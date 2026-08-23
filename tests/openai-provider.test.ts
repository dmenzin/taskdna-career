// The OpenAI provider is a second runtime arm, not a replacement for the first. These tests pin
// the properties that keep the two arms scientifically separable, and the ones that keep a
// reasoning model from silently corrupting an arm.
//
// Nothing here contacts the network: a fake client stands in for the SDK so the guarantees are
// tested without spending budget or requiring a credential.
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cacheKeyFor,
  hashJson,
  InstrumentedRunner,
  providerCacheDir,
  type ModelProvider,
  type ModelRequest,
  type PromptSpec,
} from "@/agent/runtime";
import {
  createOpenAiProvider,
  DEFAULT_OPENAI_MODEL,
  hasOpenAiCredentials,
  isQuotaError,
  OpenAiQuotaError,
  OpenAiRefusalError,
  OpenAiTruncationError,
  probeOpenAiReachability,
  OPENAI_PROVIDER_VERSION,
} from "@/agent/openaiProvider";
import { estimateCostUsd, MODEL_PRICING, worstCaseCostUsd } from "@/agent/budget";

const PROMPT: PromptSpec = {
  id: "test-prompt",
  version: "v1",
  hypothesis: "test only",
  render: (input) => `interpret: ${String(input.text ?? "")}`,
};

const SCHEMA = {
  type: "object",
  properties: { work: { type: "string" } },
  required: ["work"],
  additionalProperties: false,
} as const;

const request = (text: string): ModelRequest => ({
  prompt: PROMPT,
  input: { text },
  decoding: { temperature: 0, maxOutputTokens: 512 },
});

/** Minimal stand-in for the Responses API surface the provider actually uses. */
function fakeClient(response: Record<string, unknown>, capture?: (body: Record<string, unknown>) => void) {
  return {
    responses: {
      create: async (body: Record<string, unknown>) => {
        capture?.(body);
        return response;
      },
    },
  } as never;
}

const completed = (text: string, extra: Record<string, unknown> = {}) => ({
  model: "gpt-5.6-sol-2026-07-09",
  status: "completed",
  output_text: text,
  output: [{ type: "message", content: [{ type: "output_text", text }] }],
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 20 },
  },
  ...extra,
});

