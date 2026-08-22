# Architecture

The app is a modular monolith:

- `src/domain`: pure recommendation and inference services.
- `src/config`: versioned Task-DNA, ontology, feature flag, and scoring configuration.
- `src/fixtures`: deterministic personas and synthetic job providers.
- `src/app`: Next.js UI only; React components do not calculate scores.
- `scripts`: reproducible seed, reset, eval, and export commands.
- `tests`: regression tests for recommendation behavior.

Provider interfaces are represented by deterministic local functions in `src/domain/engine.ts`. Production providers can replace resume parsing, evidence extraction, job search, job interpretation, freshness, commute, analytics, LLM, and embedding behavior without moving score math into the UI.
