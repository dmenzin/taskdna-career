# P-01 gate report

Written after the paid run of `person-blueprint-v2:openai:LEXICAL_TRAP:low`. Structure required by the 2026-08-23 master directive.

## CURRENT BASELINE

Shared CareerBlueprint inference (`person-blueprint@v2`) + claim-level provenance + frozen deterministic field-aware matcher. Provider OpenAI `gpt-5.6-sol`, effort `low`. Jobs remain `job-blueprint@v1`. Shipping product still does not run this architecture.

## NEW EVIDENCE

12 DEVELOPMENT LEXICAL_TRAP people. 12 fresh person@v2 calls. 288/288 job cache hits. 12/12 v1 baseline cache hits.

| channel | v1 NDCG@10 | v2 NDCG@10 | Δ | 95% CI |
| --- | ---: | ---: | ---: | --- |
| experience | 0.745 | 0.727 | −0.019 | [−0.097, 0.054] |
| preference | 0.632 | 0.646 | +0.014 | [−0.043, 0.083] |
| direction | 0.732 | 0.670 | −0.062 | [−0.172, 0.043] |

Provenance at the preregistered 0.6 / 0.1 pair:

| channel | claims | contamination | unsupported | ambiguous |
| --- | ---: | ---: | ---: | ---: |
| experience | 72 | 0.000 | 0.000 | 0.000 |
| liked | 84 | 0.000 | 0.000 | 0.012 |
| disliked | 24 | 0.000 | 0.000 | 0.000 |
| desired | 48 | 0.000 | 0.000 | 0.000 |

Volume ratio interpreted/planted = 1.000 on all four channels. T-01: 25 threshold pairs, KEEP set did not flip.

Fresh person p50 14.7s, p95 18.1s (order statistics, n=12). Deterministic downstream 15.6ms/person. Actual cost $0.546 (worst-case reservation was $0.933). Spend now $11.31 / $25.

## RESULT

**SUPPORTED / Case A for auditability/provenance**

No statistically detectable retrieval regression (experience CI spans zero). Equivalence / non-inferiority has **not** been established. Provenance contamination is 0.000 on every quote channel.

## WHAT CAUSED THE RESULT

Measured mechanism: adding a required `evidence` quote does not change the five role fields the frozen matcher reads, because `stripProvenance` removes the quote before scoring. The model also produced exact planted volumes and quotes that attribute to the legitimate source channel. That is a measurement of this generation, not a proof that quotes cause self-grounding.

## WHAT CHANGED IN OUR BELIEFS

The remaining justification for always-on specialist decomposition is now weaker: the one-call architecture can be auditable. Shared+provenance is the research incumbent. Isolated Direction moves toward selective rescue (A-03), not an automatic extra call.

## WHAT DID NOT CHANGE

Field-aware matching is still the large LEXICAL_TRAP win. Qualification is still unimplemented. The product still does not run the research architecture. VALIDATION and LOCKED are untouched. Direction v1 remains a contract/routing failure, not an architecture result. NATURAL stays DEFERRED.

## BIGGEST REMAINING UNCERTAINTY

This is one generation. Direction's point estimate fell 0.062 with a CI that includes both a real regression and a small improvement. A CI spanning zero is not equivalence. If a fresh generation would have changed the written Case A conclusion — or if rankings churn while mean NDCG barely moves — one-generation architecture decisions are not safe.

## NEXT HIGHEST-INFORMATION EXPERIMENT

**S-01 (amended)** — exact-repeat stochastic stability. 12 people × 4 independent fresh person-blueprint@v2 generations. Measures representation, ranking, provenance, and architecture-decision variance. `trialId` in cache identity only. No cache replay. Distinct from S-02 (prompt perturbation). Sign-majority is not the decision rule. Paid execution is not authorized.

## WHY THIS IS NEXT

Case D of the directive said: if inconclusive, proceed to stability. Case A still requires stability before the architecture is treated as settled. P-01's near-zero Direction delta is the exact threat S-01 exists to measure.

## FRESH CALLS

P-01 used 12. S-01 would use 48. S-01 has been dry-run only and is not authorized to spend.

## ESTIMATED COST

P-01 actual $0.546. S-01 worst-case $3.73; remaining budget after P-01 ≈ $13.69.

## USER-FACING LATENCY CONSEQUENCE

Still one person call on the critical path. P-01 p50 14.7s vs the earlier shared v1 ~10.8s p50 from the prior arm. The increase is output-token work from quotes, not an extra call. Deterministic matching remains ~16ms.

## WHAT WOULD CHANGE THE PLAN

S-01 architecture-decision flips → one-generation experiments lose the right to decide architecture; move to hierarchical/repeated-trial analysis. Ranking churn with stable mean NDCG → stabilize recommendations before architecture freeze. Provenance fluctuation → P-01's one clean realization is insufficient. A later P-01-like run with contamination > 0.05 → Case B, specialists regain isolation value. An experience retrieval regression whose CI excludes zero → Case C, diagnose schema/budget/prompt before abandoning provenance.

## WHAT WE ARE DELIBERATELY NOT DOING YET

Not finishing NATURAL. Not retuning the matcher from R-01. Not running isolated Direction as always-on. Not implementing Qualification (QC-01 is design-only). Not building a domain router. Not inspecting LOCKED. Not tuning on VALIDATION. Not running S-01 paid. Not shipping research code into the product.
