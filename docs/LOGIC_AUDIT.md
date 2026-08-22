# Logic audit

Deeper computational-brain pass completed 2026-08-22.

This document is implementation ground truth plus the findings. Earlier product-audit cycles live in `docs/SELF_CRITIQUE.md`.

## Baseline (before this pass)

`pnpm lint`, `pnpm typecheck`, `pnpm test` (7 files / 35 tests), `pnpm eval`, `pnpm eval:network`, `pnpm test:e2e` (16 tests), `pnpm build` all passed.

That baseline proved the sandbox ran. It did not prove the engine was generic.

## Computational pipeline

Career path:

career text → `extractEvidence` (deduped sentences, keyword signals, sentiment inversion) → `inferTaskDna` (prior or neutral prior, weighted blend, contradiction, capped confidence) → `inferCapabilities` (evidence-tied levels) → `scoreFunctions` / `analyzeJob` (task-first function matching; extended ontology for generic users) → `scoreJobs`:

- rawPredictedFit = 10 - mean(|user - job|) over 17 dimensions, clamped 1..10
- negativeFitRisk = repellent keyword matches (0..10)
- predictedFit = rawPredictedFit - negativeFitPenalty * negativeFitRisk
- confidence = mean(profile confidence, classification confidence), clamped 0.2..0.95
- CAF = predictedFit - 2 * (1 - confidence)
- hireability = 0.72 * capabilityAlignment*10 + 2.8 * requirementsLegibility - 0.65 * hardGaps - seniorityPenalty
- careerDirection = 0.62 * fit + 0.18 * capabilityAlignment + 0.2 * (10 - negativeFitRisk)
- overall = 0.40*hireability + 0.30*CAF + 0.15*direction + 0.10*growth + 0.05*durability - 0.12*negativeFitRisk
- actionTier / sellability from configured thresholds

Network path:

relationship intake → `assessContactForOpportunity` (information / routing / credibility / referral / advocacy + ask-readiness + social cost) → `findNetworkPaths` (direct + second degree, hop penalty, credibility ×0.6 per hop) → `assessOpportunityAccess` → `createPursuitPlan` → `createInteractionPlan` → `composeDeterministicDraft` → `planNextBestActions`.

Generic users use `createHumanOpportunityGraphFromIntake`. Demo personas still hydrate from the synthetic universe.

## Failures found and fixed

1. **P0 fixture leakage.** `extractEvidence` / `inferTaskDna` / `inferContradictions` branched on persona IDs. Removed. Generic path is `buildProfileFromCareerInput`.
2. **P0 no persona-free entry point.** Added. Zero-origin now initializes.
3. **P1 duplicate-evidence inflation.** Sentences are deduped; effective signals are capped.
4. **P1 missing-data semantics.** Unknown dimensions use `unknownDimensionConfidence`.
5. **P1 title leakage.** Job matching is task-first; titles are last resort.
6. **P1 `DO_NOT_CONTACT` ignored.** Outreach planning now respects the event.
7. **P1 robotics persona-id leak in capabilities.** Replaced with generic coursework / "no professional" language.
8. **P1 `expectedHighFunctions` used as a model input** for novelty and network gaps. Replaced with current-field overlap and inferred top functions.
9. **P1 adaptive interview collapsed** to the same scenarios after leakage removal. Selection now uses preference lean, unknown coverage, and top-function separation.
10. **P1 frozen technical ontology.** Extended knowledge-work functions are used for generic / lab subjects. Demo personas keep the original pack so golden evals stay honest about scope.
11. **P2 inline constants.** Inference weights live in `scoringConfig.inference`.
12. **Scorecard overclaim (cycle 2).** First audit run minted an A while hidden-truth MAE was 1.87/10. Recovery is now graded separately and overall sandbox trust is capped at B.

## Remaining weak points

- Hidden Task DNA is only coarsely recovered. That is partly intentional (messy evidence) and partly a weak lexicon.
- Title-removal twins are often no-ops because adversarial subjects already have misleading titles.
- Hireability is still lexical.
- Social-cost and action weights are uncalibrated.
- The demo job corpus is still technically dense.
- SQLite persistence is still a documented boundary.

## Commands

```bash
pnpm audit:logic
pnpm audit:sensitivity
pnpm audit:stability
pnpm audit:parameters
pnpm eval:unseen
pnpm audit:generalization
pnpm audit:zero-origin
pnpm audit:domain-holdout
pnpm subjects:generate
pnpm subjects:inspect subject-001
pnpm subjects:validate
pnpm subjects:regenerate --seed=20260822
```

Outputs land in `artifacts/logic_audit/` and `artifacts/subjects/`.

## Pass 2 (O*NET)

Phase A froze `artifacts/logic_audit/onet_external_shock_baseline.json` on the unchanged pass-1 engine. Phases B–D repaired generic logic, then `pnpm eval:onet-shock` wrote `onet_shock_latest.json` without touching the baseline.

Headline comparison (450 O*NET-backed subjects, seed `20260823`):

| Metric | Phase A baseline | Pass 2 candidate |
|---|---|---|
| Hidden-truth MAE | 1.845 | 1.875 (no gain; do not leak truth) |
| Work-Fit spread | 0.29 | 1.99 |
| Work-Fit mean | 9.53 | 7.41 |
| Neutral job vectors | 99.6% | work-structure reading; 94.7% of occupations hit ≥1 dimension |
| Technical-demo top function | ~100% modeling-simulation on the universe | 36% of subjects |
| Hireability stuffing | false | false (after dump-stripping repair) |
| Twin pass | 68% same-pref/diff-exp | 85% overall; 95% same-pref/diff-exp |
| Invariants | pass | pass |
| NBA feasible | 100% | 100% |

See `docs/PASS2_SCORECARD.md`, `docs/ONET_EXTERNAL_SHOCK_BASELINE.md`, `docs/TASKDNA_DIMENSION_COVERAGE.md`, `docs/HIREABILITY_AUDIT.md`, `docs/NETWORK_LOGIC_AUDIT.md`, `docs/NEXT_BEST_ACTION_AUDIT.md`.

## Related docs

- `docs/LOGIC_SCORECARD.md`
- `docs/PASS2_SCORECARD.md`
- `docs/LOGIC_INVARIANTS.md`
- `docs/LOGIC_PARAMETER_REGISTRY.md`
- `docs/VIRTUAL_SUBJECT_LAB.md`
- `docs/GENERALIZATION.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/ONET_INTEGRATION.md`
- `docs/EXTERNAL_DATA.md`
