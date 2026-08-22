# Hireability audit (Pass 2)

Command: `pnpm audit:hireability` → `artifacts/logic_audit/hireability.json`

Version: `hireability.v2` (`src/domain/hireability.ts`)

Hireability is a **requirement × candidate-evidence matrix**, not keyword overlap. Work Fit never erases a fatal/legal gap. A minor optional-tool gap never destroys Hireability.

## Constructs kept separate

- core / preferred coverage
- hard disqualifiers (FATAL / LEGAL)
- professional vs academic/project vs adjacent
- seniority alignment (scope, not years-only)
- recency, evidence confidence, recruiter legibility

## Case results

| Case | Fit | Hireability | Fatal |
|---|---|---|---|
| High fit / missing core tool (C++/ROS) | 8.69 | **1.0** | 0 (CORE gap) |
| Capable-and-unhappy quality/compliance | 8.89 | **8.40** | 0 |
| Direct professional Python | 8.58 | **9.88** | 0 |
| Academic-only Python | 8.58 | **5.18** | 0 |
| RN license gap | 9.04 | **1.0** | 1 |
| Optional Tableau gap | 9.04 | **9.41** | 0 |
| Career changer into robotics | 8.58 | **1.0** | 0 |
| Seniority mismatch (2y vs Staff) | 8.97 | **5.37** | 0 |
| Same title, soft requirements | 8.58 | **9.88** | 0 |
| Keyword-stuffed resume | 8.58 | **1.0** | 0 |

`Skills:` / `Keywords:` dumps are stripped before matching. O*NET shock: stuffed mean hireability 2.06 vs unstuffed adversarial 2.51 (`stuffingBuysHireability: false`).

## Residual weakness

- Recency and duration are still coarse heuristics.
- Adjacent aliases are a small closed table, not an O*NET transfer graph.
- Demo corpus hireability is now *stricter* (many synthetic jobs sit ~2) because lexical luck was removed. That is intended, not a demo-tuning target.
