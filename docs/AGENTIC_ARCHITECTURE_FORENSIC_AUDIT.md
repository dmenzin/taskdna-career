# TaskDNA agentic architecture and research program — forensic audit

Reconstructed from the repository, git history, committed artifacts and runtime caches. Zero paid
model calls were made for this audit. Where the brief and the repository disagree, the repository
wins and the disagreement is recorded.

**One correction to the brief's premise up front: the v2 Direction experiment is NOT unrun.** It
executed at 15:56, before the audit instruction arrived. 24 fresh calls, $0.36. Its results are
folded in below rather than treated as pending, and no paid call has been made since.

State at audit: branch `cursor/taskdna-openai-provider-migration-b7d8`, **491 tests passing**,
typecheck and lint clean, frozen corpus verifies all 6 entries, LOCKED guard refuses with its
sentinel, **$10.76 of $25 spent across 741 model calls**.

---

## 1. Claim verification

| # | claim | verdict | evidence |
| --- | --- | --- | --- |
| 1 | OpenAI reproduced the Claude SEMANTIC_BRIDGE result | **VERIFIED** | Claude Δ+0.2461 CI [0.1338, 0.3575]; OpenAI Δ+0.241 CI [0.123, 0.351]. Both artifacts committed. |
| 2 | Token-bag agent did not beat lexical on LEXICAL_TRAP | **VERIFIED** | `agent-blueprint` 0.597 vs `experience-lexical` 0.622; Δ=-0.025 CI [-0.128, 0.067]. All three channels inconclusive. |
| 3 | Field-aware matching materially improved LEXICAL_TRAP | **VERIFIED** | `agent-field-match` 0.745, Δ vs bag +0.148 CI [0.088, 0.211]; BETTER on all three trap channels. |
| 4 | The first split-agent experiment failed badly on Direction | **VERIFIED** | 0.732 → 0.457 / 0.447, CIs excluding zero. |
| 5 | Traced to a contract merging Preference into Direction | **VERIFIED** | Volume 11.0 = 7 planted liked + 4 planted desired; provenance shows 81/129 and 83/132 desired claims sourced from LIKE evidence. |
| 6 | v1 "isolated" Direction still saw preference evidence | **VERIFIED** | Routing matrix from rendered input: v1 isolated Direction `like=Y dislike=Y aspiration=Y`. |
| 7 | Full-context Experience inflated channel volume | **VERIFIED** | Volume ratio 1.736 against planted (10.4 emitted vs 6 planted). |
| 8 | ~42.4% of full-context Experience claims from preference evidence | **VERIFIED** | 53 of 125 claims; `PREFERENCE_LIKE`=47, `PREFERENCE_DISLIKE`=6, drift 0, unsupported 0. |
| 9 | Isolated Experience preserved volume and retrieval | **VERIFIED** | Volume ratio exactly 1.000; retrieval Δ=-0.016 CI [-0.092, 0.050] vs shared. |
| 10 | Strict identity contamination understated the failure | **VERIFIED** | 0.008 identity vs 0.424 provenance on the same channel — a 50x gap. |
| 11 | Shared CareerBlueprint lacks claim-level provenance | **VERIFIED** | `PERSON_BLUEPRINT_SCHEMA` has no evidence field. Provenance is **unmeasurable, not absent**. |
| 12 | Corrected v2 implemented but not evaluated | **WRONG** | v2 ran at 15:56. Direction isolated 0.447 → **0.806**. |
| 13 | ~24 fresh Direction calls sufficient | **VERIFIED** | Dry run: 288/288 job, 12/12 shared, 12/12 experience per variant reusable; 24 fresh. Actual spend $0.36. |
| 14 | Latency instrumentation corrected | **PARTIALLY VERIFIED** | Cache-hit exclusion and job-cost exclusion verified. But the parallel estimate used `max(p50_A, p50_B)`, which is not the median of the per-person max — see §10. Fixed during this audit. |

---

## 2. What TaskDNA actually is, end to end

The single most important structural finding, and it is not in the brief:

**There is no agentic architecture in the product. There is no model call in the product at all.**

