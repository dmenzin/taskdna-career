# Iteration laboratory readiness — V3 bridge

**Assessment date:** 2026-08-23
**Authorized readiness-lab base:** `c10b914a147fc39f2be37cd0584425aeec958d1f`
**Ephemeral `b42e121…` prototype:** retired and not required
**Readiness gate version:** `iteration-readiness.v4` — 30/30 checks pass in ~24 s

# READY FOR AUTONOMOUS ITERATION: YES

YES means the lab and V3 computational boundaries are safe for scoped autonomous software/synthetic experiments. It does **not** mean mapper accuracy, four-fit human validity, or job recommendations are externally validated.

## Final preflight (2026-08-23, `cursor/taskdna-final-preflight`)

Four defects were found and fixed. **Every preference number recorded before this preflight
graded the decoder against semantically backwards evidence** and is not comparable to the
current values.

| defect | was | now |
|---|---|---|
| backwards generator polarity — a LOW truth expressed as a dislike of LOW-side behaviour ("I avoid solo deep work") | 261 DEVELOPMENT placements, mean truth 2.68 vs mean prediction 5.64, directional accuracy 0.147 | 0 backwards placements; the inverted corpus fails 17/17 dimensions |
| positional sampling bias — `DIMENSION_IDS.filter(...).slice(0, N)` | positions 0–2 selected always, 3–16 never | sampler chi-square 12.39 vs 39.25 critical (16 df, α=0.001) |
| late-sentence loss — `fallback.slice(0, 10)` | evidence after sentence 10 discarded | recognized at sentence 12 and 41; ~16 µs/sentence |
| duplicate evidence paths — explicit lists concatenated into `careerText` *and* passed separately | one statement counted twice | 0/150 within-field, 0/150 cross-source |

Two evaluation-semantics repairs accompany them, recorded as metric-contract changes in
`config/metric-registry.json`: availability moved to `evidence-availability.v2-stance-aware`
(all four inference-visible fields, stance resolved from the surrounding construction), and
`directionalAccuracy` is now reported with `neutralPredictionRate`,
`directionalCoverage`, and `directionalAccuracyAmongLeaning` so a prediction pinned at the
neutral prior is no longer scored as a wrong direction.

New gates in `iteration-readiness.v4`: generator semantic polarity, generator positional
sampling bias, late-sentence and duplicate-evidence regressions, four-parallel-channel and
hybrid-readiness contract, product-critical subsystem coverage, research portfolio, and the
micro-tuning guard.

See `docs/PREFERENCE_GENERATOR_SEMANTICS.md`, `docs/GENERATOR_SELECTION_BIAS.md`,
`docs/DUPLICATE_EVIDENCE.md`, `docs/AVAILABLE_EVIDENCE_DEFINITION.md`, and
`docs/PREFLIGHT_RED_TEAM.md`.

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

Values below are post-preflight (`evidence-availability.v2-stance-aware`, repaired generator).
Pre-preflight numbers are shown for the DEVELOPMENT split only, and are **not** comparable:
they graded the decoder against backwards evidence.

| Metric | DEVELOPMENT (before) | DEVELOPMENT | VALIDATION |
|---|---:|---:|---:|
| `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` (primary) | 2.5325 | **2.4152** | **2.1839** |
| `AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE` | 2.4875 | 2.3915 | 2.1828 |
| `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE` | 2.5724 | 1.7189 | 1.8184 |
| `RECOGNIZED_EVIDENCE_PREFERENCE_MICRO_MAE` | 2.4666 | 1.7949 | 1.7738 |
| `AVAILABLE_TO_RECOGNIZED_RECALL` | 0.3077 | 0.3131 | 0.4677 |
| `ZERO_AVAILABLE_EVIDENCE_MAE` | 1.4313 | 1.5715 | 1.7074 |
| `LEGACY_ALL_DIMENSION_MAE` | 1.9009 | 1.7357 | 1.7024 |
| available-eligible coverage | 0.4767 | 0.3300 | 0.3100 |
| recognized-eligible coverage | 0.2067 | 0.3000 | 0.4350 |
| `recognizedOutsideAvailableRate` | — | 0.6556 | 0.6667 |

Baselines and anti-Goodhart comparators:

| | DEVELOPMENT | VALIDATION |
|---|---:|---:|
| constant-5, available-eligible micro | 2.4961 | 2.4470 |
| development population prior, available-eligible micro | 2.4914 | 2.4470 |
| best shrinkage lambda by raw MAE | **1.0** | **1.0** |
| prediction mean / variance | 4.9968 / 0.4321 | 4.9873 / 0.4907 |
| truth mean / variance | 5.2917 / 4.4807 | 5.2940 / 4.4049 |
| variance ratio | 0.0964 | 0.1114 |
| `directionalAccuracy` (raw) | 0.2222 | 0.3548 |
| `neutralPredictionRate` | 0.6465 | 0.5000 |
| `directionalAccuracyAmongLeaning` | 0.6286 | 0.7097 |
| `extremePreferenceRecall` (strong preference) | 0.2222 | 0.3889 |
| calibration slope (truth on prediction) | 0.8858 | 1.0659 |

