# V3 computational contract

## Scientific scope

V3 is a deterministic, four-channel computational baseline for autonomous software and synthetic experiments. It is **not** externally validated and has no Overall score. Human-labelled truth remains mandatory before claims about mapping accuracy, real fit validity, or recommendation quality.

## Canonical work and mapper

Canonical tasks preserve O*NET 30.3 Task ID/statement/type, occupation, IM 1–5 source metadata, paired DWA identifiers, broader GWA hierarchy, and provenance. Context (domain, seniority, ownership, system, environment) is separate from identity. DWA labels are explicitly rendered as `O*NET DWA <id>` because the committed corpus contains IDs but not DWA label text; this is not a fabricated semantic label.

The lexical mapper is a reproducible retrieval **baseline**: token overlap plus separately bounded context overlap → Top-5 → exact Task only above threshold and margin → DWA-only fallback → abstention. Similarity and diagnostic confidence are not accuracy. Cache identity includes source text, all context, thresholds/topK/tokenizer/context weight, mapper and optional reranker version, plus corpus hash. The reranker interface cannot change downstream fit types. Job titles never enter task mapping.

## Four independent outputs

- **Preference Fit:** compatibility of explicitly LIKE/DISLIKE/NEUTRAL evidence with job responsibilities. UNKNOWN and absent likes contribute nothing; dislikes reduce fit.
- **Experience Fit:** coverage of job tasks by performed-task evidence, with exact Task or declared DWA partial credit, evidence strength, ownership, and common-source deduplication. It says nothing about enjoyment.
- **Qualification Fit:** normalized exact/alias equivalence between structured qualifications and required/preferred requirements. Tokenized normalization prevents substring collision; negated evidence cannot satisfy; missing hard requirements are gaps; preferred evidence has declared reduced weight.
- **Direction Fit:** coverage of job tasks by explicit aspiration mappings. It says nothing about demonstrated capability.

No channel reads another channel's collection. `null` means unknown/no applicable evidence and is distinct from neutral or zero performance.

## Metadata status

| Metadata | Status | Semantics |
|---|---|---|
| lexical mapping similarity | USED | deterministic candidate retrieval and declared Task/DWA/abstain thresholds |
| mapping diagnostic confidence | DIAGNOSTIC_ONLY | reported, never multiplies fit |
| evidence strength | USED | Experience and stated Preference/Direction strength only |
| ownership | USED | declared Experience depth modifier |
| Task importance | DIAGNOSTIC_ONLY | retained with O*NET scale/source; not fit-weighted |
| Core/Supplemental | DIAGNOSTIC_ONLY | retained; not fit-weighted |
| DWA partial credit | USED | fixed semantic fallback of 0.6; `PROVISIONAL_BASELINE`, not empirically validated |
| contextual reranking | EXPERIMENTAL_DISABLED | interface exists; no default reranker |
| Overall score | NOT_USED | deliberately absent |

## Autonomous preference target V1

The decoder predicts a 0–10 synthetic preference latent value. Continuous autonomous MAE is restricted to `measurable_feedback` and `experimentation_preference`. Both have ordered bipolar semantics, empirical **generator-available** coverage above the declared 10% **policy** floor, positive truth→high-evidence association, negative truth→low-evidence association, positive observable-signal association, and monotone quartile signal. Interval MAE is a policy acceptance, not a proven interval scale.

`AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` is the primary metric: for each subject, take eligible dimensions for which the generator actually placed a preference/dislike phrase in an inference-visible field; average absolute error within subject; then average subjects equally. Inclusion does **not** depend on extractor recognition. Always accompany it with available micro MAE, recognized macro/micro MAE, available-to-recognized recall, zero-available-evidence MAE, directional accuracy, extreme recall, rank/calibration, coverage, variance, constant/prior/shrinkage, and legacy all-17D MAE. Changing eligibility is a metric-contract change, not a decoder experiment.

`integration_preference` is construct-valid but currently below the 10% generator-coverage policy floor (`CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE`). That floor is a policy parameter, not a scientific fact. Extractor coverage is reported separately and must never decide eligibility.

All 17 decisions and empirical values are emitted by `pnpm eval:generator-monotonicity` and `pnpm eval:eligibility-sensitivity`; excluded dimensions remain visible. Exclusion layers are construct invalidity, insufficient interval semantics, or generator coverage—not extractor misses.
