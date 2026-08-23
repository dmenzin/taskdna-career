<!-- GENERATED FILE. Do not edit by hand. -->
<!-- Source: config/agentic-research-program.json + config/experiment-registry.json -->
<!-- Regenerate: pnpm research:program -->

# Agentic research program

Authoritative backlog of every unresolved question in the agent-first program. This file is the source of truth; docs/AGENTIC_RESEARCH_PROGRAM.md is a generated projection of it. Validated by tests/research-program.test.ts so a forgotten question becomes a failing test rather than an oversight.

**Findings and their reasoning live in docs/AGENTIC_ARCHITECTURE_FORENSIC_AUDIT.md. This file records only status, dependency and next action.**

---

## Open questions by stage

### S1 — Semantic architecture

**Exit criterion.** One DEVELOPMENT architecture has acceptable semantic quality, channel integrity and claim-level auditability, with no clearly superior unresolved architecture immediately adjacent.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `P-01` | **SUPPORTED** | Can the strongest one-call baseline gain claim-level auditability without specialist inference? | — | Treat shared+provenance as a provisional research incumbent, not a settled baseline. Do not ship. Do not equate the P-01 CIs spanning zero with equivalence or non-inferiority. The amended S-01 design must characterize generation variance before architecture freeze. | 12 | $0.93 |
| `D-01` | **INCONCLUSIVE** | Does a correctly-scoped Direction Agent beat the shared blueprint on Direction, or only tie it? | P-01, S-01 | P-01 Case A weakens always-on specialists. Do not rerun Direction because it is interesting. Remaining questions are S-01 architecture-decision stability (not sign-majority) and whether the extra call beats shared+provenance. Prefer A-03 (selective rescue) over always-on if S-01 holds. | 320 | $4.00 |
| `CT-01` | **UNTESTED** | Do the five non-implications no v1 prompt states change interpretation quality when added? | P-01 | Define semantic-contract v2 with the full rule set plus contrastive examples, as a new prompt version. Never edit a v1 prompt. | 12 | $0.45 |
| `R-01` | **SUPPORTED** | Which of the five semantic role fields carry independent signal, and is the matcher robust to paraphrase? | — | Do not retune the matcher. A later versioned matcher experiment may drop or reweight purpose; that is not P-01. | 0 | $0.00 |
| `N-01` | **DEFERRED** | Should the interrupted NATURAL arm be completed? | — | Do not resume. Revisit only if a regression check on ordinary cases becomes decision-relevant and is newly preregistered. The existing 47 cached calls stay on disk. | 253 | $3.00 |

### S2 — Inference stability

**Exit criterion.** The architectural decision and the principal quality conclusions survive exact-repeat fresh generations AND semantically equivalent prompt variation, and every KEEP/REJECT threshold has a documented sensitivity range.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `T-01` | **SUPPORTED** | Are the provenance attribution thresholds (0.6 floor, 0.1 ambiguity margin) defensible? | P-01 | No further sweep. Revisit only if a later architecture produces non-zero contamination near the ceiling. | 0 | $0.00 |
| `S-01` | **PREREGISTERED** | How much variation is introduced by repeated inference under identical semantic input, and can that variation change TaskDNA's representation, recommendations, or architecture decisions? | P-01 | Dry-run the amended design. Paid execution is not authorized in this session. Do not replay the P-01 cache as trial 0. Do not contaminate S-01 with paraphrases (that is S-02). | 48 | $3.73 |
| `S-02` | **UNTESTED** | Does semantically equivalent evidence phrasing cause materially different TaskDNA understanding? | S-01 | After S-01, preregister controlled perturbations that preserve hidden truth: bullet vs prose, reorder, paraphrase, mild typos, first- vs third-person, inserted neutral sentences. No perturbation may change planted truth. | 48 | $3.70 |
| `S-03` | **UNTESTED** | Do later provider/model/alias moves change TaskDNA understanding on a fixed regression panel? | S-01 | Define a tiny fixed panel and rerun it when the resolved model id changes. Do not interpret future behaviour changes as architecture changes when the model may have moved. | 12 | $0.90 |
| `POW-01` | **UNTESTED** | For each planned architecture comparison, what sample size would materially answer the question? | — | Estimate paired effect size and variance from DEVELOPMENT before declaring future effects inconclusive forever. Do not silently enlarge a frozen split; unused frozen subjects must keep their designated split, otherwise create a new versioned generation. | 0 | $0.00 |

### S3 — Semantic construct coverage

**Exit criterion.** Every product-required construct (E/P/Q/D, uncertainty, contradictions) has defined truth, a defined metric, and a measured implementation.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `Q-01` | **BLOCKED** | Can an agent extract held qualifications well enough to reproduce the planted meets-requirements/stretch partition? | M-01 | Wait for QC-01 (contract) and M-01 (visible evidence). Do not copy the Experience representation and call it Qualification. | 12 | $0.45 |
| `U-01` | **UNTESTED** | Can the representation say 'I do not have enough evidence' instead of inventing a conclusion, and is that signal calibrated? | P-01 | Define the construct before implementing. Candidates: explicit INSUFFICIENT_EVIDENCE, claim-level evidence strength, repeated-generation agreement as an external proxy. | 12 | $0.45 |
| `C-01` | **DEFERRED** | How should conflicting evidence and user corrections be reconciled? | P-01, U-01 | Define source precedence and versioning. Prefer deterministic reconciliation; reserve model adjudication for genuinely ambiguous semantics. | 0 | $0.00 |
| `X-01` | **UNTESTED** | Are explanations faithful to the evidence and match factors that actually produced the ranking? | P-01 | Build deterministic explanation validation after S-01. Do not generate persuasive prose disconnected from the scoring path. | 0 | $0.00 |
| `QC-01` | **UNTESTED** | What does Qualification mean, as a product contract, before any Qualification prompt is written? | P-01 | Write QUALIFICATION_CONTRACT distinguishing capabilities, credentials, experience-depth, education, hard vs preferred requirements, transferable evidence, unknown/missing evidence, and gaps. Design PersonQualification and JobRequirement together. Preserve hidden experimental domain metadata (industry / work-function / specialty, possibly per evidence item) so later D-CTX work can test conditioning without feeding those labels to the baseline interpreter. Distinguish that metadata from StructuredWork.domain. No prompt yet. | 0 | $0.00 |
| `D-CTX-04` | **BLOCKED** | Does Qualification benefit from domain context more than Experience does? | QC-01, Q-01, D-CTX-01 | Only after QC-01, a measured Q implementation (Q-01), and D-CTX-01. Evaluate domain conditioning independently for Q vs the rest of the blueprint. Do not domain-specialize the whole CareerBlueprint by default. | 24 | $1.80 |

### S4 — Generalisation

**Exit criterion.** The frozen architecture passes predefined VALIDATION criteria with no tuning on VALIDATION. Runs once per frozen architecture.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `V-01` | **BLOCKED** | Does the frozen architecture generalise to paraphrase families it never saw? | P-01, S-01, T-01 | Blocked by the architecture-freeze gate. S-01 is the remaining unmet condition of the three named dependencies. | 300 | $4.00 |

### S5 — Product-realistic evidence

