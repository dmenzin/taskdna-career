# Planted-truth benchmark design

## The circularity that had to be avoided

The forbidden design is: run the current scorer, call its output ground truth, then evaluate the
current scorer against it. That measures agreement with itself and can never detect a systematic
error.

So relevance here is defined over **planted canonical work identity** and nothing else:

```
planted atom sets (truth, never shown to the algorithm)
  -> independently rendered surface language on the person side and the job side
  -> the real production pipeline tries to recover it
  -> metrics compare the produced ranking against the planted overlap
```

The grader (`src/bench/labels.ts`) imports nothing from the scoring or mapping pipeline, and a
test asserts that. The algorithm receives only rendered text; a leakage test asserts that no atom
id, planted label, archetype, or corpus metadata field appears anywhere in the pipeline input.

## Work atoms

An atom is one canonical O*NET 30.3 Task with its DWA ids, source occupation, task type, and
published importance. Only in-scope knowledge-work occupations contribute, and only tasks that
carry both a DWA and a published importance rating, so every atom has real canonical identity
and real importance metadata rather than invented weights. The pool is stratified and capped per
stratum so a few task-heavy occupations cannot dominate.

## Independent renderers

If both sides used the verbatim O*NET statement, every metric would collapse into string
equality. Person-side and job-side renderers therefore paraphrase the SAME atom along DIFFERENT
axes: different framing, different synonym offsets, different clause order, different surrounding
noise.

Measured mean person/job content-token overlap:

| difficulty | overlap | what it models |
| --- | --- | --- |
| `verbatim` | 1.000 | leakage control; the trivial upper bound |
| `standard` | 0.406 | full paraphrase |
| `hard` | 0.193 | compressed paraphrase, the way a resume bullet compresses a duty |

At `standard` and `hard` the two renderings of an atom are never identical strings, which is
asserted per statement rather than on average.

### The optimization target

The `standard` tier **saturates**: experience and direction NDCG sit at 1.000 with worst-case
1.000, so it can detect neither improvement nor regression. Every report therefore carries a
`headroom` block that flags a saturated channel explicitly instead of presenting it as success.

`OPTIMIZATION_TARGET_CONFIG` declares `hard` difficulty at 12 or more people as the only
configuration the loop may optimize against. It is stable there: experience 0.937, preference
0.618, direction 0.769 at both 12 and 16 people.

The ladder is still useful as a diagnostic — the verbatim-to-hard drop isolates how much of the
pipeline's performance depends on surface wording.

## Planted people

Every person is planted so that all required channel combinations occur:

| set | source | plants |
| --- | --- | --- |
| performed | 6 home-stratum atoms | experience |
| likedFromPerformed | 3 performed atoms | performed AND liked |
| disliked | 2 performed atoms, never liked | performed AND disliked |
| likedAndDesired | 2 far-stratum atoms | liked AND desired, never performed |
| likedOnly | 2 second-far-stratum atoms | liked ONLY |
| desiredOnly | 2 far-stratum atoms | desired ONLY |

Every desired atom is work the person has NOT performed, so Direction cannot be a function of
Experience. No atom is ever both liked and disliked.

## Job archetypes are the known answers

Titles and industries are assigned **orthogonally to atoms**, which is what makes the
counterfactuals constructible.

| archetype | planted relationship | why it exists |
| --- | --- | --- |
| `OBVIOUS_EXPERIENCE_MATCH` | performed work, own title and industry | conventional matching should also find it |
| `CROSS_TITLE_TRANSFER` | performed work under another stratum's title | task matching should find it; title matching should not |
| `CROSS_INDUSTRY_TRANSFER` | performed work in another industry | cross-industry transfer |
| `SAME_TITLE_DIFFERENT_WORK` | own title, unrelated work | the trap for title-based matching |
| `HARD_NEAR_MISS` | same occupation, work this person did NOT do | lexically similar, plantedly irrelevant; the source of headroom |
| `EXPERIENCE_WITH_DISLIKED_WORK` | disliked plus performed-not-liked | the burned-out expert |
| `MIXED_PREFERENCE` | liked AND disliked together | the case a mean-based score cancels |
| `TRANSITION_PREFERENCE_DIRECTION` | desired work, never performed | the career changer |
| `PREFERENCE_ONLY` | liked, never performed, not desired | preference without experience |
| `DIRECTION_ONLY` | desired, not liked, never performed | direction without preference |
| `INCIDENTAL_ONLY_MATCH` | one performed atom among unrelated core work | core-versus-incidental pathology |
| `QUALIFICATION_ONLY` | requirements met, work unrelated | qualification independence |
| `IRRELEVANT` | no relationship | distractors |

`MIXED_PREFERENCE` was split out from `EXPERIENCE_WITH_DISLIKED_WORK` after the benchmark showed
that a job containing equal liked and disliked work scores exactly the neutral 0.5 — making a
genuinely mixed job indistinguishable from one with no preference evidence at all. That is a real
product-relevant limitation of mean-based preference aggregation, recorded rather than hidden.

## Labels

Coverage is weighted planted overlap: core responsibilities at weight 1, incidental at
`INCIDENTAL_LABEL_WEIGHT = 0.25`. That is a declared label-design choice — matching a peripheral
duty is weaker evidence than matching a central one, but not zero — and it must never be adjusted
to move a metric.

Preference is **signed**: liked coverage minus disliked coverage, floored at 0, so a job full of
disliked work is not labelled preference-relevant because it also contains some liked work.

Graded relevance quantizes coverage to 0–3 at fixed thresholds so NDCG gains are stable.

Derived labels: `isJointRelevant` (both channels at grade 2+), `isTransitionRelevant`
(experience ≤ 1, direction ≥ 2, preference ≥ 1), `isSurprisingTransfer` (experience ≥ 2 AND
cross-title or cross-industry). Surprise requires relevance **by definition of the label**, not
by convention.

## Generalization

`DEVELOPMENT` uses the `plain` and `clausal` paraphrase families. `VALIDATION` uses
`nominalized` and `colloquial`, which DEVELOPMENT never sees. `pnpm bench:all` reports the gap.

Measured at hard difficulty, n=12:

| metric | DEVELOPMENT | VALIDATION | gap |
| --- | --- | --- | --- |
| extraction macro F1 | 0.831 | 0.611 | **+0.220** |
| experience NDCG@5 | 0.937 | 0.988 | −0.051 |
| preference NDCG@5 | 0.618 | 0.581 | +0.037 |
| direction NDCG@5 | 0.769 | 0.903 | −0.134 |
| person experience mapping Top-1 | 0.181 | 0.139 | +0.042 |

The extraction gap of +0.220 is the headline: the regex evidence lexicon is tuned to the
framings DEVELOPMENT contains and degrades substantially on unseen ones. That is exactly the
template-overfitting signal the withheld-family design was built to detect. Ranking gaps are
small or negative because ranking leans on job-side mapping, which is robust.

Not yet withheld: unseen occupations and unseen occupation families. Only paraphrase families
are, which makes this a coarse generalization test.

## Scope boundaries

Evidence-CLASS classification is held FIXED in the ranking benchmark (`src/bench/pipeline.ts`
supplies the planted kind), so ranking numbers measure canonical mapping recovery plus channel
scoring plus ranking. Class extraction has its own evaluator
(`src/bench/extraction.ts`).

Free-text qualification extraction and free-text job-responsibility segmentation do not exist and
are explicitly excluded from the loop (`config/metric-contracts.json` rows 4 and 8).

Live posting ingestion, freshness, and closed-job detection are out of scope for this algorithmic
loop, and are not a reason to skip candidate-generation evaluation, which is measured over a
controlled pool.
