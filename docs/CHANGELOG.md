# Changelog

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
