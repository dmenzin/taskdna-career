# Product blueprint and 17D construct audit

## Upstream construct decision

The four person-side signals are independent: **Preference** (liked/disliked/tolerated work), **Experience** (performed work), **Qualification** (capability/credential evidence), and **Direction** (desired future work). Exposure is not preference; aspiration is not experience. They meet job-side Task → DWA mappings only after independent representation. Preference-vector recovery MAE is therefore a decoder-layer diagnostic, never Preference Fit or recommendation accuracy.

The observed macro MAE estimates: *the synthetic generator's continuous hidden preference value for a dimension for which the extractor received and recognized generated preference/dislike evidence*. The math matches that target. Its semantic validity is only provisional because several poles are not genuine opposites and phrase generation is sparse/templated. This target is part of the blueprint only as a proxy for preference evidence interpretation—not a full latent person profile.

## Dimension-by-dimension audit

All values use a 0–10 scale; 5 currently conflates neutral, uncertainty, and no evidence. “Linear?” asks whether equal numeric increments and MAE are defensible. Exposure is **never** legitimate preference evidence without an explicit affect statement; aspiration belongs in Direction. Current inference can recover a dimension only when its phrase hits the lexicon. Coverage/MAE/variances must be taken from the deterministic `byDimension` output, not copied into this conceptual audit.

| ID | High ↔ low / construct | Opposites, neutral, linear MAE | Observable preference/dislike semantics | Overlap / compound risk | Generator → inference validity | Classification |
|---|---|---|---|---|---|---|
| problem_structure | bounded/diagnosable ↔ open/poorly scoped | plausible ordinal; 5 ambiguous; interval equality unproven | explicit liking of bounded/open scope; dislike reverses side | overlaps scope | phrases coherent; lexical recovery partial | KEEP_WITH_REDEFINITION |
| measurable_feedback | observable ↔ long uncertain feedback | approximate opposites; ordinal better supported than interval | likes metrics/feedback; dislike means aversion to that side | closure/evidence density | coherent phrases, incomplete extraction | KEEP |
| investigation_orientation | diagnose/test ↔ document/coordinate/administer | **not true opposites**; 5 incoherent | explicit enjoyment/dislike only | compound and overlaps causal/coordination | low pole bundles three constructs; inversion risky | SPLIT |
| evidence_density | raw signals ↔ administrative information | questionable; both may coexist | prefers raw evidence vs summaries | measurable feedback | phrase direction coherent, construct partly job context | KEEP_WITH_REDEFINITION |
| experimentation_preference | experiments ↔ established playbook | reasonable ordinal contrast | enjoys experiments/routine; dislike inversion coherent | novelty/repetition | coherent and observable | KEEP |
| scope_preference | bounded subsystem ↔ broad ambiguity | compound breadth+ambiguity | explicit scope preference | problem structure | generator coherent but duplicate signal | MERGE |
| software_as_tool | software tool ↔ away from screens | poles not exhaustive opposites | explicit work-medium preference | qualification risk | recoverable preference if affect explicit | KEEP_WITH_REDEFINITION |
| reasoning_style | hypothesis/causality ↔ rules/compliance | both can be liked; not opposite | explicitly preferred reasoning activity | causal reasoning | compound phrase target | MERGE |
| creation_style | constrained creation ↔ blank-sheet invention | plausible ordinal; midpoint uncertain | explicit creation preference | problem structure | coherent phrases, partial inference | KEEP_WITH_REDEFINITION |
| real_system_grounding | observable physical/users ↔ abstract process | physical and abstract can coexist | explicit grounding preference | theory/application | compound physical+users | SPLIT |
| closure_preference | verify/close ↔ endless exploration | stylized opposites; low pole pejorative | explicit desire for closure/exploration | measurable feedback | generator semantically biased | KEEP_WITH_REDEFINITION |
| causal_reasoning | why/mechanism ↔ what/catalog | can value both; low pole pejorative | explicit causal-depth preference | reasoning/investigation | duplication dominates | MERGE |
| integration_preference | connect systems ↔ isolated/silo | approximate work-structure contrast | explicit integration preference | coordination/scope | reasonably observable | KEEP |
| customer_interaction_preference | customer-facing ↔ internal technical | **not opposites; person may like both** | independently like/dislike customer interaction | none if made unipolar | bipolar generator contradicts blueprint persona | SPLIT |
| coordination_preference | orchestration ↔ solo investigation | **not opposites; person may like both** | independent meeting/orchestration preference | investigation | bipolar generator cannot express both | SPLIT |
| theory_vs_application | applied ↔ theoretical | not exclusive; both may be valued | explicit preferred emphasis | grounding | ordinal emphasis plausible, interval unproven | KEEP_WITH_REDEFINITION |
| repetition_tolerance | routine acceptable ↔ novelty preferred | tolerance vs preference asymmetric | tolerance, dislike, novelty desire differ | experimentation | generator conflates tolerance and desire | SPLIT |

