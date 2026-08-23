# PTA-01 — Prompt / benchmark lineage audit

Written 2026-08-23 from git, the experiment registry, the prompt-render freeze, and the
executed prompt sources. **Amended the same day** after a second forensic pass.
**Zero paid model calls.** No additional VALIDATION or LOCKED instances were generated
or inspected in either pass.

This is a lineage reconstruction, not a new experiment and not a fourth research roadmap.
The live program remains `config/agentic-research-program.json`.

## 0. Verdict in one page

There is no TaskDNA weight-training dataset. The effective loop is **prompt tuning** on a
hand-designed synthetic frame corpus.

Every scored agent arm used **DEVELOPMENT**, almost always **12 people**, each ranked
against a **person-specific** pool of about **24 generated jobs**. “288 jobs” is
12 × 24 tailored pools, **not** a shared 288-job market. NDCG@10 is top-10 from
those ~24 candidates. Shared-universe retrieval and global JobBlueprint amortization
are **not** demonstrated (`MKT-01`).

Those 12 people are code-generated with a **fixed 6 / 7 / 2 / 4** channel profile.
The executed prompts receive **pre-bucketed** EXPERIENCE / LIKES / DISLIKES / WANTS NEXT
text. Qualification is planted in `narrative` and is **not read**.

The **observed-input** freeze was committed **before** the first agent score. There is
no evidence of “run agent → rewrite answers.” Hidden planted truth is **not** in that
freeze (`TRUTH-01`). There **is** generator / designer / evaluator affinity:
Claude Opus 5 co-authored the frame lexicon, the freeze, and the first CareerBlueprint
prompts. OpenAI later reproduced the Semantic Bridge effect on the same frozen objects.

Direction v2 and person-blueprint v2 were written after inspecting those same 12
LEXICAL_TRAP DEVELOPMENT people. Their NDCGs are **development-benchmark performance**,
not independent generalization.

`agent-field-match` was written after inspecting DEVELOPMENT HARD_NEAR_MISS failures
(`6fa64a2`). The LEXICAL_TRAP +0.148 vs token-bag was a **secondary** observation on
the same run that **rejected** the preregistered agent-blueprint hypothesis. Treat
field-match as **adaptive DEVELOPMENT evidence** until independent confirmation.
Do not retune it now.

P-01 splits: **provenance/auditability = SUPPORTED**; **retrieval preservation /
non-inferiority = INCONCLUSIVE**. A CI that spans zero is not equivalence.

S-01 remains preregistered in the experiment registry and is **DEFERRED** on
information value in the live program. Paid execution is not authorized. It is not
the next experiment.

Current VALIDATION is a **procedural generator holdout**, not a blinded external
holdout. LOCKED is deterministically buildable from repo code and the known seed;
it is not a custodied blind artifact (`LOCK-01`).

---

## 1. Prompt inventory (every version that exists)

Executed CareerBlueprint / specialist prompts live in `src/agent/agentArchitecture.ts` and
`src/agent/splitAgents.ts`. Shared contract fragments live in `src/agent/semanticContract.ts`.
Render hashes for person 0 of each family are frozen in `config/prompt-render-freeze.json`.

| Prompt | Version | File | First commit | Status |
| --- | --- | --- | --- | --- |
| `person-blueprint` | v1 | `agentArchitecture.ts` | `6088556` 2026-08-23 11:22 UTC | Executed. Claude SEMANTIC_BRIDGE; OpenAI SEMANTIC_BRIDGE / LEXICAL_TRAP / partial NATURAL |
| `person-blueprint` | v2 | `agentArchitecture.ts` | extracted/frozen `ed1280b`; first paid use P-01 (`6bf7be2`) | Byte-identical to v1 plus a required `evidence` quote. P-01 only |
| `job-blueprint` | v1 | `agentArchitecture.ts` | `6088556` | Executed on every scored person-job arm. Never revised |
| `experience-agent` | v1 | `splitAgents.ts` | `a497848` | Executed on both split arms. Not revised |
| `direction-agent` | v1 | `splitAgents.ts` | `a497848` | **SUPERSEDED.** Defined WANTED to include enjoyed work. Isolated arm also saw LIKES/DISLIKES. Cache retained |
| `direction-agent` | v2 | `splitAgents.ts` | written after `656c45c` failure; scored in direction-v2 arm | Desired only. Isolated arm sees aspiration only |
| `discover-work-content` | v1 | `runtime.ts` `PROMPTS` | `6088556` era scaffold | **Never executed against a model** |
| `transfer-hypotheses` | v1 | `runtime.ts` `PROMPTS` | same | **Never executed against a model** |

