<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:taskdna-experiment-rules -->

# TaskDNA persistent experiment rules

These rules persist across all future Cursor agent sessions on this repository,
including any autonomous iteration loop. Read `docs/AUTONOMOUS_ITERATION_PROTOCOL.md`,
`docs/EXPERIMENT_PERMISSIONS.md`, `docs/V3_COMPUTATIONAL_CONTRACT.md`, and
`docs/BASELINE_MANIFEST.md` before making product-scoring changes.

- **Channel independence.** Preference, Experience, Qualification, and Direction Fit
  (`src/v3/fit.ts`) are four independent computational outputs. No channel reads another
  channel's evidence collection. Never collapse them into a single score.
- **No Overall V3 score.** Do not introduce, optimize, or imply a combined/Overall score
  for V3. `docs/V3_COMPUTATIONAL_CONTRACT.md` states this deliberately.
- **Legacy all-17D MAE is not product quality.** `LEGACY_ALL_DIMENSION_MAE` (and any
  full-vector recovery metric) is a compatibility diagnostic only, never a claim about
  mapper accuracy, job fit, or recommendation quality.
- **Primary synthetic metrics must be independent of the algorithm's own recognition
  behavior.** A metric whose inclusion set depends on what the extractor/decoder under
  test recognized (e.g., the superseded `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1`)
  lets the algorithm shrink its own denominator — a selection-bias/Goodhart path. Define
  eligibility from what the observation GENERATOR exposed
  (`src/lab/evidenceAvailability.ts`), not from extractor output.
- **Report available and recognized evidence separately.** Always report
  `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` (primary) alongside
  `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`/`MICRO`, `AVAILABLE_TO_RECOGNIZED_RECALL`,
  `ZERO_AVAILABLE_EVIDENCE_MAE`, and `LEGACY_ALL_DIMENSION_MAE`. Never publish the primary
  metric alone.
- **DEVELOPMENT first.** Ordinary iteration uses the synthetic DEVELOPMENT split. Use
  VALIDATION only to confirm a preregistered DEVELOPMENT result.
- **LOCKED_CONFIRMATION is never used for tuning.** It is a guarded, already-visible
  historical holdout (`selectEvaluationSplit(..., "LOCKED_CONFIRMATION")` throws without
  `--confirm-locked`), not a pristine unseen test. A real final set must come from an
  independent custodian after hypotheses and code are frozen.
- **Every behavioral experiment is preregistered.** Run `pnpm experiment:new <id>` and
  complete every preregistration field before writing code.
- **One conceptual change at a time.** Do not bundle unrelated hypotheses into one
  experiment; each preregistration should test exactly one conceptual change.
- **Inspect distributions and examples, not just summary MAE.** Look at coverage,
  variance, paired wins/regressions, and specific examples before trusting a metric
  delta.
- **Attack Goodhart mechanisms on every change.** Constant-5/shrinkage comparison,
  mean/variance collapse, zero-evidence-only gains, coverage loss, abstention, and
  duplicate evidence must all be checked (`docs/PREFERENCE_METRIC_RED_TEAM.md` documents
  the known attack surface and current guardrail status for the preference metric).
- **Record KEEP / REVERT / INCONCLUSIVE for every experiment.** KEEP only when the
  primary construct metric and all guardrails support it. REVERT failed changes.
- **Inconclusive or speculative scoring rules must not silently remain enabled.** If an
  experiment is INCONCLUSIVE, revert or explicitly disable the change — never leave it
  active by default while unresolved.
- **Human mapping/fit/recommendation validity requires independent human truth.**
  Synthetic/autonomous metrics (`docs/EXPERIMENT_PERMISSIONS.md`'s "AUTONOMOUSLY
  EVALUABLE" and "AUTONOMOUSLY EXPERIMENTAL BUT NOT VALIDATED" sections) never establish
  real Task/DWA mapping accuracy, real Preference/Experience/Qualification/Direction Fit
  validity, or real recommendation quality. Stop at that boundary; do not label your own
  predictions as ground truth.
- **Never mutate the frozen baseline or hidden truth to improve a score.** The
  `VERIFIED_FROZEN_BASELINE` artifact in `config/baseline-manifest.json` and any
  generator hidden-truth vector are read-only from the algorithm's perspective. Changing
  generator/evaluation-design parameters (thresholds, phrase pools, coverage floors,
  eligibility sets) to flatter a metric is prohibited; such changes are metric-contract
  changes requiring the same review as changing the metric itself, not decoder
  experiments.
- **Coefficient governance status is not calibration.** Every active V3 coefficient
  (`src/v3/fit.ts`) has an explicit status in `src/v3/coefficientGovernance.ts` /
  `docs/V3_COEFFICIENT_INVENTORY.md`. `PROVISIONAL_BASELINE` and `UNJUSTIFIED` values may
  remain runnable defaults, but must never be described as calibrated weights, and tests
  must never imply their human validity.
- **Commit and push meaningful checkpoints.** Commit code and the completed experiment
  record together at the end of each experiment iteration, then choose the next issue.
  Never leave uncommitted product-scoring changes at the end of a session.

<!-- END:taskdna-experiment-rules -->