describe("secret hygiene", () => {
  it("establishes credential presence without exposing a value", () => {
    expect(typeof hasOpenAiCredentials()).toBe("boolean");
  });

  it("keeps the credential out of the call record and the cache file", async () => {
    // A sentinel that would be unmistakable if it ever leaked into telemetry or an artifact.
    const sentinel = "sk-test-SENTINEL-must-never-appear";
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = sentinel;
    try {
      const provider = createOpenAiProvider({ client: fakeClient(completed('{"work":"x"}')), outputSchema: SCHEMA });
      const cachePath = join(mkdtempSync(join(tmpdir(), "openai-secret-")), "cache.json");
      const runner = new InstrumentedRunner(provider, { cachePath });
      const { record } = await runner.run(request("a"));
      expect(JSON.stringify(record)).not.toContain(sentinel);
      expect(readFileSync(cachePath, "utf8")).not.toContain(sentinel);
      expect(JSON.stringify(runner.telemetry())).not.toContain(sentinel);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});

describe("provider separation keeps the two arms from blending", () => {
  it("gives the same prompt and input different cache keys under different providers", () => {
    const openai = createOpenAiProvider({ client: fakeClient(completed("{}")) });
    const pretendAnthropic: ModelProvider = {
      name: "anthropic",
      model: "claude-opus-5",
      async complete() {
        return { text: "{}", usage: { inputTokens: null, outputTokens: null, costUsd: null, costIsEstimate: false } };
      },
    };
    expect(cacheKeyFor(openai, request("same"))).not.toBe(cacheKeyFor(pretendAnthropic, request("same")));
  });

  it("refuses to serve an Anthropic-generated entry as an OpenAI cache hit", async () => {
    // The strong form of the guarantee: even when the two arms are pointed at the SAME cache
    // file, a key computed for one provider cannot be read by the other. Namespaced directories
    // are defence in depth; this is the property that makes contamination impossible.
    const cachePath = join(mkdtempSync(join(tmpdir(), "openai-crossarm-")), "shared-cache.json");
    const anthropicLike: ModelProvider = {
      name: "anthropic",
      model: "claude-opus-5",
      async complete() {
        return {
          text: '{"work":"CLAUDE_GENERATED"}',
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, costIsEstimate: true },
        };
      },
    };
    const first = new InstrumentedRunner(anthropicLike, { cachePath });
    await first.run(request("shared input"));
    expect(readFileSync(cachePath, "utf8")).toContain("CLAUDE_GENERATED");

    const openai = createOpenAiProvider({ client: fakeClient(completed('{"work":"OPENAI_GENERATED"}')), outputSchema: SCHEMA });
    const second = new InstrumentedRunner(openai, { cachePath });
    const { text, record } = await second.run(request("shared input"));
    expect(record.cacheHit).toBe(false);
    expect(text).toContain("OPENAI_GENERATED");
    expect(text).not.toContain("CLAUDE_GENERATED");
  });

  it("puts each provider's caches in its own directory", () => {
    expect(providerCacheDir("openai")).not.toBe(providerCacheDir("anthropic"));
    expect(providerCacheDir("openai")).toContain("openai");
  });

  it("does not read a foreign cache file that happens to sit in the namespace", async () => {
    // Guards the failure where a file is copied or renamed into place: the entry is present but
    // its key belongs to another configuration, so it must miss rather than hit.
    const dir = mkdtempSync(join(tmpdir(), "openai-foreign-"));
    const cachePath = join(dir, "cache.json");
    writeFileSync(cachePath, JSON.stringify({ "not-a-real-key": { text: "SMUGGLED", usage: {} } }));
    const provider = createOpenAiProvider({ client: fakeClient(completed('{"work":"fresh"}')), outputSchema: SCHEMA });
    const { text } = await new InstrumentedRunner(provider, { cachePath }).run(request("x"));
    expect(text).not.toContain("SMUGGLED");
  });
});

describe("reasoning effort is a behaviour-changing input", () => {
  it("changes the cache key, so a rerun at a new depth cannot reuse the old depth's results", () => {
    const low = createOpenAiProvider({ client: fakeClient(completed("{}")), effort: "low" });
    const high = createOpenAiProvider({ client: fakeClient(completed("{}")), effort: "high" });
    expect(cacheKeyFor(low, request("same"))).not.toBe(cacheKeyFor(high, request("same")));
  });

  it("changes the cache key when the output allowance changes", () => {
    const small = createOpenAiProvider({ client: fakeClient(completed("{}")), maxOutputTokens: 600 });
    const large = createOpenAiProvider({ client: fakeClient(completed("{}")), maxOutputTokens: 4000 });
    expect(cacheKeyFor(small, request("same"))).not.toBe(cacheKeyFor(large, request("same")));
  });

  it("changes the cache key when the constraining schema changes", () => {
    const a = createOpenAiProvider({ client: fakeClient(completed("{}")), outputSchema: SCHEMA });
    const b = createOpenAiProvider({
      client: fakeClient(completed("{}")),
      outputSchema: { ...SCHEMA, properties: { work: { type: "string" }, extra: { type: "string" } } } as never,
    });
    expect(cacheKeyFor(a, request("same"))).not.toBe(cacheKeyFor(b, request("same")));
  });

  it("defaults to the setting the comparable Anthropic arm used, not to a deeper one", () => {
    // The first cross-provider comparison must vary the provider ALONE. A default of `high`
    // would confound provider with reasoning depth in every number the arm produces.
    let sent: Record<string, unknown> = {};
    const provider = createOpenAiProvider({
      client: fakeClient(completed("{}"), (body) => { sent = body; }),
    });
    return provider.complete(request("x")).then(() => {
      expect((sent.reasoning as { effort: string }).effort).toBe("low");
    });
  });
});

describe("the request the provider actually sends", () => {
  it("uses schema-constrained structured output in strict mode", async () => {
    let sent: Record<string, unknown> = {};
    const provider = createOpenAiProvider({
      client: fakeClient(completed('{"work":"x"}'), (body) => { sent = body; }),
      outputSchema: SCHEMA,
      schemaName: "work_output",
    });
    await provider.complete(request("x"));
    const format = (sent.text as { format: Record<string, unknown> }).format;
    expect(format.type).toBe("json_schema");
    expect(format.strict).toBe(true);
    expect(format.name).toBe("work_output");
    expect(format.schema).toEqual(SCHEMA);
  });

  it("does not forward temperature or top_p, which this model family rejects", async () => {
    let sent: Record<string, unknown> = {};
    const provider = createOpenAiProvider({ client: fakeClient(completed("{}"), (body) => { sent = body; }) });
    await provider.complete(request("x"));
    expect(sent).not.toHaveProperty("temperature");
    expect(sent).not.toHaveProperty("top_p");
  });

  it("keeps the requested decoding parameters on the record even though they are not sent", async () => {
    const provider = createOpenAiProvider({ client: fakeClient(completed("{}")) });
    const { record } = await new InstrumentedRunner(provider).run(request("x"));
    expect(record.decoding.temperature).toBe(0);
  });
});

describe("provenance recorded for every call", () => {
  it("records the resolved model alongside the requested one", async () => {
    const provider = createOpenAiProvider({ client: fakeClient(completed('{"work":"x"}')), outputSchema: SCHEMA, schemaVersion: "work.v1" });
    const { record } = await new InstrumentedRunner(provider, { experimentId: "exp-1" }).run(request("x"));
    expect(record.provider).toBe("openai");
    expect(record.model).toBe(DEFAULT_OPENAI_MODEL);
    // The requested identifier is an alias; the resolved one is what makes the call auditable.
    expect(record.providerMetadata?.resolvedModel).toBe("gpt-5.6-sol-2026-07-09");
    expect(record.providerMetadata?.reasoning).toBe("low");
    expect(record.providerMetadata?.providerVersion).toBe(OPENAI_PROVIDER_VERSION);
    expect(record.experimentId).toBe("exp-1");
    expect(record.schemaVersion).toBe("work.v1");
    expect(record.schemaHash).toBe(hashJson(SCHEMA));
    expect(record.promptHash).toHaveLength(64);
    expect(record.inputHash).toHaveLength(64);
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("records reasoning tokens separately, without double-counting them in cost", async () => {
    const provider = createOpenAiProvider({ client: fakeClient(completed('{"work":"x"}')) });
    const { record } = await new InstrumentedRunner(provider).run(request("x"));
    expect(record.usage.reasoningTokens).toBe(20);
    expect(record.usage.outputTokens).toBe(50);
    // Reasoning tokens are billed as output tokens and are already inside output_tokens, so the
    // cost must equal a plain 100-in/50-out call and not 100-in/70-out.
    const expected = estimateCostUsd(DEFAULT_OPENAI_MODEL, { inputTokens: 100, outputTokens: 50 }).costUsd;
    expect(record.usage.costUsd).toBeCloseTo(expected, 10);
  });

  it("prices cached input at the cache-read rate rather than the fresh rate", async () => {
    const provider = createOpenAiProvider({
      client: fakeClient(
        completed('{"work":"x"}', {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            input_tokens_details: { cached_tokens: 80, cache_write_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        }),
      ),
    });
    const { record } = await new InstrumentedRunner(provider).run(request("x"));
    expect(record.usage.cachedInputTokens).toBe(80);
    const expected = estimateCostUsd(DEFAULT_OPENAI_MODEL, { inputTokens: 20, outputTokens: 50, cacheReadTokens: 80 }).costUsd;
    expect(record.usage.costUsd).toBeCloseTo(expected, 10);
    expect(record.usage.costUsd!).toBeLessThan(estimateCostUsd(DEFAULT_OPENAI_MODEL, { inputTokens: 100, outputTokens: 50 }).costUsd);
  });
});

describe("failures that must not become silent empty interpretations", () => {
  it("raises a truncation error instead of returning a partial answer", async () => {
    // On a reasoning model this is the dangerous case: reasoning eats the output allowance and
    // the visible answer never arrives. Returning "" would be scored as an empty blueprint.
    const provider = createOpenAiProvider({
      client: fakeClient({
        model: "gpt-5.6-sol-2026-07-09",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "",
        output: [],
        usage: {
          input_tokens: 100,
          output_tokens: 600,
          input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 600 },
        },
      }),
      maxOutputTokens: 600,
      outputSchema: SCHEMA,
    });
    await expect(provider.complete(request("x"))).rejects.toThrow(OpenAiTruncationError);
    await expect(provider.complete(request("x"))).rejects.toThrow(/max_output_tokens/);
  });

  it("raises a refusal error rather than reporting a successful empty result", async () => {
    const provider = createOpenAiProvider({
      client: fakeClient({
        model: "gpt-5.6-sol-2026-07-09",
        status: "completed",
        output_text: "",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "I cannot help with that" }] }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      }),
      outputSchema: SCHEMA,
    });
    await expect(provider.complete(request("x"))).rejects.toThrow(OpenAiRefusalError);
  });

  it("counts truncations in telemetry when the runner tolerates them as abstentions", async () => {
    const provider = createOpenAiProvider({
      client: fakeClient(completed('{"work":"x"}', { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } })),
      maxOutputTokens: 64,
    });
    const runner = new InstrumentedRunner(provider, {
      onError: () => ({ text: "{}", usage: { inputTokens: null, outputTokens: null, costUsd: 0, costIsEstimate: true } }),
    });
    await runner.run(request("x"));
    expect(runner.errors).toHaveLength(1);
    expect(runner.telemetry().errors).toBe(1);
  });
});

