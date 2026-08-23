# Agentic development roadmap

What should happen next, given the evidence in `docs/AGENTIC_ARCHITECTURE_FORENSIC_AUDIT.md`. That
document establishes what is true; this one is the **decision rationale** — why the next
experiments are ranked the way they are, and what a stage is allowed to conclude.

**This file is not the live program.** Status, dependencies, estimates and next actions live in
`config/agentic-research-program.json`. `docs/AGENTIC_RESEARCH_PROGRAM.md` is the generated
projection of that file. If this rationale and the JSON ever disagree, the JSON wins; edit this
file to restore the rationale, do not invent a third map.

---

## The governing principle, after audit

**TaskDNA should be agent-first at semantic boundaries, not automatically multi-agent and not
agent-everywhere.** The audit supports this, with one sharpening: the accurate word for what wins is
**structured semantic inference**, not "agent". Nothing in the repository is a tool-using or
planning agent, and nothing needs to be yet. Calling single schema-constrained calls "agents" invites
orchestration complexity the evidence does not ask for.

Corollary that should govern spending: **the two measured wins came from putting a model at the
normalisation boundary and from comparing structured output better.** Neither came from adding
agents. Until an agent-count increase wins with a CI excluding zero, treat multi-agent work as
speculative and matcher/representation work as the main line.

---

## Top five experiments, ranked by information value

These five are the decision ranking. Each is a live item in the research program; the id in
parentheses is the one the tests track. Rank is information value, not execution order of every
item in the backlog — cheaper deterministic work (R-01, T-01) can run in parallel without
displacing these.

### E1 — Provenance on the shared CareerBlueprint (`P-01`)

- **Question.** Can the incumbent architecture be made auditable without splitting it?
- **Why it matters.** Claim-level auditability is the split architecture's only clear remaining
  advantage. If one schema field buys it at one call per person, always-on multi-agent decomposition
  loses its main justification. This is the highest-leverage question in the program.
- **Hypothesis.** Adding a per-item `evidence` field to the shared schema preserves retrieval and
  yields provenance contamination at or below isolated Experience's, at half the calls of the split.
- **Minimal change.** `person-blueprint` v1 → v2: one added required field per work item. Nothing
  else.
- **Frozen.** Corpus, hidden truth, renderers, matcher, job interpretations, baselines, oracles,
  scoring, bootstrap.
- **Split / data.** DEVELOPMENT, LEXICAL_TRAP, 12 people.
- **Primary metric.** Provenance contamination per channel. **Secondary:** experience/direction
  NDCG@10 paired vs shared v1, channel volume ratio, latency, output-token delta.
- **Cost.** ~12 fresh calls, ~$0.45. Jobs and all baselines reused.
- **Runtime.** ~3 minutes. **User-latency effect:** likely small increase in output tokens; measure.
- **Decision rule.** PASS if retrieval holds (CI spans zero or better) **and** provenance
  contamination ≤ 0.05 → shared+provenance becomes the baseline and multi-agent work is deprioritised.
  FAIL if retrieval regresses with a CI excluding zero → auditability costs accuracy in the shared
  form, which materially strengthens the specialist case. INCONCLUSIVE → keep shared v1 as baseline
  and go to E2 before spending more.

### E2 — Stochastic stability (`S-01`)

- **Question.** Does run-to-run generation variance threaten any existing conclusion?
- **Why it matters.** Every result in the program is a single generation per input. Reasoning tokens
  varied 261→982 at fixed effort, so generation is demonstrably unstable; its effect on scores is
  entirely unmeasured. This is the largest unquantified threat to the whole program, including the
  field-matching finding.
- **Hypothesis.** The sign of the `agent-field-match` vs `agent-blueprint` delta is stable across
  independent generations.
- **Minimal change.** A recorded trial index in the cache key to force fresh generation. No prompt,
  schema, matcher or corpus change.
