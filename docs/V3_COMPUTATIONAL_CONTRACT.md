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
| DWA partial credit | USED | fixed semantic fallback of 0.6, not empirically validated |
| contextual reranking | EXPERIMENTAL_DISABLED | interface exists; no default reranker |
| Overall score | NOT_USED | deliberately absent |

Every coefficient in this table that carries a numeric weight (DWA partial credit, and the additional preference/experience/qualification coefficients in `src/v3/fit.ts`) has an explicit governance status (`STRUCTURAL`/`PROVISIONAL_BASELINE`/`EMPIRICALLY_JUSTIFIED`/`UNJUSTIFIED`/`EXPERIMENTAL_DISABLED`) in `docs/V3_COEFFICIENT_INVENTORY.md` and `src/v3/coefficientGovernance.ts`. None are currently `EMPIRICALLY_JUSTIFIED`.

## Autonomous preference target V1

The decoder predicts a 0–10 synthetic preference latent value for generated preference/dislike evidence. Continuous autonomous MAE is restricted to `measurable_feedback` and `experimentation_preference`. Both have ordered bipolar semantics, empirical generator coverage above the preregistered 10% floor (a declared policy parameter, not a scientific fact — see `docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md`), positive truth→high-evidence association, negative truth→low-evidence association, positive observable-signal association, and monotone quartile signal.

**AVAILABLE vs RECOGNIZED evidence.** Two independent concepts drive every preference metric (`src/lab/evidenceAvailability.ts`, `src/lab/iterationMetrics.ts`):

- **AVAILABLE** — the observation generator placed valid preference/dislike phrase evidence for the dimension in fields visible to the inference system (`explicitPreferences`/`explicitDislikes`), determined independently of the extractor.
- **RECOGNIZED** — the extractor actually produced a PREFERENCE/DISLIKE evidence item mapping to that dimension.

`AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` is the primary metric: available-evidence eligible-dimension MAE within each eligible subject, then equal subject mean. Its denominator depends only on generator exposure, never on extractor recognition, so the extractor recognizing fewer cases cannot shrink its own evaluation denominator (a selection-bias/Goodhart path the prior `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1` definition was vulnerable to; that metric is superseded and retained only for comparison). It must always be accompanied by `AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE`, `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`/`MICRO`, `AVAILABLE_TO_RECOGNIZED_RECALL`, `ZERO_AVAILABLE_EVIDENCE_MAE`, `LEGACY_ALL_DIMENSION_MAE`, directional accuracy, extreme recall, within-dimension rank correlation, calibration slope, prediction variance, and constant/prior/shrinkage diagnostics. Changing eligibility is a metric-contract change, not a decoder experiment. See `docs/PREFERENCE_METRIC_RED_TEAM.md` for adversarial testing of this metric.

All 17 decisions and empirical values are emitted by `pnpm eval:generator-monotonicity`; excluded dimensions remain visible. Dimensions are excluded for compound/non-opposite poles, overlap, non-interval semantics, or—in the case of integration preference, classified `CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE`—insufficient generator coverage under the current policy floor (`pnpm eval:eligibility-sensitivity` reports the floor's sensitivity).
