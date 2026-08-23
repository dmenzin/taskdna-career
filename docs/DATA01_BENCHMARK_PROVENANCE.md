# DATA-01 — Benchmark provenance audit

Written 2026-08-23 from `src/bench/semanticFrame.ts`, `src/bench/frameCorpus.ts`, the
preregistration, and the freeze metadata. **Amended the same day** after a second
forensic pass. **Zero paid model calls.** No additional VALIDATION or LOCKED instances
were generated or inspected. Held-out **concept ids** are inventoried from generator
source only — that is how the vocabulary was authored, not a look at VALIDATION people.
Those source definitions are themselves visible in-repo, which is why VALIDATION is a
procedural generator holdout rather than a blinded external holdout.

This is a provenance inventory, not a new corpus and not a fourth research roadmap.

## 0. Verdict in one page

Current agent prompt-development data is **`frame-corpus.v1` on `semantic-frame.v2`**.

It is not real resumes, not real job descriptions, and not O*NET ground truth. An older
O*NET atom corpus and a 450-subject product lab still exist in this repository. They are
**not** what GPT or Claude is being prompted against in the CareerBlueprint experiments.

Every DEVELOPMENT person is drawn from one planter:

- 6 performed
- 3 of those also liked
- 2 other performed also disliked (5/5 role overlap with performed, by construction)
- 2 liked+desired (never performed)
- 2 liked only
- 2 desired only

Net channel counts are therefore **6 / 7 / 2 / 4** for every person. Desired-vs-performed
identity overlap is 2 or 3 of 5 roles. This is a rigid synthetic structure, not twelve
career situations.

Surface language is a handful of hand-authored templates plus a 75-concept invented
lexicon. Preference and direction stance is **stated in the carrier**, not inferred.
Titles and industries are invented pools, assigned orthogonally to work.

Independently validated: disjointness / trap / freeze / title-chance **mechanics**.
Not independently validated: that the five-field ontology, the lexicon, or the planter
represent real careers.

---

## 1. What is, and is not, the current training data

| Asset | Used as CareerBlueprint person/job truth? |
| --- | --- |
| `frame-corpus.v1` + `semantic-frame.v2` | **Yes.** This is the current agent screen |
| O*NET 30.3 / `src/bench/workAtoms.ts` / atom corpus | No. Legacy / reference. The frame substrate replaced shared O*NET sentences because token overlap hit ROC AUC 0.9814 |
| Product lab 450 subjects (`src/lab/onetLab.ts`) | No. Hidden-truth MAE stack. Product UI still uses legacy 17-d Work Fit |
| Older virtual-subject generator | No. Legacy evaluation machinery |
| Real user conversations / resumes | **None** |

There is no fine-tuning dataset and no gradient step. “Training data” here means **the
distribution that shaped every prompt and architecture decision**.

---

## 2. Where every semantic concept came from

File: `src/bench/semanticFrame.ts`. Version: `semantic-frame.v2`.
First authored in `fbf0706` (v1), repaired in `0e98fc0` (v2).
Authorship metadata: `dmenzin` + `Co-Authored-By: Claude Opus 5`.

**75 hand-authored concepts.** No import from O*NET, ESCO, or a resume scrape. Each
concept is an invented id plus several invented surface forms.

| Role | Core (DEVELOPMENT) | Held-out (VALIDATION vocab) | Total |
| --- | --- | --- | --- |
| action | 10 | 5 | 15 |
| object | 10 | 5 | 15 |
| purpose | 7 | 4 | 11 |
| method | 6 | 4 | 10 |
| domain | 6 | 4 | 10 |
| instrument (not in identity) | 4 | 3 | 7 |
| output (not in identity) | 4 | 3 | 7 |
| **total** | **47** | **28** | **75** |

### Core (DEVELOPMENT) ids

- **action:** `act.diagnose`, `act.remediate`, `act.monitor`, `act.reconcile`, `act.audit`, `act.forecast`, `act.triage`, `act.design`, `act.negotiate`, `act.instruct`
- **object:** `obj.equipment_fault`, `obj.software_defect`, `obj.ledger`, `obj.regulatory_filing`, `obj.customer_complaint`, `obj.staffing_level`, `obj.safety_incident`, `obj.supply_shortfall`, `obj.access_request`, `obj.contract_terms`
- **purpose:** `pur.restore_uptime`, `pur.prevent_recurrence`, `pur.satisfy_regulator`, `pur.reduce_cost`, `pur.improve_experience`, `pur.reduce_risk`, `pur.increase_throughput`
- **method:** `met.elimination`, `met.statistical`, `met.interview`, `met.documentation_review`, `met.observation`, `met.experiment`
- **domain:** `dom.manufacturing`, `dom.healthcare`, `dom.financial_services`, `dom.public_sector`, `dom.retail`, `dom.education`
- **instrument:** `ins.sensor_log`, `ins.spreadsheet`, `ins.ticket_system`, `ins.checklist`
- **output:** `out.written_report`, `out.recommendation`, `out.dashboard`, `out.revised_procedure`

