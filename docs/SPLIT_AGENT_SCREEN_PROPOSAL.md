# Proposed DEVELOPMENT screen: split agents vs shared CareerBlueprint

**Status: awaiting spend approval. No model call has been made for this experiment.**

All code, metrics, tests and the corpus audit below were produced at zero runtime cost. The
`--dry-run` numbers are computed by hashing every request and checking the existing caches, not by
contacting the provider.

---

## 1. Why the objective changed, and one correction to the premise

Runtime experimentation stopped after two OpenAI arms. The premise for stopping — that
model-mediated interpretation beating lexical matching is established — is **true on
SEMANTIC_BRIDGE and replicated across providers**, but it is **not** what the trap family shows.

Experience channel, NDCG@10, n=12 DEVELOPMENT, paired against `experience-lexical`:

| family | architecture | score | paired Δ | 95% CI | verdict |
| --- | --- | --- | --- | --- | --- |
| SEMANTIC_BRIDGE | agent-blueprint | 0.639 | +0.241 | [0.123, 0.351] | BETTER |
| SEMANTIC_BRIDGE | agent-field-match | 0.709 | +0.311 | [0.155, 0.442] | BETTER |
| LEXICAL_TRAP | agent-blueprint | 0.597 | **-0.025** | [-0.128, 0.067] | **INCONCLUSIVE** |
| LEXICAL_TRAP | agent-field-match | 0.745 | +0.124 | [0.056, 0.188] | BETTER |

On the trap family the agent's *representation* alone does not beat lexical matching on any
channel — all three intervals span zero, and experience and direction are numerically negative.
What wins there is the *matcher*. The architecture-vs-architecture comparison
(`agent-field-match` vs `agent-blueprint`, identical interpretations, zero extra calls) is BETTER
on all three LEXICAL_TRAP channels and on 4 of 6 cells overall.

So the pivot to architecture-vs-architecture is well supported by the data — it is where the
largest and most consistent effects already are. But "agent > lexical, done" would be an
overstatement of one family's result, and the report should not carry it.

## 2. Where the remaining headroom is

Gap to the `oracle-normalizer` control:

| family | channel | agent-field-match | control | gap |
| --- | --- | --- | --- | --- |
| LEXICAL_TRAP | direction | 0.732 | 0.951 | **+0.219** |
| SEMANTIC_BRIDGE | direction | 0.878 | 0.993 | +0.115 |
| SEMANTIC_BRIDGE | experience | 0.709 | 0.808 | +0.098 |
| LEXICAL_TRAP | experience | 0.745 | 0.822 | +0.077 |
| LEXICAL_TRAP | preference | 0.632 | 0.654 | +0.022 |
| SEMANTIC_BRIDGE | preference | 0.693 | 0.616 | *exceeds control* |

Direction on LEXICAL_TRAP is the largest remaining gap in the matrix, and it is exactly what a
dedicated Direction Agent targets. That is why the screen below runs on LEXICAL_TRAP first.

*(SEMANTIC_BRIDGE preference exceeding its control is not a bug: the control normalises through
neutral forms, and preference is scored as a signed liked-minus-disliked difference, so a better
matcher can beat it. It means the control is not a ceiling for that channel, and it should stop
being described as one.)*

## 3. Free evidence that the interpretation itself is the weak link

Person understanding for the shared blueprint, computed from the OpenAI caches at zero cost:

| measure | SEMANTIC_BRIDGE | LEXICAL_TRAP |
| --- | --- | --- |
| channel volume vs planted | 6.0/7.0/2.0/4.0 — exact | 6.0/7.0/2.0/4.0 — exact |
| action recovery | 47.2% | **25.0%** |
| object recovery | 91.7% | 63.9% |
| purpose recovery | 100.0% | 81.9% |
| method recovery | 80.6% | 84.7% |
| domain recovery | 97.2% | 76.4% |
| disliked leaking into liked | 0 | 0 |
| invented experience | 0 of 72 | 0 of 72 |

Two things follow. Role recovery is **uniformly worse on the trap family**, so the trap does not
merely confuse the matcher — it degrades the interpretation. And **action is the weakest role in
both families**, matching the Claude-era observation. A dedicated Experience Agent has a concrete,
measured deficiency to attack rather than a hoped-for one.

Recovery figures are lower bounds: matching is word overlap against each concept's own lexicon, so
a correct interpretation using a word the lexicon lacks scores as a miss.

## 4. A benchmark limitation that must be settled before spending

Two of the requested measurements **cannot be made on this corpus at any sample size**. Audited
from planted truth across all 12 people, both families:

| quantity | measured distribution (overlap 0..5) |
| --- | --- |
| desired-vs-performed role overlap | `0 / 0 / 5 / 7 / 0 / 0` |
| disliked-vs-performed role overlap | `0 / 0 / 0 / 0 / 0 / 12` |

Every person has an identical channel profile — 6 performed, 7 liked, 2 disliked, 4 desired — with
zero variance. And:

