<!-- GENERATED FILE. Do not edit by hand. -->
<!-- Source: config/architecture-evidence-ledger.json -->
<!-- Regenerate: pnpm research:ledger -->

# Architecture evidence ledger

Measured architectural findings, not a second backlog. Questions and next actions live in config/agentic-research-program.json. This file records what the evidence currently supports, what it does not, and what would change the working baseline.

**If this ledger and the research program disagree about status, the program wins for questions and this file wins for measured findings only after a cited experiment artifact exists.**

Working principle: Use models where semantic understanding genuinely requires models; use deterministic systems wherever the transformation is known. Challenge this empirically; do not hard-code the destination architecture.

## Current baseline

- **Architecture:** shared CareerBlueprint inference + deterministic field-aware matcher
- **Provider / model / effort:** openai / gpt-5.6-sol / low
- **Prompts:** person person-blueprint@v1, job job-blueprint@v1
- **Matcher:** agent-field-match
- **Corpus / split:** frame-corpus.v1 / DEVELOPMENT
- **As of:** 2026-08-23
- **Product path:** The shipping product does not run this architecture. src/app / src/v3 / src/domain import no agent module. Research harness ≠ production.
- **Pending change:** P-01 tests whether person-blueprint@v2 can add claim-level provenance without changing ranking. The matcher stays frozen.

## Findings

### `F-BRIDGE` — replicated

Model-mediated semantic representation produces meaningful vocabulary-independent recovery.

- agent-vs-lexical:anthropic:SEMANTIC_BRIDGE experience +0.246 CI [0.134, 0.358]
- agent-vs-lexical:openai:SEMANTIC_BRIDGE:low experience +0.241 CI [0.123, 0.351]

**Do not claim:** This does not prove every gain is exclusively representation-caused, nor that the effect holds on LEXICAL_TRAP under token-bag matching.

### `F-FIELD-MATCH` — measured-once

Preserving semantic structure downstream can matter at least as much as increasing inference complexity upstream.

- On LEXICAL_TRAP OpenAI, agent-field-match experience NDCG@10 0.745 vs agent-blueprint 0.597, +0.148 CI [0.088, 0.211], zero additional model calls.

**Do not claim:** R-01 is diagnostic. Purpose was redundant on this family (Δ 0.000). The matcher is not retuned from that result.

### `F-DIRECTION-V1` — diagnosed

The v1 Direction collapse was an implementation/contract failure, not evidence against specialisation.

- split-agents:openai:LEXICAL_TRAP:low:direction-v1 REJECTED: Direction 0.732 → 0.457, 81/129 desired claims sourced from LIKE evidence.

**Do not claim:** Do not rewrite this as an architecture failure of isolated specialists.

### `F-DIRECTION-V2` — inconclusive

Correctly scoped isolated Direction repaired channel integrity; retrieval advantage is unresolved at n=12.

- Contamination 0.629 → 0.000; desired volume 2.750 → 1.000; Direction 0.806 vs shared 0.732, paired +0.074 CI [-0.066, 0.198].

**Do not claim:** Do not rerun Direction merely because it is interesting. Remaining questions are stability, power, and whether the extra call is worth it versus a clean shared+provenance baseline.

## Not yet known

- Whether shared inference is clean once claim provenance is visible (P-01).
- Whether one-generation architecture deltas keep their sign (S-01).
- Whether semantically equivalent phrasing changes understanding (S-02).
- Whether Qualification can be extracted without contaminating E/P/D (QC-01, Q-01).
- Whether domain context helps, and whether wrong-domain context harms (D-CTX-01).

