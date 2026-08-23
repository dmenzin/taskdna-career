# Provider handoff state: Anthropic arm frozen, OpenAI arm starting from zero

Written at the start of the OpenAI migration, after reconstructing the state from disk rather
than from a briefing. Every claim below is labelled **VERIFIED** (reproduced from the repository
on this machine), **REFUTED** (the repository contradicts the briefing), or **UNVERIFIABLE** (the
evidence needed to check it no longer exists).

- **Starting branch**: `cursor/taskdna-agent-first-runtime-research`
- **Starting SHA**: `5bcd74f4add4a168d39c925b7eae5e748cb2f075`
- **Working branch**: `cursor/taskdna-openai-provider-migration-b7d8`
- **Working tree at handoff**: clean. There was **no uncommitted Claude-era work to preserve**,
  so the checkpoint commit that the handoff brief asked for was unnecessary; this document is
  the checkpoint instead.

---

## 1. The finding that changes the plan: the Anthropic caches do not exist

The handoff brief treats the interrupted LEXICAL_TRAP run as resumable, with "218/288 job
blueprints cached" and "70 Claude job calls remain". **That is no longer true, and it cannot be
made true.**

`.gitignore` has excluded `artifacts/agent_runtime/` since commit `6088556`, the same commit that
introduced the runtime. The caches and the budget ledger were therefore **never committed**, and
they lived only on the ephemeral disk of the machine that ran the experiment.

| check | command | result |
| --- | --- | --- |
| cache directory present | `ls artifacts/agent_runtime` | **absent** |
| cache ever committed | `git log --all --diff-filter=A -- 'artifacts/agent_runtime/**'` | **no commit, on any branch** |
| cache elsewhere on disk | `find / -type d -name agent_runtime` | **no match** |
| untracked/ignored remnants | `git status --ignored --short` | **empty** |
| ledger state | `pnpm experiment:agent-vs-lexical --dry-run` | **`$25.000 of $25, 1000 of 1000 calls`** — a fresh ledger |

The ledger reporting the full $25 and the full 1,000 calls is independent confirmation: the
recorded 336 calls and $3.70 of prior spend are gone with the file.

### Consequences

1. **Claude LEXICAL_TRAP is not 70 calls from completion. It is 300 calls from completion**
   (12 person + 288 job), and those calls are unbuyable because `ANTHROPIC_API_KEY` is unset.
2. **The `218/288` checkpoint survives only as a historical record**, in
   `docs/FINAL_ARCHITECTURE_REPORT.md` §2 and in this document. It cannot be retained as a
   resumable cache, and no future run should claim otherwise.
3. **Claude SEMANTIC_BRIDGE is preserved as a result, not as a cache.** The committed artifact
   `artifacts/agent_experiments/agent-vs-lexical-semantic_bridge-n12.json` holds the scores,
   paired comparisons and token counts. The underlying interpretations are gone, so that arm can
   be *cited* but never *recomputed* or extended.
4. **The prior run's spend does not carry forward.** The OpenAI arm starts against a full
   $25 / 1,000-call ceiling. This is a bookkeeping reset, not an authorization to spend more:
   total program spend across both providers is now under-recorded by $3.70 / 336 calls, and
   that offset is noted here so it is never mistaken for headroom.

---

## 2. Claude arm: what is complete, incomplete, and never started

| experiment | family | status | evidence |
| --- | --- | --- | --- |
| `agent-vs-lexical` | SEMANTIC_BRIDGE | **COMPLETE (result preserved, cache lost)** | committed artifact, n=12 |
| `agent-vs-lexical` | LEXICAL_TRAP | **INCOMPLETE — interpretation only, never scored** | no artifact; cache lost |
| `agent-vs-lexical` | NATURAL | **NEVER STARTED** | no artifact, no cache, no ledger entry |
| generalization | VALIDATION, any family | **NEVER STARTED** | no artifact, no cache, no ledger entry |

Exact Claude cache counts at interruption, as recorded by the run that made them and now
**UNVERIFIABLE** on this machine:

| cache | count at stop |
| --- | --- |
| `cache-person-lexical_trap.json` | 12 / 12 |
| `cache-job-lexical_trap.json` | 218 / 288 |

LEXICAL_TRAP produced **no scores at all** — it stopped during interpretation, before evaluation.
It must never be read as a negative result for agent-first on the trap family.

### Claude configuration, for the record