- **"low Experience but strongly positive Direction" does not exist.** Every person's desired work
  shares 2 or 3 of 5 identity roles with their history. Nobody wants work unrelated to what they
  have done, so the transfer case the product exists to serve is absent.
- **"high Experience but explicitly negative Direction" is the entire corpus, uniformly.** Every
  person's disliked work is identical to work they performed, on all five roles, for all 12 people.
  There is no contrast group, so no claim of the form "this architecture handles divergent people
  better" is testable.

`pnpm experiment:split-agents --dry-run` prints this limitation before it prints anything else, and
a test pins the current histograms so a generator change fails loudly rather than silently.

**What is still measurable, and is the point of the screen**: experience and direction retrieval,
strict recall against planted truth, and contamination in both directions. The uniformity actually
sharpens the contamination test — because disliked work *is* performed work here, any architecture
that infers "has done, therefore wants" will necessarily surface work the person explicitly
rejected. That is the product-fatal error, and this corpus makes it maximally detectable.

**Decision needed from you, not from me**: extending the generator to plant genuine
Experience/Direction divergence is a metric-contract change under `AGENTS.md`, and it would
invalidate the frozen corpus and every architecture result measured against it. I have not touched
it. My recommendation is to run the screen below first — contamination is measurable now and is the
higher-priority safety question — and treat corpus extension as a separate, preregistered decision.

## 5. The proposed screen

One conceptual change, three arms, matcher held fixed at `agent-field-match` (the token-bag
matcher loses to lexical on this family, so comparing on it would test on a broken baseline).

| arm | calls per person | evidence shown | what it isolates |
| --- | --- | --- | --- |
| `shared` | 1 | all four sections | the existing baseline, **already cached** |
| `split-full-context` | 2 | all four sections, to both agents | dedicated prompts, same information |
| `split-isolated` | 2 | partitioned per agent | what withholding the other channel buys |

`split-full-context` is the fair architectural comparison. `split-isolated` is the one that gets
separation by construction, and reporting it as evidence that "dedicated prompts understand
better" would be the mistake this design exists to prevent.

### Cost, verified by dry-run against the actual caches

| item | count | cost |
| --- | --- | --- |
| job blueprints | **288 / 288 cache hits** | **$0** |
| shared baseline | **12 / 12 cache hits** | **$0** |
| new split-agent calls | 48 (12 × 2 agents × 2 variants) | **$2.886 worst case** |

The job side is free because the job prompt, schema, model, effort and output allowance are all
unchanged, so every content hash matches. Expected actual spend is well under half the worst-case
reservation, since the reservation assumes the full output allowance is consumed.

Budget position: **$16.883 of $25 remaining, 347 of 1,000 calls**. This screen is 17.1% of
remaining budget and 13.8% of remaining calls.

### Preregistered prediction and failure condition

- **Prediction**: `split-full-context` beats `shared` on the direction channel with a 95% paired
  interval excluding zero, *without* raising experience-into-direction contamination.
- **If the interval spans zero**: INCONCLUSIVE, and the split architecture is not adopted.
- **If the margin is negative**: the shared blueprint wins, and that is the finding.
- No post-hoc channel substitution, no dropping a variant, no prompt retuning to recover it.

### What will be reported

Per arm: experience and direction NDCG@10 and recall; strict performed-recall and desired-recall;
direction-into-experience, experience-into-direction and disliked-into-liked rates with their
denominators and empty-channel counts; paired bootstrap against `shared` per channel; cost and
latency. Lexical and O\*NET remain as reference controls only.

## 6. Deliberately not in this screen

- **Enriched JobBlueprint** (major vs incidental work, requirements, evidence). This is a genuinely
  separate hypothesis, and it requires regenerating all 288 job blueprints per family — roughly
  $3 per family, versus $2.89 for the entire person-side screen. Bundling it would also violate
  one-conceptual-change-at-a-time and make an ambiguous result uninterpretable. It should be its
  own preregistered experiment, run only if the person-side split shows promise.
- **NATURAL**, which is stopped at 12/12 person and 35/288 job interpretations. Those are cached
  and committed; the arm can be resumed for ~253 calls whenever it is wanted, or left as an
  explicitly incomplete arm.
- **VALIDATION**, which stays untouched until DEV work is frozen.
- **Reasoning-depth arms.** Calibration shows medium and high cost 1.4x and 1.5x more per arm for
  no measured quality benefit yet, and they would confound depth with architecture.

## 7. Recommended sequence on approval

1. `pnpm experiment:split-agents --family=LEXICAL_TRAP --people=12` — 48 calls, ~$2.89 worst case.
2. Read contamination first, retrieval second. A split architecture that ranks better while
   contaminating more is not an improvement.
3. Only if `split-full-context` beats `shared` meaningfully: confirm on SEMANTIC_BRIDGE, another
   48 calls, where the job and shared caches are also already present.
4. Only then consider the enriched JobBlueprint as a separate experiment.

Nothing in step 1 touches LOCKED, hidden truth, benchmark renderings, or VALIDATION.