**Exit criterion.** The architecture works without synthetic pre-routing of evidence and survives realistic ambiguity and contradiction.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `M-01` | **DEFERRED** | Can TaskDNA untangle a messy person, rather than interpret evidence that was already routed for it? | P-01 | Requires explicit approval: a new benchmark family is a contract change under amendment C. Same hidden truth, new independent messy-narrative renderer, no channel labels. Store domain-routing metadata as hidden experimental fields (industry / work-function / specialty, multi-label, per person and per evidence item where truth supports it). Do not pass that metadata to the baseline interpreter unless a preregistered D-CTX arm enables it. Behind S-01 on information value. | 300 | $4.00 |
| `M-02` | **BLOCKED** | Does the architecture hold for career states the current corpus does not contain? | M-01 | New versioned corpus with its own preregistration. Do not mutate the frozen corpus. Include multi-domain people (finance+analytics, healthcare+operations, legal+technology, etc.) and domain-transition cases where historical domain ≠ desired domain. These are first-class, not leftover cells. | 300 | $4.00 |
| `J-01` | **UNTESTED** | Does JobBlueprint interpretation survive real, noisy job descriptions? | — | Assemble a noisy job-description set. Keep interpretation per job and globally cached; never per user-job pair. Person-side and job-side domain context are separate later questions (D-CTX-J-01); do not assume they need the same machinery. JobBlueprints are globally precomputable, so richer job-side domain interpretation has a different cost/latency tradeoff. | 100 | $1.50 |
| `M-03` | **BLOCKED** | Does the architecture hold on conversational NATURAL_USER renderings of the same latent truth? | M-01 | New independently versioned family after M-01. Do not promote MIXED_EVIDENCE results into claims about conversational input. | 300 | $4.00 |
| `M-04` | **BLOCKED** | Can TaskDNA reconcile multi-source user evidence that contains planted contradictions? | M-03, C-01 | New versioned family combining resume bullets, narrative, explicit preferences, goals, and correction messages. Potential contradictions planted on purpose. | 300 | $4.00 |
| `TM-01` | **UNTESTED** | Can product-specific transfer quality — including historical-domain anchoring — be measured separately from paraphrase recovery? | — | Define the transfer-metric contract before the next realistic benchmark freeze, including named failure mode DOMAIN_ANCHORING. Do not invent a blended TaskDNA Quality number. | 0 | $0.00 |
| `D-CTX-01` | **BLOCKED** | If the semantic interpreter receives correct oracle domain context, does interpretation improve, and how much does wrong-domain or historically-salient context harm cross-domain transfer? | P-01, S-01, S-02 | Do not execute now. After S-01 and S-02, preregister four frozen arms: A universal/no-context, B correct oracle pack, C plausible wrong-domain, D multi-domain oracle. Smallest useful versioned packs only (vocabulary, objects, methods, credentials, a few contrastive examples). No recommendation restrictions, occupational priors, E/P/Q/D redefinitions, hidden truth, or target-job hints. Domain context must not mechanically reach the matcher. If perfect domain knowledge does not help, do not build a router. Distinguish structured-benchmark effect from later MIXED_EVIDENCE effect. | 48 | $3.70 |
| `D-CTX-02` | **BLOCKED** | Which contextual abstraction — industry, work-function, hybrid, or technical specialty — and which routing unit — person, evidence-source, evidence-item, or soft internal inference — improves interpretation without narrowing transferable meaning? | D-CTX-01 | Only if D-CTX-01 shows oracle benefit. Compare no context vs oracle industry vs oracle work-function vs industry+function vs multi-label combinations. Keep model and matcher frozen. Conceptually record whether context was applied at whole-person, evidence-source, or evidence-item level; do not skip to a learned router. | 36 | $2.80 |
| `D-CTX-03` | **BLOCKED** | Can a cheap multi-label domain router preserve oracle-domain benefits without destroying career-transition cases? | D-CTX-01, D-CTX-02 | Only if D-CTX-01 oracle arm helps. Build the cheapest adequate router. Evaluate router-level precision/recall/top-k/calibration/abstention AND end-to-end semantic recovery, E/P/Q/D, NDCG, cross-domain transfer, false discoveries, recommendation stability, latency, and cost. Never use hidden domain truth in the learned-router arm. | 24 | $1.80 |
| `D-CTX-05` | **BLOCKED** | Which router-error and fallback behavior minimizes catastrophic wrong-domain distortion once a cheap router exists? | D-CTX-03 | Only after D-CTX-03. Compare hard top-1, top-k packs, confidence threshold, universal fallback, and weighted context blending. Do not implement now. | 24 | $1.80 |
| `D-CTX-J-01` | **BLOCKED** | Does domain context improve JobBlueprint interpretation of credentials, jargon, methods, objects, and regulations — separately from person-side conditioning? | J-01, D-CTX-01 | Only after J-01 and a demonstrated person-side oracle benefit (D-CTX-01). Evaluate job-side context independently. Do not assume a win on people transfers to jobs. | 100 | $1.50 |
| `D-CTX-P` | **BLOCKED** | Do domain-specific prompt instructions add value beyond a universal semantic contract plus a small versioned context pack? | D-CTX-01, D-CTX-02 | Only if universal + modular context demonstrates value and then plateaus. Preregister against that baseline. Do not write giant domain prompts now. | 36 | $2.80 |
| `D-CTX-FT` | **BLOCKED** | Does a domain-adapted or fine-tuned model add incremental value over universal, universal+context, and domain-prompt variants? | D-CTX-P, D-CTX-05 | Do not implement. Revisit only if every listed precondition is true and cheaper stages have plateaued. | 0 | $0.00 |
| `D-META-01` | **UNTESTED** | Can future benchmarks store industry, work-function, and specialty labels as hidden experimental metadata without leaking them into the baseline interpreter or conflating them with StructuredWork.domain? | — | Write the metadata contract (label types, multiplicity, confidence/ambiguity, provenance of the label, hidden-by-default input rule) as zero-call design work. Do not feed labels to person-blueprint@v2. Do not execute domain experiments. | 0 | $0.00 |

### S6 — Human validity

**Exit criterion.** Real users show acceptable claim correctness, omission and error rates, correction burden, provenance fidelity and recommendation usefulness.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `H-01` | **BLOCKED** | Do real people agree with TaskDNA's representation of their own work? | V-01, M-01, PRIV-01 | Design the review program after PRIV-01. Corrections held out under a custodian, never folded into a tuning set. Do not use model-generated labels as human truth. | 0 | $0.00 |
| `H-02` | **BLOCKED** | Can human correction events become future held-out evaluation data without leaking into the tuning set? | H-01 | Define the correction event schema and the held-out rule before the first human study writes a correction. Do not train on every correction and then evaluate on the same distribution. | 0 | $0.00 |

### S7 — Research-to-product integration

**Exit criterion.** A validated semantic architecture runs in the product path with defined persistence, migration, fallback, latency UX, cost, privacy and security.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `L-01` | **BLOCKED** | What is the real user wait when independent calls are actually issued concurrently under provider contention? | D-01 | Only meaningful if a multi-call architecture wins. Needs genuine concurrency, >=100 subjects, repeated across times of day. | 200 | $6.00 |
| `SEC-01` | **UNTESTED** | Does the architecture separate system instructions from untrusted external data? | — | Required before ingesting any real content. Explicit data/instruction separation; treat all extracted text as data; never let ingested text reach a tool-calling path. | 24 | $0.90 |
| `I-01` | **BLOCKED** | How does a validated semantic architecture replace the deterministic product path? | V-01, H-01 | Do not merge research code into the product because DEVELOPMENT metrics look good. Requires persistence, migration, fallback, latency UX, cost, privacy and shadow testing. | 0 | $0.00 |
| `PRIV-01` | **UNTESTED** | Are consent, retention, deletion, cache, logging, and provider-exposure rules defined before any real career history is persisted? | — | Write the privacy/security foundation: consent, retention, deletion, data minimization, access boundaries, cache policy, logging policy, model-provider exposure, secrets, user export/correction. Required before H-01. | 0 | $0.00 |

### S8 — Agentic expansion

**Exit criterion.** Each genuinely agentic workflow individually demonstrates value over a simpler deterministic or single-call alternative.

| id | status | question | depends on | next action | calls | cost |
| --- | --- | --- | --- | --- | --- | --- |
| `A-01` | **DEFERRED** | Does career-landscape discovery need a genuinely exploratory agent? | I-01 | Do not implement until the core representation and retrieval foundation are stable. Selective retrieval of domain knowledge after the interpreter notices an ambiguity is a later agentic alternative (see domainProgram), not a reason to build tools now. Static/oracle context (D-CTX-01) must show value first. | 0 | $0.00 |
| `A-02` | **DEFERRED** | Does outreach and opportunity pursuit warrant agentic planning? | A-01, SEC-01 | Requires reliable semantic user state, explicit user approval boundaries and narrow tool permissions first. | 0 | $0.00 |
| `A-03` | **UNTESTED** | Is selective specialist rescue better than always-on specialist inference? | P-01, D-01 | Define triggers: ambiguous channel assignment, contradictory evidence, low evidence support, unstable repeated inference. | 60 | $2.00 |

---

## Item detail

### `P-01` — Can the strongest one-call baseline gain claim-level auditability without specialist inference?

- **Status:** SUPPORTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Case A for auditability/provenance, not proven retrieval equivalence. LEXICAL_TRAP n=12, OpenAI gpt-5.6-sol low. person-blueprint@v2 vs v1 under frozen field-match: experience Δ −0.019 CI [−0.097, 0.054]; preference +0.014 [−0.043, 0.083]; direction −0.062 [−0.172, 0.043]. No statistically detectable retrieval regression was observed; equivalence/non-inferiority has NOT been established. Provenance contamination 0.000 on experience/liked/disliked/desired (72/84/24/48 claims). Volume ratio 1.000 all channels. Actual $0.546 / 12 fresh calls. T-01 KEEP set stable across 25 threshold pairs. Working research baseline is shared+provenance+field-match pending S-01. Not shipped.
- **Next action:** Treat shared+provenance as a provisional research incumbent, not a settled baseline. Do not ship. Do not equate the P-01 CIs spanning zero with equivalence or non-inferiority. The amended S-01 design must characterize generation variance before architecture freeze.
- **Success criterion:** Retrieval holds (CI spans zero or better) AND provenance contamination <= 0.05.
- **Cost if run:** 12 calls, ~$0.93
- **Latency relevance:** Small expected increase in output tokens; measure per-call.