`src/app/page.tsx` imports `@/domain/engine` and `@/domain/networkEngine`. Nothing under `src/app`,
`src/v3` or `src/domain` imports `agent/runtime`, either provider, `agentArchitecture` or
`splitAgents`. The entire agent-first program is a **research harness** that shares a benchmark with
the product, not a system the product runs.

### Currently running product architecture

```
demo dataset (src/domain) --> buildUserProfile --> scoreJobs / scoreFunctions
  --> filterAndSortJobs --> UI
```
Deterministic, no model, no cache, sub-millisecond. Legacy: the 17-dimension/MAE lineage that
`AGENTS.md` describes as out of scope for the core matching loop.

### Research architecture (where all the evidence lives)

```
PlantedFramePerson (frozen corpus, seeded)
  experienceEvidence[6]  preferenceEvidence[9: 7 LIKE + 2 DISLIKE]  aspirationEvidence[4]
        |
        |  ONE model call per person -- person-blueprint v1, PERSON_BLUEPRINT_SCHEMA
        |  cache key: provider+model+schemaHash+{effort,maxOut,providerVersion}+promptId+version+decoding+input
        v
  CareerBlueprint { experience[], liked[], disliked[], desired[] }   each item = 5 role fields
        |
PlantedFrameJob x288
        |  ONE model call per job -- job-blueprint v1, JOB_BLUEPRINT_SCHEMA
        v
  jobWork: Map<jobId, StructuredWork[]>
        |
        v
  matcher: agent-blueprint (token bag) OR agent-field-match (per-field coverage)
        |
        v
  per-channel score --> NDCG@10 / recall --> paired bootstrap over persons
```

Failure behaviour: refusal is tolerated as a counted abstention; truncation and quota are fatal by
design. Unparseable output becomes an empty channel, visible in volume counts.

Latency contribution: person call ~10.8 s p50 (user-facing), job call ~6 s p50 (precomputed,
amortised, **never** user wait), deterministic assembly + retrieval + ranking **15–16 ms per
person** measured locally.

Cost: $0.0292–$0.0358 per person blueprint, ~$0.0091–$0.011 per job blueprint.

### Candidate architecture

`split-full-context` and `split-isolated` at v2: dedicated Experience and Direction agents, two
calls per person, folded into the same `CareerBlueprint` shape so the matcher cannot tell them
apart. Produces Experience and Direction only.

### Abandoned / superseded

- Split-agent **v1** — Direction contract merged Preference into Direction; retained frozen as
  audit-only (`DIRECTION_AGENT_PROMPT_V1`) so its 24 paid interpretations stay readable.
- O\*NET canonical path in the primary matching loop — scores identically to the degenerate
  constant-score control on SEMANTIC_BRIDGE (0.354), and 0.412 vs plain lexical's 0.665 on NATURAL.
- Anthropic arm — access revoked, caches irrecoverable.
- `PROMPTS` registry in `runtime.ts` (`discover-work-content.v1`, `transfer-hypotheses.v1`) — **dead
  code, never executed against any model.**

---

## 3. CareerBlueprint forensics

Introduced in `6088556`. Current schema: four arrays of `StructuredWork`, each exactly five string
fields — `action`, `object`, `purpose`, `method`, `domain`.

| property | status |
| --- | --- |
| Experience channel | implemented, matched |
| Preference channel | implemented as `liked`/`disliked`, matched as a signed difference |
| Direction channel | implemented as `desired`, matched |
| **Qualification channel** | **NOT IMPLEMENTED.** `qualifications` (5 per person) is planted in the corpus and never interpreted, never emitted, never matched. |
| Provenance | **absent** |
| Uncertainty / confidence | **absent** — no abstention signal, no confidence field |
| Contradiction handling | **absent** |
| Ownership / depth / context | absent from the shared schema; present only in the split Experience Agent, and stripped before the matcher |
| Persistence / versioning | versioned via `AGENT_ARCHITECTURE_VERSION` and cache key; no migration path |

**Terminology is overloaded, and this matters.** "CareerBlueprint" is used for four different
things: a JSON schema, the semantic representation, the single model call that produces it, and the
architecture arm. It is **not** an agent — it makes no decisions, uses no tools, and takes no
actions. It is one schema-constrained model call plus a deterministic fold.

