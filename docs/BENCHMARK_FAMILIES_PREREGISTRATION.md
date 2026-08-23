# Benchmark family preregistration — frame corpus v1

Preregistered 2026-08-23, **before** any candidate architecture was scored on this corpus, as
required by `docs/RESEARCH_CONTRACT_AMENDMENTS.md` § C.

Nothing in this document may be changed to favour a candidate architecture. Difficulty is set
once, here. A genuine defect may still be repaired through the scientific incident process,
which requires rerunning every baseline and invalidating results that are no longer comparable.

**Corpus version**: `frame-corpus.v1`
**Truth model**: `semantic-frame.v2` (concept-id frames; see `src/bench/semanticFrame.ts`)

---

## 0. What is being fixed

The previous corpus rendered person text and job text as two paraphrases of **one shared
O\*NET sentence**. Distinctive object nouns survived on both sides, so raw token overlap
identified same-work pairs at **ROC AUC 0.9814**. Wording nearly revealed the answer, and no
result about semantic transfer measured on that corpus is trustworthy.

The repaired truth model represents work as a frame of **concept ids** — never a sentence —
and realizes each side through its own vocabulary.

## 1. The unit of truth

A `WorkFrame` is seven concept ids:

| role | in identity? | rationale |
| --- | --- | --- |
| `action` | **yes** | what was done |
| `object` | **yes** | what it was done to |
| `purpose` | **yes** | why — two identical-looking activities with different purposes are different work |
| `method` | **yes** | how |
| `domain` | **yes** | the setting that gives the work meaning |
| `instrument` | no | incidental colour; excluded so a system cannot score by matching tooling |
| `output` | no | incidental colour |

`frameIdentity()` is the tuple of the five identity roles. Two frames are **the same work**
iff their identities are equal. This is the only definition of same-work in the benchmark, and
it imports nothing from the scoring or mapping pipeline.

Graded relevance does **not** come from partial frame identity. It comes from **coverage** —
what share of a job's core and incidental frames the person holds — exactly as
`src/bench/labels.ts` already defines it. Frame identity stays binary per frame; the grading
axis is how much of the job's work the person has.

## 2. The four families

Each family is a **rendering regime** over the same truth model. The hidden truth is
constructed identically in all four; only the surface realization differs. This is what makes
cross-family comparison meaningful: a score difference between families is a difference in
**language**, never a difference in what was planted.

Every family is reported **separately**. They are never averaged.

### A. `NATURAL`

Person and job are independently rendered from a shared neutral professional register.
Ordinary lexical overlap is permitted and expected — no disjointness is engineered.

- **Approximates**: ordinary resumes and job descriptions.
- **Expected lexical leak**: substantially above chance. **This family is NOT required to sit
  at AUC 0.50.** Natural documents legitimately share words; forcing 0.50 here would recreate
  the artificial extreme this repair exists to escape.
- **Acceptance**: no *shared source string* between the two sides. Each side samples its own
  surface form independently. Failing this means the old defect has returned.

### B. `SEMANTIC_BRIDGE`

Same underlying work; person and job vocabularies are deliberately disjoint.

- **Tests**: true semantic transfer. Purely lexical methods have no mechanism here.
- **Acceptance**: zero content-token intersection between the paired lexicons and no
  long-common-prefix stem correlation, both machine-verified; lexical-overlap ROC AUC within
  **[0.45, 0.55]**.
- A high score by a lexical method on this family is evidence of a **leak**, not of quality.

### C. `LEXICAL_TRAP`

Surface wording is deliberately similar; the underlying work differs materially.

Construction: concepts are authored in **trap pairs**. Two concepts in the same role share a
near-identical surface form but are distinct ids, differing in a way that changes the work —
purpose, object, domain, method, or consequence. A job built on concept A and a person built
on its trap partner B therefore read alike and have **different frame identity**, so the label
is 0.

- **Tests**: whether a system mistakes words for meaning.
- **Acceptance**: mean surface overlap between trap-partner pairs must **exceed** mean overlap
  between genuinely same-identity pairs. If a trap does not actually look similar, it is not a
  trap. A purely lexical method is *expected* to score near-zero or worse-than-chance here;
  that is the family working as designed.
- **Honesty constraint**: every trap distinction must be a distinction a competent human
  reviewer would agree changes the work. Traps that hinge on an arbitrary label difference
  would make this family a word game rather than a measurement.

### D. `TITLE_INDUSTRY_COUNTERFACTUAL`

Titles and industries are assigned **orthogonally** to frames, so all four cells exist:

| | same work | different work |
| --- | --- | --- |
| **same title** | conventional match | `SAME_TITLE_DIFFERENT_WORK` |
| **different title** | `CROSS_TITLE_TRANSFER` | irrelevant |

Same for industry. Plus title-removed and title-swapped variants.

- **Tests**: whether a system matches on the work or on the label attached to it.
- **Acceptance**: title and industry must carry **no** information about frame identity —
  measured as mutual information between title/industry and identity, required to be
  indistinguishable from zero. A title-only baseline must therefore score at chance.

## 3. Split and vocabulary withholding

