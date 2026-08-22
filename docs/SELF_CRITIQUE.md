# Self-critique

## Cycle 1

Highest-impact issue: the first prototype can appear broader than its persistence layer because SQLite migrations are not yet implemented.

Fix applied: documented the boundary clearly, added deterministic seed/reset commands, and kept domain models typed so a migration layer can map the same objects later.

## Cycle 2

Highest-impact issue: a title-based demo could undermine the central thesis.

Fix applied: added explicit same-title/different-task and different-title/same-task fixtures plus tests that assert divergent/similar fit behavior.

## Remaining risks

- The scenario interview needs a dedicated interactive queue.
- Confidence math is plausible but still heuristic.
- The UI is information-rich and may need more progressive disclosure after real user testing.
- Synthetic novelty can demonstrate the concept but cannot prove real labor-market usefulness.