No other person, job, or specialist prompt version exists. There is no Qualification
interpreter prompt.

`CHANNEL_CONTRACTS.contrastiveExamples` in `semanticContract.ts` are **not** rendered into
any executed v1/v2 prompt. They are reserved for a future contract version (CT-01). The
executed prompts contain **no few-shot examples**. Prompt tuning happened by changing
instructions and evidence routing after inspecting DEVELOPMENT failures, not by pasting
benchmark sentences into the prompt body.

---

## 2. What the executed prompts actually receive

`interpretCorpus` (`agentArchitecture.ts`) does **not** pass `person.narrative`. It builds:

| Prompt section | Source field | Planted channel |
| --- | --- | --- |
| `--- EXPERIENCE (what they have done) ---` | `experienceEvidence[].text` | performed |
| `--- LIKES ---` | `preferenceEvidence` where `stance === "LIKE"` | liked |
| `--- DISLIKES ---` | `preferenceEvidence` where `stance === "DISLIKE"` | disliked |
| `--- WANTS NEXT ---` | `aspirationEvidence[].text` | desired |

The job prompt receives `--- RESPONSIBILITIES ---` from rendered job frames.

So a result such as “Direction extraction works” currently means: given text already placed
in the WANTS NEXT bucket, can the model normalize the underlying five-field work? It does
**not** mean: can TaskDNA read a raw biography and decide Experience vs Preference vs
Direction?

The five-field output schema (`action`, `object`, `purpose`, `method`, `domain`) is the
same factorization the benchmark uses as hidden identity. Concept ids are not shown. The
task is mapping synthetic language into a chosen ontology, not discovering one.

---

## 3. Timeline (UTC). What existed when each prompt was written

Git timestamps below are the committer dates. Early research commits are authored by
`dmenzin` with `Co-Authored-By: Claude Opus 5`. Later Cursor Agent commits add
`Co-authored-by: dmenzin`.

| UTC | Commit | What landed | Benchmark already frozen? | DEVELOPMENT results already visible? |
| --- | --- | --- | --- | --- |
| 09:25 | `fbf0706` | `semantic-frame` v1; hand-authored lexicon; O*NET-sentence leak removed | No | No agent yet |
| 10:39 | `0e98fc0` | `semantic-frame.v2` + `frame-corpus.v1`; four families; held-out repair; plausibility; archetype repairs | No (design freeze in progress) | Deterministic diagnostics only. **No agent scores** |
| 10:52 | `eb58f13` | Freeze + re-baseline of deterministic architectures on 48 DEVELOPMENT people | **Yes.** `config/frame-corpus-freeze.json` | Deterministic baselines only. Agent runtime does not exist |
| 11:22 | `6088556` | Runtime + **first** `person-blueprint@v1` / `job-blueprint@v1` | Yes | No model-mediated result yet |
| 11:34 | `48bae4a` | First Claude SEMANTIC_BRIDGE n=12 result | Yes | First agent scores exist |
| 11:25 | `8e5c1d5` | Person-understanding analysis from cache | Yes | Inspected DEVELOPMENT person 1 planted disliked frames and surface wording |
| 11:47 | `6fa64a2` | Field-aware matcher from HARD_NEAR_MISS failures on those interpretations | Yes | Matcher changed; prompts unchanged |
| 13:13–15:27 | OpenAI provider → LEXICAL_TRAP → split v1 (`656c45c`) | Same frozen corpus | Yes | Direction v1 diagnosed on 12 LEXICAL_TRAP DEVELOPMENT people: 11 wanted = 7 liked + 4 desired |
| 15:50 | `9379845` | Provenance audit (zero calls) | Yes | Same 12 people. Shared provenance UNMEASURABLE |
| later | direction-v2 arm | Prompt + isolated routing fix | Yes | Same 12 people. Isolated Direction 0.806 vs shared 0.732, CI spans 0 |
| 16:51 | `ed1280b` | Extract v1 fragments into `semanticContract.ts` without changing a rendered byte | Yes | Prompt-render freeze captured |
| 17:23 | `6bf7be2` | P-01 Case A (`person-blueprint@v2`) | Yes | Same 12 LEXICAL_TRAP DEVELOPMENT people |
| 17:33 | `94e0033` | S-01 amended, still unpaid | Yes | — |

