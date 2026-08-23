# Generator selection bias

## The defect

Phrase selection truncated an order-preserving filter:

```ts
// src/lab/onetLab.ts (pre-fix)
const eligible = DIMENSION_IDS.filter((id) => (high ? values[id] >= 6.5 : values[id] <= 4));
return phrases.slice(0, 3);
```

`Array.prototype.filter` preserves order, so `slice(0, 3)` always kept the dimensions nearest
the front of `DIMENSION_IDS`. A dimension's exposure depended on its literal position in a
config array — an artifact of code layout, not of the construct or the hidden truth.

The effect is severe rather than marginal. When every dimension is equally expressible, the
pre-fix procedure selects positions 0, 1, 2 with probability 1 and positions 3–16 with
probability 0. `tests/generator-semantics.test.ts` asserts this directly, so the contrast is a
live regression rather than a claim in prose.

## The fix

`planPreferenceStatements` (`src/lab/preferencePhrases.ts`) applies a deterministic seeded
Fisher-Yates shuffle to **all** expressible dimensions *before* truncating. Selection order is
then independent of array position while remaining fully reproducible from the seed.

## How this is measured

`pnpm eval:generator-bias` reports two things.

### Sampler uniformity (the mechanism gate)

Every dimension is made equally expressible (truth 8.5 everywhere), so the only thing that can
make selection rates differ is the sampling procedure itself. Over 20,000 trials:

| statistic | value | gate |
| --- | --- | --- |
| chi-square vs uniform | 12.39 | < 39.252 (16 df, alpha = 0.001) |
| position vs selection rate (Spearman) | 0.105 | abs value <= 0.35 |
| min selection rate | 0.3463 | — |
| max selection rate | 0.3585 | — |
| first-half mean rate | 0.3529 | — |
| second-half mean rate | 0.3526 | — |

The first and second halves of `DIMENSION_IDS` are selected at rates that agree to three
decimal places.

### Corpus selection opportunity and realized rate (descriptive)

Over the full 450-subject corpus, per dimension: how often the hidden truth made it
expressible (**opportunity**), how often directional language for it actually reached
observable text (**realized**), and the ratio (**selection rate given opportunity**).

| statistic | value | gate |
| --- | --- | --- |
| selection-rate spread across 17 dimensions | 0.095 | <= 0.2 |
| first-half mean selection rate | 0.457 | — |
| second-half mean selection rate | 0.434 | — |
| half-mean gap | 0.024 | <= 0.12 |
| position vs selection rate (Spearman) | −0.434 | reported, not gated |

### Why the corpus rank correlation is reported but not gated

With only 17 dimensions the Spearman standard error under the null is about
`1/sqrt(16) = 0.25`, and the two-tailed 5% critical value is roughly 0.48. A value of −0.434
is inside ordinary sampling noise. It is also rank-based, so it is sensitive to differences too
small to matter: the entire spread it is ranking is 0.095, and the first/second-half means
differ by 0.024.

Gating on that number would either be vacuous (a loose bound) or flap on noise (a tight one).
The corpus gate is therefore set on the magnitude quantities — spread and half-mean gap — while
the *mechanism* is gated by the sampler-uniformity test above, where the confound (per-dimension
differences in how often the truth happens to be expressible) is removed by construction and
20,000 trials make the estimate precise.

All tolerances are declared sampling tolerances, not tuned scores.

## Related

- `src/lab/generatorBias.ts` — both diagnostics
- `src/lab/preferenceSemantics.ts` — `seededShuffle`, `expressibleDimensions`
