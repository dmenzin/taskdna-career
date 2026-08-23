# Result: split agents lose to the shared CareerBlueprint — and the reason is my prompt, not the architecture

**Verdict: REVERT.** Neither split variant is adopted.

**But the hypothesis is not refuted — it is untested.** The Direction Agent I wrote collapsed two
channels that the shared blueprint keeps apart, which is sufficient on its own to explain the
entire direction loss. This screen tested my implementation of the split, not the idea of it.

- Experiment: `split-agents:openai:LEXICAL_TRAP:low`, `split-agents.v1`
- 48 fresh calls, **$1.62 actual** (plus $0.66 sunk on a truncated first attempt, §5)
- Matcher held fixed at `agent-field-match`; frozen corpus, hidden truth, scoring and statistics
  all unchanged
- Artifact: `artifacts/agent_experiments/split-agents-openai-lexical_trap-n12.json`

---

## 1. Contamination first, as preregistered

| architecture | direction→experience | experience→direction | disliked→liked | empty channels |
| --- | --- | --- | --- | --- |
| `shared` | **0.000** | **0.000** | 0.000 | 0 |
| `split-full-context` | 0.008 | 0.000 | 0.000 | 0 |
| `split-isolated` | 0.014 | 0.008 | 0.000 | 0 |

The split arms contaminate **more**, not less — the opposite of the hypothesis. Note especially
that `split-isolated`, which cannot copy across channels because it never sees the other channel's
evidence, has the **highest** measured contamination.

That is not literal copying, and calling it contamination would be overreading the detector. The
metric counts an entry as contaminated when it matches a planted frame of the wrong channel on all
five identity roles. Because desired and performed work in this corpus overlap on 2–3 of 5 roles by
construction, an interpretation that drifts slightly can land on a wrong-channel frame without any
evidence having crossed. **The detector measures frame-identity collision, not provenance**, and
that distinction needs to be in the report every time it is used.

All rates are lower bounds: a contamination whose wording the concept lexicon does not contain is
invisible to a word-overlap matcher.

## 2. The detector missed the biggest failure, and channel volume caught it

Entry counts per person, against planted truth of 6 performed / 7 liked / 2 disliked / 4 desired:

| architecture | experience | liked | disliked | desired |
| --- | --- | --- | --- | --- |
| planted | 6 | 7 | 2 | 4 |
| `shared` | **6.0** | **7.0** | **2.0** | **4.0** |
| `split-full-context` | **10.4** | 10.8 | 2.0 | 10.8 |
| `split-isolated` | **6.0** | 11.0 | 2.0 | 11.0 |

Two failures are visible here that the contamination rates almost entirely missed.

**Failure mode A — the Direction Agent collapsed LIKED into DESIRED.** `split-isolated` emitted
**exactly 11.0** wanted entries, which is exactly `7 liked + 4 desired`. The arithmetic is not a
coincidence: my Direction Agent prompt says *"WANTED covers stated goals, aspirations, work they
enjoy and want more of, and transitions"* — and "work they enjoy" **is the preference channel**.
The shared prompt keeps LIKES and WANTS NEXT as separate output fields; my agent merged them into
one list. The direction channel is scored from `desired`, so it received 11 entries where 4 belong,
diluted with 7 preference entries.

That alone accounts for the direction collapse. **I violated the four-channel separation rule in
the prompt of the agent whose entire purpose was to protect it.**

**Failure mode B — full context made the Experience Agent over-generate by 73%.** Given all four
evidence sections, it emitted 10.4 performed entries against 6 planted, pulling liked, wanted and
disliked work into `performed`. `split-isolated`, which was shown only experience evidence, emitted
**exactly 6.0**.

So evidence isolation *worked* for the experience channel — the one thing in this screen that
supports the original hypothesis. And the strict contamination detector rated that 73% inflation
at **0.008**, essentially clean. Volume inflation and identity collision are different failures,
and a detector that only sees the second will clear an architecture that is badly wrong in the
first. `channelVolumes` was added after this run for that reason; no verdict here rests on it, and
the preregistered NDCG bootstrap below is what decides.

## 3. Retrieval

NDCG@10, LEXICAL_TRAP, n=12 DEVELOPMENT, matcher fixed at `agent-field-match`:

| architecture | experience | preference | direction |
| --- | --- | --- | --- |
| `experience-lexical` (reference) | 0.622 | 0.444 | 0.594 |
| **`shared`** | **0.745** | **0.632** | **0.732** |
| `split-full-context` | 0.653 | 0.596 | 0.457 |
| `split-isolated` | 0.729 | 0.535 | 0.447 |
| *`oracle-normalizer` (control)* | *0.822* | *0.654* | *0.951* |

Paired bootstrap over persons, against `shared`:

| arm | channel | Δ | 95% CI | verdict |
| --- | --- | --- | --- | --- |
| `split-full-context` | experience | -0.092 | [-0.188, 0.002] | INCONCLUSIVE |
| `split-full-context` | preference | -0.035 | [-0.097, 0.014] | INCONCLUSIVE |
| `split-full-context` | direction | **-0.274** | [-0.435, -0.129] | **WORSE** |
| `split-isolated` | experience | -0.016 | [-0.092, 0.050] | INCONCLUSIVE |
| `split-isolated` | preference | **-0.097** | [-0.166, -0.027] | **WORSE** |
| `split-isolated` | direction | **-0.284** | [-0.443, -0.141] | **WORSE** |