| field | value |
| --- | --- |
| provider | `anthropic` |
| model | `claude-opus-5` |
| reasoning / effort | **`low`** |
| person prompt | `person-blueprint` `v1` |
| job prompt | `job-blueprint` `v1` |
| schema | `PERSON_BLUEPRINT_SCHEMA` / `JOB_BLUEPRINT_SCHEMA` (`agent-architecture.v1`) |
| max output tokens | person 1200, job 600 |
| decoding | `temperature: 0` requested, **not forwarded** (current Anthropic models reject it) |

The `low` effort setting matters for every future cross-provider comparison and is easy to
overlook: it was a deliberate choice, documented in `src/agent/anthropicProvider.ts`, on the
grounds that these tasks are extraction rather than open-ended reasoning.

---

## 3. Statistically supported claims

**VERIFIED** — reproduced from `artifacts/agent_experiments/agent-vs-lexical-semantic_bridge-n12.json`.
SEMANTIC_BRIDGE, DEVELOPMENT, n=12, NDCG@10, paired bootstrap over persons against
`experience-lexical`:

| channel | agent-blueprint | experience-lexical | delta | 95% CI | verdict |
| --- | --- | --- | --- | --- | --- |
| experience | 0.6447 | 0.3985 | **+0.2461** | [0.1338, 0.3575] | CI excludes zero |
| preference | 0.5455 | 0.3321 | **+0.2134** | [0.0324, 0.3671] | CI excludes zero |
| direction | 0.7002 | 0.1417 | **+0.5585** | [0.3871, 0.7131] | CI excludes zero |

Also **VERIFIED** in the same artifact: `oracle-normalizer` scores 0.8078 / 0.6164 / 0.9933. The
validity control therefore holds — the agent sits well below perfect normalisation through the
corpus's own register, so the win is not merely convergence on the authored register, and the
control's own shortfall from 1.000 locates the residual loss in the matcher.

## 4. Claims that are NOT supported by any artifact

**REFUTED as an evidenced claim.** `docs/FINAL_ARCHITECTURE_REPORT.md` §2 reports an
`agent-field-match` row of 0.748 / 0.592 / 0.818 and a field-match improvement of
"experience 0.645 → 0.748, Δ=+0.104, CI [0.015, 0.186] — significant".

**No committed artifact contains an `agent-field-match` score.** The only agent artifact's
`scores` array runs from `random` to `oracle-planted-truth` and has no `agent-field-match` entry;
`agent-field-match` appears in the repository only as code (`src/agent/agentArchitecture.ts`) and
unit tests. The measurement was made in a session whose caches are now gone, and the artifact was
never regenerated to include it.

The code is sound and unit-tested, and the *diagnosis* behind it is well supported by the
`oracle-normalizer` control. But the number itself is now **unreproducible**, and it must be
demoted from a measured result to a recorded-but-unverified claim until an arm regenerates it.

Other claims still blocked:

- **LEXICAL_TRAP for any agent arm.** No provider has scored it. Open, not negative.
- **NATURAL for any agent arm.** Never attempted.
- **VALIDATION generalization for any agent arm.** Never attempted. Every agent number in the
  repository is DEVELOPMENT-split only.
- **Agent rescue rate / agent-only false discovery rate.** Defined as goals, never measured.
- **Agent vs dense retrieval.** No embedding provider; unanswered.
- **Human validity.** Zero. Everything is planted-truth recovery on synthetic people.

---

## 5. Benchmark and architecture state (all VERIFIED on this machine)

| item | state |
| --- | --- |
| corpus version | `frame-corpus.v1` |
| frame version | `semantic-frame.v2` |
| freeze manifest | `config/frame-corpus-freeze.json`, `frame-corpus-freeze.v1`, frozen 2026-08-23 |
| freeze verification | `pnpm bench:frame-freeze` → **"frame corpus freeze verified (6 entries)"** |
| `lockedConfirmationFrozen` | `false` — LOCKED is deliberately not even frozen, let alone inspected |
| preregistration | `docs/BENCHMARK_FAMILIES_PREREGISTRATION.md`, before any architecture was scored |
| matching architecture | `agent-architecture.v1`; `agent-blueprint` (token bag) and `agent-field-match` (per-field coverage) |
| channels | Experience / Preference / Qualification / Direction, independent by contract |

Frozen observed-input hashes, unchanged from the freeze:

