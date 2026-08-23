# Recommendation policy without an Overall score

## The design that was rejected

```
0.4 * Experience + 0.3 * Preference + 0.2 * Direction + 0.1 * Qualification
```

Those weights would be invented and unfalsifiable, and they would let a gain in one channel hide
damage in another. Worse, they destroy the cases the product exists for: the burned-out expert
and the career changer both look mediocre under any fixed blend.

`scoreV3` returns exactly four keys. A test asserts no mode result contains a key matching
`/overall|combined|composite|totalScore/i`, and another asserts no mode's selection rule contains
a numeric channel weight.

## Four explicit modes

Each mode is a product question with a weight-free selection rule. All four return every channel
score unchanged, so nothing is hidden.

### Mode A — transferable background discovery

**Question.** Which jobs contain work this person has actually performed, regardless of title?

**Rule.** Order by Experience Fit descending. Preference, Direction, and Qualification are
returned unchanged and never affect the order.

**Graded against.** Experience.

**Guardrails.** `CROSS_TITLE_TRANSFER_RECALL@K` must not fall. `SAME_TITLE_DIFFERENT_WORK`
precision@K must not rise. Preference and Direction scores must be byte-identical to Mode C's.

**Failure example.** A `SAME_TITLE_DIFFERENT_WORK` job outranking a `CROSS_TITLE_TRANSFER` job
means title is leaking into Experience Fit.

### Mode B — background + interest discovery

**Question.** Which jobs are strong on BOTH transferable background and independent work
interest?

**Rule.** Pareto rank on (Experience, Preference): all non-dominated candidates first, then the
next front, and so on. Within a front, order by the **minimum** of the two channel scores
(maximin).

Maximin is weight-free: it prefers the candidate whose weaker channel is strongest, and it
cannot trade one channel away for the other the way a weighted sum can. It is a declared policy
choice, not a validated one.

**Graded against.** Experience and Preference, both reported.

**Guardrails.** SCORE-SPACE dominance violations must stay at 0 (an implementation check that
Pareto ordering is internally consistent). LABEL-SPACE dominance violation rate is a separate
quality metric and must not rise. `JOINT_RELEVANT_RECALL@K` may never be reported without both
single-channel NDCGs.

**The two dominance notions must not be conflated.** Pareto ordering makes score-space violations
structurally impossible. Label-space violations remain possible and are a genuine quality signal:
they occur when the channel scores misrank relative to planted truth.

### Mode C — career transition discovery

**Question.** Which jobs move this person toward work they want to do next and would enjoy, even
without prior experience?

**Rule.** Pareto rank on (Direction, Preference), maximin within a front. Experience is returned
unchanged and **never demotes** a candidate: lacking experience is the point of a transition.

**Graded against.** Direction and Preference.

**Guardrails.** `TRANSITION_RECALL@K` must not fall. Experience scores must be byte-identical to
Mode A's. A test asserts a transition target's rank in Mode C is never worse than its rank in
Mode A — if the mode correlated with Experience it would be a resume-replication ranker under a
different name.

### Mode D — qualification-aware discovery

**Question.** Of the jobs that fit the work, which can this person plausibly be hired into today?

**Rule.** Take Mode B's order, then partition: candidates with no hard requirement gap first,
stretch candidates after, each partition keeping Mode B's internal order. Qualification
**annotates and partitions**; it never rewrites an Experience, Preference, or Direction score.

**Graded against.** Experience and Preference.

**Guardrails.** All other channel scores byte-identical to Mode B's. Stretch roles must be
**retained**, not dropped. The hard-gap partition must match the planted `hardGaps` label.

**Failure example.** Silently dropping every stretch role turns a discovery product into a filter
and hides opportunity.

## Per-job reasons

Every mode returns, for each job: its rank, its Pareto front, the tie-break value that placed it
there, its hard-gap partition, and why the job immediately above it outranked it. That is what
makes `docs/TRACEABILITY.md`'s `recommendation_policy` stage answerable.

## Constraints are separate from fit

Practical acceptability is not fit. A job may be an excellent task match and still be excluded
for violating a declared hard constraint, and constraint filtering must never rewrite the
underlying channel values.

No user constraint fields (location, remote mode, compensation, employment type, schedule,
travel, authorization, seniority) currently exist on the person or job model, so no constraints
are declared and none can be violated. That is vacuous rather than passing, and it is recorded as
row 19 of the coverage matrix and stated in every trace rather than papered over.

## Diversity is reported with relevance, never alone

`diversityOf` reports exact-duplicate rate, near-duplicate rate (planted core-work overlap above
half), title diversity, industry diversity, canonical-work diversity, and `relevantShare`.
Diversity is trivially improved by inserting irrelevant jobs, which is why `relevantShare` is
mandatory alongside every diversity number.
