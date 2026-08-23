# Iteration laboratory readiness — V3 bridge

**Assessment date:** 2026-08-23
**Authorized readiness-lab base:** `c10b914a147fc39f2be37cd0584425aeec958d1f`
**Ephemeral `b42e121…` prototype:** retired and not required

# READY FOR AUTONOMOUS ITERATION: YES

YES means the lab and V3 computational boundaries are safe for scoped autonomous software/synthetic experiments. It does **not** mean mapper accuracy, four-fit human validity, or job recommendations are externally validated.

## Correction (final pre-iteration hardening audit)

A prior version of this document and `config/baseline-manifest.json` cited an
"authorized readiness-lab base" `51ccb94c63663591503e1ee214962c130a366c85`. That SHA does
not exist in this repository or on its remote (confirmed via `git cat-file` and the
GitHub commits API). It has been corrected to the real, verified checkpoint
`c10b914a147fc39f2be37cd0584425aeec958d1f` — see `docs/BASELINE_MANIFEST.md`. This
document was also rewritten to describe the available-vs-recognized evidence hardening
(see below); prior readers should not trust the pre-hardening primary-metric numbers as
comparable without accounting for the definition change.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| readiness-lab and frozen baseline provenance | PASS | HEAD descends from `c10b914a…`; immutable artifact SHA/history checks pass |
| metric registry and preference target | PASS | 17 decisions; only two continuous eligible dimensions; primary metric (`AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1`) registered |
| generator monotonicity | PASS | eligible dimensions have coverage, correct signed associations, and monotone quartile signals |
| available evidence independent of extractor output | PASS | `src/lab/evidenceAvailability.ts` imports no production extractor module |
| primary metric uses available evidence, not recognized evidence | PASS | `PRIMARY_PREFERENCE_DECODER_METRIC === "AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1"` |
| recognized-evidence metrics reported separately | PASS | `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`/`MICRO` present and numerically distinct from the primary metric |
| available-to-recognized recall reported | PASS | `AVAILABLE_TO_RECOGNIZED_RECALL` present |
| missed-extractor example cannot disappear from the primary denominator | PASS | `tests/available-evidence.test.ts` mandatory regression |
| eligibility coverage thresholds documented as policy assumptions | PASS | `ELIGIBILITY_COVERAGE_FLOOR_POLICY.status === "POLICY_PARAMETER_NOT_SCIENTIFIC_FACT"`; sensitivity table in `docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md` |
| AGENTS.md contains persistent TaskDNA experiment rules | PASS | `<!-- BEGIN:taskdna-experiment-rules -->` block present alongside the preserved Next.js block |
| active V3 coefficients have explicit governance status | PASS | 6 coefficients in `src/v3/coefficientGovernance.ts`, none `EMPIRICALLY_JUSTIFIED` |
| observed macro/micro and anti-collapse diagnostics | PASS | deterministic DEVELOPMENT/VALIDATION reports include coverage, variance, constant/prior, shrinkage and legacy MAE |
| confidence governance | PASS | diagnostic-only; never a V3 fit multiplier |
| split governance | PASS | DEVELOPMENT/VALIDATION explicit; LOCKED_CONFIRMATION denied without confirmation and never run by preflight |
| canonical Task/DWA representation | PASS | O*NET identity/type/importance/DWA/GWA/provenance plus separate context |
| deterministic mapper baseline | PASS | Top-K, Task threshold+margin, DWA fallback, abstention, full cache identity, optional reranker interface |
| four independent channels | PASS | explicit person collections, separate job responsibilities/requirements, no Overall |
| qualification semantics | PASS | normalization, explicit aliases, kind equivalence, negation, hard gaps, preferred weighting, substring regression |
| end-to-end separation | PASS | one-channel counterfactuals and exposure/aspiration/qualification/title guards |
| mapper/external claim boundary | PASS | fixtures are semantics only; independent schema remains unfilled |
| reproducibility/software/security | PASS | repeated evaluators, full test/lint/typecheck/build, frozen diff and filename-only secret scan |

## Autonomous preference target (available vs recognized)

The primary metric is `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1`, evaluated on
`measurable_feedback` and `experimentation_preference` wherever the observation
**generator** exposed valid PREFERENCE/DISLIKE phrase evidence for the dimension —
independent of whether the extractor recognized it (`src/lab/evidenceAvailability.ts`).

| Metric | DEVELOPMENT | VALIDATION |
|---|---:|---:|
| `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` (primary) | 2.532517 | 2.431238 |
| `AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE` | 2.487480 | 2.445620 |
| `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE` (superseded-style, recognition-gated) | 2.572395 | 2.125821 |
| `RECOGNIZED_EVIDENCE_PREFERENCE_MICRO_MAE` | 2.466585 | 2.152881 |
| `AVAILABLE_TO_RECOGNIZED_RECALL` (extractor recall conditional on availability) | 0.3077 | 0.3238 |
| `ZERO_AVAILABLE_EVIDENCE_MAE` (no evidence exposed at all) | 1.431336 | 1.344512 |
| `LEGACY_ALL_DIMENSION_MAE` | 1.900921 | 1.861987 |
| available-eligible coverage | 0.4767 | 0.5250 |
| recognized-eligible coverage | 0.2067 | 0.2550 |

