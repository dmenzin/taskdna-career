// User-facing latency, as a first-class product metric.
//
// WHY TOTAL EXPERIMENT RUNTIME IS THE WRONG NUMBER
// ------------------------------------------------
// "The experiment took 33 minutes" tells a product decision nothing. Almost all of that time is
// job interpretation, which is a ONE-TIME CORPUS COST amortised across every user who ever sees
// that job — no user waits for it. What a user waits for is their own person interpretation plus
// deterministic retrieval. Those are different numbers by two orders of magnitude, and reporting
// the wrong one would make every architecture look unusable.
//
// THE DEFECT THIS ALSO FIXES
// --------------------------
// The runner's existing telemetry computes p50 over ALL records, cache hits included. A cache hit
// resolves in under a millisecond, so a cache-warm rerun reports a p50 of 0 ms — the committed
// Claude artifact literally does. Any latency figure that mixes the two populations is
// meaningless, so every distribution here is computed over FRESH calls only and cache-hit
// latency is reported as its own separate population.
//
// WHAT CANNOT BE SEPARATED, AND IS NOT PRETENDED OTHERWISE
// -------------------------------------------------------
// A recorded call duration is model compute PLUS network round trip PLUS provider queueing. The
// API exposes no server-side timing breakdown, so these are reported together as
// `freshCallMs` rather than split into invented components.
import type { ModelCallRecord } from "@/agent/runtime";

export const LATENCY_VERSION = "latency.v1";

/**
 * Below this many samples, p90 and p95 are single order statistics rather than estimates of a
 * percentile, and are labelled as such wherever they are reported.
 */
export const STABLE_PERCENTILE_MINIMUM = 20;

export interface LatencyDistribution {
  n: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  maxMs: number;
  /** False when `n` is too small for p90/p95 to mean anything. */
  percentilesAreStable: boolean;
}

const EMPTY: LatencyDistribution = { n: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p95Ms: 0, maxMs: 0, percentilesAreStable: false };

export function latencyDistribution(samplesMs: number[]): LatencyDistribution {
  if (!samplesMs.length) return EMPTY;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  // Nearest-rank on the sorted sample. With n=12 the 95th percentile IS the maximum, which is
  // why `percentilesAreStable` exists rather than quietly reporting it as a percentile.
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]!;
  return {
    n: sorted.length,
    meanMs: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    p50Ms: at(0.5),
    p90Ms: at(0.9),
    p95Ms: at(0.95),
    maxMs: sorted[sorted.length - 1]!,
    percentilesAreStable: sorted.length >= STABLE_PERCENTILE_MINIMUM,
  };
}

export interface CallLatencySample {
  promptId: string;
  subjectId: string | null;
  provider: string;
  model: string;
  resolvedModel: string | null;
  reasoning: string | null;
  cacheHit: boolean;
  /** Wall-clock time of this invocation; sub-millisecond for a cache hit. */
  latencyMs: number;
  /** Duration of the call that originally produced the result; null if never recorded. */
  originalLatencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
}

/** Flatten call records into the raw per-call rows a Pareto frontier can later be built from. */
export function callSamples(records: ModelCallRecord[]): CallLatencySample[] {
  return records.map((record) => ({
    promptId: record.promptId,
    subjectId: record.subjectId,
    provider: record.provider,
    model: record.model,
    resolvedModel: record.providerMetadata?.resolvedModel ?? null,
    reasoning: record.providerMetadata?.reasoning ?? null,
    cacheHit: record.cacheHit,
    latencyMs: record.latencyMs,
    originalLatencyMs: record.originalLatencyMs,
    inputTokens: record.usage.inputTokens,
    outputTokens: record.usage.outputTokens,
    reasoningTokens: record.usage.reasoningTokens ?? null,
  }));
}