**Confirmed.** Freeze before first agent score. No “change the answer key after the agent
ran.”

**Also confirmed.** Claude-assisted benchmark design → Claude-assisted first prompt →
Claude evaluation, then OpenAI replication on the same frozen prompt/inputs.

---

## 4. Which DEVELOPMENT cases each version was tuned against

Paid / scored screens used `people=12` even though the freeze holds 48. The 12 are the
first 12 DEVELOPMENT people of that family at `FRAME_BENCH_SEED = 20260823`. They are not
a random subset of real careers. They are the prefix of a deterministic generator.

| Experiment | People | Family | Prompts | What was inspected | What changed |
| --- | --- | --- | --- | --- | --- |
| Claude SEMANTIC_BRIDGE | 12 | SEMANTIC_BRIDGE | person/job v1 | Rankings, channel volumes, person-1 hidden disliked frames, surface lexicon hits | Field-aware matcher (`6fa64a2`) after HARD_NEAR_MISS inspection. Adaptive DEVELOPMENT evidence. Prompts unchanged |
| OpenAI effort calibration | 1 person, 1 job | SEMANTIC_BRIDGE | v1 | Truncation / token counts | Output allowance. Not a quality claim |
| OpenAI SEMANTIC_BRIDGE | 12 | SEMANTIC_BRIDGE | person/job v1 | Replication of the Claude delta | Nothing. Same prompts |
| OpenAI LEXICAL_TRAP | 12 | LEXICAL_TRAP | person/job v1 | Preregistered agent-blueprint hypothesis **REJECTED**. Field-match +0.148 was secondary (R-01) | Matcher adopted as working DEV tool. Not independent confirmation |
| OpenAI NATURAL | 12 people / 35 jobs | NATURAL | person/job v1 | Stopped by operator. **Continuation not authorized** | Nothing |
| split direction-v1 | 12 | LEXICAL_TRAP | experience@v1, direction@v1 | 11 wanted/person; provenance 81/129 and 83/132 desired claims from LIKE | **direction-agent@v2** + isolated routing |
| split direction-v2 | 12 | LEXICAL_TRAP | experience@v1, direction@v2 | Contamination 0.629 → 0; isolated dir 0.806 | No further prompt edit. INCONCLUSIVE on retrieval |
| P-01 | 12 | LEXICAL_TRAP | person@v2, job@v1 | Same 12 people; provenance 0.000 | Provenance SUPPORTED. Retrieval preservation INCONCLUSIVE. Not shipped |
| S-01 amended | 12 × 4 trials | LEXICAL_TRAP | person@v2 | Not executed. Program status **DEFERRED** | Preregistration preserved. Do not run |

Those 12 LEXICAL_TRAP DEVELOPMENT people are now **prompt-training examples** for
Direction v2 and provenance v2. The `.806` isolated Direction number and the P-01
`.727 / .646 / .670` field-match levels (and the P-01 deltas) are scores on the working
set that diagnosed the previous failure. They are not held-out confirmation.

---

## 5. Hidden truths that were visible

Hidden frame identity is excluded from the freeze file (observed inputs only). It is
**not** excluded from developer inspection.

`8e5c1d5` (person-understanding, Claude SEMANTIC_BRIDGE cache) explicitly compared person
1’s planted disliked frames to the model output and quoted person-side surface forms.
`656c45c` and `9379845` inspected LEXICAL_TRAP DEVELOPMENT outputs and planted channel
counts. That is legitimate DEVELOPMENT work. It is also why those people cannot later be
treated as independent tests of the prompts they produced.