| split | vocabulary families | use |
| --- | --- | --- |
| `DEVELOPMENT` | `core` | ordinary iteration |
| `VALIDATION` | `held-out` + `core` structure | confirm a preregistered DEVELOPMENT result |
| `LOCKED_CONFIRMATION` | all | **not executed during this run** |

VALIDATION draws surface vocabulary from a `held-out` family that DEVELOPMENT never sees, so a
system tuned to development phrasing shows a **measurable** generalization gap rather than a
silent one.

> **Defect being repaired as part of this preregistration.** In `semantic-frame.v1` the
> held-out family was unusable: `instrument` and `output` had **zero** held-out concepts, so
> `sampleFrame(rng, ["held-out"])` threw, and the remaining roles had one concept each — two
> distinct identities in total. The withholding mechanism the contract requires had therefore
> never been runnable. v2 populates every role in both families with enough concepts to build
> a real VALIDATION corpus.

## 4. Acceptance gates (all must pass before any architecture is scored)

1. Hidden truth exists **before** rendering — frames are constructed and recorded, then text is
   generated from them.
2. Person and job renderers share **no** source string in any family.
3. No target leakage: nothing downstream of planting reads a concept id.
4. No tested-model-created gold: labels import nothing from the scoring pipeline.
5. Per-family lexical-leak diagnostics, reported separately, meeting the per-family
   expectations in § 2 — **not** a single global threshold.
6. **A title-only and an industry-only baseline must score at chance** (ROC AUC 0.5 ± 0.05
   against planted experience relevance), measured at the declared corpus size.

   > This gate was reformulated during construction, before any architecture was scored.
   > The original wording — "mutual information between title and identity indistinguishable
   > from zero" — turned out to be the wrong instrument twice over. Plug-in MI is badly biased
   > upward when identities are near-unique (it returned 4.31 bits against a true value of
   > zero), and even with a permutation null correcting that bias, MI against *identity* picks
   > up person-level clustering that has nothing to do with titles predicting relevance. The
   > replacement states the claim the family actually makes and is directly falsifiable. The
   > permutation-MI test is retained as a secondary diagnostic.
7. Deterministic reproducibility: same seed and split ⇒ byte-identical corpus.
8. DEVELOPMENT / VALIDATION disjoint in both vocabulary and frames.
9. `LOCKED_CONFIRMATION` remains unexecuted.
10. Sufficient statistical power to resolve the differences that will be claimed, established
    by paired bootstrap — checked **before** claiming any difference, not after.

## 5. What this corpus still cannot establish

It measures recovery of **planted** truth. It cannot establish that real humans feel
understood, that real users like the recommendations, real job satisfaction, hiring outcomes,
or genuine career-transfer validity. Those require independent human truth and sit outside
every result produced here.


---

## 6. Construction decisions recorded at preregistration time

These were settled **before** any candidate architecture was scored, and are listed so the
corpus design is auditable rather than merely asserted. Each was made because a measurement
showed the first construction was inadequate, not to move any architecture's score.

| decision | why | evidence |
| --- | --- | --- |
| Frames are sampled with an **object-conditioned plausibility** constraint rather than uniformly per role | Independent sampling produced coherent identities attached to nonsense prose (*"I drew up bugs users kept hitting on town hall business"*). Token-overlap baselines are indifferent to nonsense; a language model is not. Scoring the agent-first hypothesis on incoherent text would handicap exactly the thing under test and we would mistake the artifact for a result. | `verifyPlausibilityCoverage` |
| Added `PARTIAL_EXPERIENCE_MATCH` and `WEAK_EXPERIENCE_MATCH` | The first build produced grades 0 and 3 only — relevance was effectively binary and NDCG could not separate a good ranking from an adequate one. | grade histogram was `192 / 0 / 0 / 72`, now `767 / 48 / 49 / 288` |
| Added `STRONG_EXPERIENCE_AND_PREFERENCE` | The joint experience+preference relevant set was **empty**, so every joint metric would have silently reported on nothing. | 0 jointly relevant pairs → 98 |
| Title and industry assigned by **balanced coin flip**, with the two definitional counterfactuals explicitly paired off | Assigning the person's own title to relevant archetypes and a foreign title to distractors makes the title a relevance oracle. First build: permutation z = 5.1 (title), 18.4 (industry). After balancing only the distractors, a title-only baseline sat at AUC 0.449 — an *inverted* oracle, still exploitable by anything that learns to flip the sign. | title-only AUC 0.449 → 0.511; industry 0.461 → 0.498 |
| Acceptance evaluated at **48 people**, not 12 | At 12 people the industry gate swings ±0.06 on noise alone. Claiming a chance-level result from an underpowered sample is the specific error that invalidated the previous benchmark. | gate flips PASS/FAIL between n=12 and n=48 |

## 7. Accepted state

All 17 gates pass (`pnpm bench:frame-acceptance`). Measured leak per family:

| family | lexical ROC AUC | verdict |
| --- | --- | --- |
| `NATURAL` | 0.8771 | above chance, as required — words legitimately help |
| `SEMANTIC_BRIDGE` | 0.4933 | at chance — wording gives nothing away |
| `LEXICAL_TRAP` | 0.8809 | trap pairs overlap **more** than genuine matches (margin +0.030) |

For comparison, the corpus this replaces sat at **0.9814** with no family distinction at all.
