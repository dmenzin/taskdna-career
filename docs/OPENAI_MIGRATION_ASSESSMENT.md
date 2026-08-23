# Assessment of the OpenAI migration plan against the verified repository state

The migration brief was written from memory of the previous session. This document checks it
against the repository and records where the plan needs to change. Companion documents:
`docs/PROVIDER_HANDOFF_STATE.md` (what the state actually is) and
`docs/RESEARCH_CONTRACT_AMENDMENTS.md` (the standing contract).

Verdict in one line: **the plan's scientific design is sound and should be followed, but three of
its factual premises are wrong, two of its instructions contradict each other, and one
contradicts the budget contract. None of that can be acted on yet, because no runtime provider is
currently reachable.**

---

## 1. What the plan gets right

These are worth stating, because they are the parts that should not be renegotiated.

- **Separate arms, never merged.** Correct, and now enforced structurally: provider and model
  participate in every cache key, so one provider's output cannot be served as another's hit even
  from a shared file, and artifacts are named per provider so an arm cannot overwrite another.
- **OpenAI regenerates every interpretation from zero.** Correct. Model-generated
  representations are provider-specific; there is no valid way to mix them inside one arm.
- **Do not continue the partial Claude LEXICAL_TRAP run with OpenAI.** Correct, and now moot —
  there is nothing left to continue (§2).
- **Do not rewrite the prompt before obtaining a canonical baseline.** Correct, and the single
  most important discipline here. The prompt is the thing under test.
- **Preserve the E/P/Q/D separation.** Correct and already contractual.
- **Do not inspect LOCKED.** Correct. The guard was probed and genuinely refuses; LOCKED is not
  even frozen, let alone read.
- **Stop and ask rather than silently raising the cap.** Correct — and the plan's own scope
  triggers this rule (§4).

---

## 2. Premises that the repository refutes

### 2.1 The Claude caches do not exist, so LEXICAL_TRAP is not 70 calls from done

The plan says 218/288 job blueprints are cached and 70 Claude calls remain. `.gitignore` has
excluded `artifacts/agent_runtime/` since the commit that introduced the runtime, so the caches
and the ledger were **never committed** and lived only on the previous machine's disk. They are
absent from the working tree, from every branch's history, and from the filesystem. A fresh ledger
reporting the full `$25.000 of $25, 1000 of 1000 calls` confirms it independently.

Resuming the Claude arm would therefore cost **300 calls, not 70** — and cannot happen at all,
because `ANTHROPIC_API_KEY` is unset. The `218/288` figure survives as a historical record only.

**Plan change**: Phase 7's instruction to "retain the exact 218/288 job-cache checkpoint" can be
honoured only as documentation. It is recorded in `docs/PROVIDER_HANDOFF_STATE.md` §2 and
annotated in `docs/FINAL_ARCHITECTURE_REPORT.md`. Nothing is resumable.

### 2.2 The field-match improvement was measured but never persisted

The plan asks us to verify that "a field-match change reportedly improved a score from roughly
0.645 to 0.748 and was measured". It was measured, and **the measurement no longer exists**. The
only committed agent artifact has no `agent-field-match` row at all; `agent-field-match` appears
in the repository only as code and unit tests. The artifact was never regenerated after the
architecture landed, and the cache it would have been regenerated from is gone.

The *diagnosis* behind the change remains well supported — `oracle-normalizer` scoring 0.822 on
SEMANTIC_BRIDGE rather than 1.000 does locate real loss in the matcher — but the 0.748 figure is
now an unverifiable claim. Both documents are annotated rather than edited away, and the
experiment script now persists that comparison, including the matcher-only ablation against
`agent-blueprint`, so the omission cannot recur.

### 2.3 The budget ledger reset, which is a bookkeeping loss rather than headroom

The prior run recorded $3.70 across 336 calls. That file is gone, so the ledger starts at zero.
Total program spend across both providers is now **under-recorded by $3.70 / 336 calls**. This is
noted so a future reader does not mistake a reset counter for available budget.

---

## 3. Where the plan contradicts itself: reasoning effort

Phase 1 says to "begin with `high`". Phase 2 says the first OpenAI experiment must hold the agent
instructions, schema, matcher, scorer and statistics equivalent so the comparison is clean.
**These cannot both be satisfied**, because the completed Claude arm ran at effort **`low`** — a
deliberate choice documented in `src/agent/anthropicProvider.ts` on the grounds that these tasks
are extraction rather than open-ended reasoning.

