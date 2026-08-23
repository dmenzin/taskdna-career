# S-01 amended design — report before paid execution

This is the operator-facing report required before any S-01 spend. The machine authority is
`config/experiment-registry.json` record `stochastic-stability:openai:LEXICAL_TRAP:low:amended`
and the formulas in `src/agent/s01Stability.ts`. The first draft
`stochastic-stability:openai:LEXICAL_TRAP:low` is SUPERSEDED and was never executed.

Paid calls are **not authorized** in this session.

## S-01 FINAL QUESTION

How much variation is introduced by repeated inference under identical semantic input, and can
that variation change TaskDNA's representation, recommendations, or architecture decisions?

Three distinct questions, not one:

1. **Representation stability** — does the CareerBlueprint change?
2. **Recommendation stability** — do the ranked jobs change?
3. **Architecture-decision stability** — would an alternative generation have changed the written P-01 Case A conclusion?

A blueprint can change wording while rankings stay identical. Rankings can churn while mean NDCG
barely moves. Mean NDCG can vary without crossing a decision boundary. S-01 reports all three,
plus provenance stability.

## EXACT DESIGN

Repeated measurements: person → independent model generations.

| Frozen | Value |
| --- | --- |
| People | 12 DEVELOPMENT |
| Family | LEXICAL_TRAP |
| Trials | 4 fresh generations / person |
| Fresh person calls | 48 |
| Provider / model / effort | OpenAI `gpt-5.6-sol` / `low` |
| Person prompt / schema | `person-blueprint@v2` |
| Job prompt | `job-blueprint@v1` (all 288 reused) |
| Matcher | frozen `agent-field-match`; token-bag `agent-blueprint` computed on the same interpretation |
| Hidden truth / scoring / corpus | unchanged |
| `trialId` | cache / experiment identity only; **not** in the rendered prompt |
| Cache reuse across trials | forbidden |
| P-01 generation as trial 0 | forbidden |
| Prompt perturbation | forbidden (that is S-02) |

v1 is **one frozen historical realization**. This design measures stochastic variation of v2
relative to that realization. It does not measure symmetric uncertainty of both architectures.

Subject id and trial id are preserved on every output and telemetry record.

## PRIMARY STABILITY ENDPOINTS

Four verdicts, each `SUPPORTED` / `CONCERN` / `INCONCLUSIVE`. Not one PASS/FAIL.

| Dimension | What is measured |
| --- | --- |
| `REPRESENTATION_STABILITY` | Per-channel volume mean/range/SD; pairwise work-identity Jaccard; field-level agreement on action/object/purpose/method/domain; truth-relative agreement (outputs differ but remain equally correct vs one generation is wrong) |
| `RANKING_STABILITY` | NDCG@10 and Recall@10 variance; top-1 agreement; top-3/5/10 overlap; Spearman rank correlation; **recommendation churn** |
| `PROVENANCE_STABILITY` | Contamination, unsupported, and ambiguous-attribution rates by trial |
| `ARCHITECTURE_DECISION_STABILITY` | Trial-level v2 vs frozen-v1 paired deltas for Experience, Preference, Direction with full magnitude (mean, median, range). Whether P-01 Case A would still stand |

**Recommendation churn, preregistered:** `1 - |TopK_A ∩ TopK_B| / K` with `K = 10`.

Architecture-decision flips use P-01's published rules, not a new NDCG margin:

- contamination > 0.05 → Case A would not stand
- experience paired CI excludes zero downward → Case C language
- Direction CI excludes zero downward → Direction *story* changes; primary Case A can still stand

Sign counts may be shown descriptively. They are not the decision rule.

## SECONDARY ENDPOINTS

- Field-match vs token-bag paired delta on the **identical** interpretation each trial; cross-trial range; whether every trial keeps the same qualitative conclusion
- Runtime: input / output / reasoning tokens, latency, cost, truncation/refusal; mean, median, range, SD
- Whether unusually expensive or slow generations correlate with better, worse, or unchanged recovery (correlation ≠ causation)

## NON-INFERIORITY / PRACTICAL-REGRESSION TREATMENT

P-01's practical question is closer to non-inferiority than to "is v2 significantly better?"

**No absolute regression margins are declared.**

Reasons, written before seeing S-01 results:

- P-01's intervals are too wide to invert into a margin without circularity
- The product has no declared NDCG loss budget
- Choosing 0.05 or 0.10 from the observed P-01 deltas (−0.019 / −0.062) would be exactly the post-hoc threshold selection this program forbids

Absence of significance is not evidence of equivalence. Non-inferiority remains `UNRESOLVED`.
S-01 reports the full trial-level delta distribution so a later POW-01 / product conversation can
set a margin with data.

## WHY 4 TRIALS

Retained as an economical first repeated-measures screen.

- Four trials give 6 pairwise comparisons per person and a four-point distribution (min, two interior, max). Three trials cannot show that shape. Two trials can only produce a range.
- The fourth trial is one extra generation per person, not a new architecture. Worst-case +~$0.93 on this model/effort.
- Five or more is linear cost for diminishing distributional information on an n=12 DEVELOPMENT screen.

Person-sample power stays n=12. That is POW-01, not S-01.

**Rejected justification:** four trials are not used because they permit a 3-to-1 sign majority.

## WHAT 4 TRIALS CANNOT ESTABLISH

- Conventional statistical power or a precise variance estimate
- Equivalence or non-inferiority of v2 vs v1
- Symmetric stochastic uncertainty of both architectures
- Prompt / format robustness (S-02)
- Model / alias drift (S-03)
- Population generalization beyond these 12 DEVELOPMENT people

## FRESH CALLS

48 person-blueprint@v2 calls if the dry-run census still shows 0/48 person hits and 288/288 job hits.

## WORST-CASE COST

$3.73 reserved. P-01 actuals ran under reservation ($0.546 vs $0.93), but S-01 must budget the ceiling.

## REMAINING BUDGET

$13.69 remaining of $25 after $11.31 spent. S-01 worst-case is ~27% of remaining. After a full reservation: ~$9.96 left.

## WHAT RESULT WOULD CHANGE THE RESEARCH PROGRAM

| If S-01 shows… | Then… |
| --- | --- |
| Highly stable on all four dimensions | Shared+provenance becomes a substantially stronger incumbent. Proceed to S-02. Then settle shared-vs-selective-specialist. Then Qualification according to dependencies. |
| Representation varies, rankings stay stable | Do not overreact. Check whether wording/frame variation preserves semantic truth. Product impact may be limited unless explanations depend on exact identity. |
| Rankings materially churn | Significant product problem. Investigate stabilization before architecture freeze. |
| Provenance contamination or unsupported claims fluctuate | P-01's one clean realization is not sufficient. Investigate grounding stability. |
| Architecture-decision flips (Case A would not stand on a fresh draw) | One-generation architecture experiments lose decision authority. Future model-mediated comparisons need repeated generations or an explicitly modeled stochastic component. |
| Direction cluster around ~0.67 | Provenance may have induced a small systematic Direction regression that n=12 could not establish. |
| Direction scatters (e.g. 0.68 / 0.73 / 0.67 / 0.75) | P-01's 0.670 was one draw from a noisy process. |

Qualification, domain conditioning, MIXED_EVIDENCE, and further specialist experiments stay
deferred from execution until the measuring instrument is characterized.

## Immediate actions that are *not* this experiment

`QC-01`, `Q-01`, `M-01`–`M-04`, the `D-CTX` series, transfer metrics, and privacy/human-validity
work remain registered. None of them spend in this pass.
