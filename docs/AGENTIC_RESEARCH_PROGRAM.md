<!-- GENERATED FILE. Do not edit by hand. -->
<!-- Source: config/agentic-research-program.json + config/experiment-registry.json -->
<!-- Regenerate: pnpm research:program -->

# Agentic research program

Authoritative backlog of every unresolved question in the agent-first program. This file is the source of truth; docs/AGENTIC_RESEARCH_PROGRAM.md is a generated projection of it. Validated by tests/research-program.test.ts so a forgotten question becomes a failing test rather than an oversight.

**Findings and their reasoning live in docs/AGENTIC_ARCHITECTURE_FORENSIC_AUDIT.md. This file records only status, dependency and next action.**

---

## Open questions by stage

### S1 — Semantic architecture

**Exit criterion.** One DEVELOPMENT architecture has acceptable semantic quality, channel integrity and claim-level auditability, with no clearly superior unresolved architecture immediately adjacent.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `P-01` | **UNTESTED** | Can the strongest one-call baseline gain claim-level auditability without specialist inference? | — | Preregister and run person-blueprint v2 with a per-item evidence field on LEXICAL_TRAP. | 12 | $0.45 |
| `D-01` | **INCONCLUSIVE** | Does a correctly-scoped Direction Agent beat the shared blueprint on Direction, or only tie it? | P-01, S-01 | Resolve at n=24-36 only if P-01 fails and S-01 passes. Deliberately behind both. | 320 | $4.00 |
| `CT-01` | **UNTESTED** | Do the five non-implications no v1 prompt states change interpretation quality when added? | P-01 | Define semantic-contract v2 with the full rule set plus contrastive examples, as a new prompt version. Never edit a v1 prompt. | 12 | $0.45 |
| `R-01` | **UNTESTED** | Which of the five semantic role fields carry independent signal, and is the matcher robust to paraphrase? | — | Deterministic leave-one-field-out ablation over existing cached interpretations. Zero calls. | 0 | $0.00 |
| `N-01` | **IN_PROGRESS** | Should the interrupted NATURAL arm be completed? | — | Leave incomplete unless a regression check on ordinary cases becomes decision-relevant. Roughly 253 calls to finish. | 253 | $3.00 |

### S2 — Inference stability

**Exit criterion.** The architectural decision and the principal quality conclusions are stable across repeated independent generations, and every KEEP/REJECT threshold has a documented sensitivity range.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `T-01` | **UNTESTED** | Are the provenance attribution thresholds (0.6 floor, 0.1 ambiguity margin) defensible? | P-01 | Sweep both thresholds over cached outputs and report verdict stability. Deterministic, zero calls. | 0 | $0.00 |
| `S-01` | **UNTESTED** | Would we reach the same architectural decision if the model regenerated the same person's blueprint? | — | Preregister a repeated-generation study: 12 people x 3 fresh trials, trial index in the cache key. | 36 | $1.30 |

### S3 — Semantic construct coverage

**Exit criterion.** Every product-required construct (E/P/Q/D, uncertainty, contradictions) has defined truth, a defined metric, and a measured implementation.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `Q-01` | **BLOCKED** | Can an agent extract held qualifications well enough to reproduce the planted meets-requirements/stretch partition? | M-01 | Wait for M-01, which makes qualifications visible as a byproduct of messy narrative rendering. | 12 | $0.45 |
| `U-01` | **UNTESTED** | Can the representation say 'I do not have enough evidence' instead of inventing a conclusion, and is that signal calibrated? | P-01 | Define the construct before implementing. Candidates: explicit INSUFFICIENT_EVIDENCE, claim-level evidence strength, repeated-generation agreement as an external proxy. | 12 | $0.45 |
| `C-01` | **DEFERRED** | How should conflicting evidence and user corrections be reconciled? | P-01, U-01 | Define source precedence and versioning. Prefer deterministic reconciliation; reserve model adjudication for genuinely ambiguous semantics. | 0 | $0.00 |
| `X-01` | **BLOCKED** | Are explanations faithful to the evidence and match factors that actually produced the ranking? | P-01 | Wait for P-01. Then build deterministic explanation validation, not a model critic. | 0 | $0.00 |

### S4 — Generalisation

