# Autonomous iteration protocol

## Entry

1. Run `pnpm eval:iteration-readiness`; stop on any failure.
2. Read `docs/RESEARCH_PORTFOLIO.md`, `config/research-portfolio.json`,
   `config/product-critical-subsystems.json`, `docs/EXPERIMENT_TIERS.md`,
   `docs/EXPERIMENT_PERMISSIONS.md`, `docs/V3_COMPUTATIONAL_CONTRACT.md`, and
   `docs/BASELINE_MANIFEST.md`.

## Loop

1. Pick the highest-value unresolved issue **from a workstream**, guided by that workstream's
   `highestValueNextExperiment` and `diminishingReturnsEvidence`. Stay inside
   `docs/EXPERIMENT_PERMISSIONS.md`.
2. Run `pnpm experiment:new <id>` and complete the portfolio declaration (Workstream, Expected
   information value, Scope, Mechanism being tested) **and** every preregistration field, before
   writing code. Run `pnpm experiment:guard`.
3. Make one conceptual change.
4. Run the FAST tier: `pnpm eval:fast` (or `pnpm eval:fast -- <subsystem>`). Seconds, not
   minutes. Do not run `pnpm build`.
5. Inspect distributions, coverage, variance, paired examples, wins and regressions — not just
   summary MAE.
6. Attack Goodhart risks: constant-5 and shrinkage comparison, mean/variance collapse,
   zero-available-evidence-only gains, coverage loss, abstention, and duplicate evidence
   (within-field and cross-source).
7. Apply an independent review lens. Run VALIDATION only to confirm a preregistered DEVELOPMENT
   result.
8. Record KEEP, REVERT, or INCONCLUSIVE. KEEP only when the primary construct metric and all
   guardrails support it. REVERT failures. INCONCLUSIVE speculative scoring must be reverted or
   disabled, never left silently active.
9. Commit code and the completed record together, then choose the next issue.

Every 45 to 90 minutes, or after a subsystem milestone: `pnpm eval:checkpoint`.

Every 60 to 90 minutes: a global portfolio review (see below).

At the beginning, at the end, and after any major architecture change: the FULL tier
(`pnpm eval:iteration-readiness`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`).

Rotate review lenses: (1) measurement scientist, (2) synthetic-lab adversary, (3) task/ontology
engineer, (4) score-semantics engineer, (5) red-team evaluator, (6) reproducibility/software
reviewer.

## Portfolio review

Approximately every 60 to 90 minutes, stop experimenting and ask:

- What is now the biggest uncertainty?
- Which subsystem is limiting progress?
- Are we repeatedly testing the same mechanism?
- Are returns diminishing?
- Is the representation or model family itself wrong?
- What fundamentally different approach has not been tried?
- Should another workstream now have priority?

Then reprioritize and update the affected entries in `config/research-portfolio.json`.

The goal is **maximum trustworthy information and useful architectural progress**, not maximum
experiment count.

## Prohibited

- Repetitive hill climbing (`0.60 -> 0.62 -> 0.64 -> 0.66`) without a preregistered
  parameter-search experiment. `pnpm experiment:guard` rejects it.
- A third consecutive experiment on substantially the same mechanism without a written
  justification for why it beats switching workstreams.
- Endless regex additions, keyword tweaks, coefficient nudging, threshold nudging, or prompt
  variants while major architectural questions are unresolved.
- Tuning to `LOCKED_CONFIRMATION`.
- Selecting a shrinkage lambda by best MAE.
- Optimizing `LEGACY_ALL_DIMENSION_MAE` as if it were product quality.
- Collapsing the four product channels, or introducing an Overall V3 score.
- Changing generator or evaluation-design parameters (phrase pools, eligibility thresholds,
  coverage floors, availability definitions) to flatter a metric. Those are metric-contract
  changes requiring the same review as changing the metric itself.
- Letting a model or agent author a final channel score, or opening a person-by-job model loop.
- Requiring a Next.js build after every experiment.

## Stop conditions

Continue until the budget is nearly exhausted, autonomously testable high-value issues are
exhausted, or a genuine human-ground-truth or security blocker is reached. Synthetic metrics
never establish real Task/DWA mapping accuracy, real
Preference/Experience/Qualification/Direction Fit validity, or real recommendation quality.
Stop at that boundary; never label your own predictions as ground truth.