### `T-01` — Are the provenance attribution thresholds (0.6 floor, 0.1 ambiguity margin) defensible?

- **Status:** SUPPORTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** 25 pairs (floor 0.40–0.80 × margin 0.05–0.20) over the P-01 quotes. Default KEEP set (all four channels true) did not flip. Contamination stayed 0.000. Thresholds remain research parameters, not a product gate, and were not selected post-hoc.
- **Next action:** No further sweep. Revisit only if a later architecture produces non-zero contamination near the ceiling.
- **Success criterion:** The KEEP/REJECT verdict is unchanged across a documented threshold range.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None.

### `S-01` — How much variation is introduced by repeated inference under identical semantic input, and can that variation change TaskDNA's representation, recommendations, or architecture decisions?

- **Status:** PREREGISTERED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** P-01 is one generation. Direction Δ −0.062 CI [−0.172, 0.043] is compatible with a meaningful regression or a small improvement. The first S-01 draft used sign-majority as the decision rule and was superseded before spend. Amended preregistration: stochastic-stability:openai:LEXICAL_TRAP:low:amended. 12 people × 4 trials; trialId in cache identity only; v1 is one frozen historical realization. Non-inferiority margins remain unresolved rather than invented. Distinct from S-02.
- **Next action:** Dry-run the amended design. Paid execution is not authorized in this session. Do not replay the P-01 cache as trial 0. Do not contaminate S-01 with paraphrases (that is S-02).
- **Success criterion:** Do not compress S-01 into one PASS/FAIL. Produce REPRESENTATION_STABILITY, RANKING_STABILITY, PROVENANCE_STABILITY, and ARCHITECTURE_DECISION_STABILITY, each SUPPORTED / CONCERN / INCONCLUSIVE. Sign counts may be descriptive only. Recommendation churn is 1 - |TopK_A ∩ TopK_B| / K with K=10. Non-inferiority remains unresolved unless a later, separately justified margin is preregistered.
- **Cost if run:** 48 calls, ~$3.73
- **Latency relevance:** Yields latency variance, currently unknown.

### `D-01` — Does a correctly-scoped Direction Agent beat the shared blueprint on Direction, or only tie it?

- **Status:** INCONCLUSIVE · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`, `S-01`
- **Evidence so far:** v2 isolated Direction 0.806 vs shared 0.732, paired delta +0.074 CI [-0.066, 0.198]. Provenance contamination 0.000 and desired volume ratio 1.000, both corrected from v1.
- **Next action:** P-01 Case A weakens always-on specialists. Do not rerun Direction because it is interesting. Remaining questions are S-01 architecture-decision stability (not sign-majority) and whether the extra call beats shared+provenance. Prefer A-03 (selective rescue) over always-on if S-01 holds.
- **Success criterion:** Direction paired delta CI excludes zero.
- **Cost if run:** 320 calls, ~$4.00
- **Latency relevance:** Doubles onboarding calls; requires real concurrent measurement before shipping.

### `CT-01` — Do the five non-implications no v1 prompt states change interpretation quality when added?

- **Status:** UNTESTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** semanticContract.ts records that liked->desired, and all four Qualification rules, are unstated in every v1 prompt. The liked->desired gap is the measured cause of the v1 Direction collapse.
- **Next action:** Define semantic-contract v2 with the full rule set plus contrastive examples, as a new prompt version. Never edit a v1 prompt.
- **Success criterion:** No channel regresses and at least one contamination measure improves.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** Longer prompt; measure input-token and latency delta.

### `R-01` — Which of the five semantic role fields carry independent signal, and is the matcher robust to paraphrase?

- **Status:** SUPPORTED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Leave-one-out on the frozen LEXICAL_TRAP OpenAI caches (n=12, 12/12 person and 288/288 job hits). Full field-match experience NDCG@10 0.745. Deltas: action -0.068, object -0.059, method -0.028, domain -0.016, purpose -0.000. Purpose is redundant on this family. Diagnostic only: agent-field-match stays on all five fields for P-01.
- **Next action:** Do not retune the matcher. A later versioned matcher experiment may drop or reweight purpose; that is not P-01.
- **Success criterion:** Per-field contribution quantified; any redundant field identified.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None; deterministic.

### `Q-01` — Can an agent extract held qualifications well enough to reproduce the planted meets-requirements/stretch partition?

- **Status:** BLOCKED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `M-01`
- **Evidence so far:** Truth side already exists: frameLabels computes qualificationFeasibility and hardGaps. Blocked because the five planted qualifications per person appear only in the narrative field, which no architecture reads. Per RECOMMENDATION_POLICY this is a partition, never a fourth similarity channel. Contract design is QC-01 and can start before M-01; evaluation cannot.
- **Next action:** Wait for QC-01 (contract) and M-01 (visible evidence). Do not copy the Experience representation and call it Qualification.
- **Success criterion:** Partition agreement against planted truth, with E/P/D scores byte-identical.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** One extra field on an existing call, or one extra call. Measure.

### `U-01` — Can the representation say 'I do not have enough evidence' instead of inventing a conclusion, and is that signal calibrated?

- **Status:** UNTESTED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** No uncertainty or confidence construct exists anywhere in the schema. Model self-reported confidence must not be assumed calibrated.
- **Next action:** Define the construct before implementing. Candidates: explicit INSUFFICIENT_EVIDENCE, claim-level evidence strength, repeated-generation agreement as an external proxy.
- **Success criterion:** Abstention correlates with actual error; calibration measured before any confidence is shown to a user.
- **Cost if run:** 12 calls, ~$0.45
- **Latency relevance:** Minor.

### `C-01` — How should conflicting evidence and user corrections be reconciled?

- **Status:** DEFERRED · **Stage:** S3 · **Split:** future MIXED_EVIDENCE
- **Depends on:** `P-01`, `U-01`
- **Evidence so far:** No contradiction handling exists. The corpus contains no contradictory evidence to test against.
- **Next action:** Define source precedence and versioning. Prefer deterministic reconciliation; reserve model adjudication for genuinely ambiguous semantics.
- **Success criterion:** A user correction reliably outranks a stale inference while history and provenance are preserved.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Affects refresh path, not first result.

### `V-01` — Does the frozen architecture generalise to paraphrase families it never saw?

- **Status:** BLOCKED · **Stage:** S4 · **Split:** VALIDATION
- **Depends on:** `P-01`, `S-01`, `T-01`
- **Evidence so far:** VALIDATION has never been used by any agent arm; all four ledger experiment ids are DEVELOPMENT. Elsewhere in this codebase extraction macro F1 drops 0.831 to 0.611 across the boundary. P-01 and T-01 now pass; S-01 does not.
- **Next action:** Blocked by the architecture-freeze gate. S-01 is the remaining unmet condition of the three named dependencies.
- **Success criterion:** Predefined criteria pass with no tuning on VALIDATION.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** None beyond what DEVELOPMENT already measured.

### `M-01` — Can TaskDNA untangle a messy person, rather than interpret evidence that was already routed for it?

- **Status:** DEFERRED · **Stage:** S5 · **Split:** new MIXED_EVIDENCE family
- **Depends on:** `P-01`
- **Evidence so far:** The frozen corpus supplies evidence pre-partitioned into three arrays with explicit LIKE/DISLIKE stance and giveaway prefixes such as 'What I liked most:'. Removing the partition inflated full-context Experience volume to 1.736 immediately. Scientifically unblocked by P-01 Case A; still a contract change. Structured-benchmark domain effects and mixed-evidence domain effects are different claims; M-01 is required only for the latter.
- **Next action:** Requires explicit approval: a new benchmark family is a contract change under amendment C. Same hidden truth, new independent messy-narrative renderer, no channel labels. Store domain-routing metadata as hidden experimental fields (industry / work-function / specialty, multi-label, per person and per evidence item where truth supports it). Do not pass that metadata to the baseline interpreter unless a preregistered D-CTX arm enables it. Behind S-01 on information value.
- **Success criterion:** Channel-assignment accuracy against planted truth, plus retrieval per channel.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** May require a routing step, which would add to the critical path.

### `M-02` — Does the architecture hold for career states the current corpus does not contain?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new corpus version
- **Depends on:** `M-01`
- **Evidence so far:** Measured from planted truth: every person has an identical 6/7/2/4 channel profile; desired-vs-performed role overlap is always 2 or 3 of 5; disliked-vs-performed is always exactly 5. No low-experience/high-direction group and no contrast group for direction aversion exist.
- **Next action:** New versioned corpus with its own preregistration. Do not mutate the frozen corpus. Include multi-domain people (finance+analytics, healthcare+operations, legal+technology, etc.) and domain-transition cases where historical domain ≠ desired domain. These are first-class, not leftover cells.
- **Success criterion:** Performance holds across pivots, returners, generalists, qualification/desire mismatches, multi-domain histories, and historical-to-desired domain transitions.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** None.

### `X-01` — Are explanations faithful to the evidence and match factors that actually produced the ranking?

- **Status:** UNTESTED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`
- **Evidence so far:** No explanation generation exists in the agent path. P-01 now supplies claim-level quotes, so most of this is deterministically checkable rather than requiring a model judge.
- **Next action:** Build deterministic explanation validation after S-01. Do not generate persuasive prose disconnected from the scoring path.
- **Success criterion:** Explanation claims trace to evidence the scoring used; zero hallucinated rationale.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Explanation is post-ranking; affects complete-result time, not first result.

