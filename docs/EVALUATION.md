# Evaluation

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
pnpm test      # 6 files, 28 tests
pnpm eval
pnpm eval:network
pnpm test:e2e  # 12 Playwright tests
pnpm export:demo
pnpm build
```

All passed on 2026-08-22.

V2 update:

- `pnpm test` now includes `tests/network-engine.test.ts` for Human Opportunity Graph behavior.
- `pnpm eval:network` checks golden human-strategy cases and generic network invariants.
- `pnpm test:e2e` now runs 16 Playwright tests, including V2 dashboard and standalone opportunity graph export.