Running OpenAI at `high` against a Claude arm at `low` varies **two** things at once. Every
difference the comparison produced would be unattributable to either provider or reasoning depth,
which defeats the purpose of Phase 2.

There is also a concrete implementation hazard, independent of the science. On the Responses API
**reasoning tokens are drawn from the same `max_output_tokens` pool as the visible answer**. The
Anthropic arm used allowances of 1200 (person) and 600 (job), sized for the answer alone. At a
deeper reasoning setting those allowances do not yield a deeper answer — they yield a **truncated**
one, which parses to an empty blueprint and would be scored as genuine incomprehension. Raising
the allowances to compensate multiplies the worst-case reservation, which runs into §4.

**Plan change, adopted in code.** The canonical cross-provider arm runs at `low`
(`CANONICAL_EFFORT` in `src/agent/providerRegistry.ts`), matching Claude. Reasoning depth becomes
a **separate, separately-recorded arm**: `--effort` is available, the artifact carries
`canonicalCrossProviderArm: false` when it is used, and the script prints a warning. Effort is in
the cache key, so a rerun at a new depth cannot be served the old depth's results. A truncated
response raises `OpenAiTruncationError` and stops the run rather than becoming an empty result,
and `pnpm openai:calibrate` measures actual reasoning consumption against the real prompts before
an arm is sized.

This is the answer to "must tests remain consistent": the *automated* tests were never at risk
(§6), but the *experimental* configuration was about to drift on exactly the axis that matters.

---

## 4. Where the plan exceeds its own budget contract

Phase 6 keeps the $25 / 1,000-call ceiling and says to stop and request authorization rather than
raise it. Phase 3 and Phase 7 then ask for four OpenAI arms. Measured with `--dry-run` at
`gpt-5.6-sol`, effort `low`, 12 people:

| arm | calls | worst-case reservation |
| --- | --- | --- |
| SEMANTIC_BRIDGE | 300 | $6.27 |
| LEXICAL_TRAP | 300 | $6.22 |
| NATURAL | 300 | $6.16 |
| **three DEV families** | **900** | **$18.65** |
| VALIDATION (one family) | 300 | ~$6.2 |
| **full plan** | **1,200** | **~$24.9** |

**1,200 calls exceeds the 1,000-call cap.** The dollar ceiling is survivable — expected spend is
far below worst case, since the Claude arm's recorded token counts price out around $2.90 per arm
on this model — but the **call** ceiling is breached by the plan as written, and each individual
arm already sits above the amendment's 20%-of-remaining review threshold.

**Recommended scope, which fits without amendment**: the three DEVELOPMENT families, 900 calls.
Priority order if something must be dropped, following Phase 9: SEMANTIC_BRIDGE first (the only
family where a Claude comparison is even possible), LEXICAL_TRAP second (precision safety, and it
has real headroom — see §5), NATURAL third (regression check).

**VALIDATION requires an explicit decision** — either raise the call ceiling by contract
amendment, or run VALIDATION at fewer people. It must not be quietly squeezed in.

---

## 5. What to re-run, what to reuse, and what to scrap

### Scrap — cannot be salvaged

| item | why |
| --- | --- |
| Claude LEXICAL_TRAP partial interpretations | cache gone; 0 of 288 recoverable, and the arm produced no scores |
| Claude budget ledger history | file gone; $3.70 / 336 calls unrecoverable |
| The `agent-field-match` 0.748 / 0.592 / 0.818 figures | no artifact; unreproducible on the Claude arm |

### Preserve and cite, never regenerate

| item | why |
| --- | --- |
| Claude SEMANTIC_BRIDGE artifact | verified; the only surviving Claude evidence. Cannot be recomputed |
| Benchmark preregistration and family definitions | preregistered before any architecture was scored |
| Frozen corpus | `pnpm bench:frame-freeze` verifies all 6 entries |

### Reuse — verified reproducible, no model calls

Re-ran the 48-person DEVELOPMENT competition. **Every previously recorded row reproduces
byte-for-byte**: 90 insertions, zero deletions, and the insertions are all `oracle-normalizer`
rows the artifact had never carried. The deterministic layer is intact.

Experience-channel NDCG@10, with the control now present for every family:

| family | experience-lexical | oracle-normalizer | headroom |
| --- | --- | --- | --- |
| NATURAL | 0.665 | 0.838 | +0.173 |
| SEMANTIC_BRIDGE | 0.397 | 0.822 | +0.425 |
| LEXICAL_TRAP | 0.603 | 0.833 | +0.230 |

