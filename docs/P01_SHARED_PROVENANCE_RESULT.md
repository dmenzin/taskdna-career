# P-01 result — shared CareerBlueprint + claim-level provenance

Experiment: `person-blueprint-v2:openai:LEXICAL_TRAP:low`
Split: DEVELOPMENT / LEXICAL_TRAP / n=12
Artifact: `artifacts/eval/person-blueprint-v2-openai-LEXICAL_TRAP-low.json`
Sensitivity: `artifacts/eval/p01-threshold-sensitivity.json`

## Verdict

**SUPPORTED / Case A.** Retrieval held. Provenance is clean. Threshold conclusion is stable.

This is a research KEEP, not a ship decision. One generation only.

## What was frozen

Provider, model, effort, job prompt, matcher, corpus, hidden truth, scoring, v1 baseline. The only conceptual change was a required per-item `evidence` quote on `person-blueprint@v2`, stripped before matching.

## Numbers

- Experience NDCG@10: 0.745 → 0.727, Δ −0.019, CI [−0.097, 0.054]
- Preference: 0.632 → 0.646, Δ +0.014, CI [−0.043, 0.083]
- Direction: 0.732 → 0.670, Δ −0.062, CI [−0.172, 0.043]
- Contamination: 0.000 on experience (72), liked (84), disliked (24), desired (48)
- Volume ratio: 1.000 all channels
- T-01: 25 pairs, KEEP set did not flip
- Fresh person p50 / p95: 14.7s / 18.1s
- Cost: $0.546 actual (reservation $0.933)
- Budget after: $11.31 / $25

## What this does not mean

It does not settle specialists. It does not prove Direction is unchanged. It does not authorize VALIDATION, product migration, or S-01 spend.
