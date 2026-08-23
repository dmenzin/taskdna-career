# Research contract amendments

Adopted 2026-08-23 at the start of the agent-first runtime research run, on branch
`cursor/taskdna-agent-first-runtime-research` (forked from checkpoint
`fbf0706df1fdc8752509650dc52b06b7f0152923`).

These amendments sit alongside `AGENTS.md`, not above it. Where an amendment is stricter than
an existing rule, the stricter one governs. Nothing here relaxes benchmark-integrity,
four-channel-independence, LOCKED, or baseline rules.

---

## A. STOPPING RULE

**Scientific benchmark integrity outranks reaching later phases.**

- Completing benchmark rewiring, acceptance, and full re-baselining **is a successful run**.
  A run that ends after Phase 2 with defensible gates is a better outcome than one that
  reaches Phase 7 on a benchmark nobody can trust.
- Do **not** rush or thin the benchmark in order to reach the agent experiments.
- Do **not** begin agent architecture optimization until the new benchmark acceptance gates
  pass. Building provider plumbing (Phase 3) in parallel is permitted because it is
  infrastructure, not optimization; **scoring a candidate architecture is not.**
- If time runs short, the correct action is to stop with a frozen, accepted benchmark and an
  honest statement of what was not reached — never to ship a rushed benchmark plus
  architecture claims resting on it.

## B. HARD RUNTIME API BUDGET

| limit | value |
| --- | --- |
| external runtime-agent spend | **$25.00 USD** |
| runtime model calls | **1,000** |

- Both limits are **enforced in code and telemetry**, not prose:
  `src/agent/budget.ts` refuses the call that would breach either ceiling, and the ledger is
  persisted so the cap survives process restarts within the run.
- **Cache all reusable calls.** A cache hit consumes no budget. Every behaviour-changing input
  belongs in the cache key (`docs/CACHE_AUDIT.md`).
- Before any batch projected to consume **>20% of remaining budget**, first state the expected
  information value and use the smallest statistically useful **paired** sample. If a smaller
  paired design answers the same question, the larger batch is not authorized.
- **Claude Code interactive/tool usage is not counted** as application runtime-agent spend.
  Only calls made by application code through the provider boundary count.
- If accurate cost cannot be obtained from the provider, estimate it conservatively from
  recorded token counts and configured pricing, and label it
  `costIsEstimate: true`. **Never invent pricing.** Unknown pricing is recorded as unknown and
  charged at the configured conservative rate, not silently as zero.
- Credentials are never serialized: not into telemetry, cache keys, artifacts, logs or commits.

## C. BENCHMARK DESIGN FREEZE

Before scoring **any** candidate architecture on the new benchmark:

1. Preregister and **version** the family definitions: `NATURAL`, `SEMANTIC_BRIDGE`,
   `LEXICAL_TRAP`, and `TITLE_INDUSTRY_COUNTERFACTUAL`.
2. Define each family's hidden truth and inclusion rules **before** rendering any surface text.
3. Define the acceptance and leakage tests for each family, including the per-family lexical
   AUC expectation. `NATURAL` is **not** required to sit at 0.50.
4. Freeze the benchmark design and the observed DEVELOPMENT / VALIDATION inputs. Candidate
   architectures all see the same frozen inputs.
5. **Do not later alter family difficulty to favor a candidate architecture.** Difficulty is
   set once, before any architecture is scored.

Genuine benchmark defects may still be repaired — but only through the existing scientific
incident process: record the defect, repair it, **rerun every baseline**, and explicitly
invalidate results that are no longer comparable. A repair that happens to help the
architecture currently being tested demands more scrutiny, not less.

Report every family **separately**. Never average the families into a single number.

## D. METRIC CONTRACTS

- Every metric used to **KEEP / REJECT** an architecture must have a valid contract in
  `config/metric-contracts.json` and a runnable evaluator, or be explicitly marked
  `EXPLORATORY` / non-optimizable.
- An `EXPLORATORY` metric may be reported and inspected. It may **not** be the basis of a
  KEEP/REJECT verdict, and it may not be optimized against.
- Extend `config/metric-contracts.json` and `pnpm audit:metric-contracts` as new decision
  metrics become real.
- **Prefer a small set of decision-grade metrics over sixty decorative ones.** The
  end-of-run report asks many questions; that does not license a metric per question. A metric
  nobody would act on is a slice to inspect, not a contract to maintain.

---

## Relationship to the standing rules

Unchanged and still binding: no Overall V3 score; four-channel independence; benchmark labels
never come from the algorithm; DEVELOPMENT first, VALIDATION sparingly, **LOCKED_CONFIRMATION
never executed during this run**; never mutate the frozen baseline or hidden truth to improve a
score; never weaken a baseline; report available and recognized evidence separately; record
KEEP / REVERT / INCONCLUSIVE for every experiment; synthetic results never establish human
validity.
