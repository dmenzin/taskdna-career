<!-- GENERATED FILE. Do not edit by hand. -->
<!-- Source: config/architecture-evidence-ledger.json -->
<!-- Regenerate: pnpm research:ledger -->

# Architecture evidence ledger

Measured architectural findings, not a second backlog. Questions and next actions live in config/agentic-research-program.json. This file records what the evidence currently supports, what it does not, and what would change the working baseline.

**If this ledger and the research program disagree about status, the program wins for questions and this file wins for measured findings only after a cited experiment artifact exists.**

Working principle: Use models where semantic understanding genuinely requires models; use deterministic systems wherever the transformation is known. Challenge this empirically; do not hard-code the destination architecture.

## Current baseline

- **Architecture:** shared CareerBlueprint inference + claim-level provenance + deterministic field-aware matcher
- **Provider / model / effort:** openai / gpt-5.6-sol / low
- **Prompts:** person person-blueprint@v2, job job-blueprint@v1
- **Matcher:** agent-field-match
- **Corpus / split:** frame-corpus.v1 / DEVELOPMENT
- **As of:** 2026-08-23
- **Product path:** The shipping product does not run this architecture. src/app / src/v3 / src/domain import no agent module. Research harness ≠ production. P-01 Case A is a research KEEP, not a ship decision.
- **Pending change:** Provenance is a DEVELOPMENT KEEP (P-01). Retrieval preservation is INCONCLUSIVE (P-01-RET); a CI spanning zero is not equivalence. Field-match is adaptive DEVELOPMENT evidence. S-01 is DEFERRED on information value and is not the next paid experiment. Next work is ONT-01 / TRUTH-01 / M-01 protocol. Do not ship.

## Findings

### `F-BRIDGE` — replicated

Model-mediated semantic representation produces meaningful vocabulary-independent recovery.

- agent-vs-lexical:anthropic:SEMANTIC_BRIDGE experience +0.246 CI [0.134, 0.358]
- agent-vs-lexical:openai:SEMANTIC_BRIDGE:low experience +0.241 CI [0.123, 0.351]

**Do not claim:** This does not prove every gain is exclusively representation-caused, nor that the effect holds on LEXICAL_TRAP under token-bag matching.

### `F-FIELD-MATCH` — measured-once

Preserving semantic structure downstream can matter at least as much as increasing inference complexity upstream.

- On LEXICAL_TRAP OpenAI, agent-field-match experience NDCG@10 0.745 vs agent-blueprint 0.597, +0.148 CI [0.088, 0.211], zero additional model calls.

**Do not claim:** This is adaptive DEVELOPMENT evidence. The matcher was designed after inspecting DEVELOPMENT HARD_NEAR_MISS failures. The +0.148 LEXICAL_TRAP result was secondary, not the preregistered hypothesis (agent-blueprint vs lexical, which was REJECTED). Do not retune. Not independent confirmation. NDCG@10 is top 10 of a ~24-job person-specific pool.

### `F-DIRECTION-V1` — diagnosed

The v1 Direction collapse was an implementation/contract failure, not evidence against specialisation.

- split-agents:openai:LEXICAL_TRAP:low:direction-v1 REJECTED: Direction 0.732 → 0.457, 81/129 desired claims sourced from LIKE evidence.

**Do not claim:** Do not rewrite this as an architecture failure of isolated specialists.

### `F-DIRECTION-V2` — inconclusive

Correctly scoped isolated Direction repaired channel integrity; retrieval advantage is unresolved at n=12.

- Contamination 0.629 → 0.000; desired volume 2.750 → 1.000; Direction 0.806 vs shared 0.732, paired +0.074 CI [-0.066, 0.198].

**Do not claim:** Do not rerun Direction merely because it is interesting. Remaining questions are stability, power, and whether the extra call is worth it versus a clean shared+provenance baseline.

### `F-P01-PROVENANCE` — measured-once

The one-call shared architecture can emit claim-level supporting phrases without measurable evidence contamination on LEXICAL_TRAP DEVELOPMENT n=12 (P-01 SUPPORTED). Retrieval preservation / non-inferiority is INCONCLUSIVE (P-01-RET); equivalence has not been established.

- person-blueprint-v2:openai:LEXICAL_TRAP:low SUPPORTED / Case A: experience Δ −0.019 CI [−0.097, 0.054]; contamination 0.000 on 72/84/24/48 claims; volume 1.000; T-01 KEEP set stable across 25 pairs.

**Do not claim:** A CI spanning zero is not equivalence or proven non-inferiority. Experience Δ −0.019 [−0.097, 0.054], Preference +0.014 [−0.043, 0.083], Direction −0.062 [−0.172, 0.043] are each compatible with a real regression or a small improvement. This is one generation. Do not treat P-01's top-level SUPPORTED as retrieval equivalence. S-01 is DEFERRED and is not the next paid experiment.

## Not yet known

- How much representation, ranking, provenance, and architecture-decision variance repeated v2 inference introduces (S-01 amended; DEFERRED, not next).
- Whether P-01's Direction −0.062 is one noisy draw or a small systematic provenance-induced regression (S-01).
- Whether v2 is non-inferior to v1 on retrieval; margins are unresolved (P-01, S-01, POW-01).
- Whether semantically equivalent phrasing changes understanding (S-02).
- Whether Qualification can be extracted without contaminating E/P/D (QC-01, Q-01).
- Whether domain-conditioned interpretation helps without reducing legitimate cross-domain transfer (D-CTX-01). Not executable yet.
- Whether wrong-domain context merely fails to help or actively corrupts semantics (D-CTX-01 wrong-domain arm).
- Whether domain context induces DOMAIN_ANCHORING (D-CTX-01, TM-01).

