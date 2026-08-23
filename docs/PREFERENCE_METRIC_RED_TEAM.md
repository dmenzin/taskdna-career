# Red-teaming the primary preference metric

`pnpm eval:metric-red-team` (`scripts/preference-metric-red-team.ts`) attempts every
attack listed in the readiness-hardening audit against
`AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` and records whether the metric resists the
attack directly, a companion guardrail exposes it unmistakably, or the attack is
structurally impossible against the current decoder interface. Full machine-readable
output: `artifacts/iteration_readiness/preference_metric_red_team.json`. Guardrail
regression coverage: `tests/preference-metric-red-team.test.ts`,
`tests/available-evidence.test.ts`.

## Results (seed 20260823, DEVELOPMENT split)

| Attack | Verdict | Mechanism |
|---|---|---|
| Recognize fewer cases (delete extractor lexicon rules) | **RESISTED_DIRECTLY** | Primary metric numerically unchanged (2.5325 → 2.5325) because its denominator is fixed by availability, computed before the extractor runs. `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`'s subject count and `AVAILABLE_TO_RECOGNIZED_RECALL` (0.308 → 0) collapse instead, making the attack visible in a companion metric rather than able to hide inside the primary one. |
| Abstain (emit no prediction) | **STRUCTURALLY_IMPOSSIBLE** | `UserProfile.taskDna` always has a numeric value for every one of the 17 dimensions (default: neutral prior); there is no code path through which "no prediction" removes a subject/dimension from the primary denominator. |
| Predict constant 5 for every eligible dimension | **EXPOSED_BY_GUARDRAIL** | The attacked metric (2.509) lands almost exactly on the reported `constant5.availableEligibleMicroMae` companion (2.486), and `predictionVariance` collapses to `0`, tripping `VARIANCE_COLLAPSE` in `warnings`. |
| Shrink predictions toward 5, report only the best lambda | **EXPOSED_BY_GUARDRAIL** | The shrinkage curve is monotone toward lower MAE as λ→0 in this run (2.533 at λ=1 vs 2.509 at λ=0), i.e. shrinking genuinely would improve the naive number. `shrinkageGovernance` is a hardcoded, unconditional string forbidding automatic minimum-MAE lambda selection, and the protocol document repeats the same prohibition. The full curve is always reported, so silent cherry-picking is visible by inspection. |
| Drop difficult dimensions from the eligible set | **EXPOSED_BY_GUARDRAIL** | `PREFERENCE_DIMENSION_DECISIONS` is a fixed, reviewed 17-entry array; `tests/v3/bridge.test.ts` asserts its length is 17 and every `maeEligible` entry is `VALID_BIPOLAR_CONTINUOUS`. Changing the eligible set is a diffed source constant requiring the same review as a metric-contract change (documented in `docs/V3_COMPUTATIONAL_CONTRACT.md` and `AGENTS.md`), not a runtime toggle a decoder experiment could flip unnoticed. |
| Inflate recognized coverage beyond what is available | **EXPOSED_BY_GUARDRAIL** | `AVAILABLE_TO_RECOGNIZED_RECALL` is defined as `recognized ∩ available / available`, never `recognized / available` with unioned membership, so claiming recognition outside the available set cannot inflate recall. `warnings` additionally includes `RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE` whenever `recognizedEligible.length > availableEligible.length`. |
| Change generator visibility (expose easier evidence) | **EXPOSED_BY_GUARDRAIL (partial/residual risk, disclosed)** | This is the one attack the audit does **not** claim to fully automate away. `pnpm eval:generator-monotonicity` re-validates truth↔evidence sign and monotonicity on every readiness run and would catch a construct-invalidating change, but would not automatically catch a construct-valid change that simply makes exposure easier. It is explicitly listed as a `knownFailureMode` (`"generator-exposure drift"`) on the metric's registry entry, and generator/evaluation-design parameters (phrase pools, coverage floors) are declared POLICY PARAMETERS requiring the same review as a metric-contract change — a process control, not a fully automatic one. |
| Duplicate easy evidence to farm coverage/confidence | **EXPOSED_BY_GUARDRAIL** | Availability is a boolean per dimension, not a count, so duplication cannot mechanically inflate a dimension's weight in the primary metric even if undetected. `warnings` additionally includes `DUPLICATED_EVIDENCE_PHRASES` whenever a subject's `explicitPreferences`/`explicitDislikes` contains a literal duplicate string — this replaces a prior no-op check (see "Audit finding" below). |

**Summary:** 2 of 8 attacks are resisted directly or structurally impossible; the
remaining 6 can move a companion number but are unmistakably visible in a mandatory
companion metric, warning, or reviewed source constant — none can silently improve the
primary metric while hiding the mechanism. One attack (generator-visibility drift) is
honestly disclosed as a residual, only partially-automated risk rather than claimed fully
solved.

## Audit finding: the pre-existing duplicate-evidence check was a no-op

The original `diagnosePreference` warning
`new Set(observed.map(r => \`${r.subjectId}:${r.id}:${r.evidenceCount}\`)).size !== observed.length`
could never fire: `records` already has exactly one row per `(subjectId, dimensionId)`
pair by construction (one entry per `DIMENSION_IDS.map`), so that composite key is always
unique regardless of `evidenceCount`. This hardening pass replaced it with
`DUPLICATED_EVIDENCE_PHRASES`, which actually inspects each subject's generated
`explicitPreferences`/`explicitDislikes` arrays for literal duplicate strings — the real
shape of a "duplicate easy evidence" attack. This is a bug fix to a diagnostic guardrail,
not a scoring/coefficient change; it does not affect any MAE value.

## Current-decoder honesty note (not a metric flaw)

`pairedDecoderVsConstant` on the DEVELOPMENT available-evidence eligible set currently
shows 21 decoder wins, 23 constant-5 wins, and 99 ties — the decoder is presently
indistinguishable from (slightly worse than) a constant-5 baseline on the two eligible
dimensions. This is a legitimate finding about current decoder quality, not something
this audit is asked to fix (the task explicitly forbids tuning coefficients or optimizing
scores in this pass). It is exactly the kind of result the primary metric and its
companions are designed to surface honestly for a future preregistered experiment, rather
than hide behind a favorable-looking aggregate number.
