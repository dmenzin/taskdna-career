# Final preflight red team

Every attack surface listed for the 8-hour-loop preflight, with the evidence that settles it.
Measured on `cursor/taskdna-final-preflight`, seed 20260823, DEVELOPMENT split (150 subjects)
unless stated otherwise.

| # | attack | verdict | evidence |
| --- | --- | --- | --- |
| 1 | semantically backwards generator evidence | **FIXED** | Was real: 261 DEVELOPMENT placements with mean truth 2.68 against mean prediction 5.64, 53.6% wrong-side, directional accuracy 0.147. Now 0 backwards placements; the deliberately inverted corpus fails 17/17 dimensions. |
| 2 | selection bias (algorithm shrinking its own denominator) | RESISTED | Availability is fixed before the extractor runs. Simulating zero extractor recognition leaves the primary metric bit-identical; recall drops to 0 instead. |
| 3 | positional generator bias | **FIXED** | Was real: `filter(...).slice(0, N)` selected positions 0–2 with probability 1 and 3–16 with probability 0. Sampler chi-square now 12.39 vs 39.25 critical (16 df, α=0.001); first/second-half selection rates 0.3529 vs 0.3526. |
| 4 | late evidence loss | **FIXED** | Was real: `fallback.slice(0, 10)` dropped everything after sentence 10. Evidence at sentence 12 and sentence 41 is now recognized, and a late-only preference sentence moves the dimension identically to an early one. |
| 5 | duplicate evidence | **FIXED** | Was real on two paths (generator restatement and list-into-careerText concatenation). Now 0/150 within-field and 0/150 cross-source; both detectors fire on deliberately introduced duplicates. |
| 6 | constant-5 collapse | EXPOSED BY GUARDRAIL | `constant5.availableEligibleMicroMae` is published every run. The decoder now beats it (2.4152 vs 2.4961 DEVELOPMENT; 2.1839 vs 2.4470 VALIDATION); under the old generator it lost to it. |
| 7 | shrinkage gaming | RESISTED | Best lambda by raw MAE is now exactly **1** on every reported metric, so shrinking toward the prior no longer pays. Previously the minimum sat below 1. The full curve is published regardless. |
| 8 | coverage reduction | RESISTED | `availableEligibleCoverage` = 0.330 is computed from generator output, not extractor output, so the model under evaluation cannot reduce it. 818 exposed placements across DEVELOPMENT. |
| 9 | over-abstention | CLEAR | Over 60 real O*NET task statements: 56 task-level, 4 DWA-level, **0 abstentions**. The mapper abstains on genuinely irrelevant text ("free lunch on Fridays", similarity 0.224). |
| 10 | title / occupation leakage | CLEAR | 40/40 `title_removed` twins pass with identical fit (8.16 → 8.16). `occupation_context` evidence produces an empty person in all four channels. |
| 11 | cross-channel contamination | CLEAR | Experience-only → `{pref: null, exp: 1, dir: null}`. Aspiration-only → `{pref: null, exp: null, dir: 1}`. Preference-only → `{pref: 1, exp: null, dir: null}`. All four non-implications are separate tests. |
| 12 | broad-DWA overmatching | ACKNOWLEDGED, BOUNDED | Ambiguous text falls back to DWA level with reduced confidence (0.530, 0.500) rather than minting a false exact Task, and retains multiple candidates. Precision on broad DWAs is workstream 3's open question. |
| 13 | stale caching | RESISTED | Every cache key contains every behaviour-changing input: source text, context, full `MAPPER_CONFIG`, mapper version, reranker version, corpus hash. Context and reranker separation are asserted, `MAPPER_CONFIG` contents are pinned, and a cache hit returns a bit-identical object. |
| 14 | locked-data leakage | CLEAR | `LOCKED_CONFIRMATION` without `--confirm-locked` exits 1 with 0 bytes of stdout. Readiness asserts the guard; it never runs the split. |
| 15 | baseline / truth mutation | CLEAR | Frozen baseline SHA-256 matches its manifest exactly. This branch's diff touches no file under `data/`, `config/baseline-manifest.json`. Availability reads no `taskDnaTruth`. |
| 16 | repetitive hill climbing | PREVENTED | `pnpm experiment:guard` rejects unpreregistered threshold/coefficient/regex/keyword/prompt nudging and an unjustified third consecutive experiment on the same mechanism. 16 tests verify the rejections. |
| 17 | expensive full-build loops | FIXED | FAST tier is 0.7–5.8 s per subsystem and runs no build. `mapWork` went from 214 ms to 3.9 ms cold / 6 µs cached, which is what made the Task/DWA workstream runnable at all. |
| 18 | premature model-family commitment | PREVENTED | No model is added. Ten boundaries declare plausible alternative families; the portfolio states model architecture must emerge from comparative evidence. CNNs are explicitly not precommitted to. |
| 19 | excessive agent calls | PREVENTED | Default policy: max invocation rate 0.15, max 2,000 calls and $5 per experiment, `invokeOnlyWhen: AMBIGUOUS_CANDIDATES`. `PERSON_JOB_PAIR` interpretation scope is prohibited outright. |
| 20 | nondeterministic final scoring | RESISTED | `scoreV3` output is identical across a cleared mapper cache. Every `*_fit` boundary is pinned to `DETERMINISTIC_ARITHMETIC` with no `LLM_AGENT` alternative, asserted by `channelScoringIsDeterministic()`. |

