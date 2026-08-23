# Architecture audit: is the corrected channel experiment the right thing to run?

Written as an audit of the current state against the product direction, before any new paid call.
**Conclusion: yes, run it — but the free provenance work has already answered part of it, changed
what the remaining question is, and surfaced one architectural liability that no retrieval metric
will ever show.**

Everything below is computed from interpretations already paid for. Zero model calls.

---

## 1. What the free provenance audit established

The instruction to build provenance-aware contamination before spending was the highest-value call
of the session. It is computable from disk because both split agents were required to emit the
supporting phrase alongside each work item, and that phrase can be matched back to the evidence
sentence it came from — which names the channel the claim was really built from.

`pnpm audit:provenance --direction-version=v1`, LEXICAL_TRAP, n=12, **0 model calls**:

### Experience channel — where did each performed-work claim come from?

| architecture | claims | supported | evidence contamination | rate | drift | unsupported |
| --- | --- | --- | --- | --- | --- | --- |
| `shared` | — | — | **UNMEASURABLE** | — | — | — |
| `split-full-context` | 125 | 72 | **53** | **0.424** | 0 | 0 |
| `split-isolated` | 72 | 72 | **0** | **0.000** | 0 | 0 |

Contaminating sources for `split-full-context`: `PREFERENCE_LIKE` = 47, `PREFERENCE_DISLIKE` = 6.

**The strict identity-collision detector rated that same channel at 0.008.** Provenance found
**42.4%**. That is a 50x difference, and the identity detector was not merely imprecise — it was
answering a different question. A claim built from "work this person enjoyed" often collides with no
planted frame at all, so it is invisible to collision while being exactly the error that recommends
someone back into the job they are trying to leave.

The evidence strings say it in plain text. Six of twelve claims for the first person quote
`"What I liked most: ..."` or `"The part I came to dread was when I monitored..."` — preference
sentences, promoted to performed work.

### Direction channel

| architecture | claims | supported | contamination | rate | source |
| --- | --- | --- | --- | --- | --- |
| `split-full-context` | 129 | 47 | 81 | 0.628 | `PREFERENCE_LIKE` = 81 |
| `split-isolated` | 132 | 49 | 83 | 0.629 | `PREFERENCE_LIKE` = 83 |

### Channel volume ratio (interpreted / planted; 1.000 exact)

| architecture | experience | desired |
| --- | --- | --- |
| `shared` | **1.000** | **1.000** |
| `split-full-context` | 1.736 | 2.688 |
| `split-isolated` | **1.000** | 2.750 |

---

## 2. Three findings that change the design

### 2.1 The Experience hypothesis is largely settled, for free

`split-isolated` on Experience: **0.000 evidence contamination, volume ratio exactly 1.000**, and
retrieval statistically indistinguishable from `shared` (Δ=-0.016, CI [-0.092, 0.050]).

Evidence isolation eliminates a 42.4% contamination rate at no measurable retrieval cost. That is
the Experience hypothesis answered on the axis that matters, without a single new call. The
corrected run will re-confirm it as a control, not discover it.

### 2.2 My "isolation" was only half-built, and v1 tested the same defect twice

The v1 "isolated" Direction Agent was shown **LIKES, DISLIKES and WANTS NEXT together**. It was
never isolated from Preference at all — which is why its contamination (0.629) is statistically
identical to the full-context arm's (0.628). Both arms ran a malformed prompt over preference
evidence, so v1 produced two measurements of the same defect and zero measurements of the
hypothesis.

Two independent errors compounded: the prompt defined WANTED to include "work they enjoy", **and**
the evidence routing handed it the preference sentences to find. v2 corrects both — the Direction
Agent emits only `desired`, and in the isolated variant it sees only aspiration evidence.

### 2.3 The liability no retrieval metric will show: `shared` cannot be audited

`shared` emits no supporting phrase, so its provenance is **unmeasurable — not zero**. It won
retrieval on every channel while being the only architecture whose claims cannot be traced to the
evidence that produced them.

This matters for the product specifically, not just for the research. Explanation fidelity,
traceability, and provenance/evidence are stated product requirements, and `AGENTS.md` already
requires that a recommendation stay traceable end to end with explanations citing only evidence the
scoring actually used. An architecture that cannot say why it believes something cannot satisfy
that, however well it ranks.

**So the split architecture's real product advantage may be auditability rather than ranking** — and
the current evaluation has no metric that rewards it. Worth stating plainly: if the corrected screen
comes back at parity on retrieval, that is a *win* on the product's own terms, not a null result.

The cheapest way to close this gap is not architectural. Adding a supporting-phrase field to the
shared blueprint would make it auditable too, at the cost of one prompt/schema revision and its own
preregistered screen. That is a strong candidate for the experiment after this one.

---

## 3. Does the frozen benchmark support the corrected design?

Checked from the corpus rather than assumed.

| question | answer |
| --- | --- |
| Is there a Direction construct distinct from Preference? | **Yes.** `desired` (4 per person) is Direction; `liked`/`disliked` (7/2) are Preference. |
| Is there an undesired-FUTURE construct? | **No.** `disliked` is a preference construct. |
| Separate observable evidence arrays? | **Yes.** `experienceEvidence` (6), `preferenceEvidence` (9, LIKE/DISLIKE), `aspirationEvidence` (4). |
| Can Direction be isolated? | **Yes** — `aspirationEvidence` alone, 4 entries against 4 planted desired. |

