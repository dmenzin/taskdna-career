# TaskDNA architecture research — run report

**Run date**: 2026-08-23
**Starting branch / SHA**: `cursor/taskdna-claude-agentic-research` @ `fbf0706df1fdc8752509650dc52b06b7f0152923`
**Research branch**: `cursor/taskdna-agent-first-runtime-research`

This report is decision-oriented. Numbers are measurements from committed, runnable scripts;
where something is not established, it says so rather than filling the gap with an inference.

---

## 1. What was wrong before, and what changed

The corpus this run replaced rendered person text and job text as two paraphrases of **one
shared O\*NET sentence**. Raw token overlap identified same-work pairs at **ROC AUC 0.9814** —
the wording nearly gave away the answer. No result about semantic transfer measured on that
corpus was trustworthy, including the premise that motivated this work.

The repaired benchmark (`frame-corpus.v1` / `semantic-frame.v2`) represents hidden truth as a
frame of **concept ids** and renders each side through its own vocabulary, in three regimes:

| family | lexical ROC AUC | what it tests |
| --- | --- | --- |
| `NATURAL` | 0.877 | ordinary resumes and postings; overlap is realistic and allowed |
| `SEMANTIC_BRIDGE` | 0.493 | genuine transfer; wording gives nothing away |
| `LEXICAL_TRAP` | 0.881 | trap pairs overlap **more** than true matches (margin +0.030) |

**18/18 acceptance gates pass** (`pnpm bench:frame-acceptance`). The design was preregistered in
`docs/BENCHMARK_FAMILIES_PREREGISTRATION.md` before any architecture was scored, and the
observed inputs are frozen in `config/frame-corpus-freeze.json`.

### Defects found and fixed before freezing

| defect | how it showed up |
| --- | --- |
| Held-out vocabulary family unusable — zero held-out instrument/output concepts, so `sampleFrame(rng,["held-out"])` **threw**; other roles had one concept each, giving 2 distinct identities. The contract's generalization mechanism had never been runnable. | crash |
| Relevance effectively **binary** (grades 0 and 3 only); joint experience+preference relevant set **empty**, so every joint metric would have reported on nothing | histogram `192/0/0/72`; 0 joint pairs |
| **Titles were a relevance oracle** — relevant archetypes got the person's own title, distractors a foreign one | permutation z = 5.1 title / 18.4 industry |
| Balancing only distractors left an **inverted** oracle, still exploitable by anything that learns to flip the sign | title-only AUC 0.449 |

### The defect that would have produced a false headline

Job ids were assigned in construction order and archetypes are added relevant-first, so any
architecture returning **tied scores** was sorted by the id tie-break straight into a
near-perfect ranking.

Measured before the fix: `onet-canonical` — which abstains on **100%** of bridge text and scored
every job exactly `0.000` — posted **NDCG@10 0.933 on SEMANTIC_BRIDGE**, beating every baseline
by +0.53. *"O\*NET wins on semantic transfer"* would have been this run's headline, produced by
an architecture that recovered nothing at all.

Jobs are now shuffled before ids are assigned, and a permanent gate requires a degenerate
`constant-score` ranker to score no better than `random`.

---

## 2. Architecture results

### Deterministic re-baseline — NDCG@10, DEVELOPMENT, 48 people

| architecture | NATURAL | SEMANTIC_BRIDGE | LEXICAL_TRAP |
| --- | --- | --- | --- |
| random | 0.348 | 0.315 | 0.378 |
| constant-score *(degenerate control)* | 0.385 | 0.354 | 0.336 |
| title-only | 0.397 | 0.353 | 0.360 |
| char-ngram-lexical | 0.634 | 0.342 | 0.600 |
| resume-lexical | 0.580 | 0.371 | 0.522 |
| **experience-lexical** *(strongest simple)* | **0.665** | **0.397** | **0.603** |
| onet-canonical | 0.412 | 0.354 | 0.365 |
| *oracle-planted-truth (ceiling)* | *1.000* | *1.000* | *1.000* |

### Agent arm — SEMANTIC_BRIDGE, 12 people

| architecture | experience | preference | direction |
| --- | --- | --- | --- |
| experience-lexical | 0.399 | 0.332 | 0.142 |
| onet-canonical | 0.346 | 0.250 | 0.276 |
| agent-blueprint (bag-of-tokens) | 0.645 | 0.545 | 0.700 |
| **agent-field-match** | **0.748** | **0.592** | **0.818** |
| *oracle-normalizer (control)* | *0.808* | *0.616* | *0.993* |
| *oracle-planted-truth (ceiling)* | *1.000* | *0.979* | *1.000* |

Paired bootstrap over persons, `agent-blueprint` vs `experience-lexical`:

| channel | delta | 95% CI | verdict |
| --- | --- | --- | --- |
| experience | +0.246 | [0.134, 0.358] | **BETTER** |
| preference | +0.213 | [0.032, 0.367] | **BETTER** |
| direction | +0.559 | [0.387, 0.713] | **BETTER** |

---

## 3. Verdicts

### O\*NET — remove it from the primary matching path

Not neutral: **actively harmful**.