export interface AgentLatencyProfile {
  /** Model-call distributions, keyed by prompt id. The population a user actually experiences. */
  freshByAgent: Record<string, LatencyDistribution>;
  /** Agents whose figures came from replayed cache entries rather than calls made in this run. */
  replayedAgents: string[];
  /** Cache-hit distribution, kept separate so it can never dilute the fresh numbers. */
  cacheHit: LatencyDistribution;
  freshCalls: number;
  cachedCalls: number;
}

export function agentLatencyProfile(samples: CallLatencySample[]): AgentLatencyProfile {
  // Any sample with a recorded ORIGINAL duration describes a real model call, whether it was made
  // in this run or replayed from cache. Restricting to fresh calls only would drop a fully-cached
  // architecture out of the latency table entirely, which is how a cached arm silently disappears
  // from a comparison.
  const byAgent: Record<string, number[]> = {};
  const replayed = new Set<string>();
  for (const sample of samples) {
    const duration = sample.cacheHit ? sample.originalLatencyMs : sample.latencyMs;
    if (duration === null || duration === undefined) continue;
    (byAgent[sample.promptId] ??= []).push(duration);
    if (sample.cacheHit) replayed.add(sample.promptId);
  }
  const fresh = samples.filter((sample) => !sample.cacheHit);
  return {
    freshByAgent: Object.fromEntries(Object.entries(byAgent).map(([id, values]) => [id, latencyDistribution(values)])),
    // An agent contributes here only if EVERY sample for it was replayed.
    replayedAgents: [...replayed].filter((id) => !fresh.some((sample) => sample.promptId === id)),
    cacheHit: latencyDistribution(samples.filter((sample) => sample.cacheHit).map((sample) => sample.latencyMs)),
    freshCalls: fresh.length,
    cachedCalls: samples.length - fresh.length,
  };
}

/**
 * One architecture's user-facing critical path.
 *
 * `personAgents` are the model calls a user waits on. Job interpretation is deliberately absent:
 * JobBlueprints are precomputed and cached per job, so they are corpus cost, not user wait.
 * Including them would overstate the wait by the entire corpus pass.
 */
export interface CriticalPathInput {
  architecture: string;
  /**
   * Per-subject durations keyed by agent, when available. THE CORRECT INPUT for a parallel
   * estimate: the critical path for one person is the max over that person's own agent calls, and
   * only then is it aggregated across people.
   */
  perSubject?: { subjectId: string; byAgent: Record<string, number> }[];
  /** Fresh latency distribution per person-side agent, in the order a sequential run makes them. */
  personAgents: { promptId: string; distribution: LatencyDistribution }[];
  /**
   * Whether these agents are independent and could run concurrently.
   *
   * Experience and Direction read the same evidence and write different channels, so they are
   * independent by the four-channel contract. A critic or validator that consumes an agent's
   * output is NOT independent and must stay on the sequential path.
   */
  agentsAreIndependent: boolean;
  /** Deterministic local work: blueprint assembly, retrieval and ranking. Measured, not assumed. */
  deterministicMs: number;
}

export interface CriticalPath {
  architecture: string;
  agentCount: number;
  /**
   * How the parallel figure was obtained. `per-subject` pairs each person's own calls and is
   * correct. `aggregate-approximation` takes the maximum of separately-aggregated percentiles,
   * which is OPTIMISTICALLY BIASED: for independent agents, max(p50_A, p50_B) sits at or below the
   * true median of max(A_i, B_i). Reported so a biased number is never mistaken for a measured one.
   */
  parallelBasis: "per-subject" | "aggregate-approximation";
  agentsAreIndependent: boolean;
  /** Sum of agent latencies. What a naive implementation would make the user wait. */
  sequentialP50Ms: number;
  sequentialP95Ms: number;
  /**
   * Slowest single agent, when they can run concurrently. DERIVED FROM SEQUENTIAL
   * MEASUREMENTS, never observed: each call here was timed on its own, so this does not include
   * the contention a real concurrent implementation would add. It is a lower bound on parallel
   * wait and is labelled `estimated` in every artifact.
   */
  estimatedParallelP50Ms: number;
  estimatedParallelP95Ms: number;
  deterministicMs: number;
  /** Best achievable user wait: parallel agents plus deterministic work. */
  timeToFirstUsableResultP50Ms: number;
  timeToFirstUsableResultP95Ms: number;
  /** Same, if the agents are run one after another. */
  sequentialUserWaitP50Ms: number;
  sequentialUserWaitP95Ms: number;
  percentilesAreStable: boolean;
}