### Held-out (VALIDATION vocabulary) ids — generator source only

These ids are listed because they were authored into the lexicon. Listing them is not
an inspection of VALIDATION people.

- **action:** `act.mediate`, `act.consolidate`, `act.provision`, `act.decommission`, `act.benchmark`
- **object:** `obj.patient_pathway`, `obj.energy_usage`, `obj.training_gap`, `obj.data_quality`, `obj.vendor_performance`
- **purpose:** `pur.inform_decision`, `pur.retain_staff`, `pur.enable_growth`, `pur.improve_accuracy`
- **method:** `met.simulation`, `met.peer_review`, `met.root_cause_tree`, `met.benchmarked_comparison`
- **domain:** `dom.logistics`, `dom.energy`, `dom.telecoms`, `dom.hospitality`
- **instrument:** `ins.query_console`, `ins.field_kit`, `ins.survey_form`
- **output:** `out.forecast_model`, `out.training_material`, `out.risk_register`

v1 shipped with **zero** held-out instruments and outputs, so VALIDATION sampling threw.
v2 populated every role. That repair was made from a diagnostic of the generator, before
any agent score, and is the reason a VALIDATION corpus can exist at all.

Independently validated: person/job SEMANTIC_BRIDGE token disjointness, stem-correlation
guard, family coverage, trap symmetry. **Not** validated: that a human rater would accept
these 75 concepts as a complete or correct ontology of work.

---

## 3. Identity definition (the answer key)

Preregistered in `docs/BENCHMARK_FAMILIES_PREREGISTRATION.md`:

| Role | In identity? |
| --- | --- |
| action, object, purpose, method, domain | **yes** |
| instrument, output | no (incidental colour) |

Two frames are the same work iff the five identity ids match. Graded job relevance is
**coverage** of a job’s frames, not partial identity.

This is an authored product ontology. It has not been human-validated. The CareerBlueprint
schema asks the model for the same five fields. Those two claims must stay separate:

1. Given this factorization, can a model map synthetic language into it?
2. Is this factorization how humans should represent work?

(1) is what the current experiments measure. (2) is unknown.

---

## 4. Template authorship

All templates are hand-authored constants in `semanticFrame.ts`. Same Claude-assisted
commit lineage as the lexicon.

**Person experience (4):**

- `I {action} {object} {domain}, {purpose}, mostly by {method}.`
- `A lot of my time went on {action} {object} {domain} — {purpose} — {method}.`
- `{domain}, I {action} {object}. {method} was how I did it, {purpose}.`
- `Most weeks I {action} {object} {domain}. {purpose}, and the way in was {method}.`

**Job responsibilities (4):** parallel professional voice. Person and job template pools
are disjoint so even NATURAL never emits an identical source string.

**LIKE (3):** `The part I genuinely enjoyed was when I {work}.` / `What I liked most: {work}.` / `I always wanted more of the work where I {work}.`

**DISLIKE (3):** `The part I came to dread was when I {work}.` / `What I disliked most: {work}.` / `I would be happy never again to be the one who {work}.`

**Aspiration (3):** `What I want to move into next is work where I {work}.` / `Going forward I am looking for a role where I {work}.` / `The direction I want next: {work}.`

The file states the rule explicitly: **preference stance is stated, never inferred.**
That isolates channel-normalization mechanics. It is not representative of an actual
career conversation, where stance is usually implicit, mixed, or contradictory.

Instrument and output are sampled onto the hidden frame and then **dropped from the
rendered clause** used in preference/aspiration carriers (`personClause` emits action,
object, domain, purpose only). They never appear in the text the model sees.

---

## 5. Qualification pool provenance

`QUALIFICATION_POOL` in `frameCorpus.ts` is 13 invented strings:

`Python`, `SQL`, `Excel`, `statistical analysis`, `technical writing`,
`project coordination`, `root cause analysis`, `bachelor degree`, `master degree`,
`six sigma green belt`, `PMP`, `JavaScript`, `Tableau`, `R`

Five are planted per person. They appear only in `narrative` as `Skills: …`.
**No current interpreter reads `narrative`.** Qualification is therefore not tested.
The planted matcher is exact lowercased string match — a model that writes
“R programming language” would fail even if an interpreter existed.

Not real-world sourced. Not independently validated.

---

