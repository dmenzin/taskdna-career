# RESET STATE

Frozen 2026-08-23 on this tree. **No paid model calls. No prompt edits. No new datasets. No VALIDATION or LOCKED generation or inspection.**

This file is the reset snapshot. It is not a new experiment and not a new roadmap.

---

## What exists

Two stacks. They are not one HEAD.

**Product path.** Deterministic 17-dimensional Work Fit (`src/domain`). 450-subject O*NET lab and Hidden-truth MAE (`src/lab`). The product UI does not call the agent stack.

**Agent research path.** `frame-corpus.v1` on `semantic-frame.v2`. Observed-input freeze: `config/frame-corpus-freeze.json` (`eb58f13`), committed before the first agent prompts. Live program: `config/agentic-research-program.json`.

Executed prompts: `person-blueprint@v1`, `person-blueprint@v2`, `job-blueprint@v1`, `experience-agent@v1`, `direction-agent@v1` (superseded), `direction-agent@v2`. No Qualification interpreter. Matcher: `agent-field-match`. Scaffold prompts `discover-work-content@v1` and `transfer-hypotheses@v1` were never run against a model.

Every scored agent arm used **DEVELOPMENT**, almost always **12 people**, each ranked against a **person-specific ~24-job pool**. NDCG@10 is top 10 of those ~24. “288 jobs” is 12 tailored pools, not a shared market. Prompts receive pre-bucketed EXPERIENCE / LIKES / DISLIKES / WANTS NEXT. Qualification is planted in `narrative` and is not read.

S-01 is registry-`PREREGISTERED` and program-`DEFERRED`. M-01 is not implemented and not rendered. VALIDATION is a procedural generator holdout (held-out vocab is visible in-repo; tests instantiate it). LOCKED is unfrozen and deterministically buildable from repo + seed `20260823`; it has not been built. PR #8 and PR #9 are sibling audit branches.

---

## What evidence is trustworthy

- There is no weight-training set. The loop is prompt tuning on a synthetic frame corpus.
- The observed-input freeze precedes the first prompts (`eb58f13` then `6088556`). There is no evidence of “run agent → rewrite answers.”
- Semantic normalisation can map deliberately separated vocabulary into the authored five-field schema. That mechanistic effect reproduced from Claude to OpenAI on the same frozen objects.
- P-01 **provenance / auditability** is SUPPORTED on those 12 people (contamination 0.000 on quoted channels).
- Direction v1 was a real contract/routing failure (liked folded into wanted). Direction v2 drove contamination 0.629 → 0 on that working set.
- O*NET atoms and the 450-subject lab exist, and they are **not** the CareerBlueprint screen.

---

## What is untrustworthy

- Any current NDCG as product performance, real-career performance, or shared-market retrieval.
- Field-match +0.148 vs token-bag on LEXICAL_TRAP: written after inspecting DEVELOPMENT HARD_NEAR_MISS failures; secondary to a **REJECTED** preregistered “agent-blueprint beats lexical” hypothesis. Adaptive DEVELOPMENT evidence only.
- Isolated Direction 0.806, and P-01 retrieval deltas, as independent confirmation. They are scores on the same 12 LEXICAL_TRAP DEVELOPMENT people used to write Direction v2 and person-blueprint v2.
- P-01 retrieval preservation / non-inferiority. That is INCONCLUSIVE. A CI spanning zero is not equivalence.
- Calling VALIDATION a blinded external holdout, or LOCKED a sealed confirmation artifact.
- Treating “288 jobs” as one market, or JobBlueprint cache reuse as global amortization.
- Treating the five-field ontology as human-validated.
- Mixing PR #8 product MAE with PR #9 agent NDCGs.

---

## What is unknown

- Whether the prompts work on raw messy career text (E / P / D routing is untested; inputs are pre-bucketed).
- Qualification (no interpreter; planted text is unread).
- Generalization past this fixed 6/7/2/4 planter and 75-concept invented lexicon.
- Stochastic stability (S-01 never executed).
- Human validity of the ontology (`ONT-01`) or of recommendations (`H-01`).
- Whether MIXED_EVIDENCE changes the architecture (M-01 not rendered).
- Shared-universe retrieval (`MKT-01`).
- Real-user usefulness, product latency, and whether the current incumbent should ever be frozen (`ARCH-01`).

---

## Which experiments / data tuned each prompt

All executed prompt work used `frame-corpus.v1` DEVELOPMENT at `FRAME_BENCH_SEED = 20260823`. Not VALIDATION instances. Not LOCKED. Not O*NET. Not the 450-subject lab. Executed v1/v2 prompts contain **no few-shot examples**.

| Prompt | What shaped it |
| --- | --- |
| `person-blueprint@v1` | Written `6088556` after the freeze, **before any model score**, with Claude Opus 5 also on the lexicon/freeze. Later **inspected** on Claude SEMANTIC_BRIDGE n=12, OpenAI SEMANTIC_BRIDGE n=12, OpenAI LEXICAL_TRAP n=12, and a stopped NATURAL arm. Those inspections changed the matcher, **not** this prompt. Never revised. |
| `job-blueprint@v1` | Same first commit. Scored on every person-job arm. **Never revised.** |
| `experience-agent@v1` | Written `a497848`. Ran on both split arms (12 LEXICAL_TRAP DEVELOPMENT). **Never revised.** |
| `direction-agent@v1` | Written `a497848`. Diagnosed on split direction-v1: same 12 LEXICAL_TRAP DEVELOPMENT people (11 wanted = 7 liked + 4 desired; LIKE leaked into desired quotes). **SUPERSEDED.** |
| `direction-agent@v2` | Written after that `656c45c` failure on **those same 12 LEXICAL_TRAP DEVELOPMENT people**. Scored on split direction-v2. No further edit. Those 12 are now prompt-training examples. |
| `person-blueprint@v2` | Byte-identical to v1 plus a required `evidence` quote. First paid use: P-01 on **the same 12 LEXICAL_TRAP DEVELOPMENT people**. Provenance KEEP; retrieval INCONCLUSIVE. Not shipped. |
| `discover-work-content@v1`, `transfer-hypotheses@v1` | Never executed. Not tuned. |
| `agent-field-match` *(matcher, not a prompt)* | Written `6fa64a2` after inspecting DEVELOPMENT HARD_NEAR_MISS on Claude SEMANTIC_BRIDGE interpretations. Do not retune. |

`CHANNEL_CONTRACTS` contrastive examples are **not** in any executed prompt. If a later version lands them, record that then.