**Exit criterion.** The frozen architecture passes predefined VALIDATION criteria with no tuning on VALIDATION. Runs once per frozen architecture.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `V-01` | **BLOCKED** | Does the frozen architecture generalise to paraphrase families it never saw? | P-01, S-01, T-01 | Blocked by the architecture-freeze gate. Two of four conditions currently fail. | 300 | $4.00 |

### S5 — Product-realistic evidence

**Exit criterion.** The architecture works without synthetic pre-routing of evidence and survives realistic ambiguity and contradiction.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `M-01` | **BLOCKED** | Can TaskDNA untangle a messy person, rather than interpret evidence that was already routed for it? | P-01 | Requires explicit approval: a new benchmark family is a contract change under amendment C. Same hidden truth, new independent messy-narrative renderer, no channel labels. | 300 | $4.00 |
| `M-02` | **BLOCKED** | Does the architecture hold for career states the current corpus does not contain? | M-01 | New versioned corpus with its own preregistration. Do not mutate the frozen corpus. | 300 | $4.00 |
| `J-01` | **UNTESTED** | Does JobBlueprint interpretation survive real, noisy job descriptions? | — | Assemble a noisy job-description set. Keep interpretation per job and globally cached; never per user-job pair. | 100 | $1.50 |

### S6 — Human validity

**Exit criterion.** Real users show acceptable claim correctness, omission and error rates, correction burden, provenance fidelity and recommendation usefulness.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `H-01` | **BLOCKED** | Do real people agree with TaskDNA's representation of their own work? | V-01, M-01 | Design the review program and the privacy prerequisites. Corrections held out under a custodian, never folded into a tuning set. | 0 | $0.00 |

### S7 — Research-to-product integration

**Exit criterion.** A validated semantic architecture runs in the product path with defined persistence, migration, fallback, latency UX, cost, privacy and security.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `L-01` | **BLOCKED** | What is the real user wait when independent calls are actually issued concurrently under provider contention? | D-01 | Only meaningful if a multi-call architecture wins. Needs genuine concurrency, >=100 subjects, repeated across times of day. | 200 | $6.00 |
| `SEC-01` | **UNTESTED** | Does the architecture separate system instructions from untrusted external data? | — | Required before ingesting any real content. Explicit data/instruction separation; treat all extracted text as data; never let ingested text reach a tool-calling path. | 24 | $0.90 |
| `I-01` | **BLOCKED** | How does a validated semantic architecture replace the deterministic product path? | V-01, H-01 | Do not merge research code into the product because DEVELOPMENT metrics look good. Requires persistence, migration, fallback, latency UX, cost, privacy and shadow testing. | 0 | $0.00 |

### S8 — Agentic expansion

**Exit criterion.** Each genuinely agentic workflow individually demonstrates value over a simpler deterministic or single-call alternative.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `A-01` | **DEFERRED** | Does career-landscape discovery need a genuinely exploratory agent? | I-01 | Do not implement until the core representation and retrieval foundation are stable. | 0 | $0.00 |
| `A-02` | **DEFERRED** | Does outreach and opportunity pursuit warrant agentic planning? | A-01, SEC-01 | Requires reliable semantic user state, explicit user approval boundaries and narrow tool permissions first. | 0 | $0.00 |
| `A-03` | **UNTESTED** | Is selective specialist rescue better than always-on specialist inference? | P-01, D-01 | Define triggers: ambiguous channel assignment, contradictory evidence, low evidence support, unstable repeated inference. | 60 | $2.00 |

---

## Item detail

### `P-01` — Can the strongest one-call baseline gain claim-level auditability without specialist inference?

- **Status:** UNTESTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Shared blueprint emits no supporting phrase, so its provenance is unmeasurable rather than absent. Isolated Experience achieves 0.000 evidence contamination with a quote; full-context achieves 0.424.
- **Next action:** Preregister and run person-blueprint v2 with a per-item evidence field on LEXICAL_TRAP.
- **Success criterion:** Retrieval holds (CI spans zero or better) AND provenance contamination <= 0.05.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** Small expected increase in output tokens; measure per-call.

### `T-01` — Are the provenance attribution thresholds (0.6 floor, 0.1 ambiguity margin) defensible?