| split / family | sha256 | people | jobs |
| --- | --- | --- | --- |
| DEVELOPMENT/NATURAL | `6a40498d9177079eb36f2ddd0abe74e9d68cd3eb19ea59f47f810769a3f53e82` | 48 | 1152 |
| DEVELOPMENT/SEMANTIC_BRIDGE | `eb6974b4a8ac1fd73946de930bfef40e9cd77fba79b3de95b6e4fecd00b86fba` | 48 | 1152 |
| DEVELOPMENT/LEXICAL_TRAP | `18b326a9bbf12a3cb253a621339de1af5a679dfa91f568aa89bc97f384b38475` | 48 | 1152 |
| VALIDATION/NATURAL | `672cd2bff48ef85584f68b21cc9b408c0640fbb9ee409a005425bac4bc4c3014` | 48 | 1104 |
| VALIDATION/SEMANTIC_BRIDGE | `9d5e1ad412e99e976e6aec97b7483d7e86c96615a8fabf624ce42b03c64b0e54` | 48 | 1104 |
| VALIDATION/LEXICAL_TRAP | `f5337e9c24032222538aba49c0fc428c1f4d1e6f5934ef0d4cd7f5f0e55a15cb` | 48 | 1104 |

Because the frozen inputs verify byte-for-byte, the OpenAI arm reads **exactly** the observed text
the Claude arm read. Input comparability is established at the benchmark layer; what is not
comparable is discussed in §7.

### Gates, all re-run on this machine at the starting SHA

| gate | result |
| --- | --- |
| `pnpm test` | **403 passed / 403**, 37 files |
| `pnpm typecheck` | clean |
| `pnpm lint` | clean |
| `pnpm eval:iteration-readiness` | **passed: true** (includes tests, typecheck, lint, build, tracked secret-pattern scan) |
| `pnpm bench:frame-freeze` | verified, 6 entries |
| LOCKED guard, live probe | `pnpm eval:preference --mode=LOCKED_CONFIRMATION` **exits non-zero with the guard sentinel** |

LOCKED was not inspected, and remains uninspected.

---

## 6. Credential state

Established by **boolean presence only**; no value was read, printed, logged, or persisted.

| variable | present |
| --- | --- |
| `ANTHROPIC_API_KEY` | **no** |
| `OPENAI_API_KEY` | **yes** |

`hasAnthropicCredentials()` correctly returns false, so every Anthropic-gated script refuses to
start. No Anthropic call was attempted during this handoff.

---

## 7. Comparability: what carries over between providers, and what does not

| layer | comparable across the two arms? |
| --- | --- |
| observed benchmark inputs | **yes** — same frozen bytes, hashes verified |
| hidden truth / labels | **yes** — computed from planted identity, no model involved |
| family definitions | **yes** — preregistered, unchanged |
| blueprint schema semantics | **yes** — same `StructuredWork` 5-tuple and four channels |
| agent instructions | **yes in wording**, subject to provider syntax adaptation |
| downstream matcher and scorer | **yes** — identical code path |
| statistical procedure | **yes** — same paired bootstrap over persons |
| **model identity** | **no, and that is the point of the comparison** |
| **reasoning effort** | **NOT YET** — Claude ran `low`; see below |
| **cached interpretations** | **no, and must never be** — separate namespaces, and the Claude cache no longer exists to contaminate anything |

### The reasoning-effort confound

The Claude arm ran at effort `low`. Running the OpenAI arm at `high` would vary **two** things at
once — provider and reasoning depth — and every provider difference it reported would be
uninterpretable. The canonical cross-provider arm must therefore run at the **comparable** effort
setting, with reasoning depth treated as a separate, separately-preregistered arm.

### Model pinning

The account exposes `gpt-5.6-sol` as a **moving alias only**; no dated snapshot
(`gpt-5.6-sol-YYYY-MM-DD`) is offered, unlike `gpt-5.4-2026-03-05` or `gpt-5.5-2026-04-23`. Exact
reproducibility against a pinned snapshot is therefore **not available** for this model. Both the
requested alias and the model identifier the API returns are recorded on every call, and this
limitation is a standing threat to reproducibility for the OpenAI arm.

---

## 8. Standing rules for the OpenAI arm

1. Anthropic caches are not read, transformed, or reused. There are none, and the namespace
   separation is enforced anyway so that a restored Anthropic arm can never blend with this one.
2. OpenAI generates its own interpretations from zero for every family it reports.
3. The partial Claude LEXICAL_TRAP run is not continued with OpenAI. It is a provider-specific
   incomplete arm, and stays that way.
4. Missing Claude measurements are never filled with OpenAI results. Arms stay in separate
   columns.
5. Cursor's own reasoning is not product-agent evidence. A result counts only when it executed
   through application code and produced a `ModelCallRecord`.
6. LOCKED is not inspected.
