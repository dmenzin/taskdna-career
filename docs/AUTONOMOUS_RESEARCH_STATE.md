# Autonomous research state

Durable state for the Claude agentic research run. The repository, not conversation memory,
holds the research plan. Update this file as findings land.

- **Branch**: `cursor/taskdna-claude-agentic-research`
- **Control checkpoint**: `e55e56cb926c1c80352f1b3877aeec7e0f3635d7` (tip of
  `cursor/taskdna-product-metric-readiness`). Preserved unmodified as the baseline.
- **Verified starting engineering state**: 315/315 tests pass. Two tests fail at a 5s default
  timeout on a slower machine (`preference-metric-red-team`, `bench-ranking`); both pass with
  `--testTimeout=120000`. They are speed artifacts, not defects.

---

## BLOCKER: no runtime model execution is available

This is a genuine, unresolved blocker. It is recorded here because Claude Code's own reasoning
is **not** a valid runtime agent benchmark.

| probe | result |
| --- | --- |
| `ANTHROPIC_API_KEY` or any provider key in env | not set |
| `.env*` files in repo | none |
| provider config in `src/` | interfaces only (`src/domain/providers.ts` declares `LLMProvider` and `EmbeddingProvider`; no implementation) |
| nested `claude -p --output-format json` | `Failed to authenticate: OAuth session expired and could not be refreshed` |

The Claude Code host holds the OAuth refresh token; a spawned child process cannot reuse it.
No new account may be created and credentials must not be extracted, so **no agent experiment
in this run executed against a real model**.

Consequence, stated plainly: this run produces **no measured agent quality, no agent rescue
rate, no hallucination rate, and no prompt optimization**. Any architecture built for the
agent-first hypothesis is unexecuted scaffolding and is labelled as such. Supplying an
`ANTHROPIC_API_KEY` is the single unblock.

---

## Headline finding: the product benchmark cannot resolve its own headline claim

The brief's central premise is that *TaskDNA does not clearly beat a dumb resume-lexical
baseline on experience ranking* (TaskDNA NDCG 0.937 vs lexical 0.963). That premise is **not
supported by the benchmark it came from.**

### The declared sample size was never validated

`OPTIMIZATION_TARGET_CONFIG` in `src/bench/run.ts` sets `minimumPeople: 12`, justified by:

> "12 is the declared minimum because the numbers stop moving there (experience 0.937,
> preference 0.618, direction 0.769 at both 12 and 16 people)."

That check cannot detect sampling noise. `buildBenchCorpus` (`src/bench/corpus.ts:234`) derives
person `i` from a hash of seed, split and **index** — independent of `peopleCount`. A 12-person
and a 16-person corpus at the same seed therefore share their first 12 people. The comparison
measures the 4 added people, not the stability of the estimate.

### What independent replication shows

`src/bench/power.ts` and `pnpm bench:power` replicate the published aggregate across
**independent seeds** and compute paired per-person bootstrap intervals. Pairing matters:
TaskDNA and each baseline rank the same person over the same job pool, so the per-person
difference removes person difficulty as a variance source.

Full result table: `docs/BENCHMARK_POWER.md`.

---

## Finding: the person/job mapping asymmetry is a rendering artifact

Reported as "person-side Experience canonical mapping Top-1 approximately 0.181 vs job-side
approximately 0.850". `pnpm diag:mapping-asymmetry` walks the difficulty ladder:

| difficulty | person_experience | job_responsibility | job/person |
| --- | --- | --- | --- |
| verbatim | 1.000 | 0.979 | 0.98x |
| standard | 0.917 | 0.850 | 0.93x |
| hard | 0.181 | 0.850 | 4.71x |

