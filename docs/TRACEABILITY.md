# End-to-end recommendation traceability

## The question this must answer

> Can a developer trace a bad recommendation to the exact subsystem and evidence that caused it,
> without guessing?

**YES** for the core V3 matching pipeline.

`src/bench/trace.ts` produces one structured `RecommendationTrace` per (person, job) pair, and
attaches a **per-stage verdict**. Localizing a failure is a lookup, not an investigation.

## Stages

| # | stage | what the trace carries |
| --- | --- | --- |
| 1 | `person_evidence_extraction` | raw text, declared kind, the extractor's own class, and provenance (planted atom, paraphrase family, difficulty) |
| 2 | `person_canonical_mapping` | full ranked candidate set with lexical and context sub-scores, the Task/DWA/abstain decision, the selection reason in terms of the mapper's own thresholds, diagnostic confidence, mapper version, corpus hash, cache key |
| 3 | `job_responsibility_extraction` | responsibility ids, raw text, core-versus-incidental flag |
| 4 | `job_canonical_mapping` | same structure as stage 2, for each responsibility |
| 5 | `candidate_retrieval` | strategy id and version, rank in the candidate set, whether it entered at all, and which shared canonical work caused retrieval |
| 6–9 | `experience_fit`, `preference_fit`, `direction_fit`, `qualification_fit` | score, coverage, evidence count, diagnostics, and **contributions decomposed to the specific person evidence id and job responsibility id** that produced them, with the weight explained (`exact Task match, credit 1 x strength(deep)=1 x ownership(led)=1`) |
| 10 | `constraints` | declared constraints, hard violations, and an explicit note when no constraint fields exist |
| 11 | `recommendation_policy` | mode, final rank, total candidates, Pareto front, tie-break value, hard-gap partition, and why the job immediately above outranked it |
| 12 | `explanation` | sentences, cited evidence ids, cited responsibility ids, and any unsupported sentence |

## Verdicts

Each stage is graded against the planted truth **for that stage alone**, so a failure downstream
of a broken stage does not mask its cause. Verdicts are `OK`, `DEGRADED`, `FAILED`, or
`NOT_APPLICABLE`.

A real example from the fixture at standard difficulty:

```
OK              person_evidence_extraction     6 experience statements, 83% classified as exposure/success
FAILED          person_canonical_mapping       35% of person statements recovered their planted Task; 6 abstentions
OK              job_responsibility_extraction  5 responsibilities present (4 core)
OK              job_canonical_mapping          80% of responsibilities recovered their planted Task
OK              candidate_retrieval            entered the candidate set at rank 3
OK              experience_fit                 planted grade 3, score 0.3925, 3 traced contribution(s)
OK              preference_fit                 planted grade 0, score 0.4667, 1 traced contribution(s)
OK              direction_fit                  planted grade 0, score 0.0000, 0 traced contribution(s)
OK              qualification_fit              hardGaps=0; preferred requirement weight=0.25
NOT_APPLICABLE  constraints                    no user constraint fields exist in the data model
OK              recommendation_policy          rank 5/19; rank 4 is ahead on Pareto front 1 with maximin 0.5333
OK              explanation                    2 sentences, 4 cited evidence ids, 0 unsupported
```

The weak stage is named: person canonical mapping recovered only 35% of planted Tasks. Every
downstream number follows from that, and the developer does not have to guess which of twelve
subsystems to open.

## Explanation grounding

Explanations are built **only** from contributions the scoring actually used. A sentence with no
supporting contribution goes to `unsupportedSentences` rather than being emitted as if grounded.
Tests assert every cited evidence id and every cited responsibility id appears in a traced
contribution.

Supported statements the trace can produce today:

- "This role matches N work pattern(s) you have performed." — cites the experience contributions
- "You have not done this work before, but it matches what you say you want to do next." — emitted
  only when direction has contributions and experience does not
- "This role contains work you have explicitly said you do not enjoy." — cites the preference
  contributions when the preference score is below the neutral centre
- "N required qualification(s) are not currently demonstrated: ..." — cites the planted hard gaps

When an LLM later writes prose, it may **summarize this provenance**. It may not invent the
underlying fit rationale.

## Reproducibility

The trace is deterministic: `JSON.stringify(traceFixture())` is byte-identical across runs. Every
mapping carries its `cacheKey`, `mapperVersion`, and `corpusHash`, so a cache hit preserves
reproducible provenance and a behaviour change invalidates it.

## Known limits

The trace covers the V3 four-channel path. The legacy 17-dimension preference path
(`src/domain/engine.ts`) is not traced to the same depth. Stage-verdict thresholds are declared
tolerances, not derived ones.

## Command

```
pnpm bench:subsystems            # emits a full trace fixture in the report
pnpm exec vitest run tests/bench-traceability.test.ts
```