## The metric red-team script

`pnpm eval:metric-red-team` (9 attacks, `preference-metric-red-team.v2`):

| verdict | attacks |
| --- | --- |
| `RESISTED_DIRECTLY` | `RECOGNIZE_FEWER_CASES`, `SHRINK_TOWARD_5` |
| `STRUCTURALLY_IMPOSSIBLE` | `ABSTAIN` |
| `EXPOSED_BY_GUARDRAIL` | `PREDICT_CONSTANT_5`, `DROP_DIFFICULT_DIMENSIONS`, `INFLATE_RECOGNIZED_COVERAGE`, `CHANGE_GENERATOR_VISIBILITY`, `DUPLICATE_EASY_EVIDENCE`, `BACKWARDS_GENERATOR_POLARITY` |

`SHRINK_TOWARD_5` moved from `EXPOSED_BY_GUARDRAIL` to `RESISTED_DIRECTLY` as a direct
consequence of the generator repair.

## Findings that are NOT P0, and why

### VARIANCE_COLLAPSE and PREDICTION_TO_5_RISK now fire

`varianceRatio` fell from 0.1333 to 0.0964 and prediction mean sits at 4.997. Both warnings
fire on DEVELOPMENT.

This is a **direct and expected consequence of removing double-counted evidence**: the decoder
previously got two evidence items from one statement, which inflated its effective-signal count
and pulled predictions further from the neutral prior. Removing the duplication removed signal
it had been getting for free.

It is not Goodhart gaming, and the diagnostics distinguish the two cases:

| quantity | DEVELOPMENT | VALIDATION | reading |
| --- | --- | --- | --- |
| `directionalAccuracy` (raw) | 0.222 | 0.355 | looks terrible |
| `neutralPredictionRate` | 0.646 | 0.500 | but two thirds of those are the decoder declining to commit |
| `directionalAccuracyAmongLeaning` | **0.629** | **0.710** | when it does commit, it is well above chance |
| `calibrationSlopeTruthOnPrediction` | 0.886 | 1.066 | and its leans are appropriately scaled |
| `predictionTo5Gaming` | false | false | MAE beats constant-5, so this is not collapse-for-score |
| `improvementOnlyZeroAvailableEvidence` | false | false | gains are not confined to unobservable dimensions |

The honest summary: **the decoder is under-committing, not pointing the wrong way.** With
`AVAILABLE_TO_RECOGNIZED_RECALL` at 0.31, it simply has too little recognized evidence to leave
the prior most of the time. That makes extraction recall — not scoring arithmetic — the binding
constraint, which is exactly what workstream 2 records as its current hypothesis.

Raw `directionalAccuracy` scores a prediction pinned at the prior as *wrong*, because `sign(0)`
matches neither `sign(+)` nor `sign(-)`. That conflation was itself a measurement-validity
defect; the decomposition above was added in this preflight to fix it. Nothing was tuned.

### recognizedOutsideAvailableRate is 0.656

Two thirds of recognized eligible records are for dimensions where the generator exposed no
directional preference language at all. The extractor's work-structure lexicon fires on
exposure vocabulary that happens to sit inside a preference sentence.

This is a real extractor over-attribution property and an open research question, not an attack.
It is reported as a quantity every run and can never inflate
`AVAILABLE_TO_RECOGNIZED_RECALL`, which is defined as recognized-AND-available over available.
On VALIDATION it also trips `RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE`
(recognized coverage 0.435 against available coverage 0.310) — the warning is doing its job by
making the over-attribution visible.

### Paraphrase and common-source duplication remain unresolved

Exact-normalized deduplication cannot detect "I enjoy root-cause investigation" versus "I enjoy
digging into why something failed". Neither residual can shrink the primary denominator
(availability is a per-dimension boolean), but both can inflate the effective-signal count.
Documented as an open problem in `docs/DUPLICATE_EVIDENCE.md` with a recommended next step, not
presented as solved.

## P0 count

**Zero.** Every defect found (items 1, 3, 4, 5) is fixed with a regression test that fails on
the pre-fix behaviour. `pnpm eval:iteration-readiness` passes 30/30.
