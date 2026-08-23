# Agent-first architecture: design, and why the evidence points somewhere specific

**Status: designed and scaffolded, never executed.** This run had no runtime model access. The
Claude Code host holds the only credential and a child process cannot reuse it
(`docs/AUTONOMOUS_RESEARCH_STATE.md`). There is therefore **no measured agent quality, no
rescue rate, no hallucination rate, and no prompt optimization** in this repository. The
`EchoProvider` stub exists to unit-test the harness and has no language ability; nothing
derived from it may be reported as agent performance.

What follows is a design justified by measurements that *were* made, plus the experiment that
would falsify it.

---

## 1. The evidence relocates the bottleneck

The research brief hypothesized that the agent should get first eyes on the raw person, because
deterministic extraction and canonical mapping were discarding meaning before the agent could
see it. **The measurements do not support that diagnosis.**

| claimed weakness | what the measurement shows |
| --- | --- |
| person-side mapping is weak (0.181 Top-1) | artifact of person-side-only text degradation. At `standard`, person-side mapping is **0.917**, better than job-side 0.850 (`pnpm diag:mapping-asymmetry`) |
| candidate retrieval is broken (0.540 recall) | canonical retrieval **beats** lexical at `verbatim` (0.978 vs 0.940) and `standard` (0.952 vs 0.907); it loses only at the tier that deletes 35% of person words |
| TaskDNA loses to a dumb lexical baseline | at n=12 the comparison was noise. It does lose to the *strongest* simple baseline by -0.064 [-0.078, -0.050], and wins preference by +0.35 and direction by +0.65 (`docs/BENCHMARK_POWER.md`) |

Extraction is not the binding constraint. The binding constraint is this:

> **Every stage of the current pipeline is lexical token overlap.** `mapWork` computes
> `overlap(tokens(text), tokens(onet_statement))` with no stemming, no lemmatization, no synonym
> expansion, and no embedding. Canonical work identity is lexical similarity discretized into an
> ontology id.

A system built entirely from token overlap cannot match two descriptions of the same work that
share no vocabulary. That is precisely the product's stated thesis — match on the underlying
work, not the wording — and the current system has **no mechanism for it at all**.

So the agent's job is not to rescue extraction. It is to supply the one capability the
deterministic system structurally lacks: **semantic bridging across disjoint vocabulary.**

---

## 2. The corpus cannot currently show this, which is itself the finding

`pnpm diag:generator-lexical-leak` measures how well raw token overlap alone identifies which
planted atom a piece of text came from:

| difficulty | ROC AUC |
| --- | --- |
| verbatim | 0.9998 |
| standard | 0.9998 |
| hard | **0.9814** |

Person text and job text for the same atom are paraphrases of the same source O\*NET sentence,
and `substituteSynonyms` only rewrites about 40 common verbs — **every object noun is shared
verbatim**. On this corpus, wording *is* the work, so semantic bridging has nothing to bridge
and cannot demonstrate value. Any agent evaluated here would be competing against a baseline
that already has the answer key.

**Fixing the corpus is a precondition for evaluating an agent at all.** Person-side and
job-side renderings of one atom must not share their distinctive nouns. Doing that fairly needs
a thesaurus or embeddings — semantic resources this repository does not have. That is a real
dependency, not an excuse: it is the same dependency the product itself has.

---

## 3. The architecture

Cost scales with **distinct evidence**, never with people times jobs. A person-by-job model
loop is prohibited and `InstrumentedRunner` makes it structurally hard: every call is cached by
content, prompt version, and decoding parameters.

```
raw person evidence
  -> [A] contextual discovery agent          once per person, ~100% of new users
       -> CareerBlueprint vN (immutable, versioned, claim-typed)
  -> [B] refresh                             only on evidence change or user correction

unique job posting
  -> [C] job interpretation                  once per posting, cached by content
       -> JobBlueprint (cached, reused across every user)

matching
  -> cheap broad retrieval                   deterministic, high recall, no model
  -> deterministic four-channel scoring      arithmetic over structured claims
  -> [E] selective contextual review         only ambiguous or high-stakes pairs
  -> [D] career-landscape exploration        occasional, per person
```

Phases A and C are the expensive ones and both are one-time-per-object. Phases B, D and E are
selective. The recurring cost of a normal recommendation refresh is intended to be **zero model
calls**.

### The 15% invocation cap does not apply to onboarding

`src/v3/strategy.ts` caps learned-component invocation at 15%, which was correct for a
deterministic-first architecture. Initial user discovery is different: it may reasonably call a
model for **100% of new users**, because the result is persisted and amortized across every
future search. The cap should be re-scoped to per-recommendation invocation, not per-user
onboarding.

### Claims, not prose

`src/agent/blueprint.ts`. The product must not depend on free-form career narrative. Each
interpretation becomes a typed claim, and the type governs what it is allowed to do:

- `SUPPORTED_FACT` — the evidence says this
- `INTERPRETATION` — the model read it this way
- `TRANSFER_HYPOTHESIS` — proposed, not performed. **Never counts as experience**, only as
  direction. Enforced in `scorableClaims`, tested in `tests/agent-scaffolding.test.ts`
- `UNCERTAIN` — genuinely ambiguous, recorded rather than resolved
- `USER_CONFIRMED` / `USER_REJECTED` — human truth, outranks every model output

An agent asserting something does not make it true, and the type system is where that rule is
enforced rather than merely stated.

### Blueprints are immutable

A published blueprint is never edited. A new interpretation produces version N+1, so a
recommendation computed against version N stays reproducible forever, and `diffBlueprints`
shows what changed. `applyCorrection` is the only path to `USER_CONFIRMED` / `USER_REJECTED`,
which is how real human truth will eventually enter the system.

---

## 4. What would falsify this design

Run when a credential exists, in this order. Each is cheap and each can kill the design.

1. **Does the ontology bridge vocabulary at all?** Build a vocabulary-disjoint corpus. Measure
   canonical retrieval and lexical retrieval. If canonical does not beat lexical *there*, O\*NET
   has no role in the main path, because vocabulary bridging is the only thing it could have
   been adding.
2. **Does an embedding retriever beat both, at a fraction of the cost of an agent?** This is the
   cheapest plausible semantic bridge and it must be tried before any agent. If it wins, most of
   this architecture is unnecessary.
3. **Agent rescue rate.** Of true concepts the deterministic pipeline misses, what share does
   the agent recover — and what share of agent-only concepts are wrong? An agent that adds more
   false discoveries than rescues is a regression regardless of its NDCG.
4. **Blueprint stability.** Two semantically equivalent renderings of the same latent person
   must produce materially the same claims. An unstable blueprint cannot be persisted or
   diffed, and the whole amortization argument collapses.
5. **Cost per rescued miss.** The Pareto question. If deterministic retrieval plus four-channel
   scoring is within noise of the agentic system, ship the cheap one.

Expected order of value, given what is now measured: **(2) embeddings before (3) agents.** The
measured gap is semantic bridging, and embeddings address exactly that at roughly a thousandth
of the cost. Reaching for an agent first would be reaching for the most expensive tool for a
problem a cheaper one may solve.

---

## 5. What this run did NOT establish

- No agent ran. No prompt was optimized. No rescue rate, hallucination rate, or agent cost was
  measured.
- Whether contextual work representation (`purpose`, `method`, `domainContext`,
  `transferableWorkflow`) beats action-plus-object is **untested**. The corpus cannot test it:
  its atoms are single O\*NET statements with no independent context dimension.
- Nothing here touches human validity. Synthetic planted-truth recovery is engineering
  evidence, never evidence that real people feel understood or that recommendations are useful.
