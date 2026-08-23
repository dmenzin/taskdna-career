# Changelog

## 0.5.3-iteration-hardening

- Replaced the recognized-evidence-gated primary preference metric with `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1`, defined from generator-exposed evidence (`src/lab/evidenceAvailability.ts`), independent of extractor recognition. The superseded `AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1` is retained under `legacySuperseded` for comparison only.
- Added `RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE`/`MICRO`, `AVAILABLE_TO_RECOGNIZED_RECALL`, and `ZERO_AVAILABLE_EVIDENCE_MAE` as mandatory companion metrics; added a mandatory regression test proving a missed extractor example cannot disappear from the primary denominator.
- Corrected a fabricated/nonexistent `readinessLabBase` commit SHA in `config/baseline-manifest.json` (confirmed via the GitHub commits API that it never existed).
- Reclassified `integration_preference` as `CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE` and added a coverage-floor sensitivity table (`pnpm eval:eligibility-sensitivity`) showing the eligibility floor is a policy parameter, not a scientific fact.
- Named and inventoried every active `src/v3/fit.ts` coefficient with an explicit governance status (`src/v3/coefficientGovernance.ts`, `docs/V3_COEFFICIENT_INVENTORY.md`); no values changed. Flagged an unjustified `EXPERIENCE_OWNERSHIP_WEIGHTS` ordering anomaly (`unknown` scoring above `assisted`) without silently fixing it.
- Red-teamed the primary metric against eight attack strategies (`pnpm eval:metric-red-team`, `docs/PREFERENCE_METRIC_RED_TEAM.md`); fixed a pre-existing no-op duplicate-evidence warning check.
- Extended `pnpm eval:iteration-readiness` with eight new gates covering the above; extended `AGENTS.md` with persistent TaskDNA experiment rules for future autonomous iteration.
- No V3 coefficients, generator behavior, or scoring logic were tuned; this is a metric-definition and governance hardening pass only.

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
