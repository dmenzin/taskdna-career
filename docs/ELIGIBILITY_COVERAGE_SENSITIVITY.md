# Eligibility coverage-floor sensitivity

`pnpm eval:eligibility-sensitivity` (`src/lab/eligibilitySensitivity.ts`,
`scripts/eligibility-sensitivity.ts`) reports, for a set of plausible generator-coverage
floors, which dimensions would be eligible for continuous autonomous MAE **solely as a
function of the threshold value**, holding every non-coverage requirement (bipolar
non-overlapping construct classification, correct-sign truth↔evidence association,
monotone quartile signal) fixed at what was actually measured on the 450-subject
`subject-lab.v2-onet` seed `20260823` population.

## Why this exists

The current 10% floor cited for `integration_preference` (see
`ELIGIBILITY_COVERAGE_FLOOR_POLICY` in `src/lab/preferenceTarget.ts`) is a **policy
parameter** — an evaluation-design tolerance for how many available-evidence subjects are
needed before a per-dimension MAE is trustworthy. It is not a scientific fact about
whether the dimension is a valid construct. This audit distinguishes construct invalidity
(compound semantics, overlap with another dimension, non-opposite poles) from mere
insufficient test coverage on an otherwise-valid construct.

## Result at seed 20260823, 450 subjects

| Floor | Eligible-by-coverage dimensions among coverage-gatable classifications |
|---|---|
| 0% | `measurable_feedback`, `experimentation_preference`, `integration_preference` |
| 5% | `measurable_feedback`, `experimentation_preference` |
| 10% | `measurable_feedback`, `experimentation_preference` |
| 20% | `measurable_feedback`, `experimentation_preference` |

Only dimensions classified `VALID_BIPOLAR_CONTINUOUS` or
`CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE` are coverage-gatable at all; every other
classification (overlap, compound/redefinition, two-independent-preferences) is excluded
for construct reasons that do **not** change with the coverage floor.

**Dimension whose eligibility flips solely because of the threshold:**
`integration_preference` (measured coverage ≈ 4.0%). It is eligible at a 0% floor and
ineligible at 5%/10%/20% floors. No other dimension flips across this floor range,
because every other dimension is either already far above all four floors
(`measurable_feedback` ≈ 58.7%, `experimentation_preference` ≈ 31.1%) or blocked by a
construct-level classification unrelated to coverage.

`integration_preference` is therefore labeled
`CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE`, not `WRONG_PRODUCT_CONSTRUCT` or
`OVERLAPS_ANOTHER_DIMENSION` — the construct is fine; the synthetic generator just rarely
produces exposed evidence for it (its phrase pool depicts cross-system/evidence-stream
integration work, which the current occupation/task sampling surfaces infrequently).

## Governance

- Changing `ELIGIBILITY_COVERAGE_FLOOR_POLICY.value` is a **metric-contract change**,
  reviewed the same way as changing `AUTONOMOUS_PREFERENCE_DIMENSIONS_V1` directly — never
  a routine experiment, and never done to move a metric number.
- This script and module are read-only diagnostics. They must never programmatically
  mutate `AUTONOMOUS_PREFERENCE_DIMENSIONS_V1` or the floor.
- Full machine-readable output: `artifacts/iteration_readiness/eligibility_coverage_sensitivity.json`.
