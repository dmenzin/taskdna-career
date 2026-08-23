# Canonical available-evidence definition

`src/lab/evidenceAvailability.ts` is the **only** implementation of "available evidence" in the
repository. Nothing else may define it.

## What AVAILABLE means

A dimension is AVAILABLE for a subject when the observation generator exposed language in a
field the inference system actually receives, whose **meaning** is directional once the
behaviour side and the LIKE/DISLIKE stance are combined.

Concretely, `preferencePlacements` splits each of the four inference-visible fields into
statement units, resolves each unit's stance, matches known catalog phrases, and records the
direction the placement means:

```
unit -> stance  (from the construction, or implied by the list field)
unit -> (dimension, behaviour side)  (from the phrase catalog)
meaning = intendedDirection(behaviour side, stance)
```

`availableHigh` / `availableLow` are then "some placement means HIGH / LOW". `available` is
their disjunction. `conflicting` marks genuinely mixed evidence, which is reported rather than
silently resolved.

## Required properties

**Extractor-independent.** The module imports nothing from `src/domain/evidence.ts`,
`src/domain/engine.ts`, or `src/domain/workStructure.ts`, and `pnpm eval:iteration-readiness`
greps the source to enforce it. Its stance lexicon (`EVALUATION_DISLIKE_MARKERS` /
`EVALUATION_LIKE_MARKERS`) is a separate, smaller vocabulary from the production extractor's on
purpose: if availability inherited the extractor's recognition behaviour, the primary metric's
denominator would once again depend on the algorithm under test.

**Hidden-truth-independent for inclusion.** Truth is never consulted to decide whether a
dimension is available. It is only compared *afterwards*, by the semantic-polarity audit.
Asserted by `tests/available-evidence.test.ts`.

**Based on exposed language, not generator metadata.** Placements are recovered by reading the
rendered text. `VirtualSubjectObservations.preferenceStatementPlan` records what the generator
*intended* and is explicitly documented as not-for-grading. A generator emitting malformed
language cannot assert its way to a correct availability label.

**Not shrinkable by the model under evaluation.** The denominator is fixed before the extractor
runs. An extractor that recognizes less shows up as reduced
`AVAILABLE_TO_RECOGNIZED_RECALL`, never as a smaller denominator.

## What changed, and why

### Field scope widened

The previous version read only `explicitPreferences` and `explicitDislikes`. Preference
language the engine genuinely receives through `resumeText` and `contradictoryStatements` was
excluded from the denominator, which understated how much evidence the extractor was failing to
recognize.

The independent Grok branch (`cursor/taskdna-pre-iteration-hardening-5d9f`,
`src/lab/availableEvidence.ts`) had already identified this and enumerated the same four fields
in `INFERENCE_VISIBLE_PREFERENCE_FIELDS`. That definition is adopted here, and
`tests/evidence-observability.test.ts` now pins the list against what `observationsToProfile`
actually passes so it cannot drift.

### Stance awareness added

The Grok definition matched phrases as bare substrings anywhere in those fields, with no regard
for the surrounding construction. That is insufficient for the same reason the old Claude
definition was wrong: **the same phrase means opposite things depending on stance.**

| exposed text | old label | correct meaning |
| --- | --- | --- |
| `explicitPreferences: ["solo deep work"]` | low-side evidence | LOW (like of low-side) |
| `explicitDislikes: ["solo deep work"]` | low-side evidence | HIGH (dislike of low-side) |
| `"I avoid stakeholder orchestration"` | high-side evidence | LOW (dislike of high-side) |

Both prior definitions would have labelled the first two identically. The stance-aware reader
distinguishes them, which is asserted directly in `tests/available-evidence.test.ts`.

A unit that names a behaviour without expressing any stance ("In this role I would report on
`<phrase>`") is correctly **not** available: it is exposure, not preference.

## Effect on the metrics

Widening the fields adds availability; requiring resolvable stance removes the bogus
availability the old definition granted to backwards evidence. On DEVELOPMENT the net effect was
`availableEligibleCoverage` 0.477 -> 0.330.

## Mandated reporting

Never publish the primary metric alone. Every run reports:

- `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` (primary)
- `AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE`
- `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE` / `MICRO`
- `AVAILABLE_TO_RECOGNIZED_RECALL`
- `ZERO_AVAILABLE_EVIDENCE_MAE`
- `LEGACY_ALL_DIMENSION_MAE` (compatibility diagnostic only, never product quality)

plus `recognizedOutsideAvailableRate`, constant-5, the DEVELOPMENT population prior, the
shrinkage curve, and the anti-Goodhart block.

## recognizedOutsideAvailableRate

The extractor's work-structure lexicon fires on exposure vocabulary that happens to sit inside
a preference sentence, so it attributes preference signal to dimensions for which the generator
exposed no preference language at all. This is a real extractor over-attribution property and an
open research question in workstream 2 — not an attack, and not something to suppress. It is
reported as a quantity every run. It can never inflate `AVAILABLE_TO_RECOGNIZED_RECALL`, which
is defined as recognized-AND-available over available.
