# Duplicate evidence and observable-source semantics

## Observable source semantics

A person's preference evidence reaches the inference system through exactly four sources, and
they are deliberately distinct:

| source | what it is | how stance is determined |
| --- | --- | --- |
| `resumeText` | the career narrative | from the sentence's own construction |
| `explicitPreferences` | a stated like list | list membership implies LIKE |
| `explicitDislikes` | a stated dislike list | list membership implies DISLIKE |
| `contradictoryStatements` | self-reported contradictions | from the statement's construction |

These are the fields in `INFERENCE_VISIBLE_PREFERENCE_FIELDS`
(`src/lab/evidenceAvailability.ts`), and `tests/evidence-observability.test.ts` asserts they
match exactly what `observationsToProfile` passes to the engine. If the evaluation path starts
or stops passing a field, that test fails rather than the availability denominator silently
drifting away from what inference actually sees.

## The defect

Two separate mechanisms caused one underlying statement to be counted twice.

**Generator-side.** The generator emitted the same phrase into `resumeText`
("I enjoy `<phrase>`") *and* into `explicitPreferences`, and reused `dislikedTasks[0]` across
the avoid sentence, the struggle sentence, the resume contradiction clause, and
`contradictoryStatements`.

**Plumbing-side.** `observationsToProfile` concatenated `explicitPreferences`,
`explicitDislikes`, and `contradictoryStatements` into `careerText` *and* passed the first two
separately:

```ts
// src/lab/evaluate.ts (pre-fix)
const text = [resumeText, ...explicitPreferences, ...explicitDislikes, ...contradictoryStatements].join(" ");
buildProfileFromCareerInput({ careerText: text, explicitPreferences, explicitDislikes, ... });
```

Each list entry therefore became both a career-text sentence and an explicit evidence item.
That inflates `inferTaskDna`'s dependence-aware effective-signal count, which drives both the
evidence weight and the confidence — so duplicated evidence bought both a stronger prediction
and higher confidence in it.

## The fix

Two independent defences, so neither is a single point of failure.

**Generator.** `planPreferenceStatements` assigns every statement to exactly ONE observable
source via an ordered slot list. The struggle, burnout, aspiration, and contradiction
constructions each consume their own statement rather than restating another one.

**Extractor.** `extractEvidence` suppresses exact-normalized repeats across sources: a
statement already seen in the career narrative is not admitted again from an explicit list.
Normalization lowercases and collapses non-alphanumerics, so punctuation and casing differences
do not defeat it.

Measured on DEVELOPMENT after the fix: 0 of 150 subjects have a within-field duplicate, and 0
of 150 have a cross-source duplicate. Both are reported every run as
`duplicatedEvidenceWithinField` and `duplicatedEvidenceAcrossSources`, and both fire correctly
when a duplicate is deliberately introduced (`tests/preference-metric-red-team.test.ts`).

## Unresolved: paraphrase and common-source duplication

Exact-normalized deduplication does **not** solve the general problem, and this section exists
so that limit is not mistaken for a solution.

**Paraphrase duplication.** "I enjoy root-cause investigation" and "I enjoy digging into why
something failed" are the same underlying preference in different words. Both are legitimate
distinct sentences under exact matching, so both count. The current corpus draws one phrase per
statement from a catalog whose entries are near-synonyms within a dimension/side, so a
paraphrase pair is possible in principle. Detecting it requires semantic equivalence, which is
exactly the `EMBEDDING_RETRIEVAL` / `CROSS_ENCODER_RERANK` capability that does not exist yet.

**Common-source duplication.** Many bullets from one resume or one role are one observation
stream, not independent samples. This is *partially* handled: `sourceGroup`
(`sourceGroupFor` in `src/domain/evidence.ts`) gives distinct sources full weight and extra
sentences inside one group diminishing partial credit, and `experienceFit` deduplicates by
`(sourceGroup, mapping identity)`. But the grouping is coarse — the whole career narrative is
one group — so it cannot distinguish "three genuinely different things I did in this role" from
"the same thing said three ways".

**Consequence for the metric.** Neither residual can shrink the primary metric's denominator:
availability is a per-dimension boolean, not a count. Both can inflate the *effective signal
count* inside `inferTaskDna`, which raises confidence and evidence weight. That is a live
research question in workstream 2 (preference representation and extraction), not a solved
problem.

**Recommended next step.** Measure how often paraphrase pairs actually occur in the corpus
before building semantic deduplication. If the generator's one-statement-per-dimension
assignment makes them rare, the exact-normalized guard plus `sourceGroup` may be sufficient in
practice, and the effort belongs elsewhere.

## Related

- `src/lab/evidenceAvailability.ts` — `crossSourceDuplicatePlacements`, `withinFieldDuplicateUnits`
- `src/domain/engine.ts` — `extractEvidence`, `normalizeStatement`
- `src/domain/evidence.ts` — `sourceGroupFor`