### `L-01` — What is the real user wait when independent calls are actually issued concurrently under provider contention?

- **Status:** BLOCKED · **Stage:** S7 · **Split:** DEVELOPMENT
- **Depends on:** `D-01`
- **Evidence so far:** All parallel figures are derived from individually-timed calls and are optimistically biased lower bounds. Measured: shared 10.8s p50 / 12.0s p95. n=24 puts p95 at the second-largest observation.
- **Next action:** Only meaningful if a multi-call architecture wins. Needs genuine concurrency, >=100 subjects, repeated across times of day.
- **Success criterion:** Measured p95 user wait under real concurrency meets a product threshold.
- **Cost if run:** 200 calls, ~$6.00
- **Latency relevance:** This item IS the latency question.

### `J-01` — Does JobBlueprint interpretation survive real, noisy job descriptions?

- **Status:** UNTESTED · **Stage:** S5 · **Split:** new job set
- **Depends on:** nothing
- **Evidence so far:** Job interpretation works on synthetic renderings. Untested against marketing fluff, duplicated or missing responsibilities, contradictory requirements, title mismatch, jargon, or injected text.
- **Next action:** Assemble a noisy job-description set. Keep interpretation per job and globally cached; never per user-job pair. Person-side and job-side domain context are separate later questions (D-CTX-J-01); do not assume they need the same machinery. JobBlueprints are globally precomputable, so richer job-side domain interpretation has a different cost/latency tradeoff.
- **Success criterion:** Structured work recovery holds on noisy input; no injected instruction changes behaviour.
- **Cost if run:** 100 calls, ~$1.50
- **Latency relevance:** Precomputed; not user wait.

### `SEC-01` — Does the architecture separate system instructions from untrusted external data?

- **Status:** UNTESTED · **Stage:** S7 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Evidence is concatenated directly into the prompt with no delimiting or instruction hierarchy. Structured output constrains response shape but not model behaviour. Blast radius is currently small because there are no tools and no external actions.
- **Next action:** Required before ingesting any real content. Explicit data/instruction separation; treat all extracted text as data; never let ingested text reach a tool-calling path.
- **Success criterion:** A planted injection in a resume or job description does not alter extraction behaviour.
- **Cost if run:** 24 calls, ~$0.90
- **Latency relevance:** None.

### `H-01` — Do real people agree with TaskDNA's representation of their own work?

- **Status:** BLOCKED · **Stage:** S6 · **Split:** real users
- **Depends on:** `V-01`, `M-01`, `PRIV-01`
- **Evidence so far:** Zero human validity. Everything is planted-truth recovery on synthetic people.
- **Next action:** Design the review program after PRIV-01. Corrections held out under a custodian, never folded into a tuning set. Do not use model-generated labels as human truth.
- **Success criterion:** Claim correctness, omission and error rates, and correction burden meet preregistered thresholds.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Perceived latency becomes measurable here.

### `I-01` — How does a validated semantic architecture replace the deterministic product path?

- **Status:** BLOCKED · **Stage:** S7 · **Split:** n/a
- **Depends on:** `V-01`, `H-01`
- **Evidence so far:** The product runs no model call at all. src/app imports @/domain/engine; nothing under src/app, src/v3 or src/domain imports any agent module. The gap between research and product is total.
- **Next action:** Do not merge research code into the product because DEVELOPMENT metrics look good. Requires persistence, migration, fallback, latency UX, cost, privacy and shadow testing.
- **Success criterion:** Shadow-tested parity plus defined SLOs.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Production UX is decided here.

### `A-01` — Does career-landscape discovery need a genuinely exploratory agent?

- **Status:** DEFERRED · **Stage:** S8 · **Split:** n/a
- **Depends on:** `I-01`
- **Evidence so far:** No tool-using or planning agent exists anywhere in the repository. This is the first component whose task might genuinely require iterative decision-making about what to investigate next.
- **Next action:** Do not implement until the core representation and retrieval foundation are stable. Selective retrieval of domain knowledge after the interpreter notices an ambiguity is a later agentic alternative (see domainProgram), not a reason to build tools now. Static/oracle context (D-CTX-01) must show value first.
- **Success criterion:** Beats a deterministic or single-call alternative on discovery quality.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Exploratory loops are latency-expensive by nature.

### `A-02` — Does outreach and opportunity pursuit warrant agentic planning?

- **Status:** DEFERRED · **Stage:** S8 · **Split:** n/a
- **Depends on:** `A-01`, `SEC-01`
- **Evidence so far:** Networking logic exists as deterministic legacy code and is out of scope for the core matching loop.
- **Next action:** Requires reliable semantic user state, explicit user approval boundaries and narrow tool permissions first.
- **Success criterion:** Beats a deterministic plan on user-accepted actions.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Asynchronous; not on the first-result path.

### `A-03` — Is selective specialist rescue better than always-on specialist inference?