The four-channel contract is stated everywhere but only **three quarters implemented**. Qualification
is conceptual. `AGENTS.md` asserts four independent computational outputs; in the agent path there
are three.

### Should it remain the research baseline?

**Yes, on current evidence — but as the strongest *measured* option rather than the best one.** It
wins retrieval on every channel of both completed families. Its channel volumes are exact (1.000 on
all four). No alternative has beaten it on retrieval.

Two caveats that a fair reading requires. Its perfect volumes owe something to **pre-sorted
evidence**: four labelled sections, one work emitted per evidence sentence. And it is the **only
architecture whose channel integrity cannot be audited**, so "shared is clean" is not a measurement,
it is an absence of instrumentation.

---

## 4. Agent versus workflow versus structured inference

| thing called an "agent" | actual class | note |
| --- | --- | --- |
| shared CareerBlueprint interpreter | **A. structured model inference** | one call, JSON-schema constrained |
| Experience Agent | **A. structured model inference** | one call |
| Direction Agent | **A. structured model inference** | one call |
| Preference Agent | **E. not implemented** | |
| Qualification Agent | **E. not implemented** | channel absent entirely |
| JobBlueprint interpreter | **A. structured model inference** | one call per job, content-cached |
| Career Landscape Agent | **E. not implemented** | no code |
| critic / validator | **E. not implemented** | `learnedComponent.ts` defines a boundary; nothing runs |
| networking / pursuit agent | **B. deterministic workflow** | legacy, no model |

**Nothing in TaskDNA is a tool-using or planning agent. Class C and D do not exist in this
repository.** Every "agent" is a single schema-constrained call with a deterministic fold.

This is not a criticism of the design — it is a correction of the vocabulary. Calling these agents
invites autonomous orchestration, retry loops and dynamic planning that the evidence does not ask
for, and each of those adds failure modes and debugging surface for no measured gain. The accurate
description of the winning architecture is **structured semantic inference at a well-defined
boundary, with deterministic everything else**, and the evidence supports exactly that.

---

## 5. Which parts actually need a model?

| subsystem | current method | model necessary? | deterministic alternative | evidence | recommendation |
| --- | --- | --- | --- | --- | --- |
| parse raw career history | benchmark supplies pre-sorted arrays | **unknown — untested** | parser/router | none | build the mixed-evidence benchmark before deciding |
| detect performed work | model | **yes** | keyword rules | isolated Experience: 0.000 provenance contamination, 1.000 volume | keep model |
| detect preference | model (shared only) | **likely** | stance lexicon | shared volumes exact; no ablation | keep, test later |
| detect direction | model | **yes** | future-tense cues | v2 isolated 0.806 vs lexical 0.594 | keep model |
| detect qualification | **not implemented** | unknown | — | none | implement before claiming four channels |
| semantic normalisation | model | **yes, this is the core finding** | O\*NET canonicalisation | O\*NET = constant-score control on bridge (0.354); agent +0.241 | keep model; O\*NET is not a substitute |
| transfer inference | not implemented | probably | — | none | defer |
| blueprint assembly | deterministic fold | **no** | current | — | keep deterministic |
| contradiction resolution | **not implemented** | probably | validator | none | deterministic validator first |
| job interpretation | model | **yes** | — | same normalisation evidence | keep, precomputed |
| job caching | deterministic content hash | **no** | current | 288/288 reuse verified | keep |
| retrieval | deterministic | **no** | current | 15–16 ms/person | keep |
| field matching | deterministic | **no** | current | **+0.148 CI [0.088, 0.211]**, zero model calls | keep, and invest here |
| ranking | deterministic NDCG | **no** | current | — | keep |
| constraints | deterministic | **no** | current | — | keep |
| explanation generation | not implemented | probably | template over provenance | — | needs provenance first |
| explanation validation | not implemented | **no** | deterministic provenance check | provenance metric works | deterministic |
| career-family discovery | not implemented | probably | — | none | defer |
| surprising-fit discovery | deterministic metric exists | **no** | current | — | keep |
| networking strategy | deterministic legacy | **no** | current | out of scope | leave |
| next-action planning | deterministic legacy | **no** | current | out of scope | leave |

