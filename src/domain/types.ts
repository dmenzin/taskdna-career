export type DimensionId =
  | "problem_structure"
  | "measurable_feedback"
  | "investigation_orientation"
  | "evidence_density"
  | "experimentation_preference"
  | "scope_preference"
  | "software_as_tool"
  | "reasoning_style"
  | "creation_style"
  | "real_system_grounding"
  | "closure_preference"
  | "causal_reasoning"
  | "integration_preference"
  | "customer_interaction_preference"
  | "coordination_preference"
  | "theory_vs_application"
  | "repetition_tolerance";

export type Vector = Record<DimensionId, number>;

export type SourceType =
  | "RESUME"
  | "WORK_HISTORY"
  | "PROJECT"
  | "SCENARIO_RESPONSE"
  | "EXPLICIT_PREFERENCE"
  | "EXPLICIT_DISLIKE"
  | "USER_FEEDBACK";

export type EvidenceLevel =
  | "DIRECT_PROFESSIONAL"
  | "DIRECT_ACADEMIC"
  | "DIRECT_PROJECT"
  | "ADJACENT_TRANSFERABLE"
  | "THEORETICAL"
  | "INTEREST_ONLY"
  | "NO_EVIDENCE";

export type Reaction = "LOVE" | "INTERESTING" | "NEUTRAL" | "DISLIKE";
export type ScenarioAnswer = Reaction | "BOTH" | "NEITHER";
export type ActionTier = "ATTACK_FIRST" | "CORE_APPLY" | "HIGH_FIT_STRETCH" | "FUTURE_EXEMPLAR" | "LOWER_PRIORITY";
export type Sellability = "DIRECT_SELL" | "SELL_HARDER" | "STRATEGIC_STRETCH" | "REAL_SKILL_GAP";
export type FreshnessState =
  | "VERIFIED_LIVE"
  | "REVERIFIED_LIVE"
  | "PREVIOUSLY_FOUND_NOT_RECHECKED"
  | "POSSIBLY_STALE"
  | "CONFIRMED_CLOSED";

export interface TaskDimensionDefinition {
  id: DimensionId;
  label: string;
  high: string;
  low: string;
  consumerLabel: string;
}

export interface UserEvidence {
  id: string;
  sourceType: SourceType;
  sourceReference: string;
  originalText: string;
  activity: string;
  context: string;
  tools: string[];
  problemType: string;
  outcome: string;
  demonstratedSkills: string[];
  capabilitySignals: string[];
  enjoymentSignals: string[];
  dislikeSignals: string[];
  inferredTaskDimensions: Partial<Vector>;
  recency: number;
  reliability: number;
}

export interface TaskDNADimension {
  dimensionId: DimensionId;
  value: number;
  confidence: number;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  inferenceMethod: string;
  inferenceVersion: string;
  interpretation: string;
}

export interface Capability {
  id: string;
  name: string;
  category: string;
  evidenceLevel: EvidenceLevel;
  directExperience: string[];
  adjacentExperience: string[];
  demonstratedOutcomes: string[];
  recency: number;
  recruiterLegibility: number;
  confidence: number;
  evidenceIds: string[];
}

export interface Persona {
  id: string;
  name: string;
  summary: string;
  currentField: string;
  careerText: string;
  preferenceVector: Vector;
  capabilityKeywords: string[];
  repellents: string[];
  desiredConstraints: string[];
  expectedHighFunctions: string[];
  expectedLowFunctions: string[];
}

export interface CareerFunction {
  id: string;
  name: string;
  shortName: string;
  oneSentenceTaskLoop: string;
  longerDescription: string;
  taskDnaVector: Vector;
  commonAttractors: string[];
  commonRepellents: string[];
  typicalTitles: string[];
  typicalDomains: string[];
  typicalRequirements: string[];
  commonSkillGaps: string[];
  active: boolean;
  version: string;
}

export interface JobSourceObservation {
  id: string;
  provider: string;
  externalId: string;
  companyRaw: string;
  titleRaw: string;
  locationRaw: string;
  urlRaw: string;
  descriptionRaw: string;
  observedAt: string;
}

export interface JobPosting {
  canonicalId: string;
  company: string;
  title: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "Onsite";
  compensation: string;
  seniority: "Associate" | "Mid" | "Senior" | "Staff" | "Manager";
  description: string;
  responsibilities: string[];
  requirements: string[];
  preferredRequirements: string[];
  domain: string;
  requisitionId: string;
  sourceObservationIds: string[];
  canonicalizationConfidence: number;
  freshnessState: FreshnessState;
  firstSeen: string;
  lastSeen: string;
  lastVerified: string;
}

export interface JobAnalysis {
  whatThisJobIsReallyAbout: string;
  primaryFunctionId: string;
  secondaryFunctionIds: string[];
  jobTaskDnaVector: Vector;
  strongMatchFactors: string[];
  frictionFactors: string[];
  requiredCapabilities: string[];
  hardGaps: string[];
  classificationConfidence: number;
  evidenceSnippets: string[];
}

export interface ScoreBreakdown {
  rawPredictedFit: number;
  predictedFit: number;
  confidence: number;
  confidenceAdjustedFit: number;
  capabilityAlignment: number;
  hireability: number;
  careerDirection: number;
  technicalGrowth: number;
  durability: number;
  negativeFitRisk: number;
  novelty: number;
  overall: number;
  actionTier: ActionTier;
  sellability: Sellability;
  scoringVersion: string;
  formulaInputs: {
    weights: {
      hireability: number;
      confidenceAdjustedFit: number;
      careerDirection: number;
      technicalGrowth: number;
      durability: number;
    };
    confidenceAdjustedFitPenalty: number;
  };
}

export interface ScoredJob {
  job: JobPosting;
  analysis: JobAnalysis;
  score: ScoreBreakdown;
  decisionTrace: string[];
  noveltyExplanation: string;
}

export interface UserProfile {
  persona: Persona;
  evidence: UserEvidence[];
  taskDna: TaskDNADimension[];
  capabilities: Capability[];
  contradictions: string[];
  confidence: number;
}

export interface FeedbackEvent {
  jobId: string;
  reaction: Reaction;
  reasonTags: string[];
}

export interface ProfileSnapshot {
  profileId: string;
  taskDna: Record<DimensionId, { value: number; confidence: number }>;
  capabilityIds: string[];
}

export interface FeedbackResult {
  updatedProfile: UserProfile;
  beforeProfileSnapshot: ProfileSnapshot;
  feedbackEvent: FeedbackEvent;
  afterProfileSnapshot: ProfileSnapshot;
  changedDimensions: { id: DimensionId; before: number; after: number }[];
  explanation: string;
}

export interface Scenario {
  id: string;
  title: string;
  prompt: string;
  targetDimensions: DimensionId[];
  positiveVector: Partial<Vector>;
  negativeVector?: Partial<Vector>;
  informationValue: number;
  clarifiesRepellents: string[];
}

export interface ScenarioResponse {
  scenarioId: string;
  answer: ScenarioAnswer;
  confidence?: number;
  freeText?: string;
}

export interface InterviewPlan {
  scenarios: Scenario[];
  earlyStopped: boolean;
  rationale: string[];
}

export interface SearchRun {
  id: string;
  queryOrLane: string;
  provider: string;
  rawCount: number;
  canonicalCount: number;
  hardFilterPassCount: number;
  semanticScreenCount: number;
  deepAnalysisCount: number;
  recommendationCount: number;
  startedAt: string;
  completedAt: string;
}