## 6. Title and industry provenance

Invented pools, not scraped postings.

**Title families (7 × 4):** analysis, engineering, operations, assurance, delivery,
commercial, people. Example titles: “Insight Analyst”, “Reliability Engineer”,
“People Partner”. Families exist so “same title” / “different title” is definable.
They are **not** aligned to domain concepts.

**Industry pool (12):** medical devices, aerospace, automotive, energy utilities,
financial services, public sector, higher education, logistics, consumer electronics,
pharmaceuticals, telecommunications, industrial manufacturing.

Assigned by independent RNG draws, then balanced so a title-only baseline sits at
chance (first builds were oracles or inverted oracles). That is a real methodological
repair. It also means title/industry in this corpus carry **no career information**,
which real documents do.

---

## 7. Synthetic person construction

`buildPerson` in `src/bench/frameCorpus.ts`. Deterministic. Seed
`FRAME_BENCH_SEED = 20260823`. Person RNG:
`hashSeed("frame-person:${seed}:${split}:${family}:${index}")`.

Planting (every person, every family, every split that uses this function):

```
performed          6 fresh frames
likedFromPerformed 3 of those
disliked           2 other performed frames   (never liked)
likedAndDesired    2 fresh                   (never performed)
likedOnly          2 fresh
desiredOnly        2 fresh
```

So:

- liked = 3 + 2 + 2 = **7**
- desired = 2 + 2 = **4**
- disliked = **2**, and both are performed work on all five identity roles

There is **zero variance** in that channel profile. The split-agent proposal already
audited this on the 12 DEVELOPMENT people. It is not an accident of those 12 draws.
It is the planter.

Desired frames that are also performed do not exist. Desired-only frames can still
share 2–3 identity roles with some performed frame because `sampleFrame` is
object-conditioned and the core vocabulary is small.

`narrative` concatenates title/industry, all evidence sentences, and the skills line.
The architecture ignores it.

---

## 8. Synthetic job construction

17 named archetypes in `FRAME_JOB_ARCHETYPES`. These **are** the known answers: each
name states the planted relationship to its person.

Forced archetypes include obvious experience, strong E+P, partial/weak experience,
cross-title, cross-industry, same-title/different-work, experience-with-dislike,
mixed preference, transition (liked+desired), preference-only, direction-only,
incidental-only, qualification-only, three HARD_NEAR_MISS (one identity role
perturbed), one LEXICAL_TRAP_NEAR_MISS (trap-partner swap), plus `distractors`
(default 6) IRRELEVANT jobs.

Job ids are assigned **after** a shuffle. `eb58f13` records that construction-order
ids made a constant-0 scorer post NDCG@10 0.933 on SEMANTIC_BRIDGE via tie-break.
That defect was repaired before any agent score.

Default freeze size: 48 people. DEVELOPMENT 1,152 jobs / family. VALIDATION 1,104
jobs / family (HARD_NEAR_MISS / trap construction can drop empty specs).

**Evaluation-scope correction.** Paid agent screens typically use 12 people, each
with a **person-specific** pool of about 24 jobs (`buildJobsFor` + 6 distractors).
“288 jobs” is 12 separate tailored pools, not one shared market of 288. NDCG@10
is the top 10 of those ~24 candidates. This benchmark does **not** demonstrate
candidate retrieval from a shared market-scale job universe or global
JobBlueprint amortization (`MKT-01`).

---

## 9. Randomness, seeds, renderer dependence

| Knob | Value |
| --- | --- |
| Corpus seed | `20260823` |
| Frame version | `semantic-frame.v2` |
| Corpus version | `frame-corpus.v1` |
| RNG | mulberry32 + `hashSeed` |
| DEVELOPMENT vocab | `core` only |
| VALIDATION vocab | `held-out` only |
| LOCKED vocab | `core` + `held-out` (deterministically buildable from this repo + seed; not frozen; not run; not a custodied blind artifact — `LOCK-01`) |

Renderer family changes **surface forms only**. Hidden frames are constructed the same
way in NATURAL, SEMANTIC_BRIDGE, and LEXICAL_TRAP. A score difference between families
is a language difference, not a different planted life.

That is a strength for mechanism isolation. It is also why beating SEMANTIC_BRIDGE
does not imply the model can parse a messy resume: the hidden life was still planted
from the same 6/7/2/4 skeleton and the same 47 core concepts.

---

## 10. Freeze state (metadata only)

`config/frame-corpus-freeze.json` — observed inputs only; planted identity excluded.

