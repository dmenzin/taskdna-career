// Architectural readiness for selective learned/agentic components.
//
// Nothing here adds a model. These tests pin the CONTRACT so that when a future experiment
// introduces one, it cannot skip provenance, abstention, caching, or the deterministic
// fallback, and cannot open a person-by-job model loop.
import { describe, expect, it } from "vitest";
import { clearMapperCache, mapperCacheSize, mapperCacheStats, mapWork, MAPPER_CACHE_LIMIT, MAPPER_CONFIG } from "@/v3/mapper";
import {
  DEFAULT_SELECTIVE_INVOCATION_POLICY,
  interpretationScopeIsPermitted,
  learnedResultIsComplete,
  PROHIBITED_INTERPRETATION_SCOPES,
  REQUIRED_LEARNED_COMPONENT_FIELDS,
  type LearnedComponent,
  type LearnedComponentInput,
  type LearnedComponentResult,
} from "@/v3/learnedComponent";
import type { MappingCandidate } from "@/v3/types";

const taskText = "Analyze test data to identify defects or determine calibration requirements.";

/**
 * Reference implementation used only to prove the contract is satisfiable and complete. It
 * abstains rather than calling anything, and its "model" is a fixed stub.
 */
const stubReranker: LearnedComponent<string, MappingCandidate, MappingCandidate[]> = {
  boundary: "contextual_reranking",
  identity: {
    provider: "stub",
    model: "no-op-reranker",
    modelVersion: "0.0.0",
    promptVersion: "rerank-instructions.v0",
    decoding: { temperature: 0, seed: 0 },
  },
  shouldInvoke: (input) => input.candidateContext.length > 1,
  deterministicFallback: (input) => input.candidateContext,
  cacheKeyFor: (input) => `stub:${input.input}:${input.candidateContext.length}`,
  async interpret(input) {
    return {
      boundary: "contextual_reranking",
      identity: this.identity,
      outcome: { status: "ABSTAINED", reason: "stub component never calls a model" },
      deterministicFallback: this.deterministicFallback(input),
      used: "DETERMINISTIC_FALLBACK",
      provenance: { source: "stub", version: "0.0.0", inputHash: "hash-input", candidateContextHash: "hash-candidates" },
      cacheKey: this.cacheKeyFor(input),
      telemetry: { latencyMs: 0, costUsd: 0, inputTokens: null, outputTokens: null, cacheHit: false, invocations: 0 },
    };
  },
};

describe("learned-component contract", () => {
  it("enumerates every field a learned component must expose", () => {
    expect(REQUIRED_LEARNED_COMPONENT_FIELDS).toContain("deterministic fallback");
    expect(REQUIRED_LEARNED_COMPONENT_FIELDS).toContain("abstention/confidence");
    expect(REQUIRED_LEARNED_COMPONENT_FIELDS).toContain("cache key");
    expect(REQUIRED_LEARNED_COMPONENT_FIELDS.length).toBe(11);
  });

  it("a conforming component produces a complete, abstention-capable result", async () => {
    const candidates = mapWork(taskText).candidates;
    const input: LearnedComponentInput<string, MappingCandidate> = { input: taskText, candidateContext: candidates };
    const result = await stubReranker.interpret(input);
    expect(learnedResultIsComplete(result as LearnedComponentResult<unknown>)).toBe(true);
    expect(result.outcome.status).toBe("ABSTAINED");
    // Abstention must still yield a usable answer.
    expect(result.used).toBe("DETERMINISTIC_FALLBACK");
    expect(result.deterministicFallback).toEqual(candidates);
  });

  it("rejects an incomplete result that omits provenance or the fallback", () => {
    const incomplete = {
      boundary: "contextual_reranking",
      identity: stubReranker.identity,
      outcome: { status: "RESOLVED", output: [], confidence: 1 },
      used: "MODEL",
      provenance: { source: "x", version: "1", inputHash: "", candidateContextHash: "" },
      cacheKey: "",
      telemetry: { latencyMs: 1, costUsd: null, inputTokens: null, outputTokens: null, cacheHit: false, invocations: 1 },
    } as unknown as LearnedComponentResult<unknown>;
    expect(learnedResultIsComplete(incomplete)).toBe(false);
  });

  it("defaults to selective invocation rather than calling on every item", () => {
    expect(DEFAULT_SELECTIVE_INVOCATION_POLICY.maxInvocationRate).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_SELECTIVE_INVOCATION_POLICY.invokeOnlyWhen).not.toBe("ALWAYS");
    expect(DEFAULT_SELECTIVE_INVOCATION_POLICY.maxInvocationsPerExperiment).toBeGreaterThan(0);
    // A single unambiguous candidate must not trigger a call.
    expect(stubReranker.shouldInvoke({ input: taskText, candidateContext: [] })).toBe(false);
  });

  it("prohibits a person-by-job interpretation loop", () => {
    expect(PROHIBITED_INTERPRETATION_SCOPES).toContain("PERSON_JOB_PAIR");
    expect(interpretationScopeIsPermitted("PERSON_JOB_PAIR")).toBe(false);
    for (const scope of ["PERSON_EVIDENCE", "JOB_RESPONSIBILITY", "REQUIREMENT"] as const) {
      expect(interpretationScopeIsPermitted(scope)).toBe(true);
    }
  });
});

