# Generalization audit

Command: `pnpm audit:generalization`

## What is being tested

Not "does the model memorize the failure-analyst fixture."

Whether a generic engine can:

- start from career text alone
- infer Task DNA without persona IDs
- rank functions from an ontology that is not frozen on medical devices
- keep Work Fit independent of network
- survive leave-one-domain-out slices
- keep preference and capability from collapsing

## Metrics (not one fake score)

Reported in `artifacts/logic_audit/generalization.json`:

- invariant / property pass rate
- counterfactual twin pass rate
- title-removal stability
- industry analog behavior
- same-experience / different-preference divergence
- network-variant Work Fit invariance
- holdout-domain pass rate
- OOD failure categories
- personalization leakage must-fix count
- hidden-truth MAE (coarse recovery, not a ranking score)

## Known weakness

Title-removal twins often produce identical resumes because many subjects already have misleading or generic titles. A no-op title strip is not proof of title independence. Task-first job matching and the same-title/different-work fixtures remain the stronger title-bias tests.

Hidden-truth MAE is about 1.9 / 10 on both labs (v1 ~2.0 after pass 2; O*NET v2 1.875 vs frozen baseline 1.845). That is expected under messy evidence and anti-circular generation. Pass 2 improved **discrimination and coverage**, not latent-vector recovery. Do not leak occupation into preference to chase MAE.

See `docs/PASS2_SCORECARD.md` and `docs/ONET_EXTERNAL_SHOCK_BASELINE.md`.