describe("an unpayable account must stop an arm, not fill it with empty results", () => {
  const quota429 = Object.assign(new Error("429 insufficient_quota"), { status: 429, code: "insufficient_quota" });

  it("recognises an unpayable 429 and not a transient one", () => {
    expect(isQuotaError(quota429)).toBe(true);
    expect(isQuotaError(Object.assign(new Error("429"), { status: 429, code: "rate_limit_exceeded" }))).toBe(false);
    expect(isQuotaError(Object.assign(new Error("500"), { status: 500 }))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it("re-types the SDK error so a tolerate-and-continue hook cannot swallow it", async () => {
    const provider = createOpenAiProvider({
      client: { responses: { create: async () => { throw quota429; } } } as never,
      outputSchema: SCHEMA,
    });
    await expect(provider.complete(request("x"))).rejects.toThrow(OpenAiQuotaError);
  });

  it("reports the blocker by name rather than as a transport failure", async () => {
    const verdict = await probeOpenAiReachability({
      client: { responses: { create: async () => { throw quota429; } } } as never,
    });
    expect(verdict.reachable).toBe(false);
    expect(verdict.reachable === false && verdict.reason).toBe("INSUFFICIENT_QUOTA");
  });

  it("distinguishes an unavailable model from an unpayable account", async () => {
    const verdict = await probeOpenAiReachability({
      client: { responses: { create: async () => { throw Object.assign(new Error("404"), { status: 404 }); } } } as never,
    });
    expect(verdict.reachable === false && verdict.reason).toBe("MODEL_UNAVAILABLE");
  });

  it("reports the served model when the provider is reachable", async () => {
    const verdict = await probeOpenAiReachability({ client: fakeClient(completed("ok")) });
    expect(verdict.reachable).toBe(true);
    expect(verdict.reachable === true && verdict.resolvedModel).toBe("gpt-5.6-sol-2026-07-09");
  });

  it("writes no cache entry and no ledger entry for a failed call", async () => {
    // The property that made the failed calibration run harmless: a call that never returned
    // must not be billed, and must not be remembered as a result.
    const dir = mkdtempSync(join(tmpdir(), "openai-quota-"));
    const cachePath = join(dir, "cache.json");
    const provider = createOpenAiProvider({
      client: { responses: { create: async () => { throw quota429; } } } as never,
    });
    const runner = new InstrumentedRunner(provider, { cachePath });
    await expect(runner.run(request("x"))).rejects.toThrow(OpenAiQuotaError);
    expect(runner.records).toHaveLength(0);
    expect(existsSync(cachePath)).toBe(false);
  });
});

describe("OpenAI pricing is configured, not guessed", () => {
  it("prices the default model from the table rather than the unknown-model fallback", () => {
    expect(MODEL_PRICING).toHaveProperty(DEFAULT_OPENAI_MODEL);
    expect(estimateCostUsd(DEFAULT_OPENAI_MODEL, { inputTokens: 1, outputTokens: 1 }).pricingWasUnknown).toBe(false);
  });

  it("uses the pre-promotion rate, so a lapsing discount cannot push spend past the cap", () => {
    // The promotional rate at the time of writing is $4/$20; the table deliberately holds the
    // standard $5/$30 so a cap computed from it stays valid if the promotion ends mid-run.
    expect(MODEL_PRICING[DEFAULT_OPENAI_MODEL].inputPerMTok).toBeGreaterThanOrEqual(4);
    expect(MODEL_PRICING[DEFAULT_OPENAI_MODEL].outputPerMTok).toBeGreaterThanOrEqual(20);
  });

  it("charges an unknown model at least as much as any known one", () => {
    const unknown = estimateCostUsd("some-unreleased-model", { inputTokens: 1000, outputTokens: 1000 });
    expect(unknown.pricingWasUnknown).toBe(true);
    for (const model of Object.keys(MODEL_PRICING)) {
      expect(unknown.costUsd).toBeGreaterThanOrEqual(estimateCostUsd(model, { inputTokens: 1000, outputTokens: 1000 }).costUsd - 1e-12);
    }
  });

  it("reserves the full output allowance, which reasoning tokens make a realistic case", () => {
    const small = worstCaseCostUsd(DEFAULT_OPENAI_MODEL, "prompt text", 600);
    const large = worstCaseCostUsd(DEFAULT_OPENAI_MODEL, "prompt text", 6000);
    expect(large).toBeGreaterThan(small * 9);
  });
});
