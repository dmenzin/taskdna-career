import type { DimensionId } from "@/domain/types";
export type PreferenceDimensionClass = "VALID_BIPOLAR_CONTINUOUS"|"VALID_WITH_REDEFINITION"|"BETTER_AS_TWO_INDEPENDENT_PREFERENCES"|"OVERLAPS_ANOTHER_DIMENSION"|"NOT_CURRENTLY_OBSERVABLE"|"WRONG_PRODUCT_CONSTRUCT"|"INSUFFICIENT_EVIDENCE"|"CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE";
export interface PreferenceDimensionDecision { id:DimensionId; classification:PreferenceDimensionClass; maeEligible:boolean; reason:string }
export const PREFERENCE_DIMENSION_DECISIONS:PreferenceDimensionDecision[]=[
 {id:"problem_structure",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"boundedness and ambiguity are compound; interval semantics not yet defensible"},
 {id:"measurable_feedback",classification:"VALID_BIPOLAR_CONTINUOUS",maeEligible:true,reason:"ordered preference for shorter/more observable versus longer/uncertain feedback"},
 {id:"investigation_orientation",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"investigation and coordination/administration are not opposites"},
 {id:"evidence_density",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"raw evidence and narrative/administrative information can coexist"},
 {id:"experimentation_preference",classification:"VALID_BIPOLAR_CONTINUOUS",maeEligible:true,reason:"ordered preference for experiment-driven versus established-procedure work"},
 {id:"scope_preference",classification:"OVERLAPS_ANOTHER_DIMENSION",maeEligible:false,reason:"duplicates problem_structure and combines breadth with ambiguity"},
 {id:"software_as_tool",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"software-mediated and hands-on work are not exhaustive opposites"},
 {id:"reasoning_style",classification:"OVERLAPS_ANOTHER_DIMENSION",maeEligible:false,reason:"duplicates causal reasoning and rules/compliance is independently desirable"},
 {id:"creation_style",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"ordinal emphasis is plausible but equal interval distance is unproven"},
 {id:"real_system_grounding",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"physical systems, users, and abstraction are multiple constructs"},
 {id:"closure_preference",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"low pole is pejorative and not neutral exploration"},
 {id:"causal_reasoning",classification:"OVERLAPS_ANOTHER_DIMENSION",maeEligible:false,reason:"overlaps investigation and reasoning_style"},
 // NOTE: integration_preference is a bipolar-ordered, non-overlapping construct like
 // measurable_feedback/experimentation_preference. It is excluded from MAE eligibility
 // SOLELY because measured generator coverage (~4%, see
 // artifacts/iteration_readiness/generator_monotonicity.json) is below the
 // ELIGIBILITY_COVERAGE_FLOOR_POLICY floor declared below. That floor is a policy
 // parameter, not a scientific fact about the construct -- see
 // docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md and `pnpm eval:eligibility-sensitivity` for
 // the sensitivity table showing which dimensions' eligibility would flip at other
 // plausible floors. Do not relabel this WRONG_PRODUCT_CONSTRUCT or
 // OVERLAPS_ANOTHER_DIMENSION; it is neither.
 {id:"integration_preference",classification:"CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE",maeEligible:false,reason:"conceptually ordered, non-overlapping bipolar construct, but generator coverage is only about 4%, below the declared 10% eligibility-floor POLICY parameter (see ELIGIBILITY_COVERAGE_FLOOR_POLICY)"},
 {id:"customer_interaction_preference",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"customer contact and internal technical work may both be liked"},
 {id:"coordination_preference",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"orchestration and solo investigation may both be liked"},
 {id:"theory_vs_application",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"theory and application are not exclusive and scale is ordinal"},
 {id:"repetition_tolerance",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"tolerance for repetition is not inverse desire for novelty"},
];
export const AUTONOMOUS_PREFERENCE_DIMENSIONS_V1=PREFERENCE_DIMENSION_DECISIONS.filter(x=>x.maeEligible).map(x=>x.id);

/**
 * The eligibility floor below is a POLICY PARAMETER (an evaluation-design choice about
 * how much generator coverage is required before a dimension's continuous MAE is
 * trustworthy), not a scientific fact about which dimensions are construct-valid.
 * `pnpm eval:eligibility-sensitivity` reports, for plausible alternative floors, which
 * dimensions' eligibility would change SOLELY because of the threshold value. Do not
 * change this value to move a dimension in or out of eligibility for metric-performance
 * reasons; changing it is a metric-contract change requiring the same review as changing
 * AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 itself.
 */
export const ELIGIBILITY_COVERAGE_FLOOR_POLICY = {
  value: 0.10,
  unit: "fraction of subjects with generator-exposed evidence for the dimension",
  status: "POLICY_PARAMETER_NOT_SCIENTIFIC_FACT" as const,
  rationale: "Below this floor, per-dimension MAE is estimated from too few available-evidence subjects to be a stable autonomous signal; the value itself is a chosen tolerance, not derived from the construct.",
  sensitivityReport: "docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md",
  sensitivityCommand: "pnpm eval:eligibility-sensitivity",
};

/**
 * Primary preference metric. Defined over dimensions for which the observation
 * GENERATOR exposed evidence (see src/lab/evidenceAvailability.ts), independent of
 * whether the extractor recognized it. This intentionally replaces the earlier
 * "AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1", whose inclusion set depended on
 * extractor recognition (profile.evidence -> inferredTaskDimensions -> supported), which
 * let the algorithm under test influence its own denominator. That metric remains
 * registered in config/metric-registry.json as a superseded/legacy contract and is still
 * reported (as RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE) for comparison, never as primary.
 */
export const PRIMARY_PREFERENCE_DECODER_METRIC="AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1";
export const SUPERSEDED_PRIMARY_PREFERENCE_DECODER_METRIC="AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1";
