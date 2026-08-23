# Preference generator semantics

## The defect

Before this preflight, the synthetic generator built its dislike channel like this:

```ts
// src/lab/onetLab.ts (pre-fix)
const dislikedTasks = preferencePhrases(truth.taskDnaTruth, false, rng);
// eligible = dimensions whose truth <= 4, phrase = PREFERENCE_PHRASES[id][1] (LOW-side)
// ...
`I avoid ${dislikedTasks.slice(0, 2).join(" and ")}.`
explicitDislikes: dislikedTasks.slice(0, 2)
```

For `coordination_preference` with hidden truth 1.8, that produced **"I avoid solo deep
work"**. But "solo deep work" is the LOW-side behaviour, so avoiding it means the person
*wants* coordination — the HIGH side. The extractor correctly inverts a dislike
(`src/domain/evidence.ts`), so a LOW truth produced a HIGH prediction.

Measured on the DEVELOPMENT split before the fix, over 261 such placements:

| quantity | value |
| --- | --- |
| mean hidden truth | 2.68 |
| mean prediction | 5.64 |
| predictions on the wrong side | 53.6% |
| directional accuracy (available eligible) | 0.147 |

Directional accuracy below chance is the signature: the language was backwards, not the
decoder.

## The rule

A preference statement has three independent parts:

- **dimension** — which TaskDNA dimension it is about
- **behaviour side** — which pole of that dimension the phrase describes (HIGH or LOW)
- **stance** — whether the person LIKES or DISLIKES that behaviour

The direction the statement *means* is a function of the last two
(`intendedDirection` in `src/lab/preferenceSemantics.ts`):

| behaviour side | stance | means |
| --- | --- | --- |
| HIGH | LIKE | HIGH |
| LOW | DISLIKE | HIGH |
| LOW | LIKE | LOW |
| HIGH | DISLIKE | LOW |

So a HIGH hidden truth may be expressed as "I enjoy `<high-side>`" **or** "I avoid
`<low-side>`", and a LOW hidden truth as "I enjoy `<low-side>`" **or** "I avoid
`<high-side>`". The generator draws seeded-randomly between the two valid forms, so all four
combinations appear in the corpus (asserted by `tests/generator-semantics.test.ts`).

The two backwards pairings — `LOW truth -> DISLIKE low-side` and
`HIGH truth -> DISLIKE high-side` — are only produced when
`adversarialPolarityInversion` is explicitly set. That flag exists solely so the audit has a
known-bad corpus to fail on (`observeWithInvertedPolarity`), and is never enabled for a
graded corpus.

## How this is enforced

`pnpm eval:generator-monotonicity` runs two independent checks and exits nonzero on either.

**Semantic polarity** (hard gate). For every placement the availability reader recovers from
the generated text, compare the direction the LANGUAGE means against the side of the hidden
truth. One backwards statement fails. Neutral-truth dimensions are skipped: a phrase can
appear incidentally in narrative text for a dimension whose truth sits between the
expressibility thresholds, and there is no defensible expected direction there.

**Distributional monotonicity.** Across subjects, the net exposed direction must increase with
hidden truth. This catches drift that per-statement checks would miss.

Crucially, meaning is recovered by **reading the rendered text**, not by trusting
`preferenceStatementPlan`. Generator metadata records what the generator *intended*; the audit
independently reads what it *said*. A generator that emits malformed language while asserting
correct metadata still fails.

Verified on the deliberately inverted corpus: 17 of 17 dimensions fail semantic polarity, and
both eligible dimensions' monotonicity correlations flip from +0.65/+0.63 to −0.73/−0.64.

## The old audit, and why it was insufficient

The previous audit correlated hidden truth against **phrase location**: "a low-side phrase
appears in `explicitDislikes`" counted as evidence pointing toward LOW truth. That is not what
such a sentence means, so a perfectly backwards generator passed. The audit now assesses the
semantic direction created by `behaviour side x stance`, which is why the same corpus that
previously passed now fails.

## Related

- `src/lab/preferenceSemantics.ts` — the rule, the stance reader, the seeded shuffle
- `src/lab/preferencePhrases.ts` — phrase catalogs and the statement planner
- `src/lab/generatorMonotonicity.ts` — both audits
- `docs/GENERATOR_SELECTION_BIAS.md` — positional sampling bias
- `docs/DUPLICATE_EVIDENCE.md` — source semantics and duplication scope