**The operating principle in the brief survives the audit.** Every measured win came from either a
model at a semantic boundary (normalisation: +0.241) or a deterministic improvement in how
structured output is compared (+0.148). Not one came from adding agents: going from one agent to two
produced −0.274 at v1 and an inconclusive +0.074 at v2.

---

## 6. Prompt forensics

Scored against Definition / Include / Exclude / Abstain / Examples.

| prompt | Definition | Include | Exclude | Abstain | Examples | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `person-blueprint` v1 | four labelled sections | implicit via sections | "Never infer one from another" | "Use only what the text supports" | **none** | adequate; carried by input structure |
| `experience-agent` v1 | explicit | explicit | explicit, incl. disliked-but-performed | explicit empty list | **none** | strongest of the five |
| `direction-agent` **v1** | **BROKEN** | "work they enjoy and want more of" | — | present | none | **defective — merged Preference into Direction** |
| `direction-agent` v2 | explicit future-only | goals, aims, transitions | explicit "ENJOYING is NOT WANTING" | explicit | **none** | corrected |
| `job-blueprint` v1 | explicit | explicit | none needed | explicit | **none** | adequate |

**No prompt contains a single canonical example.** Every construct boundary is carried by prose. The
v1 Direction failure is exactly what that costs: one clause, `"work they enjoy and want more of"`,
silently merged two channels and cost −0.274 NDCG and 24 wasted calls. A two-line contrastive
example would very likely have prevented it.

### Non-implication audit

| non-implication | stated where | enforced where |
| --- | --- | --- |
| performed ↛ liked | shared + both agents | provenance metric |
| performed ↛ desired | shared + both agents | provenance metric |
| **liked ↛ desired** | **only in Direction v2** | provenance metric |
| disliked ↛ future prohibition | nowhere | **no construct exists** |
| qualified ↛ performed | nowhere | **channel not implemented** |
| qualified ↛ desired | nowhere | **channel not implemented** |
| desired ↛ qualified | nowhere | **channel not implemented** |

Four of seven are unenforced because Qualification does not exist. `liked ↛ desired` — the one that
broke v1 — is stated in exactly one prompt and nowhere else.

**Recommendation, least brittle first.** These are constraints on a shared semantic contract, not
prose to be re-typed per prompt. Put the definitions and non-implications in **one exported
constant** that every prompt composes, add **one contrastive example pair per boundary**, and keep
the deterministic provenance validator as the check. A test asserting the shared block appears
verbatim in every channel prompt makes drift a build failure. Schemas cannot express these
constraints; validators and tests can.

---

## 7. Evidence routing — verified from rendered model input, not helper names

| architecture | Experience ev. | Preference LIKE | Preference DISLIKE | Aspiration | Qualification |
| --- | --- | --- | --- | --- | --- |
| shared CareerBlueprint | Y | Y | Y | Y | n/a |
| v1 full-context — Experience | Y | Y | Y | Y | n/a |
| v1 full-context — Direction | Y | Y | Y | Y | n/a |
| v1 **"isolated"** — Experience | Y | – | – | – | n/a |
| v1 **"isolated"** — Direction | – | **Y** | **Y** | Y | n/a |
| v2 isolated — Experience | Y | – | – | – | n/a |
| v2 isolated — Direction | – | – | – | **Y only** | n/a |

**v1's "isolated" arm was isolated on the Experience side and not on the Direction side.** Its
Direction Agent was shown the preference sentences and told to include work the person enjoys — two
independent errors pointing the same way. Its measured contamination (0.629) is statistically
indistinguishable from the full-context arm's (0.628), which is the fingerprint of an arm that was
not isolated at all.

**Consequence: v1 produced two measurements of the same defect and zero measurements of the
hypothesis.** Describing Direction specialisation as "untested by v1" is justified.

---

## 8. Contamination metric audit