**Three findings.**

The decoder now **beats constant-5** on the primary metric (2.4152 vs 2.4961 on DEVELOPMENT;
2.1839 vs 2.4470 on VALIDATION). Under the pre-fix generator it *lost* to constant-5, because
it was being graded against contradictory language. Relatedly, the best shrinkage lambda moved
to exactly 1, so shrinking toward the neutral prior no longer pays.

**Extraction recall is the binding constraint.** `AVAILABLE_TO_RECOGNIZED_RECALL` is 0.31 on
DEVELOPMENT: the lexicon misses roughly two thirds of the preference language the generator
exposes. The decoder therefore sits on the neutral prior for 65% of directional cases, which is
why prediction variance is under 10% of truth variance and `VARIANCE_COLLAPSE` fires. This is
under-commitment, not misdirection: among predictions that *do* lean, directional accuracy is
0.63 (DEVELOPMENT) and 0.71 (VALIDATION), with a calibration slope near 1. Nothing was tuned to
change these numbers.

**The extractor over-attributes.** `recognizedOutsideAvailableRate` is 0.656: two thirds of
recognized eligible records are for dimensions where no directional preference language was
exposed at all, because the work-structure lexicon fires on exposure vocabulary sitting inside a
preference sentence. On VALIDATION this also trips
`RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE`. Both are open research questions in
workstream 2, reported rather than suppressed.

The legacy all-17D MAE, zero-available-evidence MAE, directional diagnostics, extreme recall,
within-dimension rank, calibration slope, prediction variance, constant/prior comparison, and
shrinkage curve must always accompany the primary metric (never reported alone).

## Generator findings

At seed `20260823` over 450 subjects:

Associations are now measured against the SEMANTIC direction the generated language means
(behaviour side × stance), not the phrase's location. `semanticPolarityPass: true`, 0 backwards
placements.

| Eligible dimension | Coverage | truth→HIGH-meaning | truth→LOW-meaning | truth→observable signal | quartile monotone |
|---|---:|---:|---:|---:|---|
| measurable_feedback | 0.3200 | 0.5225 | −0.4835 | 0.6522 | PASS |
| experimentation_preference | 0.2844 | 0.4518 | −0.5155 | 0.6342 | PASS |

The complete 17D result is in `artifacts/iteration_readiness/generator_monotonicity.json`.

**Correction to the previous assessment.** `integration_preference` was excluded solely for
approximately 4% generator coverage, below the declared 10% floor. That 4% was an artifact of the
positional sampling bias: at position 12 in `DIMENSION_IDS`, `filter(...).slice(0, 3)` almost
never reached it. Under unbiased seeded sampling its measured coverage is **0.2933**, above the
floor, and it passes every non-coverage monotonicity criterion. Coverage is now in a narrow
0.247–0.327 band across all 17 dimensions rather than concentrated at the front of the array, so
no dimension's eligibility now turns on the threshold value (`dimensionsThatFlipSolelyDueToThreshold`
is empty at 0%/5%/10%/20%).

`integration_preference` is nevertheless left ineligible here. Widening
`AUTONOMOUS_PREFERENCE_DIMENSIONS_V1` changes the primary metric's scope, which is a
metric-contract change requiring the same review as changing the metric itself — not something a
preflight may do incidentally, and not a decoder experiment. It is recorded as workstream 1's
highest-value next experiment. Other exclusions follow the non-opposite, compound, overlap, or
non-interval findings in the product audit. No generator behaviour was changed to flatter any
metric.

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

1. Run `pnpm eval:iteration-readiness` and require `passed: true` (currently 30/30, ~24 s).
2. Read `docs/AUTONOMOUS_ITERATION_PROTOCOL.md`, `docs/RESEARCH_PORTFOLIO.md`,
   `config/research-portfolio.json`, `config/product-critical-subsystems.json`,
   `docs/EXPERIMENT_TIERS.md`, `docs/V3_COMPUTATIONAL_CONTRACT.md`,
   `docs/EXPERIMENT_PERMISSIONS.md`, `docs/PREFLIGHT_RED_TEAM.md`, and the persistent TaskDNA
   rules in `AGENTS.md`.
3. Pick a workstream, not a file. Run `pnpm experiment:new <id>`, complete the portfolio
   declaration (Workstream, Expected information value, Scope, Mechanism being tested) and the
   preregistration, then run `pnpm experiment:guard`.
4. Iterate with `pnpm eval:fast` (seconds). `pnpm eval:checkpoint` every 45–90 minutes. FULL tier
   only at the beginning, the end, and after major architecture changes. Never require
   `pnpm build` after an ordinary experiment.
5. Use DEVELOPMENT first; preserve eligibility/coverage/variance guardrails. Use VALIDATION only
   after the preregistered development gate. Never run locked confirmation during ordinary
   iteration.
6. Report `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` alongside every mandated companion metric
   — never alone, and never optimize the superseded `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1`
   or `LEGACY_ALL_DIMENSION_MAE` as if they were product quality.
7. Review the portfolio globally every 60–90 minutes and update
   `config/research-portfolio.json`. The goal is maximum trustworthy information, not maximum
   experiment count.
