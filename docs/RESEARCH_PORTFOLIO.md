# Research portfolio and micro-tuning protections

The 8-hour run must not become a hundred tiny redundant tweaks. The goal is **maximum
trustworthy information and useful architectural progress**, not maximum experiment count.

## Eight workstreams

`config/research-portfolio.json` holds the machine-readable portfolio. Each workstream records
its largest uncertainty, current hypothesis, current best strategy, strongest failed
alternative, highest-value next experiment, and evidence of diminishing returns.

| # | workstream | largest uncertainty (abridged) |
| --- | --- | --- |
| 1 | measurement / evaluation validity | Whether the repaired synthetic construct measures anything that transfers to real people. |
| 2 | preference representation + extraction | Whether a 17-dimension bipolar vector is the right representation at all. Only 2 of 17 dimensions are MAE-eligible. |
| 3 | Task/DWA mapping | Whether token-overlap retrieval distinguishes genuinely different work, or mostly matches shared generic vocabulary. |
| 4 | Preference Fit | Whether coverage-weighted mean stance contribution is the right aggregation, and how absence differs from neutrality. |
| 5 | Experience Fit | Whether self-reported strength and ownership carry usable signal, given the documented ownership ordering anomaly. |
| 6 | Qualification Fit | Ambiguous equivalence, which no fixed alias table can solve. |
| 7 | Direction Fit | Aspiration language is rare in resume-style text, making this the least-evidenced channel. |
| 8 | robustness / leakage / architecture | Whether title leakage is fully closed, and whether the harness is fast and modular enough to sustain many experiments. |

Workstream 5 (Experience) and workstream 7 (Direction) are deliberately separate and run in
parallel. Neither is derived from the other — see `docs/FOUR_CHANNEL_PARALLEL_SCOPE.md`.

The two currently strongest signals for prioritization:

- **Workstream 2** has the clearest binding constraint. `AVAILABLE_TO_RECOGNIZED_RECALL` is 0.31
  and prediction variance is under 10% of truth variance: the extractor misses roughly two
  thirds of the preference language the generator exposes, so predictions stay pinned near the
  neutral prior. Additive lexicon work has repeatedly moved recall a few points without changing
  that picture, and is explicitly deprioritized in favour of testing a different family.
- **Workstream 3** was blocked by cost, not by ideas, until the mapper became 55x faster in this
  preflight. It is now runnable for the first time.

## Every experiment declares four things

`pnpm experiment:new <id>` produces a record whose first section is validated by
`pnpm experiment:guard`:

- **Workstream** — must name or number a workstream in the portfolio
- **Expected information value** — `HIGH` / `MEDIUM` / `LOW`
- **Scope** — `LOCAL` / `SUBSYSTEM` / `ARCHITECTURAL`
- **Mechanism being tested** — the causal mechanism, not the code edit

The mechanism field is the important one. "Does DWA-level partial credit carry signal at all" is
a mechanism. "Change `DWA_PARTIAL_CREDIT` to 0.55" is a code edit dressed up as an experiment.

## Micro-tuning protections

`pnpm experiment:guard` enforces three rules and exits nonzero on any finding.
`tests/experiment-guard.test.ts` verifies each rule actually rejects what it claims to.

**Declaration.** All four fields present, workstream known, information value and scope drawn
from the declared vocabularies.

**Anti-repetition.** After two consecutive experiments on substantially the same mechanism, a
third requires a written `Repeat justification` arguing why it has greater information value
than switching workstreams. Mechanism descriptions are normalized aggressively — filler words,
tuning verbs, and numbers are stripped, then remaining words are sorted — so a reworded
restatement of the same mechanism collides with it rather than resetting the counter. Switching
mechanisms resets the run.

**Preregistered parameter search.** A mechanism mentioning thresholds, coefficients, weights,
regexes, keywords, lexicon entries, prompt variants, multipliers, constants, epsilons, or
tolerances is rejected unless `Parameter search preregistered: yes`. This is what makes
`0.60 -> 0.62 -> 0.64 -> 0.66` a hard failure instead of a matter of discipline. A genuine
sweep is still allowed; it just has to be declared as one up front.

The guard is importable without side effects, so its logic is unit-tested directly rather than
through the CLI.

## Portfolio review cadence

Every **60 to 90 minutes** (`reviewCadenceMinutes` in the portfolio JSON), stop and ask:

- What is now the biggest uncertainty?
- Which subsystem is limiting progress?
- Are we repeatedly testing the same mechanism?
- Are returns diminishing?
- Is the representation or model family itself wrong?
- What fundamentally different approach has not been tried?
- Should another workstream now have priority?

Then reprioritize and update the affected workstream entries in
`config/research-portfolio.json`. The portfolio is a living document; leaving
`diminishingReturnsEvidence` at "none yet" after six experiments in one workstream is itself a
finding.

## Model family is not precommitted

No neural model is added in this preflight, and none should be added to look sophisticated. CNNs
in particular are not precommitted to and are a poor default: this project is language plus
structured Task/DWA matching, not a domain with local spatial structure. Transformers,
embedding retrievers, cross-encoders, LLMs, and rules are all candidate families **where
appropriate**, and the choice must emerge from comparative evidence on the same evaluators. The
architecture (`docs/HYBRID_AGENT_READINESS.md`) exists so those comparisons are clean.

## Related

- `config/research-portfolio.json` — the machine-readable portfolio
- `scripts/experiment-guard.ts`, `tests/experiment-guard.test.ts`
- `experiments/templates/EXPERIMENT.md` — the record template
- `docs/AUTONOMOUS_ITERATION_PROTOCOL.md` — the loop itself