No VALIDATION hidden frames were used in any registry experiment.

---

## 6. Are prompt examples derived from benchmark concepts?

**Executed v1/v2 prompts: no examples at all.**

`semanticContract.ts` contrastive examples (not yet in any executed prompt) reuse
benchmark-adjacent language on purpose:

- “month-end accounts” / “the books” sit next to `obj.ledger`
- “safety reviews” sit next to `obj.safety_incident`
- “What I liked most” / “What I want to move into next” copy the renderer carriers
- “I hold a six sigma green belt.” is a `QUALIFICATION_POOL` string

If CT-01 lands those examples into a new prompt version, that version will have been
shown synthetic benchmark diction. Record it then. It is not true of the paid v1/v2 arms.

---

## 7. Claude / Cursor dual authorship

Cannot prove from git that Claude typed every lexicon string or every prompt sentence.
The coupling that **is** in the metadata:

| Object | Commit | Trailer |
| --- | --- | --- |
| Frame lexicon v1 | `fbf0706` | `Co-Authored-By: Claude Opus 5` |
| Frame corpus v2 + families | `0e98fc0` | `Co-Authored-By: Claude Opus 5 (1M context)` |
| Freeze + deterministic re-baseline | `eb58f13` | same |
| First CareerBlueprint prompts | `6088556` | same |
| First Claude scores | `48bae4a` | same |
| Field-aware matcher | `6fa64a2` | same |
| Later OpenAI / split / P-01 / S-01 work | Cursor Agent commits | `Co-authored-by: dmenzin` |

This belongs on the threats-to-validity ledger as **generator / designer / evaluator
affinity**. The OpenAI replication shows the Semantic Bridge effect is not
Claude-reading-Claude. It does not show the ontology, templates, or n=12 distribution
are independent of that design process.

---

## 8. VALIDATION and LOCKED — do not call them blind without qualification

### VALIDATION is a procedural generator holdout, not a blinded external holdout

True, and still true:

- No agent experiment in `config/experiment-registry.json` used `split === "VALIDATION"`.
- This audit did not open VALIDATION person texts, hidden frames, or job lists.
- There is no evidence a prompt was tuned on VALIDATION *instances*.

Also true, and previously under-said:

- **Held-out vocabulary and source definitions are visible in the repository.**
  `semanticFrame.ts` lists every `held-out` concept id and its surface forms in
  plaintext. Anyone who writes a prompt can read them. That is not a blind lexicon.
- **Existing tests instantiate VALIDATION corpora and inspect planted identity.**
  `tests/frame-corpus.test.ts` builds 16 VALIDATION people and asserts work
  identities are disjoint from DEVELOPMENT. `scripts/bench-frame-acceptance.ts`
  does the same class of check. Those runs see planted identities. They are
  generator-invariant tests, not agent screens, but they mean VALIDATION is not
  an untouched sealed box.
- Freeze hashes for VALIDATION observed inputs exist in
  `config/frame-corpus-freeze.json`. Hash presence is not instance inspection;
  it is also not secrecy of the generating process.

So: no agent experiment and no manual case review for prompt tuning has used
VALIDATION **instances**. VALIDATION is still a **procedural holdout of this
generator** (held-out family + different person indices + a promise not to score
agents on it yet). It is **not** a blinded external holdout, not a custodied
dataset, and not “untouched” in the strong sense.

`V-01` is therefore **frame-corpus.v1 mechanism validation only**. It is not
eventual architecture confirmation. If `M-01` / `M-02` can change the selected
architecture, final confirmation is `V-02` after that architecture is frozen.
Do not consume VALIDATION now.

### LOCKED is buildable, not custodied

`LOCKED_CONFIRMATION` is `lockedConfirmationFrozen: false` and has not been
executed. The evaluation entry points refuse it.

It is nonetheless **deterministically buildable** from this repository:
`buildFrameCorpus({ split: "LOCKED_CONFIRMATION" })` plus `FRAME_BENCH_SEED =
20260823` and the in-repo lexicon. Anyone with the repo can materialize it.
That is not a blind confirmation artifact.

