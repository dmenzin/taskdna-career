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

## Adversarial audit cycle 3

Issues found:

1. Career text did not materially change Task-DNA values; persona fixture vectors dominated.
2. The adaptive interview was not actually implemented.
3. Only 8 of 15 personas were selectable in the UI.
4. Decision traces did not expose raw fit, CAF, overall formula inputs, capability matches/gaps, or score version.
5. Playwright used `127.0.0.1`, which caused Next dev to serve unhydrated pages under 403 chunk failures.

Fixes applied:

- Blended evidence-derived signals into Task-DNA values and confidence.
- Added contradiction-aware inference and sentiment-aware extraction.
- Added a deterministic adaptive scenario bank and scenario response updates.
- Exposed all personas and all work functions.
- Added freshness filtering and richer debug details.
- Switched Playwright to `localhost`.

## Adversarial audit cycle 4

Issues found:

1. Non-obvious novelty was too strict for same-industry but title-non-obvious matches.
2. Standalone export used dynamic HTML interpolation without escaping.
3. Work-function explorer showed only the top 8 functions.
4. The scenario bank was too small for a credible adaptive flow.

Fixes applied:

- Gated novelty on fit and transfer, then tuned title/task novelty weighting.
- Escaped dynamic standalone-export HTML and added freshness filtering.
- Showed all work functions in ranked order.
- Expanded the scenario bank to 12 scenarios.

## Current highest-ranked remaining issues

1. Domain engine is now too large; split providers/services for maintainability.
2. SQLite migrations remain a documented boundary rather than implemented persistence.
3. Scoring is still heuristic and needs real-user calibration before production claims.
4. The UI is more truthful, but still dense for a consumer product.

## Deeper logic / generalization pass

Issues found:

1. Persona IDs and `expectedHighFunctions` were still model inputs after the earlier audit.
2. Adaptive interview selection collapsed once those branches were removed.
3. Generic users had no way to build a network graph without the golden persona universe.
4. The function ontology was frozen on the original technical map.
5. The first automated scorecard over-claimed an A while hidden-truth MAE was ~1.9/10.

Fixes applied:

- Persona-free inference entry point and leakage scan.
- Preference-aware adaptive interview ranking.
- `createHumanOpportunityGraphFromIntake` plus inferred (not fixture) network gaps.
- Extended knowledge-work ontology for generic / lab subjects.
- Virtual Subject Laboratory (200 subjects, 21 families, twins, holdout, OOD).
- `pnpm audit:*` / `pnpm subjects:*` / `pnpm eval:unseen`.
- Honest B sandbox-trust scorecard with a separate D for hidden-truth recovery.
