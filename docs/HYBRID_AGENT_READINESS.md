# Hybrid agent / model readiness

Rules and regexes are not sufficient forever. TaskDNA also must not become one giant
nondeterministic agent. This document records the architecture that lets future experiments
compare genuinely different algorithm families without either failure mode.

## Target architecture

```
messy language
  -> cheap candidate generation            (deterministic, fast, high recall)
  -> selective contextual interpretation   (model/agent, only where ambiguity warrants)
  -> structured versioned evidence / Task / DWA result
  -> deterministic downstream channel scoring
```

Models and agents belong at ambiguity-heavy **language** boundaries and at **candidate
reranking**. They never author a final channel score.

## Where models are admissible

`STRATEGY_BOUNDARIES` in `src/v3/strategy.ts` declares ten boundaries, each with its construct,
current implementation and family, plausible alternative families, model admissibility, and
evaluator.

| boundary | current family | model admissibility |
| --- | --- | --- |
| `preference_evidence_extraction` | `RULES_LEXICON` | `LANGUAGE_INTERPRETATION` |
| `preference_representation` | `RULES_LEXICON` | not permitted |
| `task_candidate_retrieval` | `LEXICAL_RETRIEVAL` | not permitted |
| `semantic_retrieval` | `EMBEDDING_RETRIEVAL` (seam only) | not permitted |
| `contextual_reranking` | `RULES_LEXICON` (no reranker wired) | `CANDIDATE_RERANKING` |
| `abstention_policy` | `RULES_LEXICON` | not permitted |
| `preference_fit` | `DETERMINISTIC_ARITHMETIC` | not permitted |
| `experience_fit` | `DETERMINISTIC_ARITHMETIC` | not permitted |
| `qualification_fit` | `DETERMINISTIC_ARITHMETIC` | `LANGUAGE_INTERPRETATION` |
| `direction_fit` | `DETERMINISTIC_ARITHMETIC` | not permitted |

Qualification Fit appears twice over because ambiguous *equivalence* is a language problem
inside otherwise deterministic arithmetic: deciding whether "BSc Computer Science" satisfies
"Bachelor's in a technical field" is interpretation. `QUALIFICATION_EQUIVALENCE_SEAM` marks the
`AliasProvider` interface as the admissible place for that judgement. A model may produce the
equivalence judgement; it may not produce the qualification score.

`channelScoringIsDeterministic()` asserts every `*_fit` boundary is
`DETERMINISTIC_ARITHMETIC` and lists no `LLM_AGENT` alternative, and
`tests/four-channel-parallel.test.ts` fails if that ever stops holding.

## Families a future experiment can compare

`rules/lexicons`, `lexical retrieval`, `embedding retrieval`, `contextual/cross-encoder
reranking`, `selective LLM/agent reasoning`, and hybrids. None of these are implemented in this
preflight — deliberately. The point is that swapping one in requires implementing an interface,
not rewriting unrelated code.

Interfaces that exist and are unused are limited to boundaries where a different family is
genuinely plausible. Affine rescales, clamping, and the semantic `(side x stance)` rule are
arithmetic or definitional, so no interface was invented for them.

## What every learned component must expose

`src/v3/learnedComponent.ts`, enforced structurally by `learnedResultIsComplete` and
`tests/hybrid-readiness.test.ts`:

- model provider, name, and version
- instruction/prompt template version, where applicable
- input
- candidate context
- structured output
- abstention status and confidence
- provenance (input hash, candidate-context hash)
- cache key
- latency
- cost
- **a deterministic fallback**

The fallback is required, not optional. A run must stay reproducible and complete when the model
is unavailable, abstains, or is deliberately disabled. Every result records which of the two was
actually `used`.

Abstention is a first-class outcome, not an error. `LearnedOutcome` is a discriminated union of
`RESOLVED` and `ABSTAINED`; the reference stub in the tests abstains on every call and still
produces a complete, usable result.

## Selective invocation

`DEFAULT_SELECTIVE_INVOCATION_POLICY`:

| field | value |
| --- | --- |
| `maxInvocationRate` | 0.15 |
| `maxInvocationsPerExperiment` | 2,000 |
| `maxCostUsdPerExperiment` | 5 |
| `invokeOnlyWhen` | `AMBIGUOUS_CANDIDATES` |

The default posture is **not** to invoke. `shouldInvoke` must justify each call from the
ambiguity actually present in its input — the reference stub returns false when there is at most
one candidate. A component that wants to exceed these limits is proposing an architecture
change, not running an experiment.

## No person-by-job model loop

Interpreting each (person, job) pairing with a model is prohibited outright.
`PROHIBITED_INTERPRETATION_SCOPES` contains `PERSON_JOB_PAIR`, and
`interpretationScopeIsPermitted` rejects it.

Unique person evidence and unique job responsibilities are interpreted **once**, cached by
content, and their canonical results reused across every pairing. Cost therefore scales with
distinct evidence rather than with the product of people and jobs. The existing mapper already
works this way: `mapWork`'s cache is keyed on text plus context plus config, never on a pairing.

## Final scoring stays deterministic

This is the load-bearing constraint. Every published Preference / Experience / Qualification /
Direction Fit number is reproducible arithmetic over structured, versioned evidence. A
nondeterministic model can change *what evidence exists* — subject to provenance, caching, and a
recorded fallback — but never what a channel score is, given that evidence.

## Related

- `src/v3/strategy.ts`, `src/v3/learnedComponent.ts`
- `tests/hybrid-readiness.test.ts`, `tests/four-channel-parallel.test.ts`
- `docs/CACHE_AUDIT.md` — cache-key requirements for learned components
