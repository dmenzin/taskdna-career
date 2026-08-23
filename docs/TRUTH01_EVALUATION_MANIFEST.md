# TRUTH-01 — Truth / evaluation manifest (spec only)

Zero-call tracked item. **This pass does not create the manifest and does not
mutate current truth.** It defines what a future manifest must hash and version
so evaluation-defining objects cannot drift silently.

Hidden planted identities must **never** be written into model input. The
current observed-input freeze (`config/frame-corpus-freeze.json`) remains the
surface-text lock. TRUTH-01 is a *separate* lock over the answer key and the
grader.

Do not build VALIDATION or LOCKED corpora to populate this spec.

---

## 1. Why a second freeze exists

`frame-corpus-freeze.json` hashes **observed inputs** and deliberately excludes
planted identity. That prevents “change the sentences after scoring.” It does
**not** pin:

- hidden frames / identities
- label implementation
- grade thresholds
- incidental weight
- archetype specifications

Those can still move while the surface hashes stay green. TRUTH-01 closes that
gap without revealing identities to the interpreter.

---

## 2. Required manifest fields

A future `config/truth-evaluation-manifest.json` (name may vary; one file) must
record versioned hashes of:

| Object | Live source today | Notes |
| --- | --- | --- |
| Corpus version | `FRAME_CORPUS_VERSION` = `frame-corpus.v1` | |
| Frame / ontology version | `SEMANTIC_FRAME_VERSION` = `semantic-frame.v2` | |
| Generator seed | `FRAME_BENCH_SEED` = `20260823` | |
| Split vocabulary map | `SPLIT_VOCABULARY` | core vs held-out vs locked |
| Person-planter rule | `buildPerson` channel counts and overlap rules | 6/7/2/4 is a rule, not a draw |
| Job-archetype specification | `FRAME_JOB_ARCHETYPES` + construction in `buildJobsFor` | including distractor count |
| Hidden planted truth | per-split, per-family identity sets | **hash only**; never plaintext in git if that would leak into prompts. A custodian may hold the preimage |
| Label implementation / version | `BENCH_LABEL_VERSION`, `src/bench/labels.ts`, `src/bench/frameLabels.ts` | same grade policy on both substrates |
| `GRADE_THRESHOLDS` | `{ g3: 0.6, g2: 0.35, g1: 0.12 }` | evaluation-defining constant |
| `INCIDENTAL_LABEL_WEIGHT` | `0.25` | evaluation-defining constant |
| NDCG cutoff | `@10` as used in agent screens | must be named with the candidate-set size |
| Candidate-set rule | person-specific pool vs shared universe | today: person-specific, ~24 jobs |

Changing any hashed object without a new manifest version invalidates every
architecture result that cited the previous version.

---

## 3. What the hash must not do

- Must not appear in any prompt render.
- Must not require opening VALIDATION or LOCKED instances in this pass.
- Must not rewrite planted frames to make an architecture look better.
- Must not replace the observed-input freeze; both locks are required.

---

## 4. Current constants (recorded, not newly chosen)

These are the live evaluation-defining numbers as of this amendment. Recording
them here is not a retune.

```
BENCH_LABEL_VERSION        = bench-labels.v1
GRADE_THRESHOLDS           = { g3: 0.6, g2: 0.35, g1: 0.12 }
INCIDENTAL_LABEL_WEIGHT    = 0.25
FRAME_BENCH_SEED           = 20260823
FRAME_CORPUS_VERSION       = frame-corpus.v1
SEMANTIC_FRAME_VERSION     = semantic-frame.v2
agent-screen NDCG          = NDCG@10 over a person-specific pool of ~24 jobs
```

---

## 5. Exit criterion

`TRUTH-01` is `SUPPORTED` when the manifest file exists, is machine-checked
against the live constants, hashes hidden truth without putting identities in
the prompt path, and a test fails if any listed constant moves without a
version bump.

This pass ends at the spec.