| metric | equation | numerator | denominator | code | blind spot | KEEP/REJECT grade |
| --- | --- | --- | --- | --- | --- | --- |
| frame collision | `all 5 roles match a wrong-channel planted frame` | wrong-channel-matching outputs | outputs in receiving channel | `channelIntegrity.ts` | **misses volume inflation entirely** (0.008 vs 0.424 truth) | supporting only |
| evidence contamination | `containment(quote, source) ≥ 0.6`, best channel wins by ≥ 0.1 margin | claims attributed to a non-legitimate channel | claims in channel | `provenance.ts` | requires a quote; ambiguous when channels share phrasing | **suitable, with §8.1 caveats** |
| interpretation drift | contaminated **and** source never shown to agent | — | — | `provenance.ts` | phrase-match limits | diagnostic |
| volume inflation | `interpreted / planted` | emitted count | planted count | `channelIntegrity.ts` | synthetic-only; needs known counts | diagnostic, strong |
| unsupported claim | best containment `< 0.6` | unattributable claims | claims | `provenance.ts` | a valid paraphrase reads as unsupported | diagnostic |
| ambiguous attribution | top-2 straddle legitimacy within margin | — | — | `provenance.ts` | — | diagnostic |

### Why identity collision read clean while volume exploded

A claim built from *work the person liked* is usually **not** any planted `desired` frame either. It
collides with nothing, so a wrong-channel-identity detector sees nothing. It is still exactly the
error that recommends someone into work they merely enjoyed talking about. **The two metrics answer
different questions, and only provenance answers the product's.**

### 8.1 Is the provenance metric itself trustworthy?

Audited rather than assumed, because a new metric producing intuitive numbers is not thereby valid.

- **Containment, not Jaccard** — correct choice: an agent quotes a fragment, and Jaccard would
  penalise a short accurate quote.
- **Floor 0.6, ambiguity margin 0.1** — both are **unvalidated hand-set thresholds**. No sensitivity
  analysis exists.
- **Corroborating signal is strong.** Attribution produced **0 drift, 0 unsupported, 0–1 ambiguous**
  across 500+ claims. A noisy matcher on a corpus that deliberately overlaps channels would produce
  many ambiguous cases; near-zero ambiguity means the quotes are near-verbatim and attribution is
  close to exact.
- **Independent confirmation.** Contaminated claims are readable in plain text — `"What I liked
  most: ..."`, `"The part I came to dread..."` — and the arithmetic corroborates: 11.0 desired items
  = 7 planted liked + 4 planted desired, exactly.
- **Structural asymmetry.** The metric can only be computed for architectures that emit a quote, so
  it cannot compare the shared arm against the split arms. That is a real limit, not a finding.

**Verdict: strong enough to support a KEEP/REJECT decision on the split arms, and it should have a
threshold sensitivity check before it gates anything else.**

---

## 9. Shared-blueprint auditability, and the hypothesis it raises

Provenance for the shared arm is **not currently captured**, and is **not recoverable** from existing
outputs — there is no quote to attribute and no per-claim identifier. It requires a new generation.
It must never be written up as clean behaviour.

**Hypothesis worth testing before any further multi-agent work:** adding a per-item `evidence` field
to `PERSON_BLUEPRINT_SCHEMA` would give the shared architecture the auditability that is currently
the split architecture's only clear advantage — at **one call per person instead of two**.

If that holds, multi-agent decomposition loses its main remaining justification. Minimum
experiment: bump to `person-blueprint v2` with one added field per item, regenerate 12 person calls
on LEXICAL_TRAP (**12 calls, ~$0.45**, jobs and everything else reused), then run the existing
provenance audit. Decision rule: if shared v2 holds its retrieval and reports provenance
contamination at or below isolated Experience's 0.000–0.008, the split architecture is not needed
for auditability.

---

## 10. Latency audit

Verified: cache hits excluded from fresh distributions (the committed Claude artifact reports
`p50LatencyMs: 0` precisely because the old code pooled them); job interpretation excluded from user
wait; deterministic ranking measured at 15–16 ms/person; latency attributed per architecture
variant; p90/p95 labelled as order statistics below 20 samples.

**Defect found and fixed during this audit.** `criticalPath()` computed the parallel estimate as
`max(p50_A, p50_B)`. That is not the median of `max(A_i, B_i)`: for independent agents,
`P(max ≤ t) = P(A ≤ t)·P(B ≤ t)`, so evaluating at `max(median_A, median_B)` gives at most 0.5 —
the old figure sits **at or below** the true median and is **optimistically biased**. A synthetic
case in the test suite shows the size: three people whose slowest agent is always 9,000 ms report
9,000 ms under per-subject pairing and 5,000 ms under the aggregate approximation, a **44%
understatement**. Requests now carry a `subjectId`, pairing happens per person before aggregation,
and every path records `parallelBasis` so an approximation can never be mistaken for a measurement.

