# O*NET external-shock baseline (Phase A — frozen)

Command: `pnpm eval:onet-shock` · Frozen artifact: `artifacts/logic_audit/onet_external_shock_baseline.json` (never overwritten; later runs write `onet_shock_latest.json`).

Engine under test: **unchanged pass-1 engine** (`scoring.v1`, `taskdna.v2`) against the real O*NET 30.3 corpus, 450 stratified virtual subjects (150 development / 100 validation / 100 locked holdout / 100 adversarial-OOD, seed 20260823), 22 cross-strata shared evaluation occupations, 600 counterfactual twins + 1,000 observation-regime variants.

## Headline numbers (before any tuning)

| Metric | Value |
|---|---|
| Hidden-truth TaskDNA MAE (all) | **1.845 / 10** |
| MAE development / validation / holdout / adversarial | 1.875 / 1.815 / 1.820 / 1.856 |
| Mean Work-Fit spread across 22 real occupations | **0.29 points** (collapsed) |
| Work-Fit distribution vs real occupations | mean 9.53, sd 0.40, min 7.93 (saturated) |
| Hireability distribution | mean 3.69, sd 1.35, max 7.57 (compressed low) |
| Neutral TaskDNA job vectors (full universe) | **99.6%** of 1,016 occupations |
| Function mapping (full universe) | 1,012 / 1,016 → "modeling-simulation" (nearest-to-neutral artifact) |
| Technical-demo top function share (subjects) | 32% |
| Twin pass: same_preference_different_experience | **68%** |
| Twin pass: pref-inverted / network / title-removed | 94% / 100% / 100% |
| Network strategy audit pass rate | **8.3%** |
| NBA feasibility (actions exist) | 100% |
| Confidence→error association | none (MAE 1.844 in <0.35 bucket vs 1.844 in 0.35-0.5 bucket) |
| Invariant failures | 0 (legacy invariants still pass) |
| Keyword stuffing buys hireability | no (3.53 vs 3.34) |

## What broke when real O*NET data replaced the 24-occupation snapshot

1. **Work Fit collapsed.** `matchFunctionByTasks` matches demo fixture responsibilities and technical keywords; 99.6% of real occupations fall through to the neutral vector (all 5s). Every real job then sits ~9.5 fit for everyone — no discrimination, trivially "stable" rankings.
2. **Function ontology cannot see the labor market.** Nearest-to-neutral maps nearly the entire universe to "modeling-simulation". The extended knowledge-work pack is never reached by job matching (only `careerFunctions` is consulted).
3. **Evidence extraction is a technical dialect.** Missing-evidence rates per dimension: `scope_preference` **100%**, `software_as_tool` 78%, `real_system_grounding` 73%, `closure_preference` 70%, `creation_style` 68%. The extractor's regexes cover logs/debugging/QMS language, not general knowledge work.
4. **Exposure bleeds into preference.** `evidence_density` bias +0.69, `measurable_feedback` bias +0.62: occupational task statements ("analyze data…") fire preference-side signals — a mild occupation→preference leak.
5. **Confidence is not informative.** Error is flat across confidence buckets; almost no subject exceeds 0.5 confidence.
6. **Hireability is lexical and compressed.** O*NET skill names ("Critical Thinking", "Judgment and Decision Making") rarely intersect stated skills; hireability piles up at 1.5-4.9 with keyword-luck noise. Experience-retargeted twins shift hireability too weakly (68% pass).
7. **Network layer leaned on fixture coincidences.** Second-degree paths require `organizationIdFromCompany(company)` collisions that demo fixtures happened to provide; on real data the strategy audit passes 8.3% (failing cases: `second-degree-paths`, `former-manager-direct`, `explicit-offer-materials`).

## Which domains failed worst before tuning

MAE by stratum (n ≥ 4): software 2.00, supply chain 1.97, business development 1.95, cybersecurity 1.93, compliance 1.92, science/research 1.92. The spread across strata is narrow because the failure is uniform: extraction misses everywhere.

## Failure classification (per section 10 taxonomy)

- Category H (occupational/domain vocabulary gap): dominant — the lexicon is a technical dialect.
- Category A (insufficient observable evidence): sparse variants behave as designed (confidence 0.26).
- Category C (extraction failure): `scope_preference` has no extraction path at all.
- Category F (bad prior): neutral job vector as the fallback for unmatched occupations manufactures 9.5 fits.
- Category G (incorrect confidence behavior): confidence does not track error.
- Category I (latent truth not recoverable): part of the residual ~1.8 MAE is irreducible under messy evidence; must not be "fixed" by leaking truth.

## Rules for repairs

Repairs use the development cohort; validation chooses between generic alternatives; the locked holdout is touched only after a candidate engine freezes. This baseline file is never regenerated in place.