describe("mapper cache is keyed on every behaviour-changing input", () => {
  it("returns a bit-identical result on a cache hit", () => {
    clearMapperCache();
    const first = mapWork(taskText);
    expect(mapperCacheStats.misses).toBe(1);
    const second = mapWork(taskText);
    expect(mapperCacheStats.hits).toBe(1);
    expect(second).toBe(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("separates entries by work context", () => {
    clearMapperCache();
    const healthcare = mapWork("unrelated pleasantries", { domain: "healthcare" });
    const finance = mapWork("unrelated pleasantries", { domain: "finance" });
    expect(healthcare.cacheKey).not.toBe(finance.cacheKey);
    expect(mapperCacheSize()).toBe(2);
  });

  it("separates entries by reranker version", () => {
    clearMapperCache();
    const passthroughA = { version: "rerank.a", rerank: (input: { candidates: MappingCandidate[] }) => input.candidates };
    const passthroughB = { version: "rerank.b", rerank: (input: { candidates: MappingCandidate[] }) => input.candidates };
    expect(mapWork(taskText, {}, passthroughA).cacheKey).not.toBe(mapWork(taskText, {}, passthroughB).cacheKey);
    expect(mapWork(taskText, {}, passthroughA).cacheKey).not.toBe(mapWork(taskText).cacheKey);
  });

  it("includes mapper config, mapper version, and corpus hash in the key", () => {
    // The key is a hash of a stable serialization of MAPPER_CONFIG, the mapper version, the
    // reranker version, and the corpus hash, so a threshold/tokenizer/corpus change cannot
    // be served a stale entry. Config identity is asserted here so a silent edit shows up as
    // a failing test rather than as reused cache entries.
    expect(MAPPER_CONFIG).toEqual({ topK: 5, taskThreshold: 0.46, dwaThreshold: 0.25, taskMargin: 0.06, tokenizer: "lowercase-alphanumeric-stopwords.v1", contextWeight: 0.08 });
    const mapping = mapWork(taskText);
    expect(mapping.corpusHash).toMatch(/^[0-9a-f]{64}$/);
    expect(mapping.cacheKey).toMatch(/^[0-9a-f]{64}$/);
    expect(mapping.mapperVersion).toBe("taskdna.mapper.lexical.v1");
  });

  it("is bounded so a long autonomous run cannot grow it without limit", () => {
    expect(MAPPER_CACHE_LIMIT).toBeGreaterThan(0);
    expect(MAPPER_CACHE_LIMIT).toBeLessThanOrEqual(200000);
  });
});