export function criticalPath(input: CriticalPathInput): CriticalPath {
  const p50s = input.personAgents.map((agent) => agent.distribution.p50Ms);
  const p95s = input.personAgents.map((agent) => agent.distribution.p95Ms);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const max = (values: number[]) => (values.length ? Math.max(...values) : 0);

  const sequentialP50 = sum(p50s);
  const sequentialP95 = sum(p95s);

  // Prefer per-subject pairing. Falling back to the aggregate maximum is an approximation and is
  // labelled as one rather than being silently reported as an estimate of the same quantity.
  let parallelP50: number;
  let parallelP95: number;
  let parallelBasis: "per-subject" | "aggregate-approximation";
  const agentIds = input.personAgents.map((agent) => agent.promptId);
  const paired = (input.perSubject ?? []).filter((row) => agentIds.every((id) => typeof row.byAgent[id] === "number"));
  if (input.agentsAreIndependent && paired.length > 0) {
    const perSubjectMax = paired.map((row) => Math.max(...agentIds.map((id) => row.byAgent[id]!)));
    const distribution = latencyDistribution(perSubjectMax);
    parallelP50 = distribution.p50Ms;
    parallelP95 = distribution.p95Ms;
    parallelBasis = "per-subject";
  } else if (input.agentsAreIndependent) {
    parallelP50 = max(p50s);
    parallelP95 = max(p95s);
    parallelBasis = "aggregate-approximation";
  } else {
    // Nothing to parallelise: a single agent, or a dependent chain.
    parallelP50 = sequentialP50;
    parallelP95 = sequentialP95;
    parallelBasis = "per-subject";
  }

  return {
    architecture: input.architecture,
    agentCount: input.personAgents.length,
    parallelBasis,
    agentsAreIndependent: input.agentsAreIndependent,
    sequentialP50Ms: sequentialP50,
    sequentialP95Ms: sequentialP95,
    estimatedParallelP50Ms: parallelP50,
    estimatedParallelP95Ms: parallelP95,
    deterministicMs: input.deterministicMs,
    timeToFirstUsableResultP50Ms: parallelP50 + input.deterministicMs,
    timeToFirstUsableResultP95Ms: parallelP95 + input.deterministicMs,
    sequentialUserWaitP50Ms: sequentialP50 + input.deterministicMs,
    sequentialUserWaitP95Ms: sequentialP95 + input.deterministicMs,
    percentilesAreStable: input.personAgents.every((agent) => agent.distribution.percentilesAreStable),
  };
}

/**
 * Is an accuracy gain worth the wait it costs?
 *
 * Deliberately does NOT return a single blended score — `AGENTS.md` forbids one, and for a good
 * reason here too: the exchange rate between NDCG and seconds is a product judgement, not a
 * measurement. This reports the exchange rate and lets a human price it.
 */
export interface LatencyQualityTrade {
  qualityDelta: number;
  addedWaitMs: number;
  /** NDCG points gained per additional second of user wait. Null when there is no added wait. */
  qualityPerAddedSecond: number | null;
  /** True when quality improved while user wait did not increase. No trade-off to price. */
  dominates: boolean;
}

export function latencyQualityTrade(qualityDelta: number, baselineWaitMs: number, candidateWaitMs: number): LatencyQualityTrade {
  const addedWaitMs = candidateWaitMs - baselineWaitMs;
  return {
    qualityDelta,
    addedWaitMs,
    qualityPerAddedSecond: addedWaitMs > 0 ? qualityDelta / (addedWaitMs / 1000) : null,
    dominates: qualityDelta > 0 && addedWaitMs <= 0,
  };
}
