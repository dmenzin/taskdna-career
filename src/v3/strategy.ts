// Replaceable strategy boundaries for autonomous experimentation.
//
// PURPOSE
// -------
// The 8-hour autonomous loop must be able to swap one algorithm FAMILY for another --
// rules/lexicons, lexical retrieval, embedding retrieval, cross-encoder reranking, selective
// LLM/agent reasoning, hybrids -- without rewriting unrelated code. Each interface below is a
// seam where a genuinely different family is plausible.
//
// WHAT IS DELIBERATELY *NOT* HERE
// -------------------------------
// No interface is declared for a step that has no plausible alternative implementation.
// Affine rescales, clamping, and the (behaviour side x stance) semantic rule are arithmetic
// or definitional, not strategies. Over-abstracting them would add indirection with no
// experimental payoff.
//
// HARD ARCHITECTURAL CONSTRAINT
// -----------------------------
// A learned or agentic component may interpret LANGUAGE and rerank CANDIDATES. It must never
// emit a final four-channel score. Channel scoring stays deterministic arithmetic over
// structured, versioned evidence (src/v3/fit.ts), so a nondeterministic model can never make
// a Preference/Experience/Qualification/Direction Fit number irreproducible.
import type { DimensionId, UserEvidence, Vector } from "@/domain/types";
import type {
  AspirationEvidence,
  ExperienceEvidence,
  MappingCandidate,
  PreferenceEvidence,
  QualificationEvidence,
  TaskMapping,
  V3Job,
  V3Person,
  ChannelScore,
  WorkContext,
} from "@/v3/types";

export const STRATEGY_REGISTRY_VERSION = "strategy-registry.v1";

/** Where in the pipeline a strategy sits. Used by the experiment guard to classify scope. */
export type StrategyBoundaryId =
  | "preference_evidence_extraction"
  | "preference_representation"
  | "task_candidate_retrieval"
  | "semantic_retrieval"
  | "contextual_reranking"
  | "abstention_policy"
  | "preference_fit"
  | "experience_fit"
  | "qualification_fit"
  | "direction_fit";

/** Algorithm families a boundary's implementation can belong to. */
export type StrategyFamily =
  | "RULES_LEXICON"
  | "LEXICAL_RETRIEVAL"
  | "EMBEDDING_RETRIEVAL"
  | "CROSS_ENCODER_RERANK"
  | "LLM_AGENT"
  | "HYBRID"
  | "DETERMINISTIC_ARITHMETIC";

export interface StrategyDescriptor {
  boundary: StrategyBoundaryId;
  /** Stable id of this implementation, e.g. "preference-extraction.rules.v1". */
  id: string;
  family: StrategyFamily;
  /** Bumped whenever behaviour changes; participates in cache keys. */
  version: string;
}

// ---------------------------------------------------------------------------
// Language boundaries (ambiguity-heavy; where models/agents are appropriate)
// ---------------------------------------------------------------------------

/** Turn messy career language into classified preference evidence. */
export interface PreferenceExtractionStrategy {
  descriptor: StrategyDescriptor;
  extract(input: { careerText: string; explicitPreferences?: string[]; explicitDislikes?: string[]; contradictoryStatements?: string[] }): UserEvidence[];
}

/** Turn classified preference evidence into whatever representation downstream scoring reads. */
export interface PreferenceRepresentationStrategy<TRepresentation = Vector> {
  descriptor: StrategyDescriptor;
  represent(evidence: UserEvidence[]): TRepresentation;
  /** Dimensions (or representation slots) this strategy can express at all. */
  expressibleDimensions(): readonly DimensionId[];
}

// ---------------------------------------------------------------------------
// Retrieval and reranking boundaries
// ---------------------------------------------------------------------------

/** Cheap candidate generation over canonical work. Must be fast and high-recall. */
export interface TaskCandidateRetrievalStrategy {
  descriptor: StrategyDescriptor;
  retrieve(input: { sourceText: string; context: WorkContext; topK: number }): MappingCandidate[];
}

/** Embedding/semantic retrieval, as an alternative or supplement to lexical retrieval. */
export interface SemanticRetrievalStrategy extends TaskCandidateRetrievalStrategy {
  /** Embedding model identity; participates in cache keys. */
  embeddingModel: { name: string; version: string; dimensions: number };
}

/**
 * Selective contextual reranking of already-retrieved candidates. This is the primary place a
 * cross-encoder or LLM may be invoked, and the invocation must be selective: see
 * `SelectiveInvocationPolicy`.
 */
export interface ContextualRerankingStrategy {
  descriptor: StrategyDescriptor;
  rerank(input: { sourceText: string; context: WorkContext; candidates: MappingCandidate[] }): MappingCandidate[];
}

