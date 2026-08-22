# Logic scorecard

Executable source: `pnpm audit:logic` → `artifacts/logic_audit/latest.md`.

This scorecard grades **internal logical defensibility**, not labor-market truth.

## Latest grades

Pass 2 24-component card and the 18 final questions: `docs/PASS2_SCORECARD.md`.

From the 2026-08-22 pass-2 v1-lab re-run (seed `20260822`, lab `subject-lab.v1`) after evidence-class repairs:

| Claim | Grade | Meaning |
|---|---|---|
| Evidence dependence | A | Career text changes relative Work Fit |
| Preference vs capability | A | Constructs do not collapse |
| Confidence honesty | A | Sparse input stays low-confidence |
| Determinism | A | Same input, same ranking |
| Personalization leakage | A | No persona-id branches in the engine |
| Holdout properties | B | Locked v1 subjects keep coarse properties (89%) |
| Counterfactual twins | C | 78% twin pass; same-experience / different-preference is harder once exposure cannot move preference |
| Zero-origin | A | Generic users initialize without golden fixtures |
| Domain holdout | A | Finance/sales/ops/UX/software/hardware slices run |
| Rank stability | A | Tiny noise does not scramble ranks |
| Hidden-truth recovery | D | MAE ≈ 1.87 / 10 — coarse, not calibrated |
| **Overall sandbox trust** | **B** | Coherent hypotheses, not career truth |

## Final recommendation

Use this prototype as an **inspectable sandbox** for work-structure hypotheses and networking strategy drafts.

Do **not** treat Overall, CAF, hireability, or next-best actions as calibrated probabilities or hiring outcomes.

The engine is no longer a UI that only agrees with its own fixtures. It is still a pile of versioned heuristics. The difference is that the heuristics are now testable, configurable, and falsifiable.

## What remains arbitrary

- Overall weights (hireability 0.40)
- Social-cost integers and ask-readiness priors
- Keyword lexicons for Task-DNA extraction
- Extended function membership
- Action-tier cliffs
- Default commute region

## What would raise the grade

- Calibrated confidence against real outcomes
- Human-beta calibration of remaining weights (O*NET 30.3 is now ingested; it did not calibrate preference)
- Human review of 30+ recommendations outside the technical demo pack
- Tighter title-removal tests that actually change observable text