- **Status:** UNTESTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** Both thresholds are hand-set. Corroborating signal is strong (0 drift, 0 unsupported, 0-1 ambiguous across 500+ claims) but no sensitivity analysis exists.
- **Next action:** Sweep both thresholds over cached outputs and report verdict stability. Deterministic, zero calls.
- **Success criterion:** The KEEP/REJECT verdict is unchanged across a documented threshold range.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None.

### `S-01` — Would we reach the same architectural decision if the model regenerated the same person's blueprint?

- **Status:** UNTESTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Nothing known. Every result is one generation per input. Reasoning tokens varied 261-982 at fixed effort, so generation is demonstrably unstable; the score effect is unmeasured.
- **Next action:** Preregister a repeated-generation study: 12 people x 3 fresh trials, trial index in the cache key.
- **Success criterion:** The sign of the agent-field-match vs agent-blueprint delta is stable across trials and ranking rank-correlation is high.
- **Cost if run:** 36 calls, ~$1.30
- **Latency relevance:** Yields latency variance, currently unknown.

### `D-01` — Does a correctly-scoped Direction Agent beat the shared blueprint on Direction, or only tie it?

- **Status:** INCONCLUSIVE · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`, `S-01`
- **Evidence so far:** v2 isolated Direction 0.806 vs shared 0.732, paired delta +0.074 CI [-0.066, 0.198]. Provenance contamination 0.000 and desired volume ratio 1.000, both corrected from v1.
- **Next action:** Resolve at n=24-36 only if P-01 fails and S-01 passes. Deliberately behind both.
- **Success criterion:** Direction paired delta CI excludes zero.
- **Cost if run:** 320 calls, ~$4.00
- **Latency relevance:** Doubles onboarding calls; requires real concurrent measurement before shipping.

### `CT-01` — Do the five non-implications no v1 prompt states change interpretation quality when added?

- **Status:** UNTESTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** semanticContract.ts records that liked->desired, and all four Qualification rules, are unstated in every v1 prompt. The liked->desired gap is the measured cause of the v1 Direction collapse.
- **Next action:** Define semantic-contract v2 with the full rule set plus contrastive examples, as a new prompt version. Never edit a v1 prompt.
- **Success criterion:** No channel regresses and at least one contamination measure improves.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** Longer prompt; measure input-token and latency delta.

### `R-01` — Which of the five semantic role fields carry independent signal, and is the matcher robust to paraphrase?

- **Status:** UNTESTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Field-aware matching beat token-bag by +0.148 CI [0.088, 0.211] on LEXICAL_TRAP over identical interpretations at zero model cost. The strongest measured result in the program, and it is deterministic.
- **Next action:** Deterministic leave-one-field-out ablation over existing cached interpretations. Zero calls.
- **Success criterion:** Per-field contribution quantified; any redundant field identified.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None; deterministic.

### `Q-01` — Can an agent extract held qualifications well enough to reproduce the planted meets-requirements/stretch partition?

- **Status:** BLOCKED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `M-01`
- **Evidence so far:** Truth side already exists: frameLabels computes qualificationFeasibility and hardGaps. Blocked because the five planted qualifications per person appear only in the narrative field, which no architecture reads. Per RECOMMENDATION_POLICY this is a partition, never a fourth similarity channel.
- **Next action:** Wait for M-01, which makes qualifications visible as a byproduct of messy narrative rendering.
- **Success criterion:** Partition agreement against planted truth, with E/P/D scores byte-identical.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** One extra field on an existing call, or one extra call. Measure.

### `U-01` — Can the representation say 'I do not have enough evidence' instead of inventing a conclusion, and is that signal calibrated?

- **Status:** UNTESTED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** No uncertainty or confidence construct exists anywhere in the schema. Model self-reported confidence must not be assumed calibrated.
- **Next action:** Define the construct before implementing. Candidates: explicit INSUFFICIENT_EVIDENCE, claim-level evidence strength, repeated-generation agreement as an external proxy.
- **Success criterion:** Abstention correlates with actual error; calibration measured before any confidence is shown to a user.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** Minor.

### `C-01` — How should conflicting evidence and user corrections be reconciled?

- **Status:** DEFERRED · **Stage:** S3 · **Split:** future MIXED_EVIDENCE
- **Depends on:** `P-01`, `U-01`
- **Evidence so far:** No contradiction handling exists. The corpus contains no contradictory evidence to test against.
- **Next action:** Define source precedence and versioning. Prefer deterministic reconciliation; reserve model adjudication for genuinely ambiguous semantics.
- **Success criterion:** A user correction reliably outranks a stale inference while history and provenance are preserved.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Affects refresh path, not first result.

### `V-01` — Does the frozen architecture generalise to paraphrase families it never saw?

- **Status:** BLOCKED · **Stage:** S4 · **Split:** VALIDATION
- **Depends on:** `P-01`, `S-01`, `T-01`
- **Evidence so far:** VALIDATION has never been used by any agent arm; all four ledger experiment ids are DEVELOPMENT. Elsewhere in this codebase extraction macro F1 drops 0.831 to 0.611 across the boundary.
- **Next action:** Blocked by the architecture-freeze gate. Two of four conditions currently fail.
- **Success criterion:** Predefined criteria pass with no tuning on VALIDATION.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** None beyond what DEVELOPMENT already measured.

### `M-01` — Can TaskDNA untangle a messy person, rather than interpret evidence that was already routed for it?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new MIXED_EVIDENCE family
- **Depends on:** `P-01`
- **Evidence so far:** The frozen corpus supplies evidence pre-partitioned into three arrays with explicit LIKE/DISLIKE stance and giveaway prefixes such as 'What I liked most:'. Removing the partition inflated full-context Experience volume to 1.736 immediately.
- **Next action:** Requires explicit approval: a new benchmark family is a contract change under amendment C. Same hidden truth, new independent messy-narrative renderer, no channel labels.
- **Success criterion:** Channel-assignment accuracy against planted truth, plus retrieval per channel.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** May require a routing step, which would add to the critical path.

### `M-02` — Does the architecture hold for career states the current corpus does not contain?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new corpus version
- **Depends on:** `M-01`
- **Evidence so far:** Measured from planted truth: every person has an identical 6/7/2/4 channel profile; desired-vs-performed role overlap is always 2 or 3 of 5; disliked-vs-performed is always exactly 5. No low-experience/high-direction group and no contrast group for direction aversion exist.
- **Next action:** New versioned corpus with its own preregistration. Do not mutate the frozen corpus.
- **Success criterion:** Performance holds across pivots, returners, generalists, and qualification/desire mismatches.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** None.

### `X-01` — Are explanations faithful to the evidence and match factors that actually produced the ranking?

- **Status:** BLOCKED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** No explanation generation exists in the agent path. Provenance would make most of this deterministically checkable rather than requiring a model judge.
- **Next action:** Wait for P-01. Then build deterministic explanation validation, not a model critic.
- **Success criterion:** Explanation claims trace to evidence the scoring used; zero hallucinated rationale.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Explanation is post-ranking; affects complete-result time, not first result.

### `L-01` — What is the real user wait when independent calls are actually issued concurrently under provider contention?

- **Status:** BLOCKED · **Stage:** S7 · **Split:** DEVELOPMENT
- **Depends on:** `D-01`
- **Evidence so far:** All parallel figures are derived from individually-timed calls and are optimistically biased lower bounds. Measured: shared 10.8s p50 / 12.0s p95. n=24 puts p95 at the second-largest observation.
- **Next action:** Only meaningful if a multi-call architecture wins. Needs genuine concurrency, >=100 subjects, repeated across times of day.
- **Success criterion:** Measured p95 user wait under real concurrency meets a product threshold.
- **Cost if run:** 200 calls, ~$6.00
- **Latency relevance:** This item IS the latency question.

### `J-01` — Does JobBlueprint interpretation survive real, noisy job descriptions?

- **Status:** UNTESTED · **Stage:** S5 · **Split:** new job set
- **Depends on:** nothing
- **Evidence so far:** Job interpretation works on synthetic renderings. Untested against marketing fluff, duplicated or missing responsibilities, contradictory requirements, title mismatch, jargon, or injected text.
- **Next action:** Assemble a noisy job-description set. Keep interpretation per job and globally cached; never per user-job pair.
- **Success criterion:** Structured work recovery holds on noisy input; no injected instruction changes behaviour.
- **Cost if run:** 100 calls, ~$1.50
- **Latency relevance:** Precomputed; not user wait.

### `SEC-01` — Does the architecture separate system instructions from untrusted external data?

- **Status:** UNTESTED · **Stage:** S7 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Evidence is concatenated directly into the prompt with no delimiting or instruction hierarchy. Structured output constrains response shape but not model behaviour. Blast radius is currently small because there are no tools and no external actions.
- **Next action:** Required before ingesting any real content. Explicit data/instruction separation; treat all extracted text as data; never let ingested text reach a tool-calling path.
- **Success criterion:** A planted injection in a resume or job description does not alter extraction behaviour.
- **Cost if run:** 24 calls, ~$0.90
- **Latency relevance:** None.

### `H-01` — Do real people agree with TaskDNA's representation of their own work?

- **Status:** BLOCKED · **Stage:** S6 · **Split:** real users
- **Depends on:** `V-01`, `M-01`
- **Evidence so far:** Zero human validity. Everything is planted-truth recovery on synthetic people.
- **Next action:** Design the review program and the privacy prerequisites. Corrections held out under a custodian, never folded into a tuning set.
- **Success criterion:** Claim correctness, omission and error rates, and correction burden meet preregistered thresholds.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Perceived latency becomes measurable here.

### `I-01` — How does a validated semantic architecture replace the deterministic product path?

- **Status:** BLOCKED · **Stage:** S7 · **Split:** n/a
- **Depends on:** `V-01`, `H-01`
- **Evidence so far:** The product runs no model call at all. src/app imports @/domain/engine; nothing under src/app, src/v3 or src/domain imports any agent module. The gap between research and product is total.
- **Next action:** Do not merge research code into the product because DEVELOPMENT metrics look good. Requires persistence, migration, fallback, latency UX, cost, privacy and shadow testing.
- **Success criterion:** Shadow-tested parity plus defined SLOs.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Production UX is decided here.

### `A-01` — Does career-landscape discovery need a genuinely exploratory agent?

- **Status:** DEFERRED · **Stage:** S8 · **Split:** n/a
- **Depends on:** `I-01`
- **Evidence so far:** No tool-using or planning agent exists anywhere in the repository. This is the first component whose task might genuinely require iterative decision-making about what to investigate next.
- **Next action:** Do not implement until the core representation and retrieval foundation are stable.
- **Success criterion:** Beats a deterministic or single-call alternative on discovery quality.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Exploratory loops are latency-expensive by nature.

### `A-02` — Does outreach and opportunity pursuit warrant agentic planning?

- **Status:** DEFERRED · **Stage:** S8 · **Split:** n/a
- **Depends on:** `A-01`, `SEC-01`
- **Evidence so far:** Networking logic exists as deterministic legacy code and is out of scope for the core matching loop.
- **Next action:** Requires reliable semantic user state, explicit user approval boundaries and narrow tool permissions first.
- **Success criterion:** Beats a deterministic plan on user-accepted actions.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Asynchronous; not on the first-result path.

### `A-03` — Is selective specialist rescue better than always-on specialist inference?

- **Status:** UNTESTED · **Stage:** S8 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`, `D-01`
- **Evidence so far:** Always-on specialists are 0 for 2 on measured wins. A trigger-based hybrid has never been tried.
- **Next action:** Define triggers: ambiguous channel assignment, contradictory evidence, low evidence support, unstable repeated inference.
- **Success criterion:** AGENT_RESCUE_RECALL improves without raising AGENT_ONLY_FALSE_DISCOVERY_RATE, at a fraction of always-on cost.
- **Cost if run:** 60 calls, ~$2.00
- **Latency relevance:** Only the rescued minority pays the extra call.