/** When to select a Task, fall back to a DWA, or abstain. */
export interface AbstentionPolicyStrategy {
  descriptor: StrategyDescriptor;
  decide(input: { candidates: MappingCandidate[]; context: WorkContext }): Pick<TaskMapping, "level" | "selected" | "diagnosticConfidence">;
}

// ---------------------------------------------------------------------------
// Channel scoring boundaries (deterministic; never model-authored)
// ---------------------------------------------------------------------------

/**
 * Channel scorers are swappable so alternative aggregations can be compared, but every
 * implementation must be deterministic arithmetic over structured evidence. `family` is
 * constrained to DETERMINISTIC_ARITHMETIC for exactly this reason.
 */
export interface ChannelScoringStrategy<TEvidence> {
  descriptor: StrategyDescriptor & { family: "DETERMINISTIC_ARITHMETIC" };
  score(evidence: TEvidence[], job: V3Job): ChannelScore;
}

export type PreferenceFitStrategy = ChannelScoringStrategy<PreferenceEvidence>;
export type ExperienceFitStrategy = ChannelScoringStrategy<ExperienceEvidence>;
export type QualificationFitStrategy = ChannelScoringStrategy<QualificationEvidence>;
export type DirectionFitStrategy = ChannelScoringStrategy<AspirationEvidence>;

export interface StrategySet {
  preferenceExtraction: PreferenceExtractionStrategy;
  preferenceRepresentation: PreferenceRepresentationStrategy;
  taskCandidateRetrieval: TaskCandidateRetrievalStrategy;
  contextualReranking: ContextualRerankingStrategy | null;
  abstentionPolicy: AbstentionPolicyStrategy;
  preferenceFit: PreferenceFitStrategy;
  experienceFit: ExperienceFitStrategy;
  qualificationFit: QualificationFitStrategy;
  directionFit: DirectionFitStrategy;
}

/** Every boundary, its current baseline implementation, and the families worth comparing. */
export interface BoundaryRecord {
  boundary: StrategyBoundaryId;
  construct: string;
  currentImplementation: string;
  currentFamily: StrategyFamily;
  plausibleAlternativeFamilies: StrategyFamily[];
  /** Where a model/agent is architecturally permitted at this boundary, if anywhere. */
  modelAdmissibility: "LANGUAGE_INTERPRETATION" | "CANDIDATE_RERANKING" | "NOT_PERMITTED";
  evaluator: string;
}

