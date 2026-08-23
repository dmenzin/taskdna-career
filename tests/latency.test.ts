// Latency is now a product metric, which means it can be wrong in ways that change a decision.
// These tests pin the four ways it would most easily mislead.
import { describe, expect, it } from "vitest";
import {
  agentLatencyProfile,
  callSamples,
  criticalPath,
  latencyDistribution,
  latencyQualityTrade,
  STABLE_PERCENTILE_MINIMUM,
  type CallLatencySample,
} from "@/agent/latency";
import type { ModelCallRecord } from "@/agent/runtime";

const sample = (over: Partial<CallLatencySample> = {}): CallLatencySample => ({
  promptId: "person-blueprint", provider: "openai", model: "gpt-5.6-sol",
  resolvedModel: "gpt-5.6-sol", reasoning: "low", cacheHit: false, latencyMs: 1000,
  inputTokens: 100, outputTokens: 50, reasoningTokens: 20, ...over,
});

const dist = (n: number, ms: number) => latencyDistribution(Array.from({ length: n }, () => ms));

describe("cache hits must never dilute the latency a user experiences", () => {
  it("computes agent distributions over fresh calls only", () => {
    // The defect this exists to prevent: the committed Claude artifact reports p50LatencyMs of 0
    // because every call was a cache hit. A cache-warm rerun would otherwise "prove" that a
    // 15-second architecture is instant.
    const profile = agentLatencyProfile([
      sample({ latencyMs: 15000 }),
      ...Array.from({ length: 50 }, () => sample({ latencyMs: 0, cacheHit: true })),
    ]);
    expect(profile.freshByAgent["person-blueprint"]!.p50Ms).toBe(15000);
    expect(profile.freshCalls).toBe(1);
    expect(profile.cachedCalls).toBe(50);
  });

  it("keeps the cache-hit population reportable in its own right", () => {
    const profile = agentLatencyProfile([sample({ latencyMs: 9000 }), sample({ latencyMs: 1, cacheHit: true })]);
    expect(profile.cacheHit.n).toBe(1);
    expect(profile.cacheHit.p50Ms).toBe(1);
  });

  it("separates the agents rather than pooling them", () => {
    const profile = agentLatencyProfile([
      sample({ promptId: "experience-agent", latencyMs: 12000 }),
      sample({ promptId: "direction-agent", latencyMs: 4000 }),
    ]);
    expect(profile.freshByAgent["experience-agent"]!.p50Ms).toBe(12000);
    expect(profile.freshByAgent["direction-agent"]!.p50Ms).toBe(4000);
  });
});

describe("small-sample percentiles are labelled, not dressed up", () => {
  it("flags p90/p95 as unstable below the declared minimum", () => {
    expect(dist(12, 5000).percentilesAreStable).toBe(false);
    expect(dist(STABLE_PERCENTILE_MINIMUM, 5000).percentilesAreStable).toBe(true);
  });

  it("reports p95 as the maximum when the sample is that small", () => {
    // Being explicit that this is arithmetic, not estimation: with n=12 the 95th percentile IS
    // the largest observation, and reporting it as a percentile would overstate what is known.
    const d = latencyDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 99]);
    expect(d.p95Ms).toBe(99);
    expect(d.maxMs).toBe(99);
    expect(d.percentilesAreStable).toBe(false);
  });

  it("returns zeroes rather than NaN for an empty sample", () => {
    const d = latencyDistribution([]);
    expect(d.n).toBe(0);
    expect(d.meanMs).toBe(0);
    expect(Number.isNaN(d.p50Ms)).toBe(false);
  });
});

