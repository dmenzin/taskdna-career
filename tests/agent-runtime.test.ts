// Runtime boundary invariants. Every one of these encodes a failure that actually happened
// while building the agent arm.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstrumentedRunner, cacheKeyFor, type ModelProvider, type ModelRequest, type ModelUsage } from "@/agent/runtime";
import { RuntimeBudgetExceededError, RuntimeBudgetLedger } from "@/agent/budget";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "taskdna-runtime-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const usage: ModelUsage = { inputTokens: 10, outputTokens: 5, costUsd: 0.001, costIsEstimate: true };

function countingProvider(behaviour: (calls: number) => { text: string } | Error = () => ({ text: "ok" })) {
  let calls = 0;
  const provider: ModelProvider = {
    name: "test",
    model: "test-model",
    async complete() {
      calls += 1;
      const outcome = behaviour(calls);
      if (outcome instanceof Error) throw outcome;
      return { text: outcome.text, usage };
    },
  };
  return { provider, calls: () => calls };
}

const prompt = { id: "p", version: "v1", hypothesis: "test", render: (i: Record<string, unknown>) => String(i.text ?? "") };
const request = (text: string): ModelRequest => ({ prompt, input: { text }, decoding: { temperature: 0, maxOutputTokens: 64 } });

describe("cache key", () => {
  it("changes when the prompt VERSION changes", () => {
    const provider = countingProvider().provider;
    const a = cacheKeyFor(provider, request("x"));
    const b = cacheKeyFor(provider, { ...request("x"), prompt: { ...prompt, version: "v2" } });
    // A cached result must never outlive the prompt that produced it, or an experiment silently
    // reports the previous prompt's numbers.
    expect(a).not.toBe(b);
  });

  it("changes when decoding parameters change", () => {
    const provider = countingProvider().provider;
    const a = cacheKeyFor(provider, request("x"));
    const b = cacheKeyFor(provider, { ...request("x"), decoding: { temperature: 0, maxOutputTokens: 128 } });
    expect(a).not.toBe(b);
  });

  it("is stable under key ordering in the input", () => {
    const provider = countingProvider().provider;
    const one: ModelRequest = { prompt, input: { a: 1, b: 2 }, decoding: { temperature: 0, maxOutputTokens: 64 } };
    const two: ModelRequest = { prompt, input: { b: 2, a: 1 }, decoding: { temperature: 0, maxOutputTokens: 64 } };
    expect(cacheKeyFor(provider, one)).toBe(cacheKeyFor(provider, two));
  });
});

describe("caching", () => {
  it("serves a repeat call without touching the provider", async () => {
    const { provider, calls } = countingProvider();
    const runner = new InstrumentedRunner(provider);
    await runner.run(request("same"));
    const second = await runner.run(request("same"));
    expect(calls()).toBe(1);
    expect(second.record.cacheHit).toBe(true);
  });

  it("does NOT serve a different input from cache", async () => {
    const { provider, calls } = countingProvider((n) => ({ text: `answer-${n}` }));
    const runner = new InstrumentedRunner(provider);
    const a = await runner.run(request("one"));
    const b = await runner.run(request("two"));
    expect(calls()).toBe(2);
    // A cache that returns the first answer for every question would make every downstream
    // result identical and meaningless while looking like a large cost saving.
    expect(a.text).not.toBe(b.text);
  });

  it("survives a process restart via the disk cache", async () => {
    const cachePath = join(dir, "nested", "cache.json");
    const first = countingProvider();
    await new InstrumentedRunner(first.provider, { cachePath }).run(request("persist"));
    expect(first.calls()).toBe(1);

    // A crash 200 calls into a 300-call run must not re-bill the completed work.
    const second = countingProvider();
    const resumed = await new InstrumentedRunner(second.provider, { cachePath }).run(request("persist"));
    expect(second.calls()).toBe(0);
    expect(resumed.record.cacheHit).toBe(true);
  });
});

describe("budget enforcement at the boundary", () => {
  it("refuses the call that would breach the cap, before contacting the provider", async () => {
    const { provider, calls } = countingProvider();
    const ledger = new RuntimeBudgetLedger(join(dir, "ledger.json"), { maxSpendUsd: 0.001, callObservabilityThreshold: 10 });
    const runner = new InstrumentedRunner(provider, { budget: ledger, projectedCostUsd: () => 1 });
    await expect(runner.run(request("expensive"))).rejects.toThrow(RuntimeBudgetExceededError);
    expect(calls()).toBe(0);
  });

  it("does not charge the budget for a cache hit", async () => {
    const { provider } = countingProvider();
    const ledger = new RuntimeBudgetLedger(join(dir, "ledger.json"), { maxSpendUsd: 10, callObservabilityThreshold: 10 });
    const runner = new InstrumentedRunner(provider, { budget: ledger, projectedCostUsd: () => 0.001 });
    await runner.run(request("same"));
    const afterFirst = ledger.calls;
    await runner.run(request("same"));
    expect(ledger.calls).toBe(afterFirst);
  });
});

describe("error handling", () => {
  it("aborts by default so a failure cannot pass as an empty result", async () => {
    const { provider } = countingProvider(() => new Error("boom"));
    await expect(new InstrumentedRunner(provider).run(request("x"))).rejects.toThrow("boom");
  });

  // A single safety refusal must not destroy a 300-call experiment — but it must be COUNTED,
  // not silently recorded as a successful empty interpretation.
  it("records a recovered failure as a counted abstention", async () => {
    const { provider } = countingProvider(() => new Error("declined"));
    const runner = new InstrumentedRunner(provider, {
      onError: () => ({ text: "{}", usage: { inputTokens: null, outputTokens: null, costUsd: 0, costIsEstimate: true } }),
    });
    const result = await runner.run(request("x"));
    expect(result.text).toBe("{}");
    expect(runner.errors).toHaveLength(1);
    expect(runner.telemetry().errors).toBe(1);
  });
});

describe("telemetry", () => {
  it("reports calls, hits, tokens and cost", async () => {
    const { provider } = countingProvider();
    const runner = new InstrumentedRunner(provider);
    await runner.run(request("a"));
    await runner.run(request("a"));
    await runner.run(request("b"));
    const telemetry = runner.telemetry();
    expect(telemetry.calls).toBe(3);
    expect(telemetry.cacheHits).toBe(1);
    expect(telemetry.costUsd).toBeGreaterThan(0);
  });

  it("carries no credential-shaped value in any record", async () => {
    const { provider } = countingProvider();
    const runner = new InstrumentedRunner(provider);
    await runner.run(request("x"));
    expect(JSON.stringify(runner.records)).not.toMatch(/sk-ant-|api[_-]?key|authorization/i);
  });
});
