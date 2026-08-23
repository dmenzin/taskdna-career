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

| control | value | kind |
| --- | --- | --- |
| external runtime-agent spend | **$25.00 USD** | **HARD — refuses the call** |
| runtime model calls | 1,000 | observability threshold — warns only |

- The dollar ceiling is **enforced in code and telemetry**, not prose: `src/agent/budget.ts`
  refuses the call that would breach it, and the ledger is persisted so the cap survives process
  restarts within the run.

### B2. AMENDMENT 2026-08-23 — call count is observability, not authorization

Adopted at the user's direction, prioritising product quality and user experience over a proxy
metric.

Call count was only ever a stand-in for spend. Enforcing it *alongside* the dollar cap added no
protection the dollar cap did not already give, while blocking exactly the experiments worth
running: cheap, high-information screens that reuse existing caches. The proposed split-agent
screen costs 48 calls and $2.89 against a fully-cached job corpus, and under the old rule its
authorization would have been argued in units of calls rather than dollars.

**Call count is still recorded for every call**, and crossing 1,000 prints a notice. What that
notice means is "re-read the architecture for an unbounded pattern", not "stop".

Runtime experimentation now stops only for:

1. a provider or system limit,
2. the hard dollar ceiling,
3. a genuine scientific-integrity issue,
4. a safety, secret, or data-handling issue,
5. an experiment that would create an **unbounded runtime pattern** — most importantly a
   person-by-job model loop, which remains prohibited by `docs/HYBRID_AGENT_READINESS.md`.

Item 5 is what the call cap was really guarding, and it is a design-review trigger rather than a
number to discover two thirds of the way through a batch.

### B3. AMENDMENT 2026-08-23 — mandatory zero-call dry run

**Every paid model experiment must first produce a zero-call dry run**, and the dry run must
report all of:

| field | why it is required |
| --- | --- |
| fresh API calls required | the only number that costs money |
| cache hits and reuse | distinguishes new work from work already paid for |
| worst-case dollar cost | computed from the full output allowance, not hoped-for output |
| cumulative spend to date | a per-experiment figure hides an accumulating total |
| projected remaining dollar budget | the hard control's headroom |
| provider and model | a moving alias makes this non-obvious |
| reasoning effort | changes cost, latency and output; confounds a comparison silently |
| prompt and schema versions | a stale cache key is a stale scientific result |
| user-facing latency impact | whether the change alters what a real user waits for |

A dry run that cannot report full cache reuse where reuse was expected is a **stop condition**:
it means the configuration has drifted from the arm it claims to extend, and running would re-bill
completed work.

### B4. AMENDMENT 2026-08-23 — runtime cache commit policy

Runtime caches are committed, reversing the original blanket ignore that destroyed the Anthropic
arm. The permission is **narrow**:

- **May be committed**: interpretations of SYNTHETIC BENCHMARK inputs, generated from the seeded
  corpus. They contain no real person's data, and they are paid, slow and irreproducible once a
  moving model alias moves.
- **Must NEVER be committed**: real user inputs, production data, credentials, or model
  interpretations derived from any real person — including interpretations that are only
  *indirectly* user-derived.

`artifacts/agent_runtime/` is **not** blanket-safe, and must not be treated as safe merely because
today's contents happen to be synthetic. `tests/runtime-cache-policy.test.ts` enforces the policy:
every tracked cache file must be attributable to a synthetic benchmark family, no cache may sit
under a user or production path, and no tracked cache may contain a credential.
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

## C2. AMENDMENT 2026-08-23 — user-facing latency is a first-class product metric

Total benchmark runtime is **not** a product measurement and must not be reported as one. "The
experiment took 33 minutes" is dominated by job interpretation, which is a one-time corpus cost
amortised across every user who ever sees that job. No user waits for it.

For every model-dependent architecture, persist enough telemetry to estimate what a real user
experiences, and report the **critical path** rather than a total:

