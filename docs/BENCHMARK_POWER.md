# Benchmark power, validity, and what the product numbers actually support

Produced by the Claude agentic research run from control checkpoint `e55e56c`. Every number
here is reproducible with the commands named beside it. Nothing in this document changes a
label, a threshold, a scoring rule, or a generator parameter.

---

## 1. The declared optimization target is under-powered by roughly 16x

`OPTIMIZATION_TARGET_CONFIG` (`src/bench/run.ts`) declares `minimumPeople: 12` and justifies it:

> "12 is the declared minimum because the numbers stop moving there (experience 0.937,
> preference 0.618, direction 0.769 at both 12 and 16 people)."

**That check cannot detect sampling noise.** `buildBenchCorpus` (`src/bench/corpus.ts:234`)
derives person `i` from a hash of `seed`, `split` and `index`, which does not depend on
`peopleCount`. A 12-person corpus and a 16-person corpus at the same seed therefore share their
first 12 people; the comparison measures the 4 people that were added, not the stability of the
estimate. Two nested samples agreeing is arithmetic, not convergence.

`pnpm bench:power --seeds=40 --people=12 --difficulty=hard` replicates the published aggregate
across **40 independent seeds** (independent atom pools and independent people) and computes a
paired per-person bootstrap. Pairing matters: TaskDNA and each baseline rank the same person
over the same job pool, so the per-person difference removes person difficulty as a variance
source.

### How much the published n=12 aggregate moves across independent corpora

| channel | TaskDNA mean | per-seed sd | observed range at n=12 |
| --- | --- | --- | --- |
| experience | 0.9358 | 0.0304 | [0.872, 0.978] |
| preference | 0.6516 | 0.0749 | [0.473, 0.795] |
| direction | 0.7702 | 0.1155 | [0.468, 0.936] |

Direction NDCG at the declared target ranges from **0.468 to 0.936** depending only on which
corpus you happen to draw. The single published value of 0.769 is one sample from that range.

### Sample size actually required

Half-width of the 95% paired CI, from the observed per-person spread (480 persons):

| channel vs resume-lexical | per-person sd | half-width at n=12 | people needed for +-0.02 |
| --- | --- | --- | --- |
| experience | 0.1414 | **+-0.0800** | **192** |
| preference | 0.2617 | **+-0.1481** | **658** |
| direction | 0.3553 | **+-0.2011** | **1213** |

At n=12 the instrument cannot resolve anything smaller than about **8 NDCG points** on
experience. Any experiment that moved experience NDCG by less than that and was declared KEEP
or REVERT on the strength of the n=12 number was decided by noise.

---

## 2. The brief's headline claim was decided by noise, against the wrong baseline

The premise driving this research run was: *TaskDNA NDCG 0.937 versus naive resume-lexical
0.963 — TaskDNA does not clearly beat a dumb resume-lexical baseline on its central
experience-ranking claim.*

Paired bootstrap over **480 persons / 40 independent seeds**, hard difficulty, DEVELOPMENT:

| channel | TaskDNA | resume-lexical | paired difference | CI95 | verdict |
| --- | --- | --- | --- | --- | --- |
| experience | 0.9358 | 0.9200 | **+0.0158** | [+0.0030, +0.0285] | TaskDNA wins |
| preference | 0.6516 | 0.3000 | **+0.3516** | [+0.3288, +0.3757] | TaskDNA wins |
| direction | 0.7702 | 0.1234 | **+0.6467** | [+0.6154, +0.6787] | TaskDNA wins |

Against the baselines as they existed, TaskDNA wins every channel. On experience the margin is
real but small (+0.016), and **its sign flips from seed to seed** — which is exactly how a single
n=12 draw produced a number pointing the other way. The reported 0.026 deficit was about one
third of the instrument's resolution at that sample size.

The important correction is not "TaskDNA is better than reported". It is that **the benchmark
at its declared target could not have answered the question either way.**

### But the baseline it was compared against was the wrong one

`resume-lexical` scores the whole narrative, mixing experience with preference, aspiration,
title and skills text. On the experience channel that extra text is dilution. Restricting the
query to the person's experience statements alone (`resume-lexical-experience`, now a
first-class baseline in `src/bench/pipeline.ts`) produces the strongest simple reference — and
it beats the full four-channel pipeline. Paired bootstrap, 192 persons / 16 independent seeds,
hard, DEVELOPMENT:

