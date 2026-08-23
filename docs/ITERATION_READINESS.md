# Iteration laboratory readiness — V3 bridge

**Assessment date:** 2026-08-23
**Authorized lab base:** `51ccb94c63663591503e1ee214962c130a366c85`
**Ephemeral `b42e121…` prototype:** retired and not required

# READY FOR AUTONOMOUS ITERATION: YES

YES means the lab and V3 computational boundaries are safe for scoped autonomous software/synthetic experiments. It does **not** mean mapper accuracy, four-fit human validity, or job recommendations are externally validated.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| readiness-lab and frozen baseline provenance | PASS | HEAD descends from `51ccb94…`; immutable artifact SHA/history checks pass |
| metric registry and preference target | PASS | 17 decisions; only two continuous eligible dimensions; primary metric registered |
| generator monotonicity | PASS | eligible dimensions have coverage, correct signed associations, and monotone quartile signals |
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

## Autonomous preference target

The primary metric is `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1`, evaluated only on `measurable_feedback` and `experimentation_preference` where the subject has extracted PREFERENCE/DISLIKE support. DEVELOPMENT macro/micro are `2.5723946176015295` / `2.46658501846426`, with eligible evidence coverage `0.20666666666666667`. VALIDATION values are `2.125820891422168` / `2.1528805734542513`, coverage `0.255`. These values describe the current unoptimized decoder, not a quality claim.

The legacy all-17D MAE remains `1.9009214051435472` DEVELOPMENT and `1.8619872971926397` VALIDATION. It is compatibility evidence only. Zero-evidence MAE remains a prior diagnostic. Directional accuracy, extreme recall, within-dimension rank, calibration slope, eligible coverage, prediction variance, constant/prior comparison, shrinkage curve, and legacy MAE must accompany the primary metric. Current poor rank/calibration diagnostics are legitimate future experiment targets, not readiness failures.

## Generator findings

At seed `20260823` over 450 subjects:

| Eligible dimension | Coverage | truth→high evidence | truth→low evidence | truth→observable signal | quartile monotone |
|---|---:|---:|---:|---:|---|
| measurable_feedback | 0.5867 | 0.7365 | −0.7402 | 0.8779 | PASS |
| experimentation_preference | 0.3111 | 0.4985 | −0.5151 | 0.6587 | PASS |

The complete 17D result and exclusions are in `artifacts/iteration_readiness/generator_monotonicity.json`. Integration preference is conceptually ordered but excluded for approximately 4% generator coverage, below the declared 10% floor. Other exclusions follow the non-opposite, compound, overlap, or non-interval findings in the product audit. No generator behavior was changed to obtain this result.

## Final blueprint check

1. **Decoder prediction:** a 0–10 synthetic preference latent value for generated preference/dislike evidence that the extractor supports—not a complete person profile or job fit.
2. **MAE-eligible:** `measurable_feedback`, `experimentation_preference` only.
3. **Excluded/questionable:** the other 15 are visible and classified; reasons include redefinition, two independent preferences, overlap, and insufficient evidence.
4. **Primary metric:** equal-subject autonomous observed preference macro MAE over supported eligible dimensions.
5. **Always accompany it:** micro MAE, directional accuracy, extreme recall, rank/order, calibration, coverage, variance, constant/prior/shrinkage, confidence/error, and legacy 17D MAE.
6. **Preference Fit:** compatibility of explicit LIKE/DISLIKE/NEUTRAL evidence with mapped job responsibilities; UNKNOWN is no contribution.
7. **Experience Fit:** coverage of job tasks by performed-task evidence with exact/DWA matching, depth, ownership and deduplication.
8. **Qualification Fit:** structured equivalence and gaps between qualifications and required/preferred requirements.
9. **Direction Fit:** alignment of explicit aspirations with mapped job tasks, without manufacturing experience.
10. **Human truth still required:** external mapper accuracy/abstention quality, real Preference/Experience/Qualification/Direction Fit validity, overall ranking and recommendation validity.

## Starting instructions for the later loop

1. Run `pnpm eval:iteration-readiness` and require `passed: true`.
2. Read `docs/V3_COMPUTATIONAL_CONTRACT.md`, `docs/EXPERIMENT_PERMISSIONS.md`, and `docs/AUTONOMOUS_ITERATION_PROTOCOL.md`.
3. Run `pnpm experiment:new <id>`, finish preregistration, then make one conceptual change.
4. Use DEVELOPMENT first; preserve eligibility/coverage/variance guardrails. Use VALIDATION only after the preregistered development gate. Do not run locked confirmation during ordinary iteration.
