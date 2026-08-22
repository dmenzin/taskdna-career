# Logic audit results

Generated: 2026-08-22T19:26:19.144Z
Lab version: subject-lab.v1
Seed: 20260822

## Scorecard

- evidenceDependence: A
- preferenceCapabilityIndependence: A
- confidenceHonesty: A
- determinism: A
- personalizationLeakage: A
- generalizationHoldout: A
- counterfactualTwins: A
- zeroOrigin: A
- domainHoldout: A
- rankStability: A
- hiddenTruthRecovery: D
- overallTrust: B

Recommendation: Sandbox-coherent, not production-calibrated. Rankings are inspectable hypotheses. Hidden Task DNA is only coarsely recovered from messy evidence (MAE ~2/10).

## Pipeline checks

- Invariants: PASS (8/8)
- Personalization must-fix leaks: 0
- Subject property pass rate: 96.6%
- Twin pass rate: 98.4%
- Zero-origin pass rate: 100.0%
- Holdout property pass rate: 96.6%
- Adversarial/OOD pass rate: 98.3%
- Rank stability Spearman: 1.000

## What this does and does not prove

This audit can falsify fixture-only reasoning, title collapse, preference/capability collapse, and network contamination of Work Fit.
It cannot prove real labor-market usefulness, psychometric validity, or calibrated probabilities.
