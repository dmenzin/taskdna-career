# Cache and recomputation audit

The rule: cache only where the cached value is a pure deterministic function of inputs that are
*all* in the key. Never trade a stale scientific result for speed.

## Major runtime bottlenecks found

| operation | cost before | cost after | how |
| --- | --- | --- | --- |
| `mapWork` — Task/DWA retrieval | **214 ms/call** | 3.9 ms cold, 6 us warm | hoisted corpus tokenization; memoized by `cacheKey` |
| `loadOnetCorpus` — gunzip + parse 1,016 occupations | 146 ms | 0.003 ms | already memoized (module-level `cached`) |
| `canonicalTaskIndex` — build 12,579 canonical Tasks | 63 ms | 0.001 ms | already memoized (module-level `cached`) |
| `extractEvidence` — sentence classification | ~16 us/sentence | unchanged | linear; bounded by a declared budget |
| `observationsToProfile` over 150 DEVELOPMENT subjects | 72 ms | unchanged | not a bottleneck |

`mapWork` was the only real problem, and it was severe: at 214 ms per call, a 150-subject by
20-job sweep with 13 mappings each would have taken over two hours of pure tokenization. That
single number is why the Task/DWA workstream was infeasible before this preflight.

## What is cached, and what invalidates it

### O*NET corpus (`src/onet/corpus.ts`)

Module-level memo of the parsed corpus. Keyed implicitly on process lifetime and
`corpusPath()`, which embeds `ONET_VERSION`. A corpus rebuild changes the file, and everything
downstream keys on the file's SHA-256.

### Canonical Task index (`src/v3/canonical.ts`)

Module-level memo. Version string is `${ONET_TRANSFORM_VERSION}:${corpus.version}`, and that
version participates in the tokenized-index key below.

### Tokenized corpus index (`src/v3/mapper.ts`)

Precomputed statement and context token sets for all 12,579 Tasks.

Key: `${corpusHash}:${MAPPER_CONFIG.tokenizer}:${canonicalTaskIndex().version}`

Rebuilt when the corpus content changes, when the tokenizer version changes, or when the
canonical transform version changes. Token sets are a pure function of exactly those three
things, so a hit is guaranteed identical to a recomputation.

### Mapping results (`src/v3/mapper.ts`)

Keyed on the mapping's own `cacheKey`, a SHA-256 over a stable serialization of:

- `sourceText` — the exact text mapped
- `context` — the full `WorkContext` (domain, seniority, ownership, systemType, environment)
- `config` — the entire `MAPPER_CONFIG`: `topK`, `taskThreshold`, `dwaThreshold`, `taskMargin`, `tokenizer`, `contextWeight`
- `mapper` — `MAPPER_VERSION`
- `reranker` — the reranker's version, or `null`
- `corpusHash` — SHA-256 of the corpus file

Every behaviour-changing input is in the key. Change a threshold, the tokenizer, the corpus, the
mapper version, or swap in a reranker, and the key changes, so a stale entry cannot be served.
`tests/hybrid-readiness.test.ts` asserts context and reranker version each separate entries,
and pins `MAPPER_CONFIG`'s exact contents so a silent edit fails a test instead of quietly
reusing cache entries.

Bounded at `MAPPER_CACHE_LIMIT = 50,000` entries with insertion-order eviction, so a long
autonomous run cannot grow memory without limit. Eviction only ever costs a recomputation,
never a different answer.

Observability: `mapperCacheStats` exposes hits, misses, and evictions; `clearMapperCache()`
resets for benchmarking.

## What is deliberately NOT cached

**Evidence extraction results.** `extractEvidence` is ~16 us per sentence and its inputs are
already per-subject, so a cache would add invalidation risk for negligible gain.

**Availability / metric computation.** These are evaluation-time and must recompute from source
on every run, because reproducibility (`DEVELOPMENT metrics deterministic` in the readiness
gate, and the byte-identical re-run in CHECKPOINT) is the point.

**Channel scores.** Cheap arithmetic over already-mapped evidence.

## Requirements on any future cache

A future learned or agentic component must carry all of the following in its cache key
(`src/v3/learnedComponent.ts` pins the contract, `tests/hybrid-readiness.test.ts` enforces the
result shape):

- source text or structured input content
- candidate context
- model provider, model name, and model version
- instruction/prompt template version
- decoding parameters (temperature, top-p, max output tokens, seed)
- retriever/tokenizer version, topK, thresholds
- corpus hash
- relevant config

Interpretation must be keyed by the content of a single person statement, job responsibility, or
requirement — never by a person-job pairing. `PROHIBITED_INTERPRETATION_SCOPES` contains
`PERSON_JOB_PAIR` and `interpretationScopeIsPermitted` rejects it, so cost scales with distinct
evidence rather than with the product of people and jobs.