Existing parallel numbers were produced by the old path and are therefore **optimistic lower
bounds**. They cannot be recomputed: `rawCalls` carried no person id, and the caches predate latency
persistence. Latency is now stored in the cache so a replayed arm stays reportable.

### What is measured versus estimated

| quantity | value | status |
| --- | --- | --- |
| shared person call, p50 / p95 | 10.8 s / 12.0 s | **measured** |
| deterministic assembly + retrieval | 15–16 ms/person | **measured** |
| v1 experience-agent p50 / p95 | 12.3 s / 25.0 s | **measured** (n=24) |
| v1 direction-agent p50 / p95 | 13.1 s / 16.8 s | **measured** (n=24) |
| v2 direction-agent p50 / p95 | **6.8 s / 9.2 s** | **measured** (n=24, from the paid run; not recoverable from cache) |
| split sequential user wait p50 | ~19 s | derived from measured parts |
| split parallel user wait p50 | ~12.3 s | **estimate, optimistically biased, never observed under concurrency** |

**Notable product signal: the v2 Direction Agent is ~2x faster than v1** (6.8 s vs 13.1 s) because
it reads 4 aspiration sentences instead of all 19. Evidence isolation is a latency optimisation as
well as a correctness one. It also means the split critical path is now dominated entirely by the
Experience Agent.

**Sample sizes are not sufficient for stable p90/p95.** n=24 puts p95 at the second-largest
observation. A real concurrent benchmark needs the calls actually issued in parallel, ≥100 subjects
per arm, and repeated trials across times of day to capture provider queueing.

---

## 11. Cost and scalability

**No person×job model loop exists.** `interpretCorpus` runs a person loop and then a job loop, never
nested — verified at `agentArchitecture.ts:184` and `:210`.

| architecture | calls | complexity | cacheability |
| --- | --- | --- | --- |
| shared person | 1/user | **O(users)** | per user, invalidated on evidence change |
| 4 specialist agents | 4/user | **O(4·users)** | per user per channel |
| shared + selective rescue | 1 + ε/user | O(users) | per user |
| shared + critic | 2/user | O(2·users) | per user |
| precomputed JobBlueprint | 1/job | **O(jobs), amortised over all users** | global |
| **forbidden** | — | O(users × jobs) | — |

Onboarding cost today: ~$0.03/user. Ongoing recommendation refresh: **$0 in model calls** — matching
runs against the stored blueprint. Job corpus: one-time per job, global. The topology is sound and
scales; the split architecture doubles onboarding cost and roughly doubles onboarding latency.

---

## 12. Stochastic stability — designed, not run

**Nothing is known about run-to-run variance.** Every result is a single generation per input.
Paired bootstrap over persons measures sampling variance across *people*, not across *generations*
of the same person. Reasoning tokens varied 261→982 at fixed effort, which is direct evidence that
generation is not stable — yet the effect it might have on scores is unmeasured.

This is the single largest unquantified threat to every conclusion in the program, including the
`agent-field-match` finding.

**Smallest study that would answer it:** 12 existing LEXICAL_TRAP people × 3 fresh generations of
the shared blueprint = 36 calls, ~$1.30. Force fresh generation by a cache-busting trial index
recorded in the cache key. Metrics: per-field agreement across trials, channel-volume variance,
concept-recovery variance, ranking rank-correlation across trials, and **effect-sign stability** for
the `agent-field-match` vs `agent-blueprint` delta. Decision rule: if the sign of that delta flips
across trials, every architecture comparison in the program needs repeated trials before it can be
believed.

---

## 13. Benchmark realism and population limits

The corpus supplies evidence **already partitioned** into `experienceEvidence`,
`preferenceEvidence` (with an explicit `LIKE`/`DISLIKE` stance) and `aspirationEvidence`. It also
renders preference sentences with giveaway prefixes — `"What I liked most:"`,
`"The part I came to dread"`.