| TaskDNA vs | paired difference | CI95 | sign flips | verdict |
| --- | --- | --- | --- | --- |
| title-only | +0.3738 | [+0.3415, +0.4047] | no | TaskDNA wins |
| resume-lexical | +0.0053 | [-0.0125, +0.0233] | **yes** | indistinguishable |
| **resume-lexical-experience** | **-0.0635** | **[-0.0775, -0.0503]** | no | **baseline wins** |
| occupation-stratum | +0.2758 | [+0.2614, +0.2890] | no | TaskDNA wins |

So the honest headline is worse than the brief's, and for a different reason. Against the
*correctly constructed* trivial baseline, TaskDNA loses experience ranking by **6.4 NDCG
points, significantly and consistently**. The original claim was directionally right by
accident: it used a weak baseline and a sample size that could not resolve the difference.

This does not overturn section 3 below. TaskDNA still beats every baseline, including this one,
on preference and direction by very large margins, because no whole-document lexical method can
separate "I did X" from "I want X" from "I dislike X".

---

## 3. Where TaskDNA's advantage actually comes from: channel separation, not O*NET

The experience margin is +0.016. The preference and direction margins are +0.35 and +0.65.

The conventional baselines score every channel from the same whole-narrative token bag, so they
cannot distinguish *"I did X"* from *"I want X"* from *"I do not enjoy X"*. TaskDNA separates
the four channels by construction and reads each from its own evidence stream. That separation,
not canonical O*NET identity, is what the large margins measure.

This is directly supported by the retrieval result below, where the O*NET path **loses**.

---

## 4. The person/job mapping asymmetry is a rendering artifact

Reported as person-side Experience mapping Top-1 approximately 0.181 versus job-side
approximately 0.850. `pnpm diag:mapping-asymmetry`:

| difficulty | person_experience | job_responsibility | job/person |
| --- | --- | --- | --- |
| verbatim | 1.000 | 0.979 | 0.98x |
| standard | 0.917 | 0.850 | 0.93x |
| hard | 0.181 | 0.850 | 4.71x |

At `standard`, where both sides receive equivalent paraphrase, **the person side is more
accurate than the job side.** Job-side accuracy is *identical* at standard and hard because
`renderJobResponsibility` (`src/bench/render.ts:154`) hardcodes its paraphrase to `standard`
and ignores the requested difficulty, by explicit design.

The collapse is caused entirely by the person-side-only `hard` transform (`paraphrase`,
`src/bench/render.ts:193`), which drops every qualifying clause and then deletes
`HARD_DROP_RATE` = 35% of remaining content words.

There is **no evidence of an algorithmic person/job asymmetry.** "Improve person-side mapping"
at the target tier is a statement about the renderer, not about the mapper.

`HARD_DROP_RATE` is an evaluation-design parameter. Per `AGENTS.md` it must not be tuned to
move a metric, and this run does not tune it. It is reported because it dominates every
`hard`-tier number the product claims rest on.

---

## 5. Validity ceiling: the corpus gives the answer away lexically

This is the most consequential finding, and it limits every other number in the repository.

Person evidence and job responsibilities for the same planted atom are both produced by
paraphrasing **the same source O\*NET statement**. `substituteSynonyms`
(`src/bench/render.ts:217`) only rewrites words present in a roughly 40-entry table of common
verbs (`analyze`, `evaluate`, `monitor`, `develop`, ...). **Every object noun passes through
verbatim on both sides** — so the rare, distinctive words that actually identify the work are
shared identically between the person text and the job text.

`pnpm diag:generator-lexical-leak` measures how well raw Jaccard token overlap alone separates
same-atom pairs from different-atom pairs:

| difficulty | same-atom mean overlap | different-atom mean | ratio | **ROC AUC** |
| --- | --- | --- | --- | --- |
| verbatim | 1.0000 | 0.0114 | 88x | 0.9998 |
| standard | 0.4216 | 0.0087 | 48x | 0.9998 |
| hard | 0.1851 | 0.0056 | 33x | **0.9814** |

Even at `hard` — after deleting every qualifying clause and 35% of the remaining content words
— **token overlap is a near-perfect atom-identity detector (AUC 0.981)**. The 10th percentile
of same-atom overlap still sits above the 90th percentile of different-atom overlap.

Two consequences:

1. **The benchmark cannot test the product thesis.** TaskDNA's thesis is that it matches on the
   underlying work rather than on wording. On this corpus, wording is a near-perfect proxy for
   the underlying work, so the thesis has no room to be demonstrated or refuted. Two
   independently written real documents — a resume bullet and a job posting for the same work —
   share no common source sentence and no guaranteed rare-word overlap.