No dimension is approved as a human-validated interval scale. MAE is provisionally useful for generator recovery; directional accuracy, within-dimension rank consistency, extreme-preference recall, calibration slope, and variance retention must accompany it. The V3 bridge evaluator supplies all complementary diagnostics, and the generator-monotonicity command empirically assesses all dimensions. Continuous optimization is restricted to the two eligible dimensions documented in the V3 contract.

## Known-answer blueprint personas (preregistered expectations)

| Persona | Observable preference | Unknown | Expected ordering / representation result |
|---|---|---|---|
| enjoys technical investigation | investigation/causal high | other constructs | investigation above neutral |
| dislikes repetitive administration | repetition/administration aversion | experience | dislike must not invent positive experience |
| likes customer contact **and** deep investigation | two independent positives | coordination | current bipolar dimensions cannot express without contradiction: representation FAIL |
| bounded problems, tolerates open creation | bounded preference + tolerance | creation enjoyment | current scale conflates tolerance with pole preference: conditional |
| measurable feedback | measurable high | evidence medium | measurable above neutral |
| no stated preference | none | all dimensions | unknown, not confident neutral |
| conflicting preference statements | both directions observed | resolution | contradiction retained; lower confidence, no arbitrary overwrite |
| strong dislike only | negative evidence | positive preference | dislike recorded without manufacturing an unrelated positive |
| aspiration only | Direction | Preference/Experience | no preference or experience manufactured |
| experience only | Experience | Preference | no preference manufactured |

## Construct separation and fit boundaries

“I spent four years debugging medical devices” is Experience; “I love diagnosing why systems fail” Preference; “I want sensor algorithm performance work” Direction; “MS in bioengineering and Python” Qualification. Mixed statements must yield separately provenance-linked evidence. The V3 person builder stores the four collections independently; known-answer counterfactuals prove that exposure, aspiration, qualification, occupation, and title do not create preference or cross-channel fit changes.

Person preference evidence → person preference representation and job responsibilities → independently annotated Task/DWA representation are separate error surfaces. Preference Fit compares these representations. Decoder MAE cannot validate job mapping or fit. Experience Fit needs independent task coverage/ranking and depth labels; Qualification Fit requirement-level precision/recall, gap accuracy and ranking; Direction Fit independent desired-task alignment/ranking. Continuous MAE is inappropriate absent equivalent continuous truth.

## Alignment table

| Product construct | Internal representation | Current truth / metric | Status; autonomous optimization? | Human validation? |
|---|---|---|---|---|
| Preference evidence interpretation | v2 17D TaskDNA + evidence classes | synthetic supported truth; observed macro/micro MAE | **PROVISIONALLY VALID**; yes with guardrails | yes |
| Preference representation | bipolar 17D vector | complete synthetic latent vector; legacy MAE | **MISALIGNED** for several poles; no redesign optimization yet | yes |
| Experience representation | V3 performed-task evidence | known-answer invariants only | **PROVISIONALLY VALID** for software experiments | yes |
| Qualification representation | V3 structured skill/education/credential/capability evidence | known-answer requirement semantics | **PROVISIONALLY VALID** for software experiments | yes |
| Direction representation | V3 explicit aspiration mappings | known-answer isolation | **PROVISIONALLY VALID** for software experiments | yes |
| Task/DWA mapping | deterministic V3 Task/DWA/abstain baseline | development semantics fixtures, no independent golden truth | **PROVISIONALLY VALID** for retrieval experiments only | yes |
| Preference Fit | vector compatibility/job heuristics | no independent job-fit truth | **NOT YET VALIDATED**; no | yes |
| Experience Fit | expected independent V3 output absent | no independent truth | **NOT YET VALIDATED**; no | yes |
| Qualification Fit | expected independent V3 output absent | no independent truth | **NOT YET VALIDATED**; no | yes |
| Direction Fit | careerDirection heuristic, not verified V3 | no independent truth | **NOT YET VALIDATED**; no | yes |
| Overall recommendation | weighted score | no human/outcome truth | **NOT YET VALIDATED**; no | yes |

## Are we measuring the right thing?

A. Synthetic preference evidence interpretation: **YES, for the narrow autonomous V1 target**—observability-aware metrics match recognized evidence and both eligible dimensions pass generator monotonicity; excluded dimensions remain visible.
B. Full latent preference profile: **NO**—zero-evidence latent values and non-opposite poles invalidate a full-profile claim.
C. Preference Fit against jobs: **NO**—no independent job mapping/fit truth.
D. Experience Fit: **NO**—no verified V3 channel or labelled task-depth truth.
E. Qualification Fit: **NO**—no independent requirement/gap labels.
F. Direction Fit: **NO**—no independent aspiration-to-task alignment truth.
G. Real-world recommendation quality: **NO**—no human-labelled or outcome-based locked evidence.