**This makes the routing problem free and the channel-assignment problem much easier than the real
product.** It is why the shared blueprint hits exactly 1.000 volume on all four channels, and why
removing the partition (full-context) immediately inflated Experience to 1.736.

### Population gaps, measured from planted truth

| distribution | measured | consequence |
| --- | --- | --- |
| channel profile | identical for all 12 people: 6 performed / 7 liked / 2 disliked / 4 desired | zero structural variance |
| desired vs performed role overlap | histogram `0/0/5/7/0/0` — always 2 or 3 of 5 | **no low-experience/high-direction group** |
| disliked vs performed overlap | `0/0/0/0/0/12` — always exactly 5 | "rejects work they performed" is the whole corpus, no contrast group |

**Cannot be claimed from this corpus:** anything about major career changers, low-prior-experience
with high desired direction, qualified-but-unwanted work, or desired-but-unqualified work.
Qualification is not even interpreted.

**Can be claimed:** semantic normalisation across disjoint vocabulary, matcher comparisons, channel
contamination and volume integrity, cost and latency shape.

A future separately-versioned `MIXED_EVIDENCE` family — same hidden truth, evidence rendered as one
unlabelled narrative containing constructions like *"I did this for years and hated it"* and *"I've
never done this professionally but want to move into it"* — would distinguish architectures that the
current corpus cannot: specifically, whether isolation survives without free routing, and whether a
router is needed at all. **The frozen corpus is not touched by this audit.**

---

## 14. Validation discipline

`VALIDATION` has **never been used by any agent arm**: the ledger's four experiment ids are all
DEVELOPMENT. `LOCKED_CONFIRMATION` is not merely unread — it is not even frozen
(`lockedConfirmationFrozen: false`), and the guard refuses with its sentinel on live probe.

Tuned on DEVELOPMENT so far: the Direction prompt (v1→v2), evidence routing, output allowances, the
matcher choice, and the contamination metrics. That is a substantial amount of DEV-fitted choice,
and the generalisation gap elsewhere in this codebase is large (extraction macro F1 drops 0.831 →
0.611 across the boundary).

**Proposed transition rule.** Move to VALIDATION when all four hold: (1) one architecture wins its
primary channel on DEVELOPMENT with a CI excluding zero; (2) stochastic stability shows the effect
sign is stable across ≥3 generations; (3) no metric used in the decision has an unvalidated
threshold gating it; (4) the architecture is frozen — prompts, schemas, routing, matcher — and the
freeze is committed before the VALIDATION run. Run VALIDATION **once** per frozen architecture.
Today, condition (1) fails and (2) is unmeasured.

---

## 15. Human validity, security, and development process — design notes

**Human validity.** Zero. Everything is planted-truth recovery on synthetic people. A later program
should have real users review performed work, likes, dislikes, desired work, qualifications,
transfer hypotheses, missing information, incorrect assertions, and explanations — with corrections
captured as *held-out* evaluation evidence under a custodian, never folded back into a tuning set.
Prerequisites: consent, data minimisation, deletion, and a hard rule that real-user interpretations
are **never committed** (already enforced by `tests/runtime-cache-policy.test.ts`).

**Security.** Resumes, job descriptions, recruiter messages and web pages are **untrusted input**.
Today the runtime concatenates evidence directly into the prompt with no delimiting or
instruction-hierarchy separation, which is a prompt-injection path the moment real content arrives.
Structured output constrains the shape of the response but not the model's behaviour. The
architecture has no tools and takes no actions, so the current blast radius is small. Requirements
before ingesting real content: explicit data/instruction separation, treat all extracted text as
data, never let ingested text reach a tool-calling path, and keep the no-secrets-in-artifacts rule.

**Development process.** The operator prompts have been carrying knowledge that belongs in the
repository — research contracts, current state, experiment design and safety constraints restated
each turn. It has worked, but it is brittle: the two premises that failed this session (cache
resumability, the 0.748 figure) failed because they lived in a briefing rather than on disk. The
repository now holds the durable versions: `AGENTS.md` for standing rules,
`RESEARCH_CONTRACT_AMENDMENTS.md` for invariants, `PROVIDER_HANDOFF_STATE.md` for verified state,
per-experiment specs for preregistration, and the test suite as the gate. **What remains in the
wrong place:** experiment preregistration is still narrated in prompts rather than committed before
execution, and `docs/` has ~90 files with real duplication. The operator prompt should shrink to
"read the contracts and state, verify, execute the named spec, persist, stop."