export const STRATEGY_BOUNDARIES: BoundaryRecord[] = [
  {
    boundary: "preference_evidence_extraction",
    construct: "Which statements in messy career language express a preference, and about what work?",
    currentImplementation: "src/domain/evidence.ts + src/domain/workStructure.ts (regex evidence classes over a work-structure lexicon)",
    currentFamily: "RULES_LEXICON",
    plausibleAlternativeFamilies: ["EMBEDDING_RETRIEVAL", "CROSS_ENCODER_RERANK", "LLM_AGENT", "HYBRID"],
    modelAdmissibility: "LANGUAGE_INTERPRETATION",
    evaluator: "pnpm eval:preference (AVAILABLE_TO_RECOGNIZED_RECALL, RECOGNIZED_EVIDENCE_PREFERENCE_*)",
  },
  {
    boundary: "preference_representation",
    construct: "What structure holds a person's preferences: a 17-dimension bipolar vector, a set of Task/DWA stances, or something else?",
    currentImplementation: "17-dimension bipolar Vector (src/config/model.ts) plus V3 Task/DWA stances (src/v3/types.ts)",
    currentFamily: "RULES_LEXICON",
    plausibleAlternativeFamilies: ["EMBEDDING_RETRIEVAL", "HYBRID"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "pnpm eval:preference + src/lab/preferenceTarget.ts construct classifications",
  },
  {
    boundary: "task_candidate_retrieval",
    construct: "Given work language, which canonical O*NET Tasks/DWAs are plausible?",
    currentImplementation: "src/v3/mapper.ts (token-overlap lexical retrieval, topK=5)",
    currentFamily: "LEXICAL_RETRIEVAL",
    plausibleAlternativeFamilies: ["EMBEDDING_RETRIEVAL", "HYBRID"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "tests/v3/bridge.test.ts known-answer fixtures + tests/fixtures/mapper/adversarial-inputs.json",
  },
  {
    boundary: "semantic_retrieval",
    construct: "Same as task_candidate_retrieval, via dense representations rather than token overlap.",
    currentImplementation: "not implemented; seam is SemanticRetrievalStrategy",
    currentFamily: "EMBEDDING_RETRIEVAL",
    plausibleAlternativeFamilies: ["EMBEDDING_RETRIEVAL", "HYBRID"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "same known-answer fixtures; must be compared against the lexical baseline, never replace it unmeasured",
  },
  {
    boundary: "contextual_reranking",
    construct: "Given cheap candidates, which one does this specific text in this specific context actually denote?",
    currentImplementation: "optional CandidateReranker hook in src/v3/mapper.ts; no reranker wired by default",
    currentFamily: "RULES_LEXICON",
    plausibleAlternativeFamilies: ["CROSS_ENCODER_RERANK", "LLM_AGENT", "HYBRID"],
    modelAdmissibility: "CANDIDATE_RERANKING",
    evaluator: "known-answer fixtures + ambiguity/collision cases in tests/v3/bridge.test.ts",
  },
  {
    boundary: "abstention_policy",
    construct: "When is the evidence too weak to name any canonical work at all?",
    currentImplementation: "MAPPER_CONFIG thresholds/margin in src/v3/mapper.ts",
    currentFamily: "RULES_LEXICON",
    plausibleAlternativeFamilies: ["CROSS_ENCODER_RERANK", "HYBRID"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "abstention-rate guardrail; over-abstention is a red-team item, not a win",
  },
  {
    boundary: "preference_fit",
    construct: "Does the job contain work the person likes or dislikes?",
    currentImplementation: "preferenceFit in src/v3/fit.ts",
    currentFamily: "DETERMINISTIC_ARITHMETIC",
    plausibleAlternativeFamilies: ["DETERMINISTIC_ARITHMETIC"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "tests/v3/bridge.test.ts channel-isolation and stance-separation known answers",
  },
  {
    boundary: "experience_fit",
    construct: "Does the job contain work the person has actually performed?",
    currentImplementation: "experienceFit in src/v3/fit.ts",
    currentFamily: "DETERMINISTIC_ARITHMETIC",
    plausibleAlternativeFamilies: ["DETERMINISTIC_ARITHMETIC"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "tests/v3/bridge.test.ts source-dedup and ownership known answers",
  },
  {
    boundary: "qualification_fit",
    construct: "Does the person's structured qualification evidence meet the job's requirements?",
    currentImplementation: "qualificationFit + DEFAULT_ALIASES in src/v3/fit.ts",
    currentFamily: "DETERMINISTIC_ARITHMETIC",
    plausibleAlternativeFamilies: ["DETERMINISTIC_ARITHMETIC", "HYBRID"],
    modelAdmissibility: "LANGUAGE_INTERPRETATION",
    evaluator: "tests/v3/bridge.test.ts alias/collision/hard-gap known answers",
  },
  {
    boundary: "direction_fit",
    construct: "Does the job contain work the person explicitly wants to do next?",
    currentImplementation: "directionFit in src/v3/fit.ts",
    currentFamily: "DETERMINISTIC_ARITHMETIC",
    plausibleAlternativeFamilies: ["DETERMINISTIC_ARITHMETIC"],
    modelAdmissibility: "NOT_PERMITTED",
    evaluator: "tests/v3/bridge.test.ts aspiration-is-not-experience isolation",
  },
];

/**
 * Ambiguous qualification equivalence is a language boundary inside an otherwise
 * deterministic channel: deciding whether "BSc Computer Science" satisfies "Bachelor's in a
 * technical field" is interpretation. It is admissible for a model to produce the
 * EQUIVALENCE JUDGEMENT (as structured, cached, versioned output); the requirement arithmetic
 * that consumes it stays deterministic.
 */
export const QUALIFICATION_EQUIVALENCE_SEAM = {
  boundary: "qualification_fit" as StrategyBoundaryId,
  interfaceName: "AliasProvider (src/v3/fit.ts)",
  modelAdmissibility: "LANGUAGE_INTERPRETATION" as const,
  note: "A model may decide equivalence; it may not decide the qualification score.",
};

export function boundaryById(id: StrategyBoundaryId): BoundaryRecord {
  const record = STRATEGY_BOUNDARIES.find((entry) => entry.boundary === id);
  if (!record) throw new Error(`Unknown strategy boundary: ${id}`);
  return record;
}

/** Boundaries where a learned/agentic component is architecturally permitted. */
export function modelAdmissibleBoundaries(): BoundaryRecord[] {
  return STRATEGY_BOUNDARIES.filter((entry) => entry.modelAdmissibility !== "NOT_PERMITTED");
}

/** Every channel scorer must remain deterministic arithmetic. */
export function channelScoringIsDeterministic(): boolean {
  return STRATEGY_BOUNDARIES.filter((entry) => entry.boundary.endsWith("_fit")).every(
    (entry) => entry.currentFamily === "DETERMINISTIC_ARITHMETIC" && entry.plausibleAlternativeFamilies.every((family) => family !== "LLM_AGENT"),
  );
}

export type { V3Person };
