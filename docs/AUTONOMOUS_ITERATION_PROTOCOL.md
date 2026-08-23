# Autonomous iteration protocol

## Entry and loop

1. Run `pnpm eval:iteration-readiness`; stop on any failure. Read the baseline and metric registries and this protocol.
2. Select the highest-value unresolved issue within `EXPERIMENT_PERMISSIONS.md`.
3. Run `pnpm experiment:new <id>` and complete every preregistration field **before code**.
4. Make one conceptual change. Run construct-specific DEVELOPMENT metrics; inspect distributions, coverage, variance, paired examples, wins and regressions.
5. Attack Goodhart risks: constant-5/shrinkage comparison, mean/variance collapse, zero-evidence-only gains, coverage loss, abstention, and duplicate evidence.
6. Apply an independent review lens; then run VALIDATION only if preregistered development guardrails pass.
7. Record KEEP, REVERT, or INCONCLUSIVE. KEEP only when the primary construct metric and all guardrails support it. REVERT failed changes. INCONCLUSIVE speculative scoring must be reverted or disabled—never silently active.
8. Commit code and completed record, then choose the next issue.

Rotate: (1) measurement scientist, (2) synthetic-lab adversary, (3) task/ontology engineer, (4) score-semantics engineer, (5) red-team evaluator, (6) reproducibility/software reviewer.

Continue until budget is nearly exhausted, autonomously testable high-value issues are exhausted, or a genuine human-ground-truth/security blocker is reached. Never tune to LOCKED_CONFIRMATION, select shrinkage lambda by best MAE, optimize the legacy MAE as product quality, or collapse the four product channels.