- **Per fresh call**: wall-clock duration, prompt/agent type, person vs job, provider, model,
  reasoning effort, input/output/reasoning tokens, cache hit or miss.
- **Distributions by agent type**: mean, p50, p90, p95, max — computed over **fresh calls only**.
  Cache hits resolve in under a millisecond and are reported as their own separate population;
  mixing the two makes a cache-warm rerun report a p50 of zero, which the committed Claude
  artifact already does.
- **When n is small, say so.** Below 20 samples, p90 and p95 are single order statistics rather
  than percentile estimates, and must be labelled as such rather than presented as percentiles.
- **Critical path**: person-side agents plus deterministic assembly, retrieval and ranking. Job
  interpretation is excluded because it is precomputed.
- **Never sum independent agents and call it user wait.** Experience, Preference, Qualification
  and Direction are independent by the four-channel contract and may run concurrently. Report
  measured-sequential and derived-parallel separately, and label the parallel figure **estimated**
  — calls timed one at a time do not include the contention a concurrent implementation adds.
- **Report time-to-first-usable-result and time-to-full-result** separately.
- **Distinguish** fresh-model latency, cache-hit latency, and deterministic local processing.
  Model compute, network round trip and provider queueing cannot be separated from an API that
  exposes no server-side timing, and must be reported together rather than split into invented
  components.

Architecture selection is **multi-objective**: semantic quality, retrieval quality, contamination,
false discovery, cost, and user-facing latency. A more accurate architecture is **not**
automatically selected when the gain is trivial relative to a large increase in user wait. Raw
per-call latency stays in the experiment artifact so a Pareto frontier can be constructed later
instead of relying on remembered timings. No blended quality-per-second score is introduced — the
exchange rate between NDCG and seconds is a product judgement, not a measurement.

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

## E. AMENDMENT 2026-08-23 — machine-checked research program

Adopted to close the configuration-management failure the Direction-v1 collapse exposed: two
source files were independently allowed to define what a semantic construct meant, and
preregistration for current experiments lived in operator prose.

- **`src/agent/semanticContract.ts` is the sole source of channel ontology.** Existing v1
  prompt versions compose from the extracted `*_V1` fragments and are frozen by SHA-256 in
  `config/prompt-render-freeze.json`. A source refactor that changes a rendered prompt is a
  scientific incident, not a cleanup. Improvements (contrastive examples, full non-implication
  set, explicit abstention) are a new prompt version, evaluated as an experiment.
- **`config/agentic-research-program.json` is the authoritative backlog.** Statuses are
  UNTESTED, PREREGISTERED, IN_PROGRESS, SUPPORTED, REJECTED, INCONCLUSIVE, BLOCKED, DEFERRED,
  SUPERSEDED — not binary pass/fail. `docs/AGENTIC_RESEARCH_PROGRAM.md` is a generated
  projection; the data wins.
- **`config/experiment-registry.json` is append-only.** Every paid agent-runtime experiment
  must have a record before execution. `assertPreregistered` refuses spend (and dry-run) on an
  unknown id. A superseded design gets a new record; the old one keeps its verdict.
- **`config/component-registry.json` classifies components by behaviour**, not by name.
  Historical "Agent" names stay for cache reproducibility and are grandfathered; no new
  component may be called an Agent unless it is TOOL_USING_AGENT or PLANNER.
- **`docs/AGENTIC_DEVELOPMENT_ROADMAP.md` is rationale, not a second program.** If it and the
  JSON disagree, the JSON wins.

## Relationship to the standing rules

Unchanged and still binding: no Overall V3 score; four-channel independence; benchmark labels
never come from the algorithm; DEVELOPMENT first, VALIDATION sparingly, **LOCKED_CONFIRMATION
never executed during this run**; never mutate the frozen baseline or hidden truth to improve a
score; never weaken a baseline; report available and recognized evidence separately; record
KEEP / REVERT / INCONCLUSIVE for every experiment; synthetic results never establish human
validity.