describe("independent agents must not be summed and called user wait", () => {
  const experience = { promptId: "experience-agent", distribution: dist(12, 12000) };
  const direction = { promptId: "direction-agent", distribution: dist(12, 4000) };

  it("reports the slowest agent, not the total, when they can run concurrently", () => {
    const path = criticalPath({
      architecture: "split-full-context",
      personAgents: [experience, direction],
      agentsAreIndependent: true,
      deterministicMs: 100,
    });
    expect(path.sequentialP50Ms).toBe(16000);
    expect(path.estimatedParallelP50Ms).toBe(12000);
    expect(path.timeToFirstUsableResultP50Ms).toBe(12100);
    expect(path.sequentialUserWaitP50Ms).toBe(16100);
  });

  it("does not parallelise a dependent chain", () => {
    // A critic that reads an agent's output cannot start before it finishes.
    const path = criticalPath({
      architecture: "agent-then-critic",
      personAgents: [experience, direction],
      agentsAreIndependent: false,
      deterministicMs: 0,
    });
    expect(path.estimatedParallelP50Ms).toBe(path.sequentialP50Ms);
  });

  it("makes parallel equal sequential for a single-agent architecture", () => {
    const path = criticalPath({
      architecture: "shared", personAgents: [experience], agentsAreIndependent: true, deterministicMs: 50,
    });
    expect(path.estimatedParallelP50Ms).toBe(path.sequentialP50Ms);
    expect(path.timeToFirstUsableResultP50Ms).toBe(12050);
  });

  it("includes deterministic local work in the user wait", () => {
    // Retrieval and ranking are on the critical path even though no network is involved.
    const path = criticalPath({
      architecture: "shared", personAgents: [experience], agentsAreIndependent: true, deterministicMs: 2500,
    });
    expect(path.timeToFirstUsableResultP50Ms - path.estimatedParallelP50Ms).toBe(2500);
  });

  it("propagates instability from any contributing agent", () => {
    const path = criticalPath({
      architecture: "split", agentsAreIndependent: true, deterministicMs: 0,
      personAgents: [{ promptId: "a", distribution: dist(50, 100) }, { promptId: "b", distribution: dist(3, 100) }],
    });
    expect(path.percentilesAreStable).toBe(false);
  });
});

describe("the quality/wait trade is priced by a human, not by a formula", () => {
  it("reports an exchange rate rather than a blended score", () => {
    const trade = latencyQualityTrade(0.05, 10000, 14000);
    expect(trade.addedWaitMs).toBe(4000);
    expect(trade.qualityPerAddedSecond).toBeCloseTo(0.0125, 6);
    expect(trade).not.toHaveProperty("score");
  });

  it("identifies the case where there is no trade-off to argue about", () => {
    const trade = latencyQualityTrade(0.08, 14000, 12000);
    expect(trade.dominates).toBe(true);
    expect(trade.qualityPerAddedSecond).toBeNull();
  });

  it("does not treat a quality regression as dominant just because it is faster", () => {
    expect(latencyQualityTrade(-0.04, 14000, 9000).dominates).toBe(false);
  });
});

describe("raw call rows survive for a later Pareto frontier", () => {
  it("carries the fields a cost/latency trade-off needs, including reasoning tokens", () => {
    const record: ModelCallRecord = {
      provider: "openai", model: "gpt-5.6-sol",
      providerMetadata: { providerVersion: "openai-provider.v1", resolvedModel: "gpt-5.6-sol-2026-07-09", reasoning: "high" },
      experimentId: "exp", promptId: "experience-agent", promptVersion: "v1", promptHash: "h",
      schemaVersion: "s", schemaHash: "sh", decoding: { temperature: 0, maxOutputTokens: 1800 },
      inputHash: "i", cacheKey: "k", cacheHit: false, latencyMs: 8123,
      usage: { inputTokens: 900, outputTokens: 700, costUsd: 0.02, costIsEstimate: true, reasoningTokens: 400, cachedInputTokens: 0 },
      outputText: "{}", timestamp: new Date().toISOString(),
    };
    const [row] = callSamples([record]);
    expect(row).toMatchObject({
      promptId: "experience-agent", resolvedModel: "gpt-5.6-sol-2026-07-09",
      reasoning: "high", latencyMs: 8123, reasoningTokens: 400, cacheHit: false,
    });
  });
});
