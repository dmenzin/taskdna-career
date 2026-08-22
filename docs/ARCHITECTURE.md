# Architecture

The app is a modular monolith:

- `src/domain`: pure recommendation and inference services.
- `src/config`: versioned Task-DNA, ontology, feature flag, and scoring configuration.
- `src/fixtures`: deterministic personas and synthetic job providers.
- `src/app`: Next.js UI only; React components do not calculate scores.
- `scripts`: reproducible seed, reset, eval, and export commands.
- `tests`: regression tests for recommendation behavior.

Provider interfaces are represented by deterministic local functions in `src/domain/engine.ts`. Production providers can replace resume parsing, evidence extraction, job search, job interpretation, freshness, commute, analytics, LLM, and embedding behavior without moving score math into the UI.

V2 adds:

- `src/domain/networkTypes.ts`: opportunity graph, relationship, interaction, path, strategy, draft, and action models.
- `src/domain/networkEngine.ts`: deterministic network access, pathfinding, interaction planning, drafting, and next-best-action logic.
- `src/fixtures/network.ts`: synthetic fictional network universe.
- `src/config/network.ts`: ask ontology, channel policy, strategy weights, and research principles.
- `scripts/eval-network.ts`: replayable network strategy evaluation.
- `scripts/export-opportunity-graph.ts`: standalone opportunity graph export.