- **Status:** UNTESTED · **Stage:** S8 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`, `D-01`
- **Evidence so far:** Always-on specialists are 0 for 2 on measured wins. A trigger-based hybrid has never been tried.
- **Next action:** Define triggers: ambiguous channel assignment, contradictory evidence, low evidence support, unstable repeated inference.
- **Success criterion:** AGENT_RESCUE_RECALL improves without raising AGENT_ONLY_FALSE_DISCOVERY_RATE, at a fraction of always-on cost.
- **Cost if run:** 60 calls, ~$2.00
- **Latency relevance:** Only the rescued minority pays the extra call.

### `N-01` — Should the interrupted NATURAL arm be completed?

- **Status:** DEFERRED · **Stage:** S1 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Stopped at 12/12 person and 35/288 job interpretations, all committed. NATURAL is the family where lexical matching already performs well and headroom is smallest (+0.173 to the normaliser control). Partial cache existence is not authorization to finish the arm.
- **Next action:** Do not resume. Revisit only if a regression check on ordinary cases becomes decision-relevant and is newly preregistered. The existing 47 cached calls stay on disk.
- **Success criterion:** n/a - a completeness question, not a hypothesis.
- **Cost if run:** 253 calls, ~$3.00
- **Latency relevance:** None.

### `S-02` — Does semantically equivalent evidence phrasing cause materially different TaskDNA understanding?

- **Status:** UNTESTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** `S-01`
- **Evidence so far:** Unmeasured. S-01 keeps prompt/input bytes identical; this item is the distinct robustness question. Real users will not phrase work like the benchmark renderer.
- **Next action:** After S-01, preregister controlled perturbations that preserve hidden truth: bullet vs prose, reorder, paraphrase, mild typos, first- vs third-person, inserted neutral sentences. No perturbation may change planted truth.
- **Success criterion:** Representation invariance and ranking stability hold under truth-preserving perturbations; channel assignment does not flip.
- **Cost if run:** 48 calls, ~$3.70
- **Latency relevance:** None directly; informs whether onboarding copy sensitivity is a product risk.

### `S-03` — Do later provider/model/alias moves change TaskDNA understanding on a fixed regression panel?

- **Status:** UNTESTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** `S-01`
- **Evidence so far:** gpt-5.6-sol is a moving alias with no dated snapshot. Requested and resolved model ids are already recorded per call. No periodic regression panel exists.
- **Next action:** Define a tiny fixed panel and rerun it when the resolved model id changes. Do not interpret future behaviour changes as architecture changes when the model may have moved.
- **Success criterion:** A documented panel, recorded requested/resolved model, and a rule that alias drift is a threat-to-validity, not an architecture result.
- **Cost if run:** 12 calls, ~$0.90
- **Latency relevance:** None.

### `POW-01` — For each planned architecture comparison, what sample size would materially answer the question?

- **Status:** UNTESTED · **Stage:** S2 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** The program has repeatedly met wide intervals at n=12 (Direction v2 +0.074 CI [-0.066, 0.198]). Inconclusive has been treated as a stopping rule rather than as a power problem.
- **Next action:** Estimate paired effect size and variance from DEVELOPMENT before declaring future effects inconclusive forever. Do not silently enlarge a frozen split; unused frozen subjects must keep their designated split, otherwise create a new versioned generation.
- **Success criterion:** Each planned comparison has an expected interval width or power calculation written down before spend.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None.

### `QC-01` — What does Qualification mean, as a product contract, before any Qualification prompt is written?

- **Status:** UNTESTED · **Stage:** S3 · **Split:** n/a
- **Depends on:** `P-01`
- **Evidence so far:** No QUALIFICATION_CONTRACT exists. Q-01 cannot be evaluated until evidence is visible (M-01), but the ontology must be designed first so person-Q and job-Q are compatible. Qualification is not Experience with another name. Domain-conditioned Q is a later candidate (D-CTX-04), not part of this contract's implementation.
- **Next action:** Write QUALIFICATION_CONTRACT distinguishing capabilities, credentials, experience-depth, education, hard vs preferred requirements, transferable evidence, unknown/missing evidence, and gaps. Design PersonQualification and JobRequirement together. Preserve hidden experimental domain metadata (industry / work-function / specialty, possibly per evidence item) so later D-CTX work can test conditioning without feeding those labels to the baseline interpreter. Distinguish that metadata from StructuredWork.domain. No prompt yet.
- **Success criterion:** A committed contract that the deterministic compatibility layer can use to tell nice-to-have from legally/operationally mandatory, without treating absence of evidence as absence of qualification unless the contract says so.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None; design work.

### `M-03` — Does the architecture hold on conversational NATURAL_USER renderings of the same latent truth?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new NATURAL_USER family
- **Depends on:** `M-01`
- **Evidence so far:** Level 2 of the prompt-realism ladder. M-01 is Level 1 (unlabelled combined narrative). Conversational hedging, corrections, and mixed chronology are untested.
- **Next action:** New independently versioned family after M-01. Do not promote MIXED_EVIDENCE results into claims about conversational input.
- **Success criterion:** Channel assignment and retrieval hold on conversational renderings of the same hidden truth.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** May require more tokens; measure.

### `M-04` — Can TaskDNA reconcile multi-source user evidence that contains planted contradictions?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new MULTI_SOURCE family
- **Depends on:** `M-03`, `C-01`
- **Evidence so far:** Level 3 of the prompt-realism ladder. No multi-source renderer exists. C-01 is the reconciliation contract this family would exercise.
- **Next action:** New versioned family combining resume bullets, narrative, explicit preferences, goals, and correction messages. Potential contradictions planted on purpose.
- **Success criterion:** Explicit recent corrections outrank stale inference; planted contradictions are detected rather than silently averaged.
- **Cost if run:** 300 calls, ~$4.00
- **Latency relevance:** Refresh-path relevant.

### `TM-01` — Can product-specific transfer quality — including historical-domain anchoring — be measured separately from paraphrase recovery?

- **Status:** UNTESTED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** nothing
- **Evidence so far:** Current metrics include surprising-fit and transition recall, but not an explicit suite for cross-title true-fit, cross-industry true-fit, cross-function true-fit, career-transition recall, same-title false-fit, performed-but-unwanted intrusion, desired-but-unqualified recommendations, recommendation-domain diversity where truth supports diversity, or DOMAIN_ANCHORING (ranking shifts back toward the historical industry when underlying work transfers).
- **Next action:** Define the transfer-metric contract before the next realistic benchmark freeze, including named failure mode DOMAIN_ANCHORING. Do not invent a blended TaskDNA Quality number.
- **Success criterion:** Each transfer failure mode, including DOMAIN_ANCHORING, has a named metric and a runnable evaluator or an explicit EXPLORATORY mark.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None.

### `D-CTX-01` — If the semantic interpreter receives correct oracle domain context, does interpretation improve, and how much does wrong-domain or historically-salient context harm cross-domain transfer?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `P-01`, `S-01`, `S-02`
- **Evidence so far:** Unmeasured. Registered now so the hypothesis cannot live only in chat. Domain information is interpretation context, not recommendation eligibility. StructuredWork.domain is a semantic role field (R-01 Δ −0.016 NDCG), not routing metadata. A cheap router is not the first test. Wrong-domain and DOMAIN_ANCHORING negative controls are mandatory. Oracle context measures an upper bound, not deployable product performance. Hidden domain truth must never leak into the no-context arm. Context packs may disambiguate evidence; they cannot become evidence (context-induced unsupported inference is a named failure class). Mixed-evidence domain benefit is a later claim requiring M-01; this item's first screen can use the structured benchmark after stability.
- **Next action:** Do not execute now. After S-01 and S-02, preregister four frozen arms: A universal/no-context, B correct oracle pack, C plausible wrong-domain, D multi-domain oracle. Smallest useful versioned packs only (vocabulary, objects, methods, credentials, a few contrastive examples). No recommendation restrictions, occupational priors, E/P/Q/D redefinitions, hidden truth, or target-job hints. Domain context must not mechanically reach the matcher. If perfect domain knowledge does not help, do not build a router. Distinguish structured-benchmark effect from later MIXED_EVIDENCE effect.
- **Success criterion:** Classify SUPPORTED / REJECTED / INCONCLUSIVE / IMPLEMENTATION FAILURE. Oracle arm must improve semantic recovery without material harm to cross-domain true-fit, transition recall, or DOMAIN_ANCHORING. Wrong-domain arm is mandatory and reported (semantic corruption, provenance mismatch, field drift, ranking damage). One generation is not enough; obey the stability program.
- **Cost if run:** 48 calls, ~$3.70
- **Latency relevance:** Context packs add input tokens; measure.

### `D-CTX-02` — Which contextual abstraction — industry, work-function, hybrid, or technical specialty — and which routing unit — person, evidence-source, evidence-item, or soft internal inference — improves interpretation without narrowing transferable meaning?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `D-CTX-01`
- **Evidence so far:** Unmeasured. Both the taxonomy and the routing unit are hypotheses. A person may simultaneously contain financial work, analytics, operations, program delivery, and people leadership. A hard single-domain label may destroy useful structure. Prefer multi-label / soft representations. Do not freeze NAICS-like industry classification from intuition.
- **Next action:** Only if D-CTX-01 shows oracle benefit. Compare no context vs oracle industry vs oracle work-function vs industry+function vs multi-label combinations. Keep model and matcher frozen. Conceptually record whether context was applied at whole-person, evidence-source, or evidence-item level; do not skip to a learned router.
- **Success criterion:** The winning representation is the one that helps interpretation without gating recommendations to the labelled domain and without forcing multi-domain people into one silo.
- **Cost if run:** 36 calls, ~$2.80
- **Latency relevance:** Minor input-token differences.

### `D-CTX-03` — Can a cheap multi-label domain router preserve oracle-domain benefits without destroying career-transition cases?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `D-CTX-01`, `D-CTX-02`
- **Evidence so far:** No router exists. Building one before oracle benefit is shown is the failure this item exists to prevent. Prefer soft multi-label scores with uncertainty, abstention, general fallback, and unknown/new-domain handling over a hard FINANCE label. Classification accuracy is not sufficient: a 95% accurate router can still be bad if rare errors destroy career-transition cases. The router need not be an agent; deterministic or cheap-classifier options come first.
- **Next action:** Only if D-CTX-01 oracle arm helps. Build the cheapest adequate router. Evaluate router-level precision/recall/top-k/calibration/abstention AND end-to-end semantic recovery, E/P/Q/D, NDCG, cross-domain transfer, false discoveries, recommendation stability, latency, and cost. Never use hidden domain truth in the learned-router arm.
- **Success criterion:** Learned routing preserves enough of the oracle arm's downstream benefit to justify the extra machinery. Low-confidence cases fall back to the universal interpreter. Label accuracy alone cannot KEEP this item.
- **Cost if run:** 24 calls, ~$1.80
- **Latency relevance:** Router is an extra call unless it is a cheap classifier; measure the critical path.

### `D-CTX-04` — Does Qualification benefit from domain context more than Experience does?

- **Status:** BLOCKED · **Stage:** S3 · **Split:** DEVELOPMENT
- **Depends on:** `QC-01`, `Q-01`, `D-CTX-01`
- **Evidence so far:** Unmeasured. Credentials (CPA, RN, bar admission, PE, Series 7, clinical licensure, security clearance, AWS certifications, government eligibility) are where domain expertise is most plausible. Universal E/P/D plus domain-conditioned Q remains an explicit architectural candidate and must stay separate from domain-conditioning the entire CareerBlueprint. This item is Qualification-specific domain conditioning (addendum DCTX-Q-01). Router-error stress testing is D-CTX-05, not this id.
- **Next action:** Only after QC-01, a measured Q implementation (Q-01), and D-CTX-01. Evaluate domain conditioning independently for Q vs the rest of the blueprint. Do not domain-specialize the whole CareerBlueprint by default.
- **Success criterion:** Domain-conditioned Q improves hard-requirement precision/recall without raising false hard-gates or blocking transferable candidates.
- **Cost if run:** 24 calls, ~$1.80
- **Latency relevance:** Possibly one extra Q call or a longer shared call.

### `D-CTX-05` — Which router-error and fallback behavior minimizes catastrophic wrong-domain distortion once a cheap router exists?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `D-CTX-03`
- **Evidence so far:** Unmeasured. This is the addendum's DCTX-04 (router-error stress). Live D-CTX-04 remains Qualification-specific so existing ids are not stolen. Controlled cases: top label wrong, correct domain second, low confidence, two equally plausible domains, multi-domain evidence, historical industry ≠ desired domain.
- **Next action:** Only after D-CTX-03. Compare hard top-1, top-k packs, confidence threshold, universal fallback, and weighted context blending. Do not implement now.
- **Success criterion:** The chosen fallback minimizes wrong-domain semantic corruption, DOMAIN_ANCHORING, and ranking damage relative to oracle and universal controls, including transition cases.
- **Cost if run:** 24 calls, ~$1.80
- **Latency relevance:** Fallback strategy can add router or pack-loading latency; measure.

### `D-CTX-J-01` — Does domain context improve JobBlueprint interpretation of credentials, jargon, methods, objects, and regulations — separately from person-side conditioning?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** new job set
- **Depends on:** `J-01`, `D-CTX-01`
- **Evidence so far:** Unmeasured. Person-side and job-side contextual machinery need not be identical. JobBlueprints are globally precomputable, so a richer job-side pack has a different cost/latency tradeoff than per-user inference.
- **Next action:** Only after J-01 and a demonstrated person-side oracle benefit (D-CTX-01). Evaluate job-side context independently. Do not assume a win on people transfers to jobs.
- **Success criterion:** Job-side oracle context improves structured-work recovery or requirement interpretation without fabricating unsupported job duties and without becoming a retrieval filter on people.
- **Cost if run:** 100 calls, ~$1.50
- **Latency relevance:** Precomputed; not user wait. Measure pack tokens and job-interpretation cost.

### `D-CTX-P` — Do domain-specific prompt instructions add value beyond a universal semantic contract plus a small versioned context pack?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `D-CTX-01`, `D-CTX-02`
- **Evidence so far:** Unmeasured and not to be implemented first. Isolated Finance/Healthcare/Legal/Software/Marketing brains with independent ontologies are explicitly deferred. If domain modules are ever tested, render SYSTEM/UNIVERSAL CONTRACT + DOMAIN MODULE + UNTRUSTED EVIDENCE + OUTPUT SCHEMA. Only contextual knowledge may differ. Deterministic consistency tests must assert identical E/P/Q/D definitions, schema, non-implications, abstention, and no retrieval restrictions.
- **Next action:** Only if universal + modular context demonstrates value and then plateaus. Preregister against that baseline. Do not write giant domain prompts now.
- **Success criterion:** Specialized instructions beat universal+context on semantic recovery without ontology divergence, transfer damage, or DOMAIN_ANCHORING. If not, keep one prompt.
- **Cost if run:** 36 calls, ~$2.80
- **Latency relevance:** Prompt bloat is in scope; measure input tokens, latency, truncation risk.

### `D-CTX-FT` — Does a domain-adapted or fine-tuned model add incremental value over universal, universal+context, and domain-prompt variants?

- **Status:** BLOCKED · **Stage:** S5 · **Split:** DEVELOPMENT
- **Depends on:** `D-CTX-P`, `D-CTX-05`
- **Evidence so far:** Unmeasured. This is the final escalation, not the starting point. Do not fine-tune unless domain conditioning helps, prompt/context specialization has plateaued, independent high-quality train and validation data exist, transfer can still be evaluated, router-error behavior is understood, and maintenance/latency/cost have a production case. Avoid circular validation (one model inventing the context another is scored against).
- **Next action:** Do not implement. Revisit only if every listed precondition is true and cheaper stages have plateaued.
- **Success criterion:** Fine-tuning demonstrates incremental value over simpler variants on semantic recovery without destroying cross-domain transfer or exploding maintenance.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Only relevant if a production case exists; do not assume it does.

### `D-META-01` — Can future benchmarks store industry, work-function, and specialty labels as hidden experimental metadata without leaking them into the baseline interpreter or conflating them with StructuredWork.domain?

- **Status:** UNTESTED · **Stage:** S5 · **Split:** n/a
- **Depends on:** nothing
- **Evidence so far:** No such schema exists. StructuredWork.domain is a semantic description of the work itself (industry/setting). Routing metadata is a different object: it may label a person, an evidence source, or an evidence item, possibly multi-label, and must stay hidden unless an experiment explicitly enables it. Designing this now lets QC-01 and M-01 preserve later D-CTX testability.
- **Next action:** Write the metadata contract (label types, multiplicity, confidence/ambiguity, provenance of the label, hidden-by-default input rule) as zero-call design work. Do not feed labels to person-blueprint@v2. Do not execute domain experiments.
- **Success criterion:** A committed distinction between routing metadata and the semantic domain role field, with a place for hidden labels on future MIXED_EVIDENCE / Qualification datasets.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None; design work.

### `H-02` — Can human correction events become future held-out evaluation data without leaking into the tuning set?

- **Status:** BLOCKED · **Stage:** S6 · **Split:** real users
- **Depends on:** `H-01`
- **Evidence so far:** No correction capture exists. Corrections are valuable only if original inference, evidence, model/version, timestamp, and resulting update are retained under a split.
- **Next action:** Define the correction event schema and the held-out rule before the first human study writes a correction. Do not train on every correction and then evaluate on the same distribution.
- **Success criterion:** A versioned correction log with an explicit evaluation split; no correction used both to tune and to score.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** Refresh path.

### `PRIV-01` — Are consent, retention, deletion, cache, logging, and provider-exposure rules defined before any real career history is persisted?

- **Status:** UNTESTED · **Stage:** S7 · **Split:** n/a
- **Depends on:** nothing
- **Evidence so far:** Synthetic benchmark cache policy (amendment B4) does not automatically apply to humans. Real-user interpretations must never casually enter Git. No product privacy contract exists for the research path.
- **Next action:** Write the privacy/security foundation: consent, retention, deletion, data minimization, access boundaries, cache policy, logging policy, model-provider exposure, secrets, user export/correction. Required before H-01.
- **Success criterion:** A committed policy that forbids committing real-user caches and defines provider exposure before the first consented study.
- **Cost if run:** 0 calls, ~$0.00
- **Latency relevance:** None.

---

## Empirical questions that must remain answerable

These are the questions the program is not allowed to 'finish' without answering. Each is covered by a live item or a historical experiment. Chat is not the memory.

| id | question | covered by |
| --- | --- | --- |
| `EQ-01` | Does semantic model inference beat lexical matching? | `agent-vs-lexical:openai:SEMANTIC_BRIDGE:low`, `agent-vs-lexical:openai:LEXICAL_TRAP:low` |
| `EQ-02` | Does structured field comparison beat token-bag comparison? | `R-01` |
| `EQ-03` | Is the shared person interpreter clean when claim provenance is visible? | `P-01` |
| `EQ-04` | Do specialist agents improve anything enough to justify extra inference? | `D-01`, `A-03` |
| `EQ-05` | Does the same input produce stable understanding across fresh runs? | `S-01` |
| `EQ-06` | Is understanding robust to harmless wording/format changes? | `S-02` |
| `EQ-07` | Can TaskDNA correctly distinguish Experience from Preference? | `CT-01`, `M-01` |
| `EQ-08` | Can it distinguish Preference from Direction? | `D-01`, `CT-01` |
| `EQ-09` | Can it distinguish Qualification from Experience/Direction? | `Q-01`, `QC-01` |
| `EQ-10` | Can it abstain rather than invent? | `U-01` |
| `EQ-11` | Can it reconcile explicit corrections? | `C-01` |
| `EQ-12` | Can it understand an unlabeled messy career narrative? | `M-01` |
| `EQ-13` | Can it handle true career transitions? | `M-02` |
| `EQ-14` | Can it distinguish attractive lexical similarity from actual work similarity? | `R-01`, `agent-vs-lexical:openai:LEXICAL_TRAP:low` |
| `EQ-15` | Can it discover true fits across titles? | `TM-01` |
| `EQ-16` | Can it discover true fits across industries? | `TM-01` |
| `EQ-17` | Can it avoid recommending performed work that the person wants to leave? | `M-01`, `TM-01` |
| `EQ-18` | Can it avoid recommending work the person likes but does not want professionally? | `M-01`, `TM-01` |
| `EQ-19` | Can it identify qualification gaps without over-gating transferable candidates? | `Q-01` |
| `EQ-20` | Does domain context improve understanding? | `D-CTX-01` |
| `EQ-21` | Does wrong-domain context cause dangerous bias? | `D-CTX-01` |
| `EQ-22` | Does a cheap router preserve oracle-domain benefits? | `D-CTX-03` |
| `EQ-23` | Does domain conditioning damage cross-domain transfer? | `D-CTX-01` |
| `EQ-24` | Are JobBlueprints accurate on messy job descriptions? | `J-01` |
| `EQ-25` | Are explanations faithful to the actual match computation? | `X-01` |
| `EQ-26` | Do synthetic gains generalize? | `V-01` |
| `EQ-27` | Do real humans agree with the resulting CareerBlueprint? | `H-01` |
| `EQ-28` | Is performance stable across model updates? | `S-03` |
| `EQ-29` | Is actual product latency acceptable? | `L-01` |
| `EQ-30` | Is actual product cost acceptable? | `I-01` |
| `EQ-31` | Can the architecture safely ingest untrusted external content? | `SEC-01` |
| `EQ-32` | Does any future autonomous agent outperform a simpler workflow enough to justify itself? | `A-01`, `A-02` |
| `EQ-33` | Does Qualification benefit from domain context more than Experience does? | `D-CTX-04` |
| `EQ-34` | Is industry, work-function, hybrid, or specialty the right domain-context abstraction? | `D-CTX-02` |
| `EQ-35` | Should domain routing happen per person, per evidence source, per evidence item, or softly inside one model? | `D-CTX-02` |
| `EQ-36` | Does adding domain context shift rankings back toward the person's historical industry (DOMAIN_ANCHORING)? | `D-CTX-01`, `TM-01` |
| `EQ-37` | Which router-error fallback minimizes catastrophic wrong-domain distortion? | `D-CTX-05` |
| `EQ-38` | Does domain context improve JobBlueprint extraction separately from person-side conditioning? | `D-CTX-J-01` |
| `EQ-39` | Do domain-specific prompts beat a universal contract plus a small context pack? | `D-CTX-P` |
| `EQ-40` | Is fine-tuning a domain model ever justified over simpler conditioning? | `D-CTX-FT` |
| `EQ-41` | Can one universal semantic ontology survive all domains? | `D-CTX-01` |
| `EQ-42` | Does domain context help more on messy mixed evidence than on already-routed structured evidence? | `D-CTX-01`, `M-01` |
| `EQ-43` | Does domain context induce unsupported inferences that the user's evidence does not support? | `D-CTX-01` |
| `EQ-44` | Do multi-domain people benefit from multi-label context, or does it average away structure? | `D-CTX-01`, `M-02` |
| `EQ-45` | Does domain conditioning reproduce conventional career paths on historical-to-desired domain transitions? | `D-CTX-01`, `M-02` |
| `EQ-46` | Can a universal model infer useful domain context internally, making an explicit router unnecessary? | `D-CTX-01` |
| `EQ-47` | Does representation identity vary across generations while rankings stay stable, or the reverse? | `S-01` |
| `EQ-48` | Does requiring provenance preserve enough retrieval quality that the added auditability is worth adopting (non-inferiority)? | `P-01`, `S-01` |

---

## Conflicts with the 2026-08-23 master directive

Where the pasted directive disagreed with disk evidence, the repository won. The disagreement is recorded here so it is not silently smoothed away.

### Qualification sequencing

- **Directive said:** Implement Qualification after P-01 and S-01 as Stage D.
- **Repository evidence:** Planted qualifications appear only in the narrative field, which no current architecture reads. Q-01 evaluation is therefore blocked on M-01, not merely on architecture settlement.
- **Resolution:** Split the work: QC-01 designs the contract after P-01 with zero spend; Q-01 evaluation stays blocked on M-01. Both remain in S3. Do not invent a qualification-evidence renderer that M-01 would immediately replace.

### S-01 dependencies

- **Directive said:** Run S-01 after P-01 so stability is measured on the architecture we actually have.
- **Repository evidence:** S-01 can technically run against person-blueprint@v1. The highest-value stability question after this directive is shared+provenance, not v1.
- **Resolution:** S-01 now depends on P-01. Exact-repeat stochasticity stays S-01; prompt-perturbation robustness is the new S-02.

### NATURAL sunk cost

- **Directive said:** Do not finish NATURAL because of sunk cost.
- **Repository evidence:** N-01 is already DEFERRED with continuationAuthorized: false and 47 cached calls preserved.
- **Resolution:** No change. Partial cache is not authorization. Unique information vs MIXED_EVIDENCE remains unanswered and is not a reason to resume.

### Q-01 blocked on specialists vs mixed evidence

- **Directive said:** Qualification is the next major missing semantic construct after architecture+stability.
- **Repository evidence:** Roadmap E5 already corrected two scoping errors: Q is a partition not a fourth similarity channel, and truth already exists.
- **Resolution:** Keep those corrections. QC-01 writes the contract; Q-01 measures partition agreement; D-CTX-04 tests domain-conditioned Q separately.

### D-CTX-01 dependency on MIXED_EVIDENCE

- **Directive said:** Place domain experiments after provenance, stability, Qualification design, with some domain work potentially alongside the realistic-input benchmark.
- **Repository evidence:** The previous live item depended on M-01. The current structured benchmark already hands the model pre-routed evidence, so a structured D-CTX-01 screen can measure an upper-bound oracle effect after S-01/S-02 without waiting for a new family. Mixed-evidence domain benefit is a different claim.
- **Resolution:** D-CTX-01 now depends on P-01, S-01, and S-02. M-01 remains required before claiming a mixed-input domain effect. Immediate paid priority does not change.

### Addendum DCTX-04 vs live D-CTX-04

- **Directive said:** DCTX-04 is router-error / fallback stress; DCTX-Q-01 is Qualification-specific domain conditioning.
- **Repository evidence:** Live D-CTX-04 was already 'Does Qualification benefit from domain context more than Experience does?' Stealing that id would silently retarget an existing question.
- **Resolution:** Keep D-CTX-04 as Qualification-specific (addendum DCTX-Q-01). Register router-error stress as new D-CTX-05. Record the map in domainProgram.idMap.

### S-01 sign-majority justification

- **Directive said:** Four trials because they allow a 3-to-1 sign majority; success if every architectural sign is identical across trials.
- **Repository evidence:** P-01 Direction Δ −0.062 CI [−0.172, 0.043] is a magnitude-and-uncertainty problem, not a sign-vote problem. Sign voting throws away both. A CI spanning zero is not equivalence.
- **Resolution:** Supersede stochastic-stability:openai:LEXICAL_TRAP:low with :amended before spend. Four trials stay as an economical first repeated-measures screen. Primary endpoints are representation / ranking / provenance / architecture-decision stability. Sign counts are descriptive only. Non-inferiority margins are unresolved rather than invented from the observed P-01 deltas.

---

## Domain-conditioned semantic inference (registered, not executable)

**Status:** REGISTERED_NOT_EXECUTABLE

Can domain-conditioned semantic inference improve TaskDNA's understanding of specialized language, work context, and qualifications without reducing legitimate cross-domain transfer?

**Permanent principle.** Specialized knowledge may inform interpretation; specialized knowledge must not fragment the universal semantic language TaskDNA uses to understand work. Domain context should help TaskDNA understand where someone has been without deciding where they are allowed to go.

**Conditioning vs gating.** Domain conditioning may help the interpreter understand what evidence means (e.g. 'owned the close' as financial close vs deal close). Domain gating restricts which jobs a person may match (classified Finance → only search Finance). Gating would undermine the product's cross-domain-transfer objective. Domain context starts as interpretation context, not recommendation eligibility. Do not use domain classification as a retrieval filter unless a separately preregistered future experiment demonstrates benefit without destroying legitimate transfer.

**Universal ontology.** All domain-conditioned variants must initially emit the same universal TaskDNA representation: Person semantics (Experience, Preference, Qualification, Direction, provenance, uncertainty/abstention) and work-role semantics (action, object, purpose, method, domain). Domain context may improve interpretation of these fields. It must not redefine them.

**Semantic domain field vs routing metadata.** StructuredWork.domain is a semantic role field — the industry or setting of the work. R-01 found it contributed only −0.016 NDCG on LEXICAL_TRAP. Hidden industry / work-function / specialty labels are experimental routing metadata. They are not the same object and must not be conflated.

**Immediate priority.** S-01 remains the next candidate paid experiment. Domain work is not executable because its stability and architecture dependencies are unsatisfied. Interesting is not authorization.

Do not build yet:

- Finance/Healthcare/Legal/Software/Marketing agents or models
- Independent per-domain ontologies, prompts, or matchers
- A learned domain router
- Domain classification as a job-retrieval filter
- Giant domain-specific prompts
- Fine-tuned domain models
- Selective/agentic domain-knowledge retrieval

Escalation ladder:

- D-CTX-01 oracle / none / wrong / multi-domain context
- D-CTX-02 industry vs function vs hybrid taxonomy and routing unit
- D-CTX-03 cheapest adequate multi-label router
- D-CTX-05 router-error and fallback stress
- D-CTX-04 Qualification-specific domain conditioning
- D-CTX-J-01 JobBlueprint domain conditioning
- D-CTX-P domain-specific prompt modules if warranted
- D-CTX-FT fine-tuned domain models only if warranted

Architectures to keep alive as hypotheses, not to anoint:

- raw evidence → universal interpreter + selectively loaded domain knowledge → universal CareerBlueprint → deterministic field matcher → optional domain-aware Q check → cross-domain retrieval
- one powerful universal model needs no explicit router because it infers domain context itself; if this wins, do not build extra machinery
- interpreter notices an ambiguity and retrieves only relevant domain knowledge — more agentic; do not implement until static/oracle context has value

| addendum id | live id | note |
| --- | --- | --- |
| DCTX-01 | `D-CTX-01` | Oracle / none / wrong / multi-domain. Already existed; enriched. |
| DCTX-02 | `D-CTX-02` | Taxonomy ablation plus routing-unit hypothesis. Already existed; enriched. |
| DCTX-03 | `D-CTX-03` | Cheap multi-label router. Already existed; enriched. |
| DCTX-04 | `D-CTX-05` | Addendum DCTX-04 is router-error stress. Live D-CTX-04 was already Qualification-specific, so the new item is D-CTX-05. |
| DCTX-Q-01 | `D-CTX-04` | Qualification-specific domain conditioning. Existing id kept. |
| DCTX-J-01 | `D-CTX-J-01` | Job-side domain context. New. |
| domain prompt modules | `D-CTX-P` | New; blocked until context packs plateau. |
| fine-tuned domain models | `D-CTX-FT` | New; final escalation. |
| domain metadata design | `D-META-01` | New; zero-call design so QC-01/M-01 can preserve later tests. |

---

## Directive stage map (A–K → S1–S8)

The 2026-08-23 master directive used stages A–K. Those letters are a conceptual order, not a second program. This map is the only permitted translation. Do not create Stage A as a live stage id.

| directive stage | live program stage |
| --- | --- |
| A | `S1` |
| B | `S2` |
| C | `S1` |
| D | `S3` |
| E | `S4` |
| F | `S5` |
| G | `S5` |
| H | `S5` |
| I | `S6` |
| J | `S7` |
| K | `S8` |

---

## Experiment ledger

Append-only record of every runtime experiment. A paid experiment must have a record here BEFORE it executes; tests/research-program.test.ts enforces that every experiment id appearing in the budget ledger has one.

**Records are never rewritten to make a later result look cleaner. A superseded design gets a NEW record and the old one is marked with supersededBy. Estimated figures are left as estimated even when actuals differ.**

| experiment | status | family | calls | cost | outcome |
| --- | --- | --- | --- | --- | --- |
| `agent-vs-lexical:anthropic:SEMANTIC_BRIDGE` | **SUPPORTED** | SEMANTIC_BRIDGE | 300 | $3.06 | experience +0.2461 CI [0.1338, 0.3575]; preference +0.2134 CI [0.0324, 0.3671]; direction +0.5585 CI [0.3871, 0.7131]. |
| `openai-effort-calibration:SEMANTIC_BRIDGE` | **SUPPORTED** | SEMANTIC_BRIDGE | 6 | $0.19 | Person output 886 tokens at low, 2027 at medium, 1304 at high. The Anthropic arm's 1200 allowance would have truncated at medium and high. |
| `agent-vs-lexical:openai:SEMANTIC_BRIDGE:low` | **SUPPORTED** | SEMANTIC_BRIDGE | 300 | $3.64 | experience +0.241 CI [0.123, 0.351], within 0.006 of the Claude arm. agent-field-match reaches 0.709 / 0.693 / 0.878. |
| `agent-vs-lexical:openai:LEXICAL_TRAP:low` | **REJECTED** | LEXICAL_TRAP | 300 | $3.58 | The stated hypothesis FAILED: agent-blueprint 0.597 vs 0.622, delta -0.025 CI [-0.128, 0.067], and no channel beat lexical. The same run showed agent-field-match at 0.745, +0.148 CI [0.088, 0.211] over agent-blueprint - a matcher result, recorded separately as R-01. |
| `agent-vs-lexical:openai:NATURAL:low` | **DEFERRED** | NATURAL | 47 | $0.50 | Stopped at 12/12 person and 35/288 job interpretations by operator instruction. All committed. Continuation is NOT authorized; partial cache is not a reason to finish the arm. |
| `split-agents:openai:LEXICAL_TRAP:low:direction-v1` | **REJECTED** _(superseded by `split-agents:openai:LEXICAL_TRAP:low:direction-v2`)_ | LEXICAL_TRAP | 64 | $2.28 | Direction collapsed 0.732 to 0.457 / 0.447, CIs excluding zero. INVALID AS A TEST OF SPECIALISATION: the v1 Direction prompt defined WANTED to include work the person enjoys, and the 'isolated' arm was still shown preference evidence. Two independent defects pointing the same way; provenance confirmed 81/129 and 83/132 desired claims sourced from LIKE evidence. |
| `split-agents:openai:LEXICAL_TRAP:low:direction-v2` | **INCONCLUSIVE** | LEXICAL_TRAP | 24 | $0.36 | Channel integrity fully repaired: provenance contamination 0.629 to 0.000, desired volume 2.750 to 1.000. Retrieval unresolved: isolated direction 0.806 vs shared 0.732, paired +0.074 CI [-0.066, 0.198]. Experience bit-identical from cache, so the ablation is clean. |
| `smoke-test` | **UNTESTED** | n/a | — | — | Operational probe. Not a quality experiment. |
| `person-blueprint-v2:openai:LEXICAL_TRAP:low` | **SUPPORTED** | LEXICAL_TRAP | 12 | $0.55 | SUPPORTED / Case A for auditability/provenance. No statistically detectable retrieval regression: experience Δ −0.019 CI [−0.097, 0.054]. Equivalence/non-inferiority has NOT been established. Provenance contamination 0.000 on all four quote channels (72/84/24/48 claims), volume ratio 1.000. T-01 KEEP set stable across 25 threshold pairs. Direction point estimate −0.062 CI [−0.172, 0.043] is compatible with a meaningful regression or a small improvement. Fresh person p50 14.7s. Not shipped. |
| `stochastic-stability:openai:LEXICAL_TRAP:low` | **SUPERSEDED** _(superseded by `stochastic-stability:openai:LEXICAL_TRAP:low:amended`)_ | LEXICAL_TRAP | — | — | Never executed. Superseded before spend because the first draft used sign-majority as the decision rule and treated a CI spanning zero as retrieval equivalence. Methodological amendment is stochastic-stability:openai:LEXICAL_TRAP:low:amended. |
| `stochastic-stability:openai:LEXICAL_TRAP:low:amended` | **PREREGISTERED** | LEXICAL_TRAP | — | — | Amended and preregistered. Dry-run only. Paid execution not authorized. |

---

## Status vocabulary

Deliberately not binary pass/fail: most of these questions resolve into something other than a verdict.

| status | meaning |
| --- | --- |
| `UNTESTED` | No evidence either way. Not blocked, just not attempted. |
| `PREREGISTERED` | Specification committed to config/experiment-registry.json; not yet executed. |
| `IN_PROGRESS` | Execution started and incomplete. |
| `SUPPORTED` | Evidence supports the hypothesis under the stated conditions. |
| `REJECTED` | Evidence contradicts the hypothesis. |
| `INCONCLUSIVE` | Executed; the interval spans the decision boundary. Neither adopted nor refuted. |
| `BLOCKED` | Cannot proceed until a dependency or an external prerequisite resolves. |
| `DEFERRED` | Deliberately postponed on information value, not blocked. |
| `SUPERSEDED` | Replaced by a later item; retained so history stays legible. |

---

## At a glance

- **40** tracked questions across **8** stages
- Status spread: 17 BLOCKED, 5 DEFERRED, 1 INCONCLUSIVE, 1 PREREGISTERED, 3 SUPPORTED, 13 UNTESTED
- **Runnable now** (untested, no unmet dependency): `J-01`, `SEC-01`, `POW-01`, `TM-01`, `D-META-01`, `PRIV-01`
- **Next paid experiment if authorized:** `S-01`
- Total spend recorded so far: **$14.15** across **1053** calls