- **Split / data.** DEVELOPMENT, LEXICAL_TRAP, the same 12 people, 3 trials.
- **Primary metric.** Effect-sign stability of the matcher delta. **Secondary:** per-field agreement
  across trials, channel-volume variance, ranking rank-correlation, reasoning-token and latency
  variance.
- **Cost.** ~36 fresh calls, ~$1.30.
- **Decision rule.** PASS (sign stable, rank correlation high) → single-generation experiments stay
  admissible. FAIL (sign flips) → **every architecture comparison in the program needs repeated
  trials before it can be believed**, and prior deltas are downgraded to provisional. INCONCLUSIVE →
  widen to 5 trials on 6 people before concluding.

### E3 — Resolve v2 Direction at adequate power (`D-01`)

- **Question.** Does a correctly-scoped Direction Agent beat the shared blueprint on Direction, or
  only tie it?
- **Why it matters.** v2 numerically leads (0.806 vs 0.732) with an interval spanning zero at n=12.
  This is the only live multi-agent hypothesis, and it is currently unresolved rather than refuted.
- **Hypothesis.** The Direction advantage is real and resolves at larger n.
- **Minimal change.** None to the architecture — it is frozen. Only the person count rises.
- **Split / data.** DEVELOPMENT, LEXICAL_TRAP, 24–36 people.
- **Primary metric.** Direction NDCG@10 paired vs shared. **Secondary:** provenance, volume, and the
  per-subject parallel critical path now that pairing is correct.
- **Cost.** ~2 calls/person for split + 1/person shared + new job blueprints for the added people.
  At 24 people, roughly 300–330 fresh calls, ~$4.
- **Note.** Deliberately ranked **below** E1 and E2. If E1 passes, this experiment's motivation
  shrinks sharply; if E2 fails, its result would not be trustworthy anyway. **Do not run it first.**
- **Decision rule.** PASS (CI excludes zero) → adopt the specialist Direction Agent and pay the
  latency, contingent on a concurrent implementation. FAIL → shared wins, close the multi-agent line
  for Direction. INCONCLUSIVE at n=36 → the effect is smaller than the benchmark can resolve; stop
  spending on it.

### E4 — `MIXED_EVIDENCE` benchmark family (`M-01`)

- **Question.** How much of the current performance depends on the benchmark handing over
  pre-sorted, stance-labelled evidence?
- **Why it matters.** The corpus supplies separate evidence arrays and prefixes preference sentences
  with `"What I liked most:"`. Real users submit one messy narrative. Removing the partition already
  inflated full-context Experience volume to 1.736, which suggests the partition is doing
  substantial work. No architecture choice is safe until this is known.
- **Hypothesis.** Shared and isolated architectures converge or invert when evidence is unlabelled,
  because isolation depends on routing that no longer comes free.
- **Minimal change.** A **new, separately versioned** family. **The existing frozen corpus is not
  modified.** Same hidden truth, new renderer emitting one unlabelled narrative including
  constructions like *"I did this for years and hated it"*, *"I've never done this professionally but
  want to move into it"*, *"I love this as a hobby but wouldn't want the job"*.
- **Primary metric.** Channel-assignment accuracy against planted truth. **Secondary:** retrieval per
  channel, volume ratio, provenance, and whether an explicit routing step is required.
- **Cost.** Renderer work is free; scoring an arm is ~300 calls, ~$4.
- **Decision rule.** This is a **benchmark-contract change** and needs preregistration and explicit
  approval before the renderer is written, per amendment C.

### E5 — Qualification extraction and partition agreement (`Q-01`)

**This entry was mis-scoped in the first draft, in two ways that mattered.** The corrections are
recorded rather than quietly edited, because both would have produced an experiment that violated a
standing contract.

**Correction 1 — it is not a fourth similarity channel.** The first draft proposed "a `qualifications`
array plus a matcher channel". That contradicts `AGENTS.md` and `docs/RECOMMENDATION_POLICY.md`, which
state that Qualification **annotates and partitions** and *never* rewrites an Experience, Preference
or Direction score. It splits candidates into meets-requirements and stretch, each partition keeping
its work-content order. Scoring it as a parallel NDCG channel would have been a contract violation
dressed up as filling a gap.