**Key finding:** available coverage is roughly double recognized coverage on both
splits, and the extractor recognizes only ~31%/32% of the eligible-dimension evidence
the generator actually exposed. All four `measurable_feedback` phrase templates and 3 of
4 `experimentation_preference` phrase templates do not match any pattern in the current
keyword lexicon (`src/domain/workStructure.ts`) — a real, quantified extraction gap on
the only two currently-eligible dimensions, now visible precisely because the primary
metric no longer depends on extractor recognition to define its denominator. These
values describe the current unoptimized decoder and extractor, not a quality claim, and
this pass does not fix the lexicon (that is a future preregistered experiment, not part
of this hardening audit).

The legacy all-17D MAE, zero-evidence MAE, directional accuracy, extreme recall,
within-dimension rank, calibration slope, prediction variance, constant/prior comparison,
and shrinkage curve must always accompany the primary metric (never reported alone).
Current poor rank/calibration diagnostics, and the fact that the decoder is roughly tied
with a constant-5 baseline on available-evidence eligible dimensions (see
`docs/PREFERENCE_METRIC_RED_TEAM.md`), are legitimate future experiment targets, not
readiness failures.

## Generator findings

At seed `20260823` over 450 subjects:

| Eligible dimension | Coverage | truth→high evidence | truth→low evidence | truth→observable signal | quartile monotone |
|---|---:|---:|---:|---:|---|
| measurable_feedback | 0.5867 | 0.7365 | −0.7402 | 0.8779 | PASS |
| experimentation_preference | 0.3111 | 0.4985 | −0.5151 | 0.6587 | PASS |

The complete 17D result and exclusions are in `artifacts/iteration_readiness/generator_monotonicity.json`. Integration preference is conceptually ordered but classified `CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE` (not a construct-invalidity classification) for approximately 4% generator coverage, below the declared 10% floor — a declared policy parameter, not a scientific fact; see `docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md` for the sensitivity table across 0%/5%/10%/20% floors. No dimension other than `integration_preference` flips eligibility solely due to the threshold. Other exclusions follow the non-opposite, compound, overlap, or non-interval findings in the product audit. No generator behavior was changed to obtain this result.

## Final blueprint check

1. **Decoder prediction:** a 0–10 synthetic preference latent value for generated preference/dislike evidence — not a complete person profile or job fit.
2. **MAE-eligible:** `measurable_feedback`, `experimentation_preference` only.
3. **Excluded/questionable:** the other 15 are visible and classified; reasons include redefinition, two independent preferences, overlap, and (for `integration_preference` specifically) insufficient generator coverage under the current policy floor.
4. **Primary metric:** equal-subject `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` over generator-exposed (not extractor-recognized) eligible dimensions.
5. **Always accompany it:** micro MAE, `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`/`MICRO`, `AVAILABLE_TO_RECOGNIZED_RECALL`, `ZERO_AVAILABLE_EVIDENCE_MAE`, directional accuracy, extreme recall, rank/order, calibration, coverage, variance, constant/prior/shrinkage, confidence/error, and legacy 17D MAE.
6. **Preference Fit:** compatibility of explicit LIKE/DISLIKE/NEUTRAL evidence with mapped job responsibilities; UNKNOWN is no contribution.
7. **Experience Fit:** coverage of job tasks by performed-task evidence with exact/DWA matching, depth, ownership and deduplication.
8. **Qualification Fit:** structured equivalence and gaps between qualifications and required/preferred requirements.
9. **Direction Fit:** alignment of explicit aspirations with mapped job tasks, without manufacturing experience.
10. **Human truth still required:** external mapper accuracy/abstention quality, real Preference/Experience/Qualification/Direction Fit validity, overall ranking and recommendation validity.

## Starting instructions for the later loop

1. Run `pnpm eval:iteration-readiness` and require `passed: true`.
2. Read `docs/V3_COMPUTATIONAL_CONTRACT.md`, `docs/EXPERIMENT_PERMISSIONS.md`, `docs/AUTONOMOUS_ITERATION_PROTOCOL.md`, `docs/PREFERENCE_METRIC_RED_TEAM.md`, and the persistent TaskDNA rules in `AGENTS.md`.
3. Run `pnpm experiment:new <id>`, finish preregistration, then make one conceptual change.
4. Use DEVELOPMENT first; preserve eligibility/coverage/variance guardrails. Use VALIDATION only after the preregistered development gate. Do not run locked confirmation during ordinary iteration.
5. Report `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` alongside every mandated companion metric — never alone, and never optimize the superseded `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1` or `LEGACY_ALL_DIMENSION_MAE` as if they were product quality.
