import type { DimensionId } from "@/domain/types";
export type PreferenceDimensionClass = "VALID_BIPOLAR_CONTINUOUS"|"VALID_WITH_REDEFINITION"|"BETTER_AS_TWO_INDEPENDENT_PREFERENCES"|"OVERLAPS_ANOTHER_DIMENSION"|"NOT_CURRENTLY_OBSERVABLE"|"WRONG_PRODUCT_CONSTRUCT"|"INSUFFICIENT_EVIDENCE";
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
 {id:"integration_preference",classification:"INSUFFICIENT_EVIDENCE",maeEligible:false,reason:"conceptually ordered but generator coverage is only about 4%, below the declared 10% eligibility floor"},
 {id:"customer_interaction_preference",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"customer contact and internal technical work may both be liked"},
 {id:"coordination_preference",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"orchestration and solo investigation may both be liked"},
 {id:"theory_vs_application",classification:"VALID_WITH_REDEFINITION",maeEligible:false,reason:"theory and application are not exclusive and scale is ordinal"},
 {id:"repetition_tolerance",classification:"BETTER_AS_TWO_INDEPENDENT_PREFERENCES",maeEligible:false,reason:"tolerance for repetition is not inverse desire for novelty"},
];
export const AUTONOMOUS_PREFERENCE_DIMENSIONS_V1=PREFERENCE_DIMENSION_DECISIONS.filter(x=>x.maeEligible).map(x=>x.id);
export const PRIMARY_PREFERENCE_DECODER_METRIC="AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1";
