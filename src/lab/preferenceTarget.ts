import type { DimensionId } from "@/domain/types";

/**
 * Eligibility coverage floor is a POLICY PARAMETER, not a scientific fact.
 * Changing it is a metric-contract change and must be preregistered.
 */
export const ELIGIBILITY_GENERATOR_COVERAGE_FLOOR = 0.10;
export const ELIGIBILITY_COVERAGE_FLOOR_IS_POLICY = true;
export const ELIGIBILITY_COVERAGE_FLOOR_SENSITIVITY = [0, 0.05, 0.10, 0.20] as const;

export type PreferenceDimensionClass =
  | "VALID_BIPOLAR_CONTINUOUS"
  | "VALID_WITH_REDEFINITION"
  | "BETTER_AS_TWO_INDEPENDENT_PREFERENCES"
  | "OVERLAPS_ANOTHER_DIMENSION"
  | "NOT_CURRENTLY_OBSERVABLE"
  | "WRONG_PRODUCT_CONSTRUCT"
  | "CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE";

export type ConstructValidity =
  | "VALID_BIPOLAR_CONTINUOUS"
  | "NEEDS_REDEFINITION"
  | "NOT_OPPOSITES"
  | "OVERLAPPING"
  | "UNOBSERVABLE";

export type IntervalSemantics = "POLICY_ACCEPTED_FOR_SYNTHETIC_MAE" | "INSUFFICIENT_INTERVAL_SEMANTICS";

export type ExclusionLayer =
  | "CONSTRUCT_INVALIDITY"
  | "GENERATOR_COVERAGE"
  | "EXTRACTOR_COVERAGE"
  | "INSUFFICIENT_INTERVAL_SEMANTICS";

export interface PreferenceDimensionDecision {
  id: DimensionId;
  classification: PreferenceDimensionClass;
  constructValidity: ConstructValidity;
  intervalSemantics: IntervalSemantics;
  maeEligible: boolean;
  /** Layers that currently exclude the dimension from continuous MAE. Extractor coverage must never appear here. */
  exclusionLayers: ExclusionLayer[];
  reason: string;
}

export const PREFERENCE_DIMENSION_DECISIONS: PreferenceDimensionDecision[] = [
  {
    id: "problem_structure",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "boundedness and ambiguity are compound; interval semantics not yet defensible",
  },
  {
    id: "measurable_feedback",
    classification: "VALID_BIPOLAR_CONTINUOUS",
    constructValidity: "VALID_BIPOLAR_CONTINUOUS",
    intervalSemantics: "POLICY_ACCEPTED_FOR_SYNTHETIC_MAE",
    maeEligible: true,
    exclusionLayers: [],
    reason: "ordered preference for shorter/more observable versus longer/uncertain feedback; interval MAE is a policy acceptance, not a proven interval scale",
  },
  {
    id: "investigation_orientation",
    classification: "BETTER_AS_TWO_INDEPENDENT_PREFERENCES",
    constructValidity: "NOT_OPPOSITES",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "investigation and coordination/administration are not opposites",
  },
  {
    id: "evidence_density",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "raw evidence and narrative/administrative information can coexist",
  },
  {
    id: "experimentation_preference",
    classification: "VALID_BIPOLAR_CONTINUOUS",
    constructValidity: "VALID_BIPOLAR_CONTINUOUS",
    intervalSemantics: "POLICY_ACCEPTED_FOR_SYNTHETIC_MAE",
    maeEligible: true,
    exclusionLayers: [],
    reason: "ordered preference for experiment-driven versus established-procedure work; interval MAE is a policy acceptance, not a proven interval scale",
  },
  {
    id: "scope_preference",
    classification: "OVERLAPS_ANOTHER_DIMENSION",
    constructValidity: "OVERLAPPING",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "duplicates problem_structure and combines breadth with ambiguity",
  },
  {
    id: "software_as_tool",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "software-mediated and hands-on work are not exhaustive opposites",
  },
  {
    id: "reasoning_style",
    classification: "OVERLAPS_ANOTHER_DIMENSION",
    constructValidity: "OVERLAPPING",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "duplicates causal reasoning and rules/compliance is independently desirable",
  },
  {
    id: "creation_style",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "ordinal emphasis is plausible but equal interval distance is unproven",
  },
  {
    id: "real_system_grounding",
    classification: "BETTER_AS_TWO_INDEPENDENT_PREFERENCES",
    constructValidity: "NOT_OPPOSITES",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "physical systems, users, and abstraction are multiple constructs",
  },
  {
    id: "closure_preference",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "low pole is pejorative and not neutral exploration",
  },
  {
    id: "causal_reasoning",
    classification: "OVERLAPS_ANOTHER_DIMENSION",
    constructValidity: "OVERLAPPING",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "overlaps investigation and reasoning_style",
  },
  {
    id: "integration_preference",
    classification: "CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE",
    constructValidity: "VALID_BIPOLAR_CONTINUOUS",
    intervalSemantics: "POLICY_ACCEPTED_FOR_SYNTHETIC_MAE",
    maeEligible: false,
    exclusionLayers: ["GENERATOR_COVERAGE"],
    reason: "conceptually ordered connect-versus-silo preference; excluded only because generator-available coverage is below the declared POLICY floor of 10%, not because the construct is invalid",
  },
  {
    id: "customer_interaction_preference",
    classification: "BETTER_AS_TWO_INDEPENDENT_PREFERENCES",
    constructValidity: "NOT_OPPOSITES",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "customer contact and internal technical work may both be liked",
  },
  {
    id: "coordination_preference",
    classification: "BETTER_AS_TWO_INDEPENDENT_PREFERENCES",
    constructValidity: "NOT_OPPOSITES",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "orchestration and solo investigation may both be liked",
  },
  {
    id: "theory_vs_application",
    classification: "VALID_WITH_REDEFINITION",
    constructValidity: "NEEDS_REDEFINITION",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY", "INSUFFICIENT_INTERVAL_SEMANTICS"],
    reason: "theory and application are not exclusive and scale is ordinal",
  },
  {
    id: "repetition_tolerance",
    classification: "BETTER_AS_TWO_INDEPENDENT_PREFERENCES",
    constructValidity: "NOT_OPPOSITES",
    intervalSemantics: "INSUFFICIENT_INTERVAL_SEMANTICS",
    maeEligible: false,
    exclusionLayers: ["CONSTRUCT_INVALIDITY"],
    reason: "tolerance for repetition is not inverse desire for novelty",
  },
];

export const AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 = PREFERENCE_DIMENSION_DECISIONS.filter((item) => item.maeEligible).map((item) => item.id);

/** Dimensions that would be MAE-eligible if the coverage-floor policy were the only remaining gate. */
export const COVERAGE_GATED_CONSTRUCT_VALID_DIMENSIONS = PREFERENCE_DIMENSION_DECISIONS
  .filter((item) => item.constructValidity === "VALID_BIPOLAR_CONTINUOUS" && item.intervalSemantics === "POLICY_ACCEPTED_FOR_SYNTHETIC_MAE")
  .map((item) => item.id);

export const PRIMARY_PREFERENCE_DECODER_METRIC = "AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1";
export const LEGACY_RECOGNIZED_PREFERENCE_MACRO_METRIC = "RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE";
export const LEGACY_ALL_DIMENSION_METRIC = "LEGACY_ALL_DIMENSION_MAE";
