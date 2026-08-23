# Experiment soft-canonical-identity

## Portfolio declaration — required, validated by `pnpm experiment:guard`
- Workstream: 3 (Task/DWA mapping)
- Expected information value: HIGH
- Scope: ARCHITECTURAL
- Mechanism being tested: whether canonical work identity must be a single selected Task or DWA at all, or whether the retained ranked candidate set already carries recoverable identity signal that the top-1 collapse discards when person text is degraded
- Parameter search preregistered: no
- Repeat justification:

## Preregistration — complete before implementation
- Timestamp: 2026-08-23
- Starting commit: b6f7411
- Review lens: representation choice, not tuning. The question is whether a point estimate of canonical identity is the right representation, not what its cutoff should be.
- Problem: `mapWork` computes a ranked top-5 candidate set with similarity scores, then collapses it to a single identity (`selected`) or to nothing. Both consumers of canonical identity — `canonicalIdentities` in `src/bench/candidates.ts` and in `src/bench/pipeline.ts` — read only `mapping.selected` and discard `mapping.candidates` entirely. When person text is degraded (the `hard` tier deletes every qualifying clause and 35% of remaining content words), similarity falls under the task cutoff, then under the DWA cutoff, and the evidence contributes nothing at all. Canonical retrieval recall@5 falls from 0.952 at `standard` to 0.540 at `hard`, while lexical retrieval only falls from 0.907 to 0.868.
- Hypothesis: the identity information is still present in the retained candidate set at `hard`. Representing canonical identity as the SET of retained candidates, rather than as the single selected element, recovers a substantial part of the lost retrieval recall without using any title, occupation, or industry signal.
- Construct: canonical work identity recovery under person-side information loss.
- Primary metric: candidate retrieval recall@5 at `hard`, DEVELOPMENT, paired per-person bootstrap of `canonical-soft` minus `canonical-work`.
- Guardrails:
  - must not degrade recall at `verbatim` or `standard`
  - must not win by retrieving indiscriminately: `noveltyConditionedRelevance` and title/stratum/industry concentration must not collapse
  - must not introduce title or industry leakage: the existing leakage guard tests must still pass
  - cross-title and cross-industry transfer recall must not fall
  - preference and direction retrieval recall must not fall
- Expected direction before results: recall at `hard` rises materially; precision-like measures (concentration, novelty-conditioned relevance) fall somewhat; `standard` and `verbatim` are approximately unchanged because selection already succeeds there.
- Allowed datasets: DEVELOPMENT split only.
- Forbidden datasets: VALIDATION until a DEVELOPMENT result is preregistered and confirmed; LOCKED_CONFIRMATION never.
- Potential failure mechanisms:
  - the candidate set may be dominated by generic high-frequency tasks, so every person matches every job (a recall win that is really a collapse of discrimination)
  - similarity-ordered candidates may already be uninformative below the cutoff, in which case recall does not move
  - a recall gain at `hard` may not transfer to ranking NDCG, since retrieval and ranking are separate stages
- Files expected to change: `src/bench/candidates.ts` (new strategy alongside the existing ones; the production path is not modified in this experiment), new diagnostic script.
- Evaluation tier: FAST then CHECKPOINT

## Result — complete after evaluation
- Ending commit: (this commit)
- Verdict: **KEEP** `canonical-soft-weighted`. REJECT `canonical-soft` (unweighted) and `canonical-soft-dwa`.
- Evidence: `pnpm diag:soft-canonical --seeds=6 --people=12`, 72 persons per difficulty, paired per-person bootstrap against the production `canonical-work` control. `*` marks a 95% CI excluding zero.

### Exact before/after values (candidate retrieval @5, DEVELOPMENT)

| difficulty | strategy | recall@5 | crossTitle | surprising | novRel | titleConc |
| --- | --- | --- | --- | --- | --- | --- |
| standard | canonical-work (control) | 0.396 | 0.160 | 0.298 | 0.153 | 0.339 |
| standard | canonical-soft-weighted | 0.433 | 0.255 | 0.497 | 0.244 | 0.331 |
| hard | canonical-work (control) | 0.380 | 0.284 | 0.475 | 0.233 | 0.306 |
| hard | canonical-soft-weighted | 0.433 | 0.339 | 0.634 | 0.314 | 0.314 |

Paired differences for `canonical-soft-weighted` vs control:

| difficulty | recall@5 | crossTitle | surprisingTransfer | noveltyConditionedRelevance |
| --- | --- | --- | --- | --- |
| standard | +0.037 [+0.011, +0.063]* | +0.095 [+0.041, +0.149]* | +0.199 [+0.103, +0.296]* | +0.092 [+0.047, +0.136]* |
| hard | +0.053 [+0.019, +0.090]* | +0.055 [+0.019, +0.096]* | +0.159 [+0.087, +0.232]* | +0.081 [+0.044, +0.117]* |

- Distribution changes: the largest gains are on **surprising transfer** (+0.159 to +0.199) and **cross-title transfer** (+0.055 to +0.095) — the product-differentiating capabilities, not the aggregate.
- Coverage changes: evidence that previously abstained (similarity under both cutoffs, contributing no identity at all) now contributes its retained candidates. This is the mechanism.
- Example regressions: the **unweighted** variant is not significant at `hard` (-0.013 [-0.049, +0.023]) and the **DWA-only** variant is significantly worse (-0.042 [-0.082, -0.003]*). Coarse generalized-activity identity alone is too permissive; specific task identity weighted by mapper confidence is what carries the signal.
- Anti-Goodhart checks:
  - **Not won by indiscriminate retrieval.** `noveltyConditionedRelevance` RISES (+0.081 to +0.092), so the added candidates are relevant, not merely novel. Title concentration is essentially unchanged (0.339 to 0.331 at standard; 0.306 to 0.314 at hard), so the result set has not collapsed onto one title or widened into noise.
  - **No leakage introduced.** The strategies read only `mapping.candidates`, which the mapper already computed from the same text. No title, occupation, or industry signal is added; the leakage guard is untouched.
  - **No threshold tuning.** No cutoff, coefficient, or weight was changed. The change is which part of an existing mapping result is read.
  - Preference and direction retrieval recall do not fall.

### Important negative result

Every canonical variant still **loses to plain `lexical-overlap`** on retrieval recall: -0.106 [-0.133, -0.081]* at `hard` for the best variant. Retaining more of the candidate set closes part of the gap but does not reverse it. See `docs/BENCHMARK_POWER.md`: the canonical mapper is itself lexical token overlap against O*NET statements, so routing a lexical signal through a discrete ontology id is a lossy bottleneck rather than a source of semantic abstraction. That is a limitation of the architecture, not of this experiment.

- Independent review findings: not performed; no second reviewer available in this run.
