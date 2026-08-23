# Experiment permissions and evaluation splits

## Modes

- **DEVELOPMENT**: ordinary iteration; synthetic `design` subjects and development fixtures. May guide changes.
- **VALIDATION**: explicit confirmation on the fixed synthetic validation slice. It may decide a preregistered experiment after development.
- **LOCKED_CONFIRMATION**: historical holdout, available only with `--confirm-locked`. It has already been visible and is **not pristine**; do not run it routinely or claim unseen-test evidence. A future final set must be collected/annotated by an independent custodian after hypotheses and code are frozen, stored outside agent access, and evaluated once.

`pnpm eval:preference -- --mode=DEVELOPMENT` and `--mode=VALIDATION` are allowed. The locked form requires both the explicit mode and confirmation flag. Readiness never invokes it.

## AUTONOMOUSLY EVALUABLE

Synthetic preference decoder semantics (available-evidence macro primary plus available/recognized micro, recall, coverage, variance and collapse guards); generator correctness and monotonicity; invariance; deterministic cache/provenance; code correctness; runtime; channel isolation; known-answer scoring fixtures.

## AUTONOMOUSLY EXPERIMENTAL BUT NOT VALIDATED

Mapper retrieval, contextual reranking, abstention and DWA fallbacks evaluated on development fixtures, plus fit-equation alternatives on synthetic/known-answer fixtures. Results describe fixture behavior, never independent accuracy or human validity.

## REQUIRES INDEPENDENT HUMAN GROUND TRUTH

Real Task/DWA mapping accuracy and abstention quality; real Preference, Experience, Qualification and Direction Fit; end-to-end job ranking; career recommendation validity. The agent must stop at this boundary rather than label its own predictions as truth.