2. **`hard` does not make the task semantically harder.** It makes it lexically noisier while
   preserving near-perfect separability. TaskDNA degrades under it because its per-statement
   threshold-and-abstain design is brittle, not because the identifying information was removed.

Corroboration: a trivial Jaccard over only the person's experience bullets
(`pnpm diag:baseline-ablation`) scores **1.0000** experience NDCG at standard and **0.9942** at
hard — beating TaskDNA at hard by -0.065 [-0.082, -0.050]. The repo's own `resume-lexical`
baseline scores lower (0.9243) only because it dilutes experience signal with preference,
aspiration, title and skills text.

**This means the strongest simple baseline was never in the benchmark.** Section 38 of the
research brief forbids weakening a baseline; here the existing one was accidentally weak.
`lexical-experienceOnly` should be added as a first-class reference.

---

## 6. In the retrieval path, O*NET hurts

`pnpm diag:soft-canonical`, candidate retrieval recall@5, DEVELOPMENT, 72 persons per tier:

| difficulty | canonical-work | canonical-soft-weighted | lexical-overlap | title-only |
| --- | --- | --- | --- | --- |
| standard | 0.396 | 0.433 | **0.525** | 0.151 |
| hard | 0.380 | 0.433 | **0.539** | 0.151 |

The mapper is `MAPPER_VERSION = "taskdna.mapper.lexical.v1"` and computes
`overlap(tokens(text), tokens(onet_statement))` with no stemming, no lemmatization, no synonym
expansion, and no embedding. **Canonical work identity is lexical similarity discretized into
an ontology id.** It therefore holds no information the raw text does not already hold, and the
discretization only loses some of it — which is exactly the ordering observed: the more of the
candidate distribution you retain, the closer you get back to raw lexical performance.

`canonical-soft-weighted` (experiment `soft-canonical-identity`, verdict **KEEP**) recovers part
of the loss by reading the retained candidate set instead of the single `selected` id, with
significant gains on the product-differentiating metrics:

| difficulty | recall@5 | cross-title | surprising transfer | novelty-conditioned relevance |
| --- | --- | --- | --- | --- |
| standard | +0.037* | +0.095* | +0.199* | +0.092* |
| hard | +0.053* | +0.055* | +0.159* | +0.081* |

It still loses to plain lexical retrieval by -0.106 [-0.133, -0.081] at hard.

**Verdict on O\*NET in the main path: it HURTS retrieval and is not the source of TaskDNA's
ranking advantage.** It remains useful as an external taxonomy, a debugging anchor, and
occupational metadata. It should not be the doorway every piece of person evidence must pass
through.

Caveat stated honestly: this verdict is measured on a corpus whose vocabulary is shared between
the two sides. An ontology's real value would be bridging *disjoint* vocabulary, which this
corpus never exercises. Testing that requires semantic resources (a thesaurus, embeddings, or a
model) that this repository does not have and that this run had no runtime access to. **The
O\*NET verdict is therefore firm for the corpus as built and untested for the case the ontology
is supposed to serve.**

---

## 7. What should change

1. **Raise the optimization target sample size.** 12 people cannot resolve any effect this
   product cares about. Use at least 192 people for experience and treat preference/direction
   comparisons under ~650 people as directional only. Cost is not the obstacle: the run behind
   this document measured 480 persons per channel in about 12 minutes.
2. **Report paired intervals, never bare aggregates.** `pnpm bench:power` does this. A KEEP or
   REVERT decision on a bare n=12 delta is not supported.
3. **`resume-lexical-experience` is now a first-class baseline** (done in this run). It is the
   strongest simple reference and beats TaskDNA on experience at `hard` by -0.064
   [-0.078, -0.050]. Experience ranking should be treated as a **known open loss**, not a win.
4. **Fix the generator's vocabulary leak before trusting any matching result.** Person-side and
   job-side renderings of one atom must not share their distinctive nouns verbatim. This is a
   metric-contract change requiring the same review as changing a metric, and it will make the
   numbers worse, which is the point.
5. **Move canonical identity out of candidate retrieval** and keep four-channel separation,
   which is where the measured advantage actually is. If canonical retrieval is retained, adopt
   `canonical-soft-weighted`.

---

## Reproduction

```bash
pnpm bench:power --seeds=40 --people=12 --difficulty=hard
pnpm diag:mapping-asymmetry --people=12
pnpm diag:generator-lexical-leak --seeds=4 --people=12
pnpm diag:baseline-ablation --seeds=12 --people=12
pnpm diag:soft-canonical --seeds=6 --people=12
```