**Correction 2 — the truth side already exists; the blocker is elsewhere.** `frameLabels.ts` already
computes `qualificationFeasibility = (required − hardGaps) / required` and lists `hardGaps` per pair.
So this is **not** a benchmark-truth change and needs no approval on that axis. What is missing is
that **no agent can see qualifications at all**: the five planted per person appear only in
`narrative`, which no current architecture reads. The `Channel` type has three values and `CHANNELS`
has three entries.

- **Question.** Can an agent extract held qualifications well enough to reproduce the
  meets-requirements/stretch partition that planted truth produces?
- **Why it matters.** Closes the gap between a contract asserting four channels and an implementation
  with three, and unblocks four of the seven documented non-implications
  (`qualified ↛ performed`, `qualified ↛ desired`, `desired ↛ qualified`, and the disliked/prohibition
  distinction).
- **Hypothesis.** Agent-extracted qualifications partition candidates the same way planted
  qualifications do.
- **Primary metric.** **Partition agreement** against the planted partition — not NDCG. Secondary:
  extraction precision/recall against planted qualification values, and a hard guardrail that
  Experience, Preference and Direction scores stay **byte-identical**.
- **The research risk worth naming.** The planted label matches qualifications by **exact
  lowercased string** (`"R"`, `"SQL"`, `"Tableau"`, `"six sigma green belt"`). That is a lexical
  operation, and every prompt in this repository instructs the model to *normalise away* distinctive
  wording. An agent that helpfully writes "R programming language" fails an exact match. So
  Qualification may need a **different matcher** from work content, and the normalisation instruction
  that makes the other channels work may actively hurt here. This is a genuine design question, not
  an implementation detail.
- **Sequencing.** Deliberately **after** E4. A messy human narrative naturally contains
  *"I have a six sigma green belt"*, so the evidence-visibility blocker is solved as a **byproduct**
  of building the mixed-evidence family. Running E5 first would mean inventing a bespoke
  qualification-evidence renderer that E4 would immediately replace.
- **Cost.** Trivial in calls once evidence is visible — roughly 12 person calls on the shared arm.
  The expensive part is the metric and matcher design, which is free but not quick.

---

## Staged program with exit criteria

Each stage exits on a condition, not on a feeling. We do not stay in architecture experimentation
indefinitely.

The first draft of this file had six stages. Two coverage holes the audit found — semantic
construct coverage (Qualification, uncertainty, contradictions) and a distinct agentic-expansion
gate — were being implicitly folded into "architecture" and "production". That is how they would
have been forgotten. The live program therefore has **eight** stages. The historical six-stage
wording is superseded, not deleted from git; this section is the reconciled map.

Statuses and next actions are **not** maintained here. See `config/agentic-research-program.json`.

### S1 — Semantic architecture *(current)*

Establish the best single-user-call representation and its matcher, including claim-level
auditability.
**Contains:** `P-01` (E1), `R-01`, `CT-01`, `N-01`, and `D-01` (E3) only if `P-01` fails and
`S-01` passes.
**EXIT WHEN:** one DEVELOPMENT architecture has acceptable semantic quality, channel integrity and
claim-level auditability, with no clearly superior unresolved architecture immediately adjacent.

### S2 — Inference stability

Establish that conclusions survive generation variance and that KEEP/REJECT thresholds have a
documented sensitivity range.
**Contains:** `S-01` (E2) and `T-01`.
**EXIT WHEN:** the architectural decision and the principal quality conclusions are stable across
repeated independent generations, and every KEEP/REJECT threshold has a documented sensitivity
range.

### S3 — Semantic construct coverage

Close the gap between a four-channel contract and a three-channel implementation, and define
uncertainty and contradiction handling before they are shown to a user.
**Contains:** `Q-01` (E5), `U-01`, `C-01`, `X-01`.
**EXIT WHEN:** every product-required construct (E/P/Q/D, uncertainty, contradictions) has defined
truth, a defined metric, and a measured implementation.

