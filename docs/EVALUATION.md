# Evaluation

For the O*NET 450-subject lab, hidden-truth MAE, holdout, baseline freeze, and leakage audit, see `docs/EVALUATION_SPEC.md`. The 15-persona harness below is separate and does not define Hidden-truth MAE.

The deterministic harness in `runEvaluation()` covers 15 personas and checks:

- persona/function alignment,
- high work fit with lower hireability,
- high hireability with lower work fit,
- same title / different tasks,
- different titles / same tasks,
- sparse evidence lower confidence.

Run:

```bash
pnpm eval
pnpm test
```

Adversarial audit coverage added:

- `tests/evidence-taskdna.test.ts`: evidence extraction, provenance, confidence, contradictory evidence.
- `tests/adaptive-interview.test.ts`: adaptive selection, scenario response updates, early stopping.
- `tests/scoring-boundaries.test.ts`: CAF, overall formula, tier thresholds, sellability, raw score preservation.
- `tests/job-intelligence.test.ts`: actual-work summaries, title-bias cases, novelty, freshness, canonicalization, hard filters, commute.
- `tests/active-learning-filters.test.ts`: feedback snapshots, ranking changes, no capability fabrication, filtering/sorting.
- `tests/e2e/taskdna-flows.spec.ts`: five persona flows across desktop/mobile plus standalone export behavior.

Latest full gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval
pnpm eval:network
pnpm eval:unseen
pnpm audit:logic
pnpm test:e2e
pnpm export:demo
pnpm build
```

Unit tests: 11 files / 47 tests after the logic-audit pass.

V2 update:

- `pnpm test` now includes `tests/network-engine.test.ts` for Human Opportunity Graph behavior.
- `pnpm eval:network` checks golden human-strategy cases and generic network invariants.
- `pnpm test:e2e` now runs 16 Playwright tests, including V2 dashboard and standalone opportunity graph export.

Logic-audit update:

- `tests/logic-invariants.test.ts`, `tests/virtual-subjects.test.ts`, `tests/zero-origin.test.ts`, `tests/logic-metamorphic.test.ts`.
- `pnpm audit:logic` writes `artifacts/logic_audit/latest.json` and `latest.md`.
- Hidden-truth MAE is reported separately from property pass rates so the scorecard cannot hide coarse recovery.