---

## 16. Current strongest baseline, and ranked hypotheses

**CURRENT BASELINE: shared CareerBlueprint + `agent-field-match`.** LEXICAL_TRAP experience 0.745,
preference 0.632, direction 0.732; SEMANTIC_BRIDGE experience 0.709, preference 0.693, direction
0.878. Beats every deterministic baseline and every executed agent alternative on every channel of
both families.

| architecture | semantic acc. | channel integrity | auditability | robustness | latency | cost | complexity | scalability | empirical support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lexical only | poor on bridge | n/a | n/a | high | instant | free | trivial | excellent | strong, and the bar |
| shared + token matcher | moderate | exact volumes | **none** | unknown | 10.8 s | 1 call | low | excellent | strong |
| **shared + field matcher** | **best measured** | exact volumes | **none** | unknown | 10.8 s | 1 call | low | excellent | **strongest** |
| shared + provenance *(untested)* | expected equal | expected equal | **would be full** | unknown | ~10.8 s | 1 call | low | excellent | **none yet — top candidate** |
| specialist v1 | worse | broken Direction | full | — | ~19 s seq | 2 calls | med | good | refuted |
| specialist v2 isolated | Direction 0.806 vs 0.732, CI spans zero | **0.000 provenance, 1.000 volume** | full | unknown | ~12.3 s est | 2 calls | med | good | promising, inconclusive |
| specialist, always-on 4 channels | unknown | unknown | full | — | ~4x | 4 calls | high | moderate | none |
| shared + selective rescue | unknown | unknown | partial | — | ~10.8 s + ε | 1 + ε | med | excellent | none |
| shared + critic | unknown | unknown | partial | — | ~2x | 2 calls | med | good | none |

---

## 17. Is v2 Direction still the next experiment?

It is no longer a question — **v2 executed**. Its result, with Experience bit-identical from cache
so the ablation is clean:

| arm | channel | v1 | v2 | change | v2 paired vs shared |
| --- | --- | --- | --- | --- | --- |
| isolated | direction | 0.447 | **0.806** | **+0.359** | Δ=+0.074 CI [-0.066, 0.198] INCONCLUSIVE |
| full-context | direction | 0.457 | 0.671 | +0.214 | Δ=-0.061 CI [-0.176, 0.053] INCONCLUSIVE |
| isolated | experience | 0.729 | 0.729 | 0.000 | Δ=-0.016 CI [-0.092, 0.050] INCONCLUSIVE |

Provenance for v2 Direction: **0.000 contamination in both arms** (was 0.628/0.629). Desired volume
ratio **1.000** in both (was 2.688/2.750).

**Reading it honestly: the prompt-contract fix worked completely on channel integrity and did not
resolve the retrieval question.** `split-isolated` now numerically leads `shared` on Direction
(0.806 vs 0.732) and closes most of the gap to the 0.951 normaliser ceiling, but the interval spans
zero at n=12. It is neither adopted nor refuted.

Also settled: **the v1 Direction failure was a prompt-contract failure compounded by an
evidence-routing failure — not an architecture failure.** Both errors are now measured, and both are
fixed.

---

## 18. What this audit changes about the plan

The evidence points somewhere different from where the multi-agent program was heading.

Two things won measurably: **a model at the semantic-normalisation boundary** (+0.241, replicated
across vendors) and **a deterministic improvement in structured comparison** (+0.148, zero extra
calls). Adding agents has not won anything yet: −0.274 at v1, +0.074 inconclusive at v2.

Meanwhile the split architecture's one clear advantage — claim-level auditability — is very likely
obtainable from the shared architecture for **one added schema field and 12 calls**. If that holds,
the case for always-on multi-agent decomposition largely evaporates, and the honest next move is not
more agents but **provenance on the incumbent, then stability, then a benchmark that stops giving
the routing away for free**.

**"Structured semantic comparison matters more than agent count" is the best-supported architectural
claim in the program.** Field-aware matching is significant on both families over identical
interpretations at zero marginal cost; agent count is 0 for 2.
