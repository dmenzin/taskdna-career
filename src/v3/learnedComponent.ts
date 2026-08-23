// Contract every future learned or agentic component must satisfy.
//
// TARGET ARCHITECTURE
// -------------------
//   messy language
//     -> cheap candidate generation            (deterministic, fast, high recall)
//     -> selective contextual interpretation   (model/agent, only where ambiguity warrants)
//     -> structured versioned evidence / Task / DWA result
//     -> deterministic downstream channel scoring
//
// Models and agents belong at ambiguity-heavy LANGUAGE boundaries and at CANDIDATE RERANKING.
// They never author a final Preference/Experience/Qualification/Direction Fit score: that
// stays deterministic arithmetic over structured evidence, so every published channel number
// is reproducible from its inputs.
//
// A person-by-job model loop is prohibited. Unique person evidence and unique job
// responsibilities are interpreted ONCE, cached by content, and their canonical results
// reused across every pairing. Cost therefore scales with distinct evidence, not with the
// product of people and jobs.
import type { StrategyBoundaryId } from "@/v3/strategy";

export const LEARNED_COMPONENT_CONTRACT_VERSION = "learned-component.v1";

/** Model/prompt identity. Every field participates in the cache key. */
export interface ModelIdentity {
  provider: string;
  model: string;
  modelVersion: string;
  /** Instruction/prompt template version, where the component uses one. */
  promptVersion: string | null;
  /** Decoding parameters that change output. Recorded so a change cannot silently reuse a cache entry. */
  decoding: { temperature: number; topP?: number; maxOutputTokens?: number; seed?: number | null };
}

export interface LearnedComponentInput<TInput, TCandidate> {
  /** The exact text or structure interpreted. Cached by content, never by person or job id. */
  input: TInput;
  /** Candidates the cheap deterministic stage produced, when the component is reranking. */
  candidateContext: TCandidate[];
}

/**
 * A learned component either returns a structured result or abstains. Abstention is a
 * first-class outcome, not an error: the deterministic fallback is then authoritative.
 */
export type LearnedOutcome<TOutput> =
  | { status: "RESOLVED"; output: TOutput; confidence: number }
  | { status: "ABSTAINED"; reason: string };

export interface LearnedComponentTelemetry {
  latencyMs: number;
  /** Estimated cost in USD, or null when the component is local and free. */
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheHit: boolean;
  invocations: number;
}

export interface LearnedComponentResult<TOutput> {
  boundary: StrategyBoundaryId;
  identity: ModelIdentity;
  outcome: LearnedOutcome<TOutput>;
  /** Result the deterministic baseline would have produced. Always populated. */
  deterministicFallback: TOutput;
  /** Which result was actually used downstream. */
  used: "MODEL" | "DETERMINISTIC_FALLBACK";
  provenance: { source: string; version: string; inputHash: string; candidateContextHash: string };
  /** Hash over every behaviour-changing input: content, candidates, model identity, prompt, decoding. */
  cacheKey: string;
  telemetry: LearnedComponentTelemetry;
}

/**
 * The interface a learned component implements. `deterministicFallback` is required, not
 * optional: a run must remain reproducible and complete when the model is unavailable,
 * abstains, or is deliberately disabled.
 */
export interface LearnedComponent<TInput, TCandidate, TOutput> {
  boundary: StrategyBoundaryId;
  identity: ModelIdentity;
  /**
   * Selective invocation gate. Returning false means the deterministic path is used with no
   * model call at all. The default posture is NOT to invoke: a component must justify each
   * call from the ambiguity actually present in its input.
   */
  shouldInvoke(input: LearnedComponentInput<TInput, TCandidate>): boolean;
  deterministicFallback(input: LearnedComponentInput<TInput, TCandidate>): TOutput;
  interpret(input: LearnedComponentInput<TInput, TCandidate>): Promise<LearnedComponentResult<TOutput>>;
  cacheKeyFor(input: LearnedComponentInput<TInput, TCandidate>): string;
}

/**
 * Budget for one experiment. The loop must stay dominated by deterministic work; a component
 * that wants to exceed these limits is proposing an architecture change, not an experiment.
 */
export interface SelectiveInvocationPolicy {
  /** Maximum share of eligible items that may reach the model. */
  maxInvocationRate: number;
  /** Hard cap on model calls for one experiment. */
  maxInvocationsPerExperiment: number;
  /** Hard cap on spend for one experiment. */
  maxCostUsdPerExperiment: number;
  /** Only invoke when the deterministic stage is genuinely uncertain. */
  invokeOnlyWhen: "AMBIGUOUS_CANDIDATES" | "LOW_CONFIDENCE" | "ABSTENTION" | "ALWAYS";
}

export const DEFAULT_SELECTIVE_INVOCATION_POLICY: SelectiveInvocationPolicy = {
  maxInvocationRate: 0.15,
  maxInvocationsPerExperiment: 2000,
  maxCostUsdPerExperiment: 5,
  invokeOnlyWhen: "AMBIGUOUS_CANDIDATES",
};

/** Interpret-once caching scope. PERSON_JOB_PAIR is prohibited. */
export type InterpretationScope = "PERSON_EVIDENCE" | "JOB_RESPONSIBILITY" | "REQUIREMENT" | "PERSON_JOB_PAIR";

export const PROHIBITED_INTERPRETATION_SCOPES: InterpretationScope[] = ["PERSON_JOB_PAIR"];

/**
 * Guard against a person-by-job model loop. Interpretation must be keyed by the content of a
 * single person statement, job responsibility, or requirement -- never by a pairing.
 */
export function interpretationScopeIsPermitted(scope: InterpretationScope): boolean {
  return !PROHIBITED_INTERPRETATION_SCOPES.includes(scope);
}

/** Fields a learned component MUST expose. Asserted by tests/hybrid-readiness.test.ts. */
export const REQUIRED_LEARNED_COMPONENT_FIELDS = [
  "model/version",
  "instruction/prompt version where applicable",
  "input",
  "candidate context",
  "structured output",
  "abstention/confidence",
  "provenance",
  "cache key",
  "latency",
  "cost",
  "deterministic fallback",
] as const;

/** Structural check that a result object carries every mandated field. */
export function learnedResultIsComplete(result: LearnedComponentResult<unknown>): boolean {
  return Boolean(
    result.identity.model &&
      result.identity.modelVersion &&
      result.identity.decoding &&
      result.boundary &&
      result.provenance.inputHash &&
      result.provenance.candidateContextHash &&
      result.cacheKey &&
      result.outcome &&
      result.deterministicFallback !== undefined &&
      result.used &&
      typeof result.telemetry.latencyMs === "number" &&
      "costUsd" in result.telemetry &&
      typeof result.telemetry.cacheHit === "boolean",
  );
}
