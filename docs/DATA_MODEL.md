# Data model

Core objects are typed in `src/domain/types.ts`.

- `UserEvidence`: provenance-rich source records with raw text, activity, tools, demonstrated skills, enjoyment/dislike signals, inferred dimensions, recency, and reliability.
- `TaskDNADimension`: value, confidence, supporting evidence, contradictory evidence, method, version, and interpretation.
- `Capability`: evidence level, direct/adjacent experience, outcomes, recency, recruiter legibility, confidence, and evidence IDs.
- `CareerFunction`: recurring work loop, Task-DNA vector, attractors, repellents, titles, domains, requirements, gaps, version.
- `JobSourceObservation`: raw synthetic provider observations.
- `JobPosting`: canonical job with provenance, freshness, requirements, seniority, and description.
- `JobAnalysis` and `ScoreBreakdown`: actual-work interpretation, traceable factors, independent score components, tier, and sellability.

The current sandbox persists deterministic seed output to `data/sandbox-seed.json`. A future SQLite migration layer should map these same objects into versioned tables.
