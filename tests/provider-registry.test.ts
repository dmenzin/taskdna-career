// The registry is what makes "provider" an experimental variable instead of a compile-time fact.
// These tests pin the properties that keep two arms from contaminating or confounding each other.
import { describe, expect, it } from "vitest";
import {
  armCachePath,
  buildProvider,
  CANONICAL_EFFORT,
  defaultModelFor,
  PROVIDER_NAMES,
  type ProviderName,
} from "@/agent/providerRegistry";
import { cacheKeyFor, type ModelRequest, type PromptSpec } from "@/agent/runtime";
import { PERSON_BLUEPRINT_SCHEMA, JOB_BLUEPRINT_SCHEMA, AGENT_ARCHITECTURE_VERSION } from "@/agent/agentArchitecture";
import { MODEL_PRICING } from "@/agent/budget";

const PROMPT: PromptSpec = { id: "p", version: "v1", hypothesis: "test only", render: () => "rendered" };
const request: ModelRequest = { prompt: PROMPT, input: { a: 1 }, decoding: { temperature: 0, maxOutputTokens: 600 } };

const personProvider = (provider: ProviderName, overrides: { effort?: string; model?: string } = {}) =>
  buildProvider({
    provider,
    model: overrides.model,
    effort: (overrides.effort ?? CANONICAL_EFFORT) as never,
    maxOutputTokens: 1200,
    outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "career_blueprint",
  });

describe("the canonical cross-provider arm varies the provider alone", () => {
  it("defaults to the effort setting the completed Anthropic arm used", () => {
    expect(CANONICAL_EFFORT).toBe("low");
  });

  it("builds both providers against the same schema", () => {
    // Comparability at the schema layer: a schema difference would make the arms incomparable no
    // matter how carefully everything else was held fixed.
    const openai = personProvider("openai");
    expect(openai.schemaVersion).toBe(AGENT_ARCHITECTURE_VERSION);
    expect(openai.schemaHash).toHaveLength(64);
    const job = buildProvider({
      provider: "openai",
      effort: CANONICAL_EFFORT,
      maxOutputTokens: 600,
      outputSchema: JOB_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "job_blueprint",
    });
    expect(job.schemaHash).not.toBe(openai.schemaHash);
  });

  it("prices every provider's default model from the table", () => {
    for (const provider of PROVIDER_NAMES) {
      expect(MODEL_PRICING).toHaveProperty(defaultModelFor(provider));
    }
  });
});

describe("cache namespacing is visible in the path, not only inside a hash", () => {
  it("separates the two providers", () => {
    const args = { model: "m", effort: "low", family: "SEMANTIC_BRIDGE", kind: "person" } as const;
    expect(armCachePath({ ...args, provider: "openai" })).not.toBe(armCachePath({ ...args, provider: "anthropic" }));
  });

  it("isolates a versioned person cache so v2 cannot overwrite v1", () => {
    const base = { provider: "openai" as const, model: "gpt-5.6-sol", effort: "low", family: "LEXICAL_TRAP", kind: "person" as const };
    expect(armCachePath(base)).toBe("artifacts/agent_runtime/openai/cache-person-lexical_trap-gpt-5.6-sol-low.json");
    expect(armCachePath({ ...base, promptVersion: "v2" })).toContain("cache-person-v2-");
    expect(armCachePath({ ...base, promptVersion: "v2" })).not.toBe(armCachePath(base));
  });

  it("separates person and job caches, so one schema cannot answer for the other", () => {
    const args = { provider: "openai", model: "m", effort: "low", family: "SEMANTIC_BRIDGE" } as const;
    expect(armCachePath({ ...args, kind: "person" })).not.toBe(armCachePath({ ...args, kind: "job" }));
  });

  it("separates families, models and effort settings", () => {
    const base = { provider: "openai", model: "gpt-5.6-sol", effort: "low", family: "SEMANTIC_BRIDGE", kind: "job" } as const;
    expect(armCachePath({ ...base, family: "LEXICAL_TRAP" })).not.toBe(armCachePath(base));
    expect(armCachePath({ ...base, model: "gpt-5.6-luna" })).not.toBe(armCachePath(base));
    expect(armCachePath({ ...base, effort: "high" })).not.toBe(armCachePath(base));
  });

  it("produces a path safe to write on any platform", () => {
    // Model identifiers contain characters that are legal in an API but not in a filename, and a
    // previous run in this repository lost a gate to exactly this class of portability defect.
    const path = armCachePath({ provider: "openai", model: "vendor/model:v1 (test)", effort: "low", family: "NATURAL", kind: "job" });
    expect(path).not.toMatch(/[:*?"<>|]/);
    expect(path.split("/").slice(1).join("/")).not.toContain(" ");
  });
});

describe("no arm can be served another arm's results", () => {
  it("gives the two providers different cache keys for identical work", () => {
    expect(cacheKeyFor(personProvider("openai"), request)).not.toBe(cacheKeyFor(personProvider("anthropic"), request));
  });

  it("gives two effort settings different cache keys on the same provider", () => {
    expect(cacheKeyFor(personProvider("openai", { effort: "low" }), request)).not.toBe(
      cacheKeyFor(personProvider("openai", { effort: "high" }), request),
    );
  });

  it("gives two models on the same provider different cache keys", () => {
    expect(cacheKeyFor(personProvider("openai", { model: "gpt-5.6-sol" }), request)).not.toBe(
      cacheKeyFor(personProvider("openai", { model: "gpt-5.6-luna" }), request),
    );
  });
});