Consistent with §2: `split-isolated` is statistically indistinguishable from `shared` on
**experience** (Δ=-0.016), which is the channel where its evidence isolation produced exactly the
right volume. Both variants lose decisively on **direction**, which is the channel the collapsed
prompt destroyed.

## 4. User-facing latency

Fresh calls only. Cache hits are reported separately at p50 **0.0 ms** over 300 calls — the reason
distributions must never pool the two populations.

| agent | n | mean | p50 | p90 | p95 | max |
| --- | --- | --- | --- | --- | --- | --- |
| `experience-agent` | 24 | 13,561 ms | 12,313 ms | 19,479 ms | 24,976 ms | 27,699 ms |
| `direction-agent` | 24 | 13,611 ms | 13,089 ms | 16,788 ms | 16,826 ms | 16,946 ms |

At n=24 these are just above the stability threshold, but p90/p95 remain coarse.

Critical path — evidence submitted to first usable recommendations. Job interpretation is
**excluded**: JobBlueprints are precomputed per job and amortised across every user, so no user
waits for them. Deterministic assembly, retrieval and ranking measured at **15.7 ms per person**,
which is negligible against the model calls.

| architecture | agents | sequential p50 | sequential p95 | parallel p50* | parallel p95* | TTFR p50 | TTFR p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shared` | 1 | 10.8 s | 12.0 s | 10.8 s | 12.0 s | **10.8 s** | **12.0 s** |
| `split-full-context` | 2 | 25.4 s | 41.8 s | 13.1 s | 25.0 s | **13.1 s** | **25.0 s** |
| `split-isolated` | 2 | 25.4 s | 41.8 s | 13.1 s | 25.0 s | **13.1 s** | **25.0 s** |

\* Derived from calls timed one at a time, so they exclude the contention a concurrent
implementation adds. Lower bound on parallel wait, not an observation.

**The naive-implementation gap is the headline here.** Run sequentially, the split architecture
makes a user wait **25.4 s at p50 and 41.8 s at p95** — an unusable product. Run concurrently it
costs only **+2.3 s at p50** over shared. Anyone shipping a multi-agent person-understanding step
must issue the independent agents concurrently; summing them is a 2.4x latency penalty for nothing.

### Multi-objective verdict

| arm | Δ direction NDCG | added p50 wait | outcome |
| --- | --- | --- | --- |
| `split-full-context` | -0.274 | +2.3 s | **dominated** — worse quality AND slower |
| `split-isolated` | -0.284 | +2.3 s | **dominated** — worse quality AND slower |

Both arms are worse on every axis, so there is no exchange rate to price. No blended
quality-per-second score is needed or offered.

## 5. The truncation guard earned its place

The first attempt ran the split agents at the shared blueprint's 1,800-token allowance and
**aborted on person 9** with `OpenAiTruncationError`: 982 reasoning tokens spent, leaving too
little for the answer. Without that guard the call would have returned empty JSON and been scored
as an architecture that understood nothing — a silent, plausible, completely wrong result.

Measured across the 16 calls that completed at 1,800, the Experience Agent's output ran
829/1,361/1,619 (min/median/max) against the shared blueprint's 886 total, because it emits
ownership, depth and evidence per work item. Reasoning alone varied 261 to 982 — nearly fourfold at
a *fixed* effort setting, which is why an allowance sized from a single probe is not safe.

The allowance was raised to 3,600 for the split agents only, keeping `shared` at 1,800 so its 12
paid interpretations stayed valid. That is a ceiling, not a budget: it cannot flatter the split arms
on quality, and it changes only the worst-case reservation. **$0.66 was sunk** on the truncated
attempt — its 16 interpretations are cache-invalid at the new allowance and are not reused.

## 6. Standing limitations

- **The hypothesis is untested, not refuted.** Failure mode A is a defect in my Direction Agent
  prompt, not a property of dedicated agents. A corrected agent that emits `wanted` and `liked`
  as separate channels is a legitimate next experiment — as a **new** preregistration, not a
  rescue of this one.
- **No divergence subgroup exists in this corpus.** Every person has an identical channel profile,
  desired work always overlaps performed on 2–3 of 5 roles, and disliked work is identical to
  performed work for all 12 people. Nothing here speaks to people making dramatic career
  transitions.
- **n=12, one family, one model, one effort setting.**
- **Strict recall is at the floor and does not discriminate**: 0.000 for `shared` against 0.069 and
  0.028 for the split arms, while `shared` wins retrieval outright. A 5-of-5 role match is too
  demanding to separate these architectures and should not be read as an accuracy ordering.
- **Contamination rates measure frame-identity collision, not provenance** (§1).
- **Zero human validity.** Planted-truth recovery on synthetic people throughout.

## 7. What happens next, and what does not

**Not proceeding to the SEMANTIC_BRIDGE confirmation.** It was preregistered as conditional on
`split-full-context` beating `shared`. It did not, so the confirmation is not run.

**Not tweaking the Direction Agent prompt and re-running in this experiment.** The failure mode is
reported first, as agreed.

Budget after this screen: **$10.40 of $25 spent**, $14.60 remaining under the hard dollar ceiling;
717 calls made against the 1,000-call observability threshold, which is not a stop condition.

The strongest candidate for the next preregistration, on the evidence: a **corrected Direction
Agent** that keeps `liked` and `desired` separate, paired with **isolated evidence for the
Experience Agent**, since isolation was the one thing here that demonstrably worked — exact 6.0
experience volume against full-context's inflated 10.4. That is a single conceptual change with a
measured motivation, and it reuses every JobBlueprint at zero cost.
