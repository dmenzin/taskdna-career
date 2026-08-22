# Decisions

## D1: Build a deterministic local heuristic engine first

- Decision: implement local providers and synthetic data before any external integration.
- Alternatives: depend on LLM/job APIs immediately.
- Rationale: the sandbox must run end-to-end without credentials and remain testable.
- Assumptions: V1 needs behavioral proof more than production data freshness.
- Reversibility: high; providers are swappable.
- Revisit trigger: real user validation requires live data or richer parsing.

## D2: Keep scores out of React components

- Decision: all scoring lives in the domain layer.
- Alternatives: calculate UI-specific scores inline.
- Rationale: tests, eval, exports, and UI must reproduce the same ranking.
- Reversibility: low-cost if service boundaries remain typed.
- Revisit trigger: scoring grows large enough to split into dedicated modules.

## D3: Use generated synthetic corpus with deliberate regression cases

- Decision: generate 120 canonical jobs and 180 raw observations deterministically.
- Alternatives: handwrite a small static dataset.
- Rationale: filtering, ranking, and search funnel behavior need enough variety to feel real.
- Reversibility: medium; generated data can be replaced by SQLite fixtures.
- Revisit trigger: production providers or curated golden artifacts become available.
