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
 // measurable_feedback/experimentation_preference. Do not relabel it
 // WRONG_PRODUCT_CONSTRUCT or OVERLAPS_ANOTHER_DIMENSION; it is neither.
 //
 // ITS STATED EXCLUSION REASON NO LONGER HOLDS. It was excluded solely for ~4% generator
 // coverage, below the ELIGIBILITY_COVERAGE_FLOOR_POLICY floor declared below. That 4%
 // was an artifact of the positional sampling bias fixed in the final preflight: with
 // `DIMENSION_IDS.filter(...).slice(0, 3)`, integration_preference sat at position 12 and
 // was almost never reached. Under unbiased seeded sampling its measured coverage is
 // 0.2933 (artifacts/iteration_readiness/eligibility_coverage_sensitivity.json), well
 // above the 0.10 floor, and it passes every non-coverage monotonicity criterion.
 //
 // It is nonetheless left maeEligible:false here. Adding a dimension to
 // AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 changes the primary metric's scope, which is a
 // metric-contract change requiring the same review as changing the metric itself
 // (AGENTS.md) -- not something a preflight or a decoder experiment may do incidentally.
 // Promoting it is recorded as the highest-value next experiment for workstream 1 in
 // config/research-portfolio.json.
 {id:"integration_preference",classification:"CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE",maeEligible:false,reason:"conceptually ordered, non-overlapping bipolar construct. Its original exclusion (about 4% generator coverage, below the declared 10% floor) was an artifact of positional sampling bias; measured coverage under unbiased sampling is 0.2933. Promotion to the eligible set is a pending metric-contract review, deliberately not applied in the preflight."},
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
