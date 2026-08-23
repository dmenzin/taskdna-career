# ONT-01 — Ontology review protocol

Zero-call human review of the **authored work ontology**, not of TaskDNA recommendations
and not of real-user outcomes. This is **not** `H-01`.

**Status:** protocol only. No review has been run. `ONT-01` must complete before any
`M-01` design decision that assumes the five-field identity is correct.

Do not inspect VALIDATION or LOCKED person instances as review materials.

---

## 1. What is under review

| Object | Source | Question |
| --- | --- | --- |
| Five identity roles | `docs/BENCHMARK_FAMILIES_PREREGISTRATION.md` § 1; `IDENTITY_ROLES` | Are action, object, purpose, method, and domain the right factorization of “same work”? |
| Identity equality | `frameIdentity()` | Is same-work iff five ids match the right rule? Too strict? Too loose? |
| Incidental exclusion | instrument, output | Is excluding them from identity scientifically right, or hiding real work distinctions? |
| Relevance semantics | `src/bench/labels.ts` / `frameLabels.ts` | Is graded relevance-as-coverage the right label, given `GRADE_THRESHOLDS` and `INCIDENTAL_LABEL_WEIGHT = 0.25`? |
| Trap distinctions | declared `trapPartner` pairs in `semanticFrame.ts` | Would a competent reviewer agree each pair changes the work, not just the label? |

Reviewers see **role definitions, the equality rule, the grading policy, and a
stratified sample of trap *concept pairs*** (ids + surface forms from generator
source). They do not see model outputs, DEVELOPMENT failure cases, or VALIDATION
people.

---

## 2. Reviewer independence

- At least **two** reviewers. Neither may be the prompt author of an executed
  CareerBlueprint / specialist prompt, nor the primary author of a DEVELOPMENT
  experiment write-up that used those prompts.
- Prefer at least one reviewer who did not author `semantic-frame.v2` lexicon
  strings or templates.
- Model assistance in writing this protocol does **not** count as a review.
- A model is **not** a reviewer. Do not use a model as adjudicator.

---

## 3. Materials they may see

**Allowed**

- The five-role definitions and the identity-equality rule, in writing.
- The coverage / grade policy (`GRADE_THRESHOLDS`, `INCIDENTAL_LABEL_WEIGHT`) as
  label-design choices, not as scores.
- A stratified sample of trap pairs drawn from **generator source**
  (`CONCEPTS` with `trapPartner`), at least one pair per identity role that has
  traps, presented as “Concept A vs Concept B, same role.”
- A small set of **constructed** frame pairs (not corpus people) illustrating
  one-role perturbations vs trap swaps vs identical identity.

**Forbidden**

- Model interpretations, NDCGs, or DEVELOPMENT failure lists.
- VALIDATION or LOCKED person/job instances.
- Hidden planted identities of frozen DEVELOPMENT people used in paid screens
  (those 12 are already prompt-training examples).
- Instructions of the form “the benchmark needs you to agree these are different.”

---

## 4. Disagreement capture

Each item is scored independently before discussion:

| Code | Meaning |
| --- | --- |
| `AGREE` | The distinction / rule changes the work in the way claimed |
| `DISAGREE` | It does not, or it is a word game |
| `UNSURE` | A competent reviewer cannot decide from the materials |

Record per-item: reviewer id, code, one-sentence reason. Do not collapse to a
mean. The deliverable is the disagreement table, not a single κ dressed up as
validity.

---

## 5. Adjudication

1. Items both reviewers `AGREE` → provisionally accepted for ontology use.
2. Any `DISAGREE` → item is **not** accepted. Either revise the ontology in a
   **new versioned** truth model (do not mutate `semantic-frame.v2` in place) or
   drop that trap / rule from claims.
3. `UNSURE` + `AGREE` → treat as unresolved; cannot ground an M-01 assumption.
4. Adjudication is a written decision with names. It is not a third model call.

---

## 6. Exit criteria

`ONT-01` is `SUPPORTED` only if all hold:

- Two independent human reviews exist on disk.
- Every identity role and the equality rule were reviewed.
- The stratified trap sample was reviewed (minimum: every declared trap pair
  class, not necessarily every lexical variant).
- Relevance-as-coverage was explicitly accepted or rejected as a label policy.
- No `DISAGREE` remains on a rule that later M-01 design will assume.
- The write-up does **not** claim real-user recommendation validity (`H-01`).

Otherwise `INCONCLUSIVE` or `REJECTED`. M-01 design that needs the ontology
stays blocked.

---

## 7. What this does not authorize

- Mutating current hidden truth, freeze, or lexicon.
- Running S-01 or any paid model call.
- Rendering MIXED_EVIDENCE.
- Treating agreement on synthetic trap pairs as product ontology proof for
  real careers. That remains `H-01`.
