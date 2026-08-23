# Three evaluation tiers

The autonomous loop must perform many *meaningful* experiments, so the cost of learning
whether a change worked has to be seconds, not minutes. No experiment should require a Next.js
build.

## FAST — after every code edit

```
pnpm eval:fast                      # infer subsystems from `git diff --name-only HEAD`
pnpm eval:fast -- preference        # one named subsystem
pnpm eval:fast -- mapper channels   # several
pnpm eval:fast -- --list            # show the subsystem map
```

Runs only what is directly relevant: the subsystem's tests, its DEVELOPMENT evaluator, its
anti-Goodhart checks, and its known-answer fixtures. No full test suite, no build, no
VALIDATION.

Measured on this VM:

| subsystem | steps | runtime |
| --- | --- | --- |
| `generator` | semantics tests, semantic-polarity + monotonicity gate, positional-bias gate | 2.3 s |
| `preference` | availability + observability tests, DEVELOPMENT metrics, metric red team | 5.8 s |
| `mapper` | known answers, cache identity + hybrid contract | 2.5 s |
| `channels` | four-channel isolation, coefficient governance | 1.1 s |
| `network` | network engine + logic tests | 0.8 s |
| `hireability` | hireability tests | 0.7 s |

Worst case under 6 seconds. `pnpm eval:fast` with no arguments maps changed files to
subsystems, so the common case is a single command with no thinking required.

## CHECKPOINT — every 45 to 90 minutes, or after a subsystem milestone

```
pnpm eval:checkpoint
```

Broader than FAST, cheaper than FULL: whole unit suite, typecheck, both generator validity
gates, the DEVELOPMENT dashboard, a byte-identical reproducibility re-run, the VALIDATION
dashboard (confirmation only), channel isolation, mapper/scorer regression, the metric red
team, and a check that `LOCKED_CONFIRMATION` is still guarded. Writes
`artifacts/iteration_readiness/checkpoint_latest.json`.

Measured: **13.6 s** for all 11 steps.

| step | runtime |
| --- | --- |
| unit tests | 4.4 s |
| typecheck | 1.6 s |
| generator semantic polarity + monotonicity | 0.6 s |
| generator positional bias | 0.6 s |
| DEVELOPMENT preference dashboard | 0.8 s |
| DEVELOPMENT metrics reproducible | 0.8 s |
| VALIDATION preference dashboard | 0.7 s |
| four-channel isolation | 1.1 s |
| mapper/scorer regression | 1.4 s |
| preference metric red team | 1.0 s |
| LOCKED_CONFIRMATION stays guarded | 0.5 s |

No Next.js build in this tier.

## FULL — beginning, end, and major architecture changes only

```
pnpm eval:iteration-readiness
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Measured:

| command | runtime |
| --- | --- |
| `pnpm test` | 4.4 s |
| `pnpm typecheck` | 1.4 s |
| `pnpm lint` | 3.4 s |
| `pnpm build` | 6.6 s |
| `pnpm eval:iteration-readiness` | 24 s (runs the four above plus all 30 readiness gates) |

Readiness re-runs test/typecheck/lint/build internally and adds all 30 gates, so the FULL tier
is about **24 s** in total — that one command covers everything. It passes 30/30.

`pnpm eval:iteration-readiness` never runs `LOCKED_CONFIRMATION`; it asserts the guard holds.

## What made this affordable

The binding constraint was not the test suite, it was the mapper. `mapWork` re-tokenized all
12,579 O*NET task statements on every call, at 214 ms per call — a 150-subject by 20-job
mapping sweep would have been over two hours of pure tokenization, so the Task/DWA workstream
was effectively unrunnable inside an 8-hour budget.

Token sets are a pure deterministic function of (corpus content, tokenizer version), so
hoisting them out of the call is memoization rather than approximation. Combined with
memoizing results by the existing `cacheKey`:

| | before | after | factor |
| --- | --- | --- | --- |
| `mapWork` cold (distinct text) | 214 ms | 3.9 ms | 55x |
| `mapWork` warm (repeat text) | 214 ms | 6 us | ~35,000x |

Results are bit-identical: `tests/hybrid-readiness.test.ts` asserts a cache hit returns the
same object and the same serialization, and every `tests/v3/bridge.test.ts` known answer is
unchanged.

## Related

- `scripts/eval-fast.ts`, `scripts/eval-checkpoint.ts`
- `docs/CACHE_AUDIT.md` — what is cached and how it invalidates
