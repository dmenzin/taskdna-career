<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:taskdna-experiment-rules -->

# TaskDNA experiment rules

These rules bind every future Cursor agent on this repository. They do not replace the Next.js block above.

## Channel independence

- Preserve Preference / Experience / Qualification / Direction independence.
- Exposure is not preference. Aspiration is not experience.
- Do not optimize an Overall V3 score. Do not introduce one.

## Metrics

- Legacy all-17D MAE is not product quality.
- Primary synthetic metrics must use evaluation sets independent of the algorithm's own recognition behavior.
- Report available and recognized evidence separately.
- A missed extraction must not remove a case from the primary denominator.

## Splits

- Development first.
- Validation only for preregistered confirmation.
- LOCKED_CONFIRMATION is never used for tuning.

## Experiment discipline

- Every behavioral experiment is preregistered.
- One conceptual change at a time.
- Inspect distributions and examples.
- Attack Goodhart mechanisms.
- Record KEEP / REVERT / INCONCLUSIVE.
- Speculative/inconclusive scoring rules should not silently remain enabled.

## Validity boundary

- Human mapping/fit/recommendation validity requires independent human truth.
- Never mutate frozen baseline or hidden truth to improve a score.

## Process

- Commit and push meaningful checkpoints.

<!-- END:taskdna-experiment-rules -->
