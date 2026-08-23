# Iteration laboratory readiness — V3 bridge

**Assessment date:** 2026-08-23
**Authorized lab base:** `51ccb94c63663591503e1ee214962c130a366c85`
**Hardening checkout:** `cursor/taskdna-pre-iteration-hardening-5d9f`
**Ephemeral `b42e121…` prototype:** retired and not required

# READY FOR AUTONOMOUS ITERATION: YES

YES means the lab and V3 computational boundaries are safe for scoped autonomous software/synthetic experiments. It does **not** mean mapper accuracy, four-fit human validity, or job recommendations are externally validated.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| readiness-lab and frozen baseline provenance | PASS | Declared `51ccb94…` is not in this GitHub object store; HEAD descends from historical checkpoint `c10b914…`; frozen artifact SHA/history checks pass |
| metric registry and preference target | PASS | 17 decisions; only two continuous eligible dimensions; available-evidence primary registered |
| available vs recognized evidence | PASS | availability uses generator-visible phrases; extractor output cannot empty the primary denominator |
| eligibility coverage floor | PASS | 10% floor documented as a policy assumption; sensitivity table emitted |
| AGENTS.md TaskDNA rules | PASS | Next.js block preserved; experiment rules appended |
| V3 coefficient governance | PASS | every active coefficient has an explicit non-calibrated status |
| generator monotonicity | PASS | eligible dimensions have coverage, correct signed associations, and monotone quartile signals |
| available/recognized macro/micro and anti-collapse diagnostics | PASS | deterministic DEVELOPMENT/VALIDATION reports include recall, coverage, variance, constant/prior, shrinkage and legacy MAE |
| confidence governance | PASS | diagnostic-only; never a V3 fit multiplier |
| split governance | PASS | DEVELOPMENT/VALIDATION explicit; LOCKED_CONFIRMATION denied without confirmation and never run by preflight |
| canonical Task/DWA representation | PASS | O*NET identity/type/importance/DWA/GWA/provenance plus separate context |
| deterministic mapper baseline | PASS | Top-K, Task threshold+margin, DWA fallback, abstention, full cache identity, optional reranker interface |
| four independent channels | PASS | explicit person collections, separate job responsibilities/requirements, no Overall |
| qualification semantics | PASS | normalization, explicit aliases, kind equivalence, negation, hard gaps, preferred weighting, substring regression |
| end-to-end separation | PASS | one-channel counterfactuals and exposure/aspiration/qualification/title guards |
| mapper/external claim boundary | PASS | fixtures are semantics only; independent schema remains unfilled |
| reproducibility/software/security | PASS | repeated evaluators, full test/lint/typecheck/build, frozen diff and filename-only secret scan |

## Autonomous preference target

The primary metric is `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1`. For each subject, take eligible dimensions (`measurable_feedback`, `experimentation_preference`) for which the generator actually placed a preference/dislike phrase in an inference-visible field; average absolute error within subject; then average those subjects equally. Extractor recognition is not an inclusion rule.

Current unoptimized decoder values, not a quality claim:

| Split | Available macro | Available micro | Recognized macro | Recognized micro | Available→recognized recall | Available coverage | Recognized coverage | Zero-available MAE | Legacy 17D MAE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DEVELOPMENT | 2.500982319581047 | 2.4694755263173227 | 2.5723946176015295 | 2.46658501846426 | 0.2953020134228188 | 0.49666666666666665 | 0.20666666666666667 | 1.4071360989067914 | 1.9009214051435472 |
| VALIDATION | 2.4345693230624006 | 2.43878826897293 | 2.125820891422168 | 2.1528805734542513 | 0.3177570093457944 | 0.535 | 0.255 | 1.3286917764786086 | 1.8619872971926397 |

VALIDATION recognized MAE is lower than available MAE. That is the selection-bias pattern the old primary would have rewarded. Directional accuracy, extreme recall, rank, calibration, coverage, variance, constant/prior/shrinkage, recall, and legacy MAE must accompany the primary metric. Current poor rank/calibration and near-constant-5 behavior are legitimate future experiment targets, not readiness failures.

## Generator findings

DEVELOPMENT available-evidence coverage at seed `20260823`:

| Eligible dimension | Generator-available coverage | Extractor-recognized coverage |
|---|---:|---:|
| measurable_feedback | 0.6133 | 0.3133 |
| experimentation_preference | 0.3800 | 0.1000 |

`integration_preference` is conceptually ordered (`CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE`) with generator-available coverage `0.0667`, below the declared **policy** floor of 10%. It would become eligible only at 0% or 5% floors. No other dimension's eligibility changes solely because of the threshold. Extractor coverage never decides eligibility.

## Final blueprint check

1. **Decoder prediction:** a 0–10 synthetic preference latent value where generated preference/dislike evidence was made available—not a complete person profile or job fit.
2. **MAE-eligible:** `measurable_feedback`, `experimentation_preference` only.
3. **Excluded/questionable:** the other 15 remain visible. Layers are construct invalidity, insufficient interval semantics, or generator-coverage policy—not extractor misses.
4. **Primary metric:** equal-subject available-evidence preference macro MAE over eligible dimensions.
5. **Always accompany it:** available micro, recognized macro/micro, available-to-recognized recall, zero-available MAE, directional accuracy, extreme recall, rank/order, calibration, coverage, variance, constant/prior/shrinkage, and legacy 17D MAE.
6. **Preference Fit:** compatibility of explicit LIKE/DISLIKE/NEUTRAL evidence with mapped job responsibilities; UNKNOWN is no contribution.
7. **Experience Fit:** coverage of job tasks by performed-task evidence with exact/DWA matching, depth, ownership and deduplication.
8. **Qualification Fit:** structured equivalence and gaps between qualifications and required/preferred requirements.
9. **Direction Fit:** alignment of explicit aspirations with mapped job tasks, without manufacturing experience.
10. **Human truth still required:** external mapper accuracy/abstention quality, real Preference/Experience/Qualification/Direction Fit validity, overall ranking and recommendation validity.

## Starting instructions for the later loop

1. Start from this hardened branch and SHA after `pnpm eval:iteration-readiness` reports `passed: true`.
2. Read `docs/V3_COMPUTATIONAL_CONTRACT.md`, `docs/EXPERIMENT_PERMISSIONS.md`, `docs/V3_COEFFICIENT_GOVERNANCE.md`, and `docs/AUTONOMOUS_ITERATION_PROTOCOL.md`.
3. Run `pnpm experiment:new <id>`, finish preregistration, then make one conceptual change.
4. Use DEVELOPMENT first; preserve eligibility/coverage/variance/recall guardrails. Use VALIDATION only after the preregistered development gate. Do not run locked confirmation during ordinary iteration.