- On SEMANTIC_BRIDGE it scores **0.354, identical to the constant-score control**, because it
  abstains on 100% of bridge text. It contributes literally nothing.
- On NATURAL it scores **0.412 against plain lexical matching's 0.665**. Passing text through
  O\*NET canonicalisation **destroys** signal that raw token overlap retains.

The mapper is token overlap against O\*NET statements with no stemming or embeddings, so it has
no mechanism when vocabulary differs. Keep O\*NET as external taxonomy, occupational metadata
and a debugging anchor. It should not gate what the system is able to perceive.

### Agent-first — supported, with stated limits

`agent-blueprint` is the **first architecture in this repository to exceed the degenerate
control on SEMANTIC_BRIDGE**. Every deterministic system sits between 0.29 and 0.44.

The comparison is a controlled ablation: the agent arm uses the **same scorer** as
`experience-lexical` and changes only the represented text, so the difference is attributable
to the representation rather than to a better matcher.

**The obvious validity threat was tested, not assumed.** The agent is told to normalise into
"plain general English", and the corpus's own neutral register is also plain English — so a win
could mean genuine understanding *or* both sides converging on a register the corpus author
happened to write. The `oracle-normalizer` control performs that normalisation perfectly by
construction:

- **agent 0.645 vs normalizer 0.808** — the agent is well below perfect normalisation, so it is
  not merely reaching the authored register. There is real interpretation loss.
- **normalizer 0.808, not 1.000** — even flawless normalisation loses ~0.19 under token
  matching. The **matcher** was the binding constraint.

### The cheapest available gain was in the matching layer

Acting on that diagnosis, `agent-field-match` compares structured work **field by field**
instead of as a bag of tokens. Identical interpretations, zero additional model calls:

- experience **0.645 → 0.748**, Δ=+0.104, CI [0.015, 0.186] — significant
- now at **93% of the oracle-normalizer ceiling**, up from 80%

This matters for the recommendation: more inference was not the lever. Better use of the
inference already paid for was.

### Failure analysis

Agent false positives in the top 5 are dominated by **HARD_NEAR_MISS (12 of 23)** — work
differing from the person's own in exactly one identity role. Misses are concentrated in
`MIXED_PREFERENCE` (6) and `STRONG_EXPERIENCE_AND_PREFERENCE` (4). Fine-grained discrimination,
not gross matching, is the remaining weakness.

---

## 4. Person understanding

Computed from cache at zero additional cost (`pnpm analyze:blueprints`), SEMANTIC_BRIDGE, 12 people:

| measure | result |
| --- | --- |
| channel volume vs planted | experience 6.0/6.0, liked 7.0/7.0, disliked 2.0/2.0, desired 4.0/4.0 — **exact** |
| role recovery *(LOWER BOUND)* | domain 97.2%, purpose 94.4%, object 91.7%, method 84.7%, action 41.7% |
| invention | **0** of 72 interpreted works match no planted work |
| disliked leaking into liked | **0** across 12 people |

A 3-of-5 role threshold first reported 9 channel leaks. **All were false positives of that
detector** — plausibility constraints make unrelated frames share domain and purpose routinely.
At 5/5 the count is zero, and manual inspection confirms correct separation.

Qualitative evidence the bridging is genuine — the person text said *"the books"*, *"our running
totals"*, *"on the wards"*; the interpretation returned *"reconcile financial records in retail"*
and *"analyze causes of near misses in healthcare"*, both in the correct channel. Nothing
lexical connects those.

Role recovery is a **lower bound, not an accuracy figure**: it matches by word overlap against
each concept's own lexicon, so it cannot credit a correct interpretation that uses a word the
lexicon does not contain. The low action figure is at least partly this.

---

## 5. Cost

| phase | unit cost | latency (p50) |
| --- | --- | --- |
| person blueprint (onboarding) | **$0.0358** | 11.4 s |
| job blueprint (corpus, amortised over all users) | **$0.0091** | 4.7 s |

Interpretation is per person and per job, **never per pair** — a person-by-job loop is the
architecture the boundary exists to prevent. Every call is cached by content hash, so a job
appearing in two people's pools is paid for once.

Implication for the product: onboarding a user costs about **4 cents**. Ongoing recommendation
refresh costs **nothing in model calls** — matching runs against the stored blueprint. The job
corpus is a one-time-per-job cost amortised across every user who ever sees it.

---

## 6. What this run does NOT establish

1. **No true embedding baseline.** No embedding provider is available in this environment, so
   **agent vs dense retrieval is not answered**. `char-ngram-lexical` is a stronger lexical
   competitor and is explicitly not a semantic retriever.
2. **One prompt, one model, one effort setting.** "Agent-first wins" currently means "this
   prompt, on this model, at low effort, wins".
3. **n=12 for the agent arm** against n=48 for the deterministic re-baseline.
4. **Frame identity is a discrete 5-tuple.** Real relevance is continuous; NDCG here measures
   recovery of a discrete planted key.
5. **Zero human validity.** Everything is planted-truth recovery on synthetic people. Nothing
   here shows that real users feel understood or that these recommendations are good.
6. **Traceability for the frame pipeline is not built.** The existing traceability machinery
   covers the old atom pipeline.