### `N-01` — Should the interrupted NATURAL arm be completed?

- **Status:** IN_PROGRESS · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Stopped at 12/12 person and 35/288 job interpretations, all committed. NATURAL is the family where lexical matching already performs well and headroom is smallest (+0.173 to the normaliser control).
- **Next action:** Leave incomplete unless a regression check on ordinary cases becomes decision-relevant. Roughly 253 calls to finish.
- **Success criterion:** n/a - a completeness question, not a hypothesis.
- **Cost if run:** 253 calls, ~$3.00
- **Latency relevance:** None.

---

## Experiment ledger

Append-only record of every runtime experiment. A paid experiment must have a record here BEFORE it executes; tests/research-program.test.ts enforces that every experiment id appearing in the budget ledger has one.

**Records are never rewritten to make a later result look cleaner. A superseded design gets a NEW record and the old one is marked with supersededBy. Estimated figures are left as estimated even when actuals differ.**

| experiment | status | family | calls | cost | outcome |
| --- | --- | --- | --- | --- | --- |
| `agent-vs-lexical:anthropic:SEMANTIC_BRIDGE` | **SUPPORTED** | SEMANTIC_BRIDGE | 300 | $3.06 | experience +0.2461 CI [0.1338, 0.3575]; preference +0.2134 CI [0.0324, 0.3671]; direction +0.5585 CI [0.3871, 0.7131]. |
| `openai-effort-calibration:SEMANTIC_BRIDGE` | **SUPPORTED** | SEMANTIC_BRIDGE | 6 | $0.19 | Person output 886 tokens at low, 2027 at medium, 1304 at high. The Anthropic arm's 1200 allowance would have truncated at medium and high. |
| `agent-vs-lexical:openai:SEMANTIC_BRIDGE:low` | **SUPPORTED** | SEMANTIC_BRIDGE | 300 | $3.64 | experience +0.241 CI [0.123, 0.351], within 0.006 of the Claude arm. agent-field-match reaches 0.709 / 0.693 / 0.878. |
| `agent-vs-lexical:openai:LEXICAL_TRAP:low` | **REJECTED** | LEXICAL_TRAP | 300 | $3.58 | The stated hypothesis FAILED: agent-blueprint 0.597 vs 0.622, delta -0.025 CI [-0.128, 0.067], and no channel beat lexical. The same run showed agent-field-match at 0.745, +0.148 CI [0.088, 0.211] over agent-blueprint - a matcher result, recorded separately as R-01. |
| `agent-vs-lexical:openai:NATURAL:low` | **IN_PROGRESS** | NATURAL | 47 | $0.50 | Stopped at 12/12 person and 35/288 job interpretations by operator instruction. All committed; resumable for roughly 253 calls. |
| `split-agents:openai:LEXICAL_TRAP:low:direction-v1` | **REJECTED** _(superseded by `split-agents:openai:LEXICAL_TRAP:low:direction-v2`)_ | LEXICAL_TRAP | 64 | $2.28 | Direction collapsed 0.732 to 0.457 / 0.447, CIs excluding zero. INVALID AS A TEST OF SPECIALISATION: the v1 Direction prompt defined WANTED to include work the person enjoys, and the 'isolated' arm was still shown preference evidence. Two independent defects pointing the same way; provenance confirmed 81/129 and 83/132 desired claims sourced from LIKE evidence. |
| `split-agents:openai:LEXICAL_TRAP:low:direction-v2` | **INCONCLUSIVE** | LEXICAL_TRAP | 24 | $0.36 | Channel integrity fully repaired: provenance contamination 0.629 to 0.000, desired volume 2.750 to 1.000. Retrieval unresolved: isolated direction 0.806 vs shared 0.732, paired +0.074 CI [-0.066, 0.198]. Experience bit-identical from cache, so the ablation is clean. |
| `smoke-test` | **UNTESTED** | n/a | — | — | Operational probe. Not a quality experiment. |