At `standard`, where both sides receive equivalent paraphrase, **the person side is more
accurate than the job side**. Job-side accuracy is identical at `standard` and `hard` because
`renderJobResponsibility` (`src/bench/render.ts:154`) hardcodes its paraphrase to `standard`
and ignores the requested difficulty, by explicit design ("job postings are not compressed the
way resume bullets are").

The entire collapse is caused by the person-side-only `hard` transform, which does two things
at once (`paraphrase`, `src/bench/render.ts:193`):

1. **drops every qualifying clause** (only the head clause survives), then
2. **drops `HARD_DROP_RATE` = 35% of the remaining content words**, with rare and distinctive
   words as eligible for deletion as filler.

Mean person/job token overlap for the *same planted atom* falls to **0.193** at `hard`.

There is therefore **no evidence of an algorithmic person/job asymmetry**. "Improve person-side
mapping" is not a model problem at the target tier; it is a statement about the renderer.

`HARD_DROP_RATE` is an evaluation-design parameter. Per `AGENTS.md` it must **not** be tuned to
move a metric, and this run does not tune it. It is reported because it dominates every
`hard`-tier number the product claims rest on.

---

## Finding: the retrieval bottleneck is difficulty-conditional and reverses

Candidate recall@5 by strategy, from `artifacts/product_readiness/bench_all.json`:

| difficulty | canonical-work | lexical-overlap | title-only | winner |
| --- | --- | --- | --- | --- |
| verbatim | 0.978 | 0.940 | 0.422 | **canonical** |
| standard | 0.952 | 0.907 | 0.444 | **canonical** |
| hard | 0.540 | 0.868 | 0.444 | lexical |

Canonical-work retrieval — the strategy the product thesis actually depends on — **beats
lexical retrieval at every tier where person and job text are rendered comparably**, and loses
only at the tier that deletes 35% of person content words while leaving job text intact.

Two structural differences, neither of them "canonical matching is bad", plausibly drive the
`hard` reversal. `pnpm diag:baseline-ablation` separates them:

- **Aggregation.** The lexical baseline scores the whole narrative as one token bag; canonical
  retrieval maps each statement individually and needs it to resolve to a Task or DWA. Under
  35% word deletion an individual bullet often resolves to nothing, while the *union* of ten
  such bullets still shares many tokens with the job text.
- **Extra fields.** The narrative contains `homeTitle`, `homeIndustry` and a `Skills:` line.
  TaskDNA's leakage guard deliberately refuses title and occupation signal
  (`buildPersonFromRenderedText` passes it as `occupation_context`, which must create no
  person-side signal). **The baseline is allowed to use information the system under test is
  forbidden to use.**

---

## Experiment ledger

| id | hypothesis | verdict | evidence |
| --- | --- | --- | --- |
| E1 | The product benchmark at n=12 cannot resolve the TaskDNA-vs-lexical gap it reports. | **CONFIRMED** | `pnpm bench:power` — half-width at n=12 is +-0.080 on experience, about 5x the true effect; 192 people needed for +-0.02 |
| E2 | The person/job mapping asymmetry is caused by asymmetric rendering, not by the mapper. | **CONFIRMED** | `pnpm diag:mapping-asymmetry` — at `standard` the person side (0.917) beats the job side (0.850) |
| E3 | The lexical baseline's advantage comes from aggregation and from fields the canonical path refuses. | **CONFIRMED, and it revealed a stronger baseline** | `pnpm diag:baseline-ablation` — experience-only Jaccard scores 0.9942 at `hard`, beating TaskDNA |
| E4 | Canonical identity is better represented as the retained candidate set than as one selected id. | **KEEP** `canonical-soft-weighted` | `pnpm diag:soft-canonical` — recall +0.053, cross-title +0.055, surprising transfer +0.159 at `hard`, all CIs excluding zero |
| E5 | The corpus makes token overlap a near-perfect atom detector, so it cannot test the product thesis. | **CONFIRMED** | `pnpm diag:generator-lexical-leak` — ROC AUC 0.981 even at `hard` |

## Standing conclusions

1. **TaskDNA's measured value is four-channel separation, not O\*NET canonicalization.**
   Preference +0.352 and direction +0.647 against resume-lexical; experience -0.064 against the
   strongest simple baseline. No whole-document lexical method can separate what a person has
   done from what they want or dislike, and that is the entire margin.
2. **In the retrieval path O\*NET hurts** (canonical 0.380 vs lexical 0.539 at `hard`). The
   mapper is lexical overlap against O\*NET statements, so canonicalization discretizes a
   lexical signal rather than adding semantic abstraction.
3. **Experience ranking is a known open loss** against `resume-lexical-experience`.
4. **The corpus cannot test the product thesis** and must be fixed before any matching result
   is trusted. This is a metric-contract change and was deliberately NOT made in this run.
5. **The next thing to try is an embedding retriever, not an agent.** The measured gap is
   semantic bridging; embeddings address it at a fraction of the cost.

## Engineering state at the end of this run

- 326/326 tests pass (315 inherited plus 11 new agent-scaffolding invariant tests)
- typecheck clean, lint clean
- **37/37 readiness gates pass**, and the gate now runs on Windows at all: `spawnSync` cannot
  execute pnpm's `.cmd` shim without a shell, which previously crashed it outright
- `.gitattributes` pins artifact and config bytes to LF so a recorded sha256 stays meaningful
  on every platform; the frozen baseline previously false-failed on any Windows checkout

## Open questions, highest information value first

1. Does an ontology bridge genuinely disjoint vocabulary? Untestable on this corpus; needs the
   generator fix plus a thesaurus or embeddings.
2. Does an embedding retriever beat both canonical and lexical retrieval?
3. What is the agent rescue rate and agent-only false discovery rate? **Blocked** on runtime
   model access.
4. Is `hard` the right optimization target, or does it conflate paraphrase robustness with
   lexical-deletion robustness?
5. Everything human-validity related. No synthetic result here speaks to it.
