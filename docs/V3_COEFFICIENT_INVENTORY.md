# V3 active coefficient inventory and governance status

This inventory covers the coefficients actually used by `src/v3/fit.ts` (the V3
four-channel scorer introduced for the autonomous-iteration bridge). It is distinct from
`docs/COEFFICIENT_REGISTRY.md`, which inventories the older, separate `scoringConfig` /
network-weight system (`src/config/model.ts`, `src/config/network.ts`) used by the legacy
engine (`src/domain/engine.ts`). The two systems do not share coefficients.

The machine-readable source of truth is `src/v3/coefficientGovernance.ts`, which imports
the live constants from `src/v3/fit.ts` directly (so this table cannot silently drift from
the code) and is guarded by `tests/v3/coefficientGovernance.test.ts`. **No value listed
below was changed by this audit** — only named and classified. Governance status is not a
calibration and never implies human validity.

## Status legend

| Status | Meaning |
|---|---|
| `STRUCTURAL` | A necessary consequence of the score's defined range/shape, not an empirical or heuristic weight. |
| `PROVISIONAL_BASELINE` | Hand-chosen so the scorer is runnable at all. Documented, never claimed calibrated, and a candidate hypothesis for the future preregistered experiment framework. |
| `EMPIRICALLY_JUSTIFIED` | Fit to data with a stated estimator. **None currently qualify.** |
| `UNJUSTIFIED` | No defensible rationale offered, including internal ordering anomalies. |
| `EXPERIMENTAL_DISABLED` | Interface exists but has no active default effect. |

## Active V3 coefficients

| Coefficient | Value | Location | Status | Affects | Rationale |
|---|---|---|---|---|---|
| `DWA_PARTIAL_CREDIT` | `0.6` | `match()` | `PROVISIONAL_BASELINE` | preference/experience/direction credit for a DWA-level (non-exact-Task) match | Fixed semantic fallback, not empirically validated; required for the DWA tier to differ from abstention. Also documented in `docs/V3_COMPUTATIONAL_CONTRACT.md`'s metadata-status table (`USED`, "fixed semantic fallback of 0.6, not empirically validated"). |
| `PREFERENCE_SCORE_CENTER` | `0.5` | `preferenceFit()` | `STRUCTURAL` | preference-fit output range | Centers a signed mean contribution at the score's neutral midpoint; the only value consistent with "no evidence ⇒ neutral 0.5" on a `[0,1]` scale. |
| `PREFERENCE_SCORE_SPAN` | `2` | `preferenceFit()` | `STRUCTURAL` | preference-fit output range | Affine rescale of a `[-1,1]`-bounded mean contribution onto `[0,1]`; a range conversion, not a sensitivity weight. |
| `EXPERIENCE_STRENGTH_WEIGHTS` | `{deep:1, demonstrated:0.75, weak:0.4}` | `strength()` | `PROVISIONAL_BASELINE` | experience-fit credit by self-reported depth | Ordinal order is defensible; magnitudes are hand-chosen, not estimated. |
| `EXPERIENCE_OWNERSHIP_WEIGHTS` | `{led:1, performed:0.85, assisted:0.55, unknown:0.65}` | `ownership()` | `UNJUSTIFIED` | experience-fit credit by ownership | **Ordering anomaly:** `unknown` (0.65) scores strictly higher than the explicit lesser-ownership claim `assisted` (0.55). No rationale is recorded anywhere for ranking unknown ownership above an explicitly-stated lesser one. Flagged, not silently "fixed" — see governance note below. |
| `PREFERRED_REQUIREMENT_WEIGHT` | `0.25` | `qualificationFit()` | `PROVISIONAL_BASELINE` | qualification-fit weight for non-required ("preferred") requirements | Hand-chosen down-weight so preferred requirements matter less than required ones without being invisible; not empirically estimated. |

## Governance notes

- **Zero coefficients above are `EMPIRICALLY_JUSTIFIED`.** None have been fit to data or
  validated against human ground truth. Treating any of them as "calibrated" is a
  forbidden interpretation (`docs/V3_COMPUTATIONAL_CONTRACT.md`).
- **`EXPERIENCE_OWNERSHIP_WEIGHTS` is `UNJUSTIFIED`**, not `PROVISIONAL_BASELINE`, because
  the anomaly (`unknown` > `assisted`) has no stated rationale and is not merely
  "unvalidated" — it looks like an authoring inconsistency. Per the audit instructions,
  this pass does **not** tune it. It is recorded as a candidate hypothesis for a future
  preregistered experiment (e.g., "does `unknown` ownership credit exceeding `assisted`
  change experience-fit rankings in a way that matters, and if so, which ordering is
  actually defensible?").
- None of these coefficients are implied to be human-valid by any test in
  `tests/v3/bridge.test.ts` or `tests/v3/coefficientGovernance.test.ts`; those tests check
  internal consistency (e.g., LIKE > NEUTRAL > DISLIKE ordering, channel isolation,
  dedup/negation semantics), never real-world fit quality.
- Mapper coefficients (`MAPPER_CONFIG.topK/taskThreshold/dwaThreshold/taskMargin/contextWeight`
  in `src/v3/mapper.ts`) are out of scope for this table; they are already governed by the
  metadata-status table in `docs/V3_COMPUTATIONAL_CONTRACT.md` (similarity `USED` for
  retrieval, diagnostic confidence `DIAGNOSTIC_ONLY`).