### S4 — Generalisation

**Contains:** `V-01` — exactly one VALIDATION run against the frozen architecture.
**ENTRY GATE:** the architecture-freeze conditions in the audit. Two of four currently fail.
**EXIT WHEN:** the frozen architecture passes predefined VALIDATION criteria with no tuning on
VALIDATION. **Runs once per frozen architecture.** LOCKED stays untouched.

### S5 — Product-realistic evidence

**Contains:** `M-01` (E4), `M-02`, `J-01`, plus an evidence-routing decision — deterministic
router, model router, or structured onboarding that makes routing unnecessary.
**EXIT WHEN:** the architecture works without synthetic pre-routing of evidence and survives
realistic ambiguity and contradiction.

### S6 — Human validity

**Contains:** `H-01`. Corrections are held out under a custodian, never folded into tuning.
**EXIT WHEN:** real users show acceptable claim correctness, omission and error rates, correction
burden, provenance fidelity and recommendation usefulness. **No production claim before this
stage completes.**

### S7 — Research-to-product integration

User-facing latency, cost, privacy, security, and the actual replacement of the deterministic
product path.
**Contains:** `L-01`, `SEC-01`, `I-01`.
**EXIT WHEN:** a validated semantic architecture runs in the product path with defined
persistence, migration, fallback, latency UX, cost, privacy and security.

### S8 — Agentic expansion

Genuinely tool-using or planning components, each justified individually against a simpler
alternative. Nothing in the repository is in this class today.
**Contains:** `A-01`, `A-02`, `A-03`.
**EXIT WHEN:** each genuinely agentic workflow individually demonstrates value over a simpler
deterministic or single-call alternative.

---

## What not to do yet

- **Do not add more agents.** Agent count is 0 for 2 on measured wins. E1 may remove the reason
  entirely.
- **Do not build a critic, planner, or tool-using agent.** Nothing in the evidence asks for
  autonomy, and each adds failure modes and debugging surface.
- **Do not run VALIDATION.** Its entry gate fails on two of four conditions.
- **Do not touch the frozen corpus.** E4 is a new family, preregistered and approved separately.
- **Do not optimise latency yet.** Establish the architecture first, then attack latency with model
  tier, effort, prompt length, or selective invocation without muddling the science.
- **Do not treat the parallel latency figures as measured.** They are optimistically biased estimates
  from individually-timed calls.
- **Do not claim production readiness.** Human validity is zero.
- **Do not use `docs/` growth as progress.** The live program is
  `config/agentic-research-program.json`; this file is rationale. Consolidate rather than add.
- **Do not run a paid experiment that is not in `config/experiment-registry.json`.** The scripts
  refuse. Add the record with `pnpm experiment:preregister` and commit it first.

## Autonomy boundary for this repository

**Autonomous — no approval needed.** Inspect state; run any zero-cost deterministic analysis; audit
caches and artifacts; diagnose failures; fix clearly invalid instrumentation (as with the parallel
latency defect and the type-prefix matcher bug), preserving the historical result and marking what it
invalidates; compute cache reuse and cost projections; write preregistrations; run tests, typecheck,
lint and freeze verification; commit and push evidence.

**Requires explicit approval.** Any paid model call beyond a handful of preflight probes; modifying
benchmark truth, renderers, or the frozen corpus; changing a metric contract or a KEEP/REJECT metric;
running VALIDATION; anything touching LOCKED; exceeding the hard dollar ceiling; migrating the
product architecture; collecting real-user data.

**Always, regardless of approval.** Zero-call dry run before any paid experiment, reporting fresh
calls, cache reuse, worst-case and cumulative spend, remaining budget, provider/model, effort,
prompt and schema versions, and latency impact. Missing expected cache reuse is a stop condition.
Preregistration committed before execution. Evidence committed after. Never fabricate an unavailable
measurement; report the gap.