So the v2 Direction Agent correctly emits **only** `desired`. Adding an unwanted-future output would
create a channel with no planted truth to score it against.

### Preference is NOT PRODUCED, and must not be read as a regression

This architecture covers Experience and Direction only, per the instruction to leave Preference to
its own screen. `foldSplitOutputs` therefore leaves `liked` and `disliked` empty, and the preference
channel score becomes degenerate — every job scores 0 and the ranking is decided by tie-break. That
column will be reported as **NOT PRODUCED** and excluded from the verdict. Reading it as a loss
would penalise the architecture for a capability it never claimed, and reading its NDCG at all would
be reading the tie-break order.

---

## 4. A product coupling worth deciding deliberately

Volume ratio 1.000 for `shared` and for isolated Experience is partly a property of **pre-sorted
evidence**: the benchmark hands the agent four labelled sections, one work per sentence. The
full-context inflation to 1.736 happens precisely when that sorting is removed.

So evidence isolation depends on knowing which text is experience and which is aspiration. In
production that routing is either free or expensive depending on a **product** decision:

- **Structured onboarding** — separate fields for history, likes/dislikes, and goals. Routing is
  free, and isolation eliminates 42.4% contamination for nothing.
- **Single blob** — a pasted résumé or one free-text answer. Routing must be computed, by a
  heuristic that can misroute or by another model call that adds a step to the critical path. A
  routing error is unrecoverable: the Experience Agent never sees text that was routed away.

The corrected full-context arm is worth its 12 calls precisely because it **prices the single-blob
option**. That is its stated information value, not symmetry.

---

## 5. Cost, verified rather than asserted

The prediction that unchanged Experience calls should be cache hits is correct, and the dry run
proves it by hashing every request:

| item | count | cost |
| --- | --- | --- |
| job blueprints | 288 / 288 hits | $0 |
| `shared` baseline | 12 / 12 hits | $0 |
| `split-full-context` / experience | **12 / 12 hits** | **$0** |
| `split-isolated` / experience | **12 / 12 hits** | **$0** |
| Direction v2, both variants | 24 fresh | **$2.739 worst case** |

**24 calls, not 48.** The dry run now reports cache status per agent per variant, and a miss on an
unchanged Experience call is a hard stop condition rather than a cost to absorb.

Diagnosing that stop condition found a real defect on the way: the experiment and the audit each
carried their own copy of the cache-path builder, and they had already diverged. There is now one
implementation in `providerRegistry`, and the four v1 cache files were migrated to the versioned
naming with `git mv` — same keys, new filename, nothing regenerated. The v1 provenance audit still
reproduces byte-identically after the migration, which is the check that matters, because that audit
is the evidence this whole redesign rests on.

The v1 Direction prompt, schema and evidence routing are **retained as frozen audit-only
definitions**. Prompt version participates in the cache key, so deleting them would have made 24
paid interpretations unreadable and the motivating measurement unreproducible — the exact failure
that lost the Anthropic arm.

Budget: **$10.40 of $25 spent**, $14.60 remaining. This screen is 18.8% of remaining.

---

## 6. Preregistered hypotheses

Frozen before the run. Three separate hypotheses; they are not required to move together.

**H1 — Experience (confirmatory).** An evidence-isolated Experience Agent preserves Experience
retrieval relative to `shared` while eliminating experience-channel evidence contamination and
volume inflation. *Already supported by the free audit; this run re-confirms it under the corrected
Direction configuration.*

**H2 — Direction (the real test).** A correctly channel-scoped Direction Agent, shown only
aspiration evidence, preserves or improves Direction retrieval relative to `shared` without
absorbing Preference items. Predicted: desired volume ratio near 1.000 (down from 2.750) and
`PREFERENCE_LIKE` contamination near 0.000 (down from 0.629).

**H3 — Separation.** The dedicated channel architecture reduces unsupported cross-channel claims
and volume inflation without material retrieval regression.

**Failure conditions, stated in advance.** If Direction retrieval is worse with a CI excluding zero,
the dedicated Direction Agent loses and that is the finding. If intervals span zero, INCONCLUSIVE.
No prompt tuning after seeing results; no dropped variant; no channel substitution. If it loses
again, stop and diagnose rather than iterate on the prompt.

## 7. Standing limitations, unchanged

- **No divergence subgroup.** Every person has an identical channel profile, desired work always
  overlaps performed on 2–3 of 5 roles, and disliked work is identical to performed work for all 12
  people. **Nothing from this run speaks to users making dramatic career transitions.**
- Identity-collision contamination measures frame collision, not provenance. Both are reported.
- Provenance attribution is phrase containment with an ambiguity margin, needed because the corpus
  deliberately plants liked work overlapping performed work. It is a lower bound.
- n=12, one family, one model, one effort setting. Zero human validity.
- `shared` provenance is unmeasurable, so the contamination comparison is between the two split
  arms and an architecture that cannot be audited — not between three measured architectures.

## 8. What is not being touched

Frozen corpus, hidden truth, renderers, matcher, Experience Agent prompt, job interpretations,
lexical baselines, oracle controls, scoring, bootstrap procedure. VALIDATION unused. LOCKED not
inspected.