| Entry | People | Jobs | Frozen |
| --- | --- | --- | --- |
| DEVELOPMENT/NATURAL | 48 | 1,152 | yes |
| DEVELOPMENT/SEMANTIC_BRIDGE | 48 | 1,152 | yes |
| DEVELOPMENT/LEXICAL_TRAP | 48 | 1,152 | yes |
| VALIDATION/NATURAL | 48 | 1,104 | yes (hashes only read here) |
| VALIDATION/SEMANTIC_BRIDGE | 48 | 1,104 | yes (hashes only read here) |
| VALIDATION/LEXICAL_TRAP | 48 | 1,104 | yes (hashes only read here) |
| LOCKED_CONFIRMATION / any | — | — | **`lockedConfirmationFrozen: false`** |

Freeze commit `eb58f13` ran deterministic baselines on 48 DEVELOPMENT people **before**
`6088556` introduced the agent prompts.

---

## 11. What is real-world sourced vs invented vs validated

| Piece | Provenance | Independently validated? |
| --- | --- | --- |
| 75 concepts + surface forms | Invented, Claude-assisted | Mechanical disjointness / coverage only |
| 5-field identity | Invented product ontology | No human study |
| Templates | Invented, stance-explicit | Mechanical “no shared source string” |
| Object-conditioned affinity | Invented, to avoid nonsense prose | Coverage tests only |
| Trap pairs | Invented confusable partners | Surface-overlap > same-identity overlap |
| Title / industry pools | Invented | Title-only / industry-only at chance (n=48) |
| Qualification pool | Invented | Not even supplied to the interpreter |
| Person planter 6/7/2/4 | Invented, fixed | Documented; zero variance |
| Job archetypes | Invented known answers | Existence of grade-1/2/3 and joint E+P sets |
| O*NET atoms | Real occupational task text | **Not used** as current agent truth |
| Real resumes / conversations | Absent | — |

Model assistance during benchmark authoring is real enough to list as a threat
(see `docs/PTA01_PROMPT_BENCHMARK_LINEAGE.md` § 7). The scientific contract still
holds on the narrower claim: answers were not rewritten after the agent scored.

`V-01`, if ever run, answers only: does a **frozen frame-corpus.v1** architecture
generalize to unseen vocabulary and unseen draws **from this same generator**?
That is mechanism validation. It is not eventual architecture confirmation
(`V-02`) and it is not “does TaskDNA work on real people’s messy career
histories?” Do not consume VALIDATION now. If `M-01` / `M-02` can change the
selected architecture, keep final confirmation for after that architecture is
frozen.

VALIDATION is a **procedural generator holdout**: no agent experiment or manual
prompt-tuning review has used its instances, but held-out concept source is
visible in this file’s § 2 and tests already instantiate small VALIDATION
corpora to inspect planted identity. It is not a blinded external holdout.

---

## 12. What “better training data” should mean from here

Do **not** start a fine-tune. There is no weight-training loop, and more of the
current planter would only teach the current planter.

S-01 is **DEFERRED** on information value. It is a valid later stability
question about `person-blueprint@v2` on these same 12 people. It is not the next
action and it is not ahead of M-01. Do not spend $3.73 on it now.

Do **not** peek at VALIDATION instances to “get a better number.” That spends a
procedural generator holdout. It was never a blinded external holdout.

The data work that would actually change what a prompt can be trained on, in
order, all as **new versioned families / protocols**, never by mutating the freeze:

1. **Keep the current observed-input freeze sacred.** Add `TRUTH-01` (separate
   truth/evaluation manifest) without mutating current truth.
2. **`ONT-01`.** Human ontology review. Protocol: `docs/ONT01_ONTOLOGY_REVIEW.md`.
   Must precede M-01 design decisions that assume the five-field ontology.
3. **`LOCK-01` design.** A custodied blind confirmation seed/artifact outside
   prompt-author access. Do not build today’s LOCKED split as a substitute.
4. **MIXED_EVIDENCE / M-01 design, under `docs/M01_INDEPENDENCE_PROTOCOL.md`.**
   Do not render yet. Same hidden frames, no pre-bucketing, no giveaway
   carriers. Renderer author does not get current prompt outputs unless a
   documented exception applies. Contract change (amendment C).
5. **Career-state diversity / M-02.** After M-01. New corpus version. Do not
   mutate the frozen corpus.
6. **`MKT-01`.** A future shared-universe retrieval / ranking bench. Not this
   corpus.
7. **Qualification-visible evidence / QC-01 then Q-01.** Do not build a bespoke
   qualification renderer that MIXED_EVIDENCE would immediately replace.
8. **Small real-user sample only after PRIV-01.** That is `H-01`, not `ONT-01`.

S-01 may be revived only when a post-M-01 architecture question makes
repeated-generation stability useful again. Its preregistration stays on disk.
