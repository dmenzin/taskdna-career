# V3 coefficient governance

Machine inventory: `src/v3/coefficientGovernance.ts`.

This is **not** a calibration report. No listed coefficient is `EMPIRICALLY_JUSTIFIED`. Do not call these calibrated weights.

| Status | Meaning |
|---|---|
| `STRUCTURAL` | Algebra or identity required by the computational contract |
| `PROVISIONAL_BASELINE` | Required to make the scorer runnable; documented hypothesis candidate |
| `EMPIRICALLY_JUSTIFIED` | Estimated from independent data with a stated estimator — none today |
| `UNJUSTIFIED` | Free number without even a provisional rationale — none remain active |
| `EXPERIMENTAL_DISABLED` | Interface exists but must not silently affect scores |

Active behavioral coefficients include mapper Top-K/thresholds/margin/context weight, DWA partial credit `0.6`, the preference contribution transform, experience depth weights `1 / 0.75 / 0.4`, ownership weights `1 / 0.85 / 0.55 / 0.65`, and preferred-requirement weight `0.25`. The contextual reranker and Overall V3 score are `EXPERIMENTAL_DISABLED`.