---

## Status vocabulary

Deliberately not binary pass/fail: most of these questions resolve into something other than a verdict.

| status | meaning |
| --- | --- |
| `UNTESTED` | No evidence either way. Not blocked, just not attempted. |
| `PREREGISTERED` | Specification committed to config/experiment-registry.json; not yet executed. |
| `IN_PROGRESS` | Execution started and incomplete. |
| `SUPPORTED` | Evidence supports the hypothesis under the stated conditions. |
| `REJECTED` | Evidence contradicts the hypothesis. |
| `INCONCLUSIVE` | Executed; the interval spans the decision boundary. Neither adopted nor refuted. |
| `BLOCKED` | Cannot proceed until a dependency or an external prerequisite resolves. |
| `DEFERRED` | Deliberately postponed on information value, not blocked. |
| `SUPERSEDED` | Replaced by a later item; retained so history stays legible. |

---

## At a glance

- **22** tracked questions across **8** stages
- Status spread: 8 BLOCKED, 3 DEFERRED, 1 INCONCLUSIVE, 1 IN_PROGRESS, 9 UNTESTED
- **Runnable now** (untested, no unmet dependency): `P-01`, `S-01`, `R-01`, `J-01`, `SEC-01`
- Total spend recorded so far: **$13.61** across **1041** calls