Do **not** build or inspect it now.

`LOCK-01` tracks a future requirement: a genuinely blind, custodied final
confirmation artifact or seed **outside prompt-author access**. Until that
exists, do not describe LOCKED as sealed.

---

## 9. Relabel of existing numbers

| Finding | Trust after this audit |
| --- | --- |
| Semantic normalisation can bridge deliberately separated vocabulary | Strong mechanistic DEVELOPMENT evidence |
| Same effect on Claude and OpenAI | Strong evidence it is not one-provider-specific |
| Field-aware matcher beats token-bag on Lexical Trap | Adaptive DEVELOPMENT evidence; secondary to a rejected preregistered hypothesis; not independent |
| Provenance / auditability (P-01) | SUPPORTED on the same 12 people |
| Retrieval preservation / non-inferiority (P-01) | INCONCLUSIVE. CI spanning zero is not equivalence |
| Isolated Direction may outperform shared | Interesting DEVELOPMENT evidence, not independent |
| Absolute NDCG = product performance | No |
| Current prompt works on arbitrary real career input | Unknown |
| E/P/D routing works on raw messy text | Largely untested (pre-bucketed inputs) |
| Qualification works | No — not implemented |
| Prompt generalizes past this DEVELOPMENT distribution | Unknown |
| Five-field ontology is human-valid | Unknown |

---

## 10. Evaluation scope (person-specific pools, not a market)

Paid n=12 screens call `buildFrameCorpus({ people: 12, … })`. Each person gets
their own job list from `buildJobsFor` (~24 jobs: forced archetypes + 6
distractors; empty specs are dropped). Ranking is **within that person’s
pool**. Summing 12 × 24 = 288 counts interpretations, not a shared market.

NDCG@10 therefore means: of those ~24 person-specific candidates, how good is
the top 10. It does **not** mean retrieval from a shared job universe, and it
does not demonstrate that JobBlueprints were computed once globally and reused
as a product corpus (`MKT-01`). Job-interpretation *caching* inside an
experiment is not market-scale amortization.

## 11. Branch authority

PR #8 (`cursor/taskdna-product-forensic-audit-b7d8`) and PR #9 (this branch,
`cursor/taskdna-prompt-benchmark-lineage-b7d8`) are **sibling audit branches**.
They do not share one HEAD.

| PR | Branch | Base (as opened) | Subject |
| --- | --- | --- | --- |
| #8 | `cursor/taskdna-product-forensic-audit-b7d8` | `cursor/taskdna-agent-first-runtime-research` | Product-engine forensic specs (17-d Work Fit / MAE). No algorithm change |
| #9 | `cursor/taskdna-prompt-benchmark-lineage-b7d8` | `cursor/taskdna-openai-provider-migration-b7d8` | Agent prompt/benchmark lineage. No prompt or truth mutation |

Do not silently treat both as current authority. Product numbers from #8 and
agent NDCGs from #9 are different stacks.

**Proposed future reconciliation (do not merge or rebase unless authorized):**

1. Keep #8 as the as-is product-engine spec on the product path.
2. Keep #9 (this amendment included) as the as-is agent-research lineage spec.
3. Reconcile into the live research-program / AGENTS.md only after an explicit
   operator decision, in that order: product facts first if they conflict with
   older product docs; agent-research facts first if they conflict with older
   agent summaries.
4. Do not fast-forward either branch over the other as if they were one line
   of work.

`BR-01` tracks that decision.

## 12. What this audit does not authorize

- Paid S-01 (program status DEFERRED; registry preregistration preserved)
- Implementing or rendering M-01
- Inspecting or generating additional VALIDATION or LOCKED instances
- Building LOCKED “to see”
- Editing any executed prompt
- Retuning `agent-field-match`
- Mutating hidden truth or the observed-input freeze
- Treating MIXED_EVIDENCE, independent renderers, or `ONT-01` as already done
- Collecting a weight-training set

Next work is zero-call: `ONT-01`, `TRUTH-01`, `LOCK-01` design, and the M-01
independence protocol — not S-01.
