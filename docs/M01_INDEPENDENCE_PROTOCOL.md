# M-01 independence / blinding protocol

Protocol only. **Do not render the MIXED_EVIDENCE corpus. Do not implement M-01.**

This exists so the next realistic-evidence family is not another round of
prompt authors inspecting every case and retuning. It is a contract-change
prerequisite (amendment C), not a license to build.

`ONT-01` must complete before any M-01 design decision that assumes the
five-field ontology is correct.

---

## 1. Roles

| Role | Who | May see |
| --- | --- | --- |
| **Renderer author** | Preferred: a human who did not write executed CareerBlueprint / specialist prompts. Independent authorship over Claude-assisted authorship where feasible | Latent-truth *specification* below. Not current prompt outputs, not DEVELOPMENT failure cases, unless a documented exception in § 4 applies |
| **Prompt author** | Anyone who has edited an executed person/job/specialist prompt | DEVELOPMENT mechanism results already on disk. **Not** every new M-01 instance after render |
| **Custodian** | Holds the M-01 render freeze and the case-inspection budget | Full rendered family after it exists. Releases inspection slices, not the whole set, to prompt authors |
| **Grader** | Deterministic `frameLabels` / planted identity | Hidden frames. Never model input |

Model assistance used while authoring the renderer must be recorded (model,
date, what it drafted). Prefer none.

---

## 2. Latent-truth specification the renderer author may see

**Allowed**

- The five identity roles and the equality rule (post-`ONT-01` accepted form).
- Channel definitions: performed / liked / disliked / desired / qualifications
  as *hidden* labels, not as section headers to emit.
- That stance must be recoverable by a human reader *without* giveaway carriers
  such as “What I liked most” or “What I want to move into next.”
- Planting constraints that M-02 will later vary (the current 6/7/2/4 skeleton
  is a known limitation; the renderer must not depend on those counts).
- That person and job sides still share no source string.
- That titles/industries remain orthogonal if that family is reused.

**Forbidden unless § 4 exception**

- Cached model outputs, NDCG tables, Direction-v1/v2 failure write-ups.
- The current executed prompt text.
- Per-person DEVELOPMENT hidden frames from the n=12 paid screens.
- VALIDATION or LOCKED instances.
- Instructions that name the current prompt’s section labels as the target
  surface form.

The renderer author is told **what must be true in the hidden labels**, not
**how the current model failed to recover them**.

---

## 3. After a corpus exists (future; not this pass)

- Freeze observed inputs the same way `frame-corpus-freeze.json` does,
  *plus* a TRUTH-01 evaluation manifest (hidden-truth hashes, not plaintext
  identities in the prompt path).
- Prompt authors get a **preregistered inspection budget**: a small DEVELOPMENT
  slice declared before first look. Further cases are not available for
  iterative prompt edits.
- Tuning against the remainder, or against VALIDATION, is a contract violation.
- JobBlueprints, if used, are per-job and globally cached — but M-01 as
  currently conceived still does not demonstrate shared-universe retrieval
  (`MKT-01`).

---

## 4. Exception rule

The renderer author may see a DEVELOPMENT failure class **only if** all hold:

1. The exception is written down before the material is shown.
2. The material is a *class* (e.g. “stance is explicit in a carrier prefix”),
   not a list of person ids or quoted model outputs from those people.
3. A custodian, not the prompt author, decides the exception.
4. The exception is recorded in the renderer’s authorship log.

“I want the renderer to be hard” is not an exception.

---

## 5. Authorship log (required before any render)

The renderer commit must record:

- Human author(s)
- Whether a model drafted templates or lexicon, and which model
- That this protocol was followed
- Any § 4 exception
- That `ONT-01` had reached an accepted ontology form, or that the renderer
  is explicitly ontology-agnostic and does not assume the five fields

Until that log exists, do not render.

---

## 6. What this pass does **not** do

- Does not create MIXED_EVIDENCE text.
- Does not change `semantic-frame.v2` or `frame-corpus.v1`.
- Does not spend model calls.
- Does not inspect VALIDATION or LOCKED.
