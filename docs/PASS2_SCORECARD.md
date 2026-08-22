# Pass 2 final scorecard and questions

Grades are **logical defensibility**, not labor-market truth. A component can be logically stronger and still empirically unvalidated.

## 24 grades

| # | Component | Grade | Meaning |
|---|---|---|---|
| 1 | Occupational data coverage | **A** | Official O*NET 30.3, 1,016 occupations, license/manifest hygiene |
| 2 | TaskDNA construct coverage | **B** | 94.7% of occupations hit ≥1 dimension; `integration_preference` still 4.4% |
| 3 | TaskDNA hidden-truth recovery | **D** | MAE 1.875 / 10 (baseline 1.845). No material recovery gain; do not leak truth |
| 4 | TaskDNA confidence behavior | **C** | Sparse stays low; buckets do not rank error. Almost nobody > 0.5 |
| 5 | Preference / capability separation | **A** | Exposure never moves preference; academic ≠ professional |
| 6 | Job task interpretation | **B** | Work-structure vectors replace all-5s; title no longer mints a vector |
| 7 | Function ontology generalization | **C** | Technical-demo share 35% (was ~100% modeling-simulation). `field-applications` still over-compressed (281) |
| 8 | Hireability logic | **B** | Structured matrix, fatal/core/minor, stuffing no longer buys score |
| 9 | Transferability logic | **C** | Adjacent aliases + O*NET related-occupation data unused as auto-qualify |
| 10 | Seniority logic | **C** | Scope + weak years proxy; not a validated leveling model |
| 11 | Work Fit | **B** | Spread 1.99 (was 0.29). Mean 7.41, not saturated at 9.5 |
| 12 | Score stability | **A** | Spearman 0.999 on O*NET lab; 1.0 on v1 lab |
| 13 | Personalization leakage | **A** | 0 must-fix leaks; original design user is regression only |
| 14 | Network subtype separation | **B** | Gates use credibility/routing/offer, not aggregate access |
| 15 | Relationship / ask logic | **B** | Demo evals pass; O*NET-lab golden strategy cases remain fixture-shaped |
| 16 | Network pathfinding | **C** | Second-degree hypothesized when routing ≥ 7; still heuristic |
| 17 | Social-cost logic | **C** | Versioned integers, uncalibrated |
| 18 | NBA feasibility | **A** | 100% of sampled subjects get a feasible plan |
| 19 | NBA prioritization | **B** | 90-min portfolio, diversity, no weak-job advocacy. Weights remain |
| 20 | Holdout generalization | **B** | O*NET holdout MAE 1.817, property 99.8%. V1 holdout properties 89% (grade B) |
| 21 | OOD behavior | **B** | Adversarial MAE 1.907; v1 OOD property 92% |
| 22 | Interpretability | **A** | Evidence class, matrix trace, ask gates, and decision traces are inspectable |
| 23 | Parameter arbitrariness | **C** | Still 74 free scoring coefficients. Rules replaced some lexical shortcuts |
| 24 | Real-user readiness | **D** | Sandbox only. No psychometric, probability, or outcome claim |

**Overall sandbox trust: B.** Broader occupational coverage, construct separation, and discrimination improved. Hidden preference recovery did not.

## 18 final questions

1. **What broke when real O*NET replaced the 24-occupation snapshot?** Work Fit collapsed (spread 0.29). 99.6% of occupations became a neutral TaskDNA vector and mapped to `modeling-simulation`. Exposure leaked into preference. Hireability compressed. Network golden cases depended on demo company-id collisions.
2. **Which domains failed worst before tuning?** Software, supply chain, business development, cybersecurity, compliance (MAE ~1.92–2.00). The spread was narrow because the failure was uniform extraction collapse.
3. **Which TaskDNA dimensions generalized well?** After repair: investigation, customer interaction, coordination, real-system grounding, software-as-tool, repetition/compliance — they fire from official GWA names.
4. **Which did not?** `integration_preference` (4.4%), `causal_reasoning` (24%), `experimentation_preference` (33%). Recovery MAE remains ~1.7–2.0 even on “good” dimensions.
5. **Were missing dimensions discovered?** No. Residuals are holes in existing dimensions, not a new construct that met all six add-a-dimension criteria.
6. **How much did hidden-truth recovery improve?** It did **not**. 1.845 → 1.875. Honest: stripping exposure from preference slightly *raised* MAE. That is not a bug to “fix” by leaking occupation into preference.
7. **Is confidence associated with lower error?** No useful association. `<0.35` MAE 1.84 vs `0.35–0.5` MAE 1.91. One subject above 0.5.
8. **Is Hireability still mostly lexical?** No. It is a requirement-evidence matrix. Residual: recency/duration and adjacent aliases are still coarse.
9. **Which gap behaviors remain weak?** Transfer from O*NET related occupations, duration/recency, and recruiter-legibility of non-technical work.
10. **Which network heuristics remain arbitrary?** Social-cost integers, ask-readiness priors, path weights, action weights.
11. **Is NBA still dominated by weights?** Less than before (gates + budget + diversity first). Priority inside the eligible set is still a weighted sum.
12. **How many free parameters were removed?** **0** from `scoringConfig` (still 74). Several *behaviors* moved from weights to rules (exposure weight 0, ask gates, dump stripping, title-not-a-vector).
13. **What failed on locked holdout?** Holdout MAE 1.817 (fine vs development 1.901). Property pass ~99.8%. No individual holdout subject was tuned. V1-lab holdout properties dropped to 89% (grade B) because evidence-class handling is stricter.
14. **What remains OOD?** Trades/physical work without GWA rows, licensed-profession outcomes, non-US markets, real contact graphs, real hiring results.
15. **Which components are safe for a small human beta?** Inspectable TaskDNA/Work Fit *hypotheses*, requirement-gap traces, ask-eligibility explanations. All labeled experimental.
16. **Which should be visibly experimental?** Hidden-preference recovery, Hireability as an offer predictor, NBA priority, network path scores, confidence numbers.
17. **What human-beta data should calibrate remaining heuristics?** Outcome-linked ratings of Work Fit vs lived dislike, recruiter-side requirement judgments, actual ask acceptance/fatigue, time spent per action type.
18. **What should NOT be built next?** Auth, billing, live job search, Gmail/LinkedIn automation, CRM, UI redesign, or any claim of psychometric validity or interview/offer/referral probability.

## Claim boundary

This pass establishes broader occupational coverage, logical generalization, construct separation, robustness, counterfactual sanity, reproducibility, and reduced original-user leakage.

It does **not** establish psychometric validation, satisfaction prediction, interview/offer/referral probability, empirically optimal networking, or causal job-search optimization.