Two things follow. The bridge family has by far the most room, which is consistent with the Claude
result. And **LEXICAL_TRAP has more headroom than NATURAL**, so the trap arm is not a formality —
there is real signal to win or lose there.

### Re-run from zero on OpenAI

Every model-generated interpretation, for every family reported. No exceptions and no partial
reuse.

---

## 6. On test consistency, specifically

The concern that the provider swap could destabilise the tests is worth addressing directly,
because the answer is reassuring and the reason is structural.

The automated suite is **provider-independent by construction**, and three separate contract
rules keep it that way:

- **Benchmark labels never come from a model.** Relevance is computed from planted canonical work
  identity, which imports nothing from the scoring or mapping pipeline.
- **Deterministic baselines make no model calls.** They are pure functions over frozen text.
- **The frozen corpus is byte-verified.** Both arms read identical observed inputs.

Measured: the suite went from **403 passing** at the starting SHA to **442 passing** after the
migration work, with typecheck, lint, the 37-gate readiness check and the freeze verification all
clean. No existing test changed behaviour; the 39 additions cover the new provider.

So test consistency was never the exposure. The real exposures are the ones above: a lost cache
that made a "resumable" arm unresumable, a claim with no artifact behind it, and a reasoning
setting that would have silently confounded the comparison. Those are experimental-integrity
problems, and they are the reason the handoff had to be reconstructed from disk rather than
accepted from a briefing.

---

## 7. The current blocker

**No runtime model provider is reachable.**

| provider | credential | reachable | detail |
| --- | --- | --- | --- |
| Anthropic | absent | no | access revoked; caches gone |
| OpenAI | **present** | **no** | valid key, but the account returns `429 insufficient_quota` |

The OpenAI failure is account-level, not model-level: `gpt-5.6-sol`, `gpt-5.6-luna` and
`gpt-4o-mini` all return the same `insufficient_quota`. `pnpm openai:preflight` reports this as a
named blocker and writes `artifacts/agent_experiments/openai-preflight.json`.

Nothing was spent. The failure was clean: no ledger entry, no cache file, no partial artifact —
which is itself a check on the boundary, since a call that never returned must be neither billed
nor remembered as a result.

**Unblocking requires** billing or credit on the OpenAI account, or a funded key supplied through
Cloud Agent secrets. Once either is in place, `pnpm openai:preflight` should pass and the arms can
run with no further code changes.

### Model pinning, for the record

The account exposes `gpt-5.6-sol` as a **moving alias only** — there is no `gpt-5.6-sol-YYYY-MM-DD`
snapshot, unlike `gpt-5.4-2026-03-05` or `gpt-5.5-2026-04-23`. Exact reproducibility against a
pinned snapshot is therefore unavailable. Every call records both the requested alias and the
identifier the API reports serving, and a divergence between them is the only warning a later
reader will get. This is a standing threat to validity for the OpenAI arm, not a solved problem.

---

## 8. Recommended sequence once quota exists

1. `pnpm openai:preflight` — confirm reachability and record the resolved model identifier.
2. `pnpm openai:calibrate` — measure reasoning-token consumption against the real prompts and
   size the output allowances from data rather than from the Anthropic arm's numbers.
3. `pnpm experiment:agent-vs-lexical --provider=openai --family=SEMANTIC_BRIDGE --people=12` —
   the canonical cross-provider arm, at `low`. This is the only family where a Claude comparison
   is possible, so it is the highest-value single spend.
4. Same for `LEXICAL_TRAP`, then `NATURAL`. Report each family separately; never average them.
5. Stop at 900 calls and report. VALIDATION needs an explicit budget decision first.
6. Only after the canonical arms exist: reasoning-depth and prompt-adaptation arms, each recorded
   as its own arm and never substituted for the canonical result.

A note on what step 3 can and cannot conclude. Because the Claude arm's interpretations are gone,
the cross-provider comparison is **artifact-to-artifact, not cache-to-cache**. Both arms read the
same frozen inputs and are scored by the same code, so the comparison is legitimate — but it
cannot be re-derived from Claude's raw outputs, and no per-person paired test across providers is
possible. Provider-level differences on SEMANTIC_BRIDGE are therefore descriptive, not
inferential. That limitation is permanent, and it belongs in the final report.
