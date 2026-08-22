# TaskDNA dimension coverage (Pass 2)

Command: `pnpm audit:taskdna-coverage` → `artifacts/logic_audit/taskdna_coverage.json`

Lexicon: `src/domain/workStructure.ts` (`work-structure.v1`). Official O*NET Generalized Work Activity names are first-class entries. The lexicon describes **what kind of work a text depicts**. Whether a person likes that work is decided by evidence class, never here.

## Universe coverage (O*NET 30.3, 1,016 occupations)

| Metric | Value |
|---|---|
| Occupations with any non-neutral dimension | **962 / 1,016 (94.7%)** |
| Occupations with <3 covered dimensions | 77, almost all `no-gwa` (occupations without work-activity rows) |
| New dimensions added | **None** |

## Residual holes (lowest occupation hit rate)

| Dimension | Occupation hit rate | Note |
|---|---|---|
| `integration_preference` | 4.4% | Cross-system language is rare in official GWA names |
| `causal_reasoning` | 24.3% | Investigation GWA exists; "why/mechanism" is sparser |
| `experimentation_preference` | 33.3% | Strong in science/test occupations, absent elsewhere |

Most other dimensions now fire on ~88–92% of occupations because official GWA names (`Documenting/Recording Information`, `Selling or Influencing Others`, `Interacting With Computers`, …) are in the lexicon.

## Recommendation

Residuals are coverage holes **inside existing dimensions**, not a new recurring preference construct. No sixth-criterion dimension was added.

Do not treat occupation hit rate as preference recovery. High coverage means the engine can *describe* the work, not that it knows who likes it.
