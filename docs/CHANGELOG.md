# Changelog

## 0.5.2-pre-iteration-hardening

- Split generator-available preference evidence from extractor-recognized evidence.
- Primary synthetic metric is now `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1`.
- Relabelled `integration_preference` as construct-valid but below the policy coverage floor.
- Documented V3 coefficient governance statuses and persistent TaskDNA experiment rules in `AGENTS.md`.
- No coefficient tuning and no 8-hour improvement loop.

## 0.5.1-forensic-specs

- Documented the current implementation as-is in `docs/ALGORITHM_SPEC.md`, `docs/EVALUATION_SPEC.md`, and `docs/COEFFICIENT_REGISTRY.md`.
- No algorithm, coefficient, dataset, baseline, or evaluation-code changes.

## 0.5.0-onet-pass-2

- Ingested official O*NET 30.3 (CC BY 4.0, USDOL/ETA) with fetch/verify/corpus commands and frozen `onet_external_shock_baseline.json`.
- Expanded the Virtual Subject Lab to ~450 O*NET-backed subjects plus 1,600 counterfactuals (`subject-lab.v2-onet`).
- Separated exposure / success / preference / dislike / aspirational evidence. Exposure never moves TaskDNA.
- Replaced title/neutral-vector job reading with a versioned work-structure lexicon including official GWA names.
- Rebuilt Hireability as a requirement-evidence matrix (`hireability.v2`) with fatal/core/significant/minor gaps.
- Hardened network asks (credibility/observed-work gates) and Next Best Action (90-minute diversified portfolio).
- Published pass-2 audits, scorecard, and the 18 final questions. Hidden-truth recovery remains D. No psychometric or probability claims.

## 0.1.0

- Created greenfield Next.js sandbox prototype.
- Added deterministic Task-DNA, capability, function, job, scoring, novelty, freshness, and active-learning domain models.
- Added 15 synthetic personas, 180 raw observations, and 120 canonical synthetic jobs.
- Built consumer UI with onboarding, evidence, profile, functions, job explorer, reactions, debug trace, search funnel, and Product Lab.
- Added evaluation harness, Vitest regression tests, and standalone demo exports.
- Documented architecture, scoring, limitations, security/privacy, and roadmap.

## 0.2.0-audit

- Fixed evidence-driven Task-DNA so pasted career text and scenario evidence can materially change recommendations.
- Added contradiction-aware confidence and sentiment-aware evidence extraction.
- Added adaptive scenario interview selection and scenario response updates.
- Expanded tests from 1 file / 6 tests to 6 files / 28 unit-integration tests plus 12 Playwright E2E tests.
- Added all-persona UI access, all-function ranking visibility, freshness filtering, richer decision trace/debug details, and safer standalone export HTML escaping.
- Added provider boundary interfaces and domain helpers for canonicalization, hard filters, freshness transitions, and simulated commute.
- Fixed Playwright hydration by using `localhost` instead of `127.0.0.1`.

## 0.4.0-logic-audit

- Finished the deeper computational-brain audit without rebuilding the product.
- Removed remaining persona-id and `expectedHighFunctions` model inputs.
- Added a persona-free profile path, intake-based opportunity graphs, and an extended knowledge-work function ontology.
- Built the Virtual Subject Laboratory: 200 subjects, O*NET-inspired occupations, hidden truth vs messy observations, twins, holdout, and OOD cohorts.
- Added `pnpm audit:logic|sensitivity|stability|parameters|generalization|zero-origin|domain-holdout`, `pnpm eval:unseen`, and `pnpm subjects:*`.
- Published the logic scorecard: sandbox trust B, hidden-truth recovery D. Not production-calibrated.

## 0.3.0-v2-human-opportunity-graph

- Added Human Opportunity Graph V2 domain models for people, organizations, teams, relationships, interactions, ask types, paths, access assessments, pursuit plans, drafts, and next-best actions.
- Added synthetic network universe with 160 fictional contacts, 160 relationships, 50+ interaction histories, explicit offers/boundaries, dormant ties, weak ties, recruiters, and second-degree paths.
- Added relationship/readiness, contact-opportunity assessment, opportunity access, pathfinding, interaction planning, deterministic message drafting, and daily next-best-action engines.
- Added `pnpm eval:network` and standalone `artifacts/opportunity_graph_demo.html` plus network JSON exports.
- Added Human Opportunity Graph dashboard, contact explorer, job-level network access tab, network coverage, warm paths, and next-best-action UI.
- Expanded E2E coverage to 16 Playwright tests including V2 dashboard and standalone opportunity graph export.
