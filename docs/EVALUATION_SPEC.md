# Evaluation specification (as-is)

This document describes how the current system is measured. It does not propose
new metrics or change hidden truth.

Companion: `docs/ALGORITHM_SPEC.md`, `docs/COEFFICIENT_REGISTRY.md`.

**Provenance (do not mix these three rows):**

| Layer | File / method | MAE | Holdout MAE | Work-Fit mean | meanFitSpread | tech-demo share |
|---|---|---|---|---|---|---|
| Frozen baseline | `onet_external_shock_baseline.json` (2026-08-22, `80312e2`) | 1.845228 | ~1.820 | 9.532 | 0.293 | 0.320 |
| Frozen candidate artifact | `onet_shock_latest.json` (2026-08-22, `c10b914`) | **1.875021** | **1.816938** | 7.408 | 1.986 | 0.358 |
| **Live HEAD** | `evaluateOnetSubject` on this checkout (2026-08-23) | **1.730477** | **1.705023** | 7.411 | 1.949 | 0.331 |

Live HEAD uses the same seed `20260823` and O*NET 30.3 corpus. It does **not**
match 1.875 because the generator is now `subject-lab.v2-onet-semantic-polarity`
and `extractEvidence` uses a 200-sentence / 40k-char budget. The cited 1.875 is
a `VERIFIED_TRANSIENT_RUN`, not live HEAD. Do not run `pnpm eval:onet-shock`
to “refresh” it — that overwrites `onet_shock_latest.json`.

---

## 1. What is being predicted vs what is being scored

| Construct | Variable | Who computes it | In official MAE? |
|---|---|---|---|
| Hidden preference vector | `subject.truth.taskDnaTruth` (17-d, 0–10) | Lab generator | **Yes — this is the MAE target** |
| Inferred preference vector | `profileVector(profile)` | Engine | Prediction |
| Work Fit | `score.predictedFit` | Engine | No |
| Function rank | `scoreFunctions` by `overallPriority` | Engine | No |
| Hireability | `buildRequirementMatrix` | Engine | No (pathology flag only) |
| Hidden-best function | `argmax vectorFit(truth, fn.vector)` | **Not stored**; derived in forensic audit only | No |

**The algorithm’s product output is a ranked list of jobs/functions plus
Hireability, CAF, NBA.** The official headline number is **preference-vector
recovery**, not ranking quality.

---

## 2. Hidden truth

### 2.1 Definition

**Variable:** `VirtualSubjectTruth.taskDnaTruth` (`src/lab/types.ts`)
**Type:** `Vector` — 17 floats, theoretically [0, 10], generated in ~[1.5, 8.8]
**Not:** a job label, a function id, a Work-Fit score, or a ranking.

**Origin:** synthetic, rule-generated inside `generateOnetSubject`
(`src/lab/onetLab.ts`). Not human-authored. Not model-generated.

### 2.2 Creation procedure

Seed: `ONET_LAB_SEED = 20260823`. Version: `subject-lab.v2-onet`.
Subject `i` uses `mulberry32(hashSeed("20260823:v2:" + i))`.

1. Sample an O*NET occupation (stratified; see §4).
2. `independentPreference = randomVector(rng)`:
   each dim ~ Uniform(1.5, 8.8), then `vector()` (already in range).
3. With probability **0.35** (development/validation/holdout) or **0.20**
   (adversarial), `occupationFitsPreference = true` and
   `nudgeTowardOccupation(independent, occupation, rng)`:
   for regex-matched GWA/task themes, replace
   `dim = clamp(0.4*old + 0.6*target, 0, 10)` with `target` drawn in a high band.
   This models “some people like their jobs.” The nudge writes **truth only**.
4. `attractorsTruth` / `repellentsTruth` = dims ≥ 7.2 / ≤ 3.2 (up to 4 each).
5. Observations (`observeOnetSubject`) generate messy text from truth **and**
   occupation tasks. Occupation tasks are prefixed `In this role I would` so
   they classify as EXPOSURE.

**When created:** at evaluation time, in memory. Subjects are not a checked-in
JSON fixture; they are a pure function of seed + corpus. Created originally
with the v2 lab in commit `80312e2` (2026-08-23 seed). Regenerating with the
same seed and corpus yields the same 450 truths.

### 2.3 Observations per subject

One hidden 17-d vector per subject. MAE uses that one vector (17 dim errors).
Work Fit uses 22 shared jobs × 450 subjects = 9,900 pairs, but those pairs
are **not** in MAE.

### 2.4 What the model can and cannot see

| Field | Engine sees? | Used for TaskDNA? |
|---|---|---|
| `taskDnaTruth` | **No** | — |
| `nudgeTowardOccupation` targets | **No** | — |
| Occupation tasks in resume | Yes, as text | Only if misclassified; intended EXPOSURE weight 0 |
| Preference / dislike phrases | Yes | Yes, if lexicon hits |
| `statedSkills` from occupation | Yes | Capabilities / Hireability only |
| Title (or misleading substitute) | Yes as text | Not a job-vector mint on candidate |
| `expectedGeneralProperties` | Eval only | Property tests compare inferred vs truth |

`observationsToProfile` passes resume, explicit prefs/dislikes, contradictory
statements, apparent field, stated skills. It does **not** pass `truth`.

### 2.5 “Occupation is not preference”

**Evaluation-design meaning:**

1. Hidden preference is drawn independently of the occupation for most subjects
   (310 / 450 have `occupationFitsPreference = false`).
2. Even when nudged, the engine is not given occupation-as-label.
3. Occupation tasks are exposure sentences with `signalWeight = 0`.
4. Property `occupation_does_not_define_preference` fails if an investigative
   occupation plus a low investigation-truth still gets inferred investigation
   ≥ truth + 3.5.

It does **not** mean the occupation string is stripped from the resume. The
person still “worked as” that occupation. The invariant is: **doing the job
must not count as liking the job.**

### 2.6 Intentionally hidden

- The numeric `taskDnaTruth` vector
- `occupationFitsPreference`
- Attractors/repellents lists as structured fields (they are also verbalized)
- Capability confidence truth
- Cohort label (not an engine input)

---

## 3. Hidden-truth MAE

### 3.1 Exact formula

**File:** `src/lab/onetEvaluate.ts` `evaluateProfileAgainstTruth`

Per subject:

\[
\mathrm{mae}_s = \frac{1}{17}\sum_{d=1}^{17} \bigl|\hat{u}_{s,d} - u^{\star}_{s,d}\bigr|
\]

where \(\hat{u} =\) `profileVector(profile)` and \(u^{\star} =\) `taskDnaTruth`.

Overall (live HEAD 1.730; frozen artifact 1.875):

\[
\mathrm{meanMae} = \frac{1}{450}\sum_{s=1}^{450} \mathrm{mae}_s
\]

**This is not** `mean(|predicted_work_fit - hidden_true_work_fit|)`.
There is no hidden Work-Fit target.

| Item | Value |
|---|---|
| Prediction | inferred TaskDNA dimension |
| Target | `taskDnaTruth` dimension |
| Unit | points on the 0–10 dimension scale |
| Dims / subject | 17 |
| Subjects | 450 |
| Dim-level observations | **7,650** |
| Subject weighting | **equal** (1/450) |
| Dimension weighting | **equal** (1/17) inside each subject |
| Job/function weighting | **none** — jobs are not in this mean |
| Missing values | none; every dim always has a number (prior 5 if no evidence) |

`aggregate()` is `mean(evaluations.map(mae))` — same equal-subject mean.
There is no size-weighting by stratum.

Equivalent expanded form:

\[
\mathrm{meanMae} = \frac{1}{450\cdot 17}\sum_s\sum_d |\hat{u}_{s,d}-u^{\star}_{s,d}|
\]

because every subject has exactly 17 dims. **Explicit.**

### 3.2 Reported numbers (seed 20260823)

**Live HEAD** (this audit, `generateOnetSubjects(20260823)` + current engine):

| Split | n | meanMae |
|---|---|---|
| design (development) | 150 | 1.7356990323559016 |
| validation | 100 | 1.7024183446496204 |
| holdout | 100 | 1.7050226637495052 |
| adversarial | 100 | 1.7761579059023023 |
| **all** | **450** | **1.7304772139633957** |

Check: \((150\cdot 1.735699 + 100\cdot 1.702418 + 100\cdot 1.705023 + 100\cdot 1.776158)/450 = 1.730477\).

**Frozen candidate artifact** (`onet_shock_latest.json`, 2026-08-22) — the
cited **1.875**:

| Split | n | meanMae |
|---|---|---|
| design | 150 | 1.900921405143544 |
| validation | 100 | 1.8619872971926392 |
| holdout | 100 | 1.8169384777024278 |
| adversarial | 100 | 1.9072870934676516 |
| **all** | **450** | **1.875021105795119** |

Frozen baseline overall: **1.8452277688400356**.

### 3.3 Neutral-prior floor (why ~1.83 is unsurprising)

`randomVector` ~ Unif(1.5, 8.8). A constant-5 predictor has

\[
\mathbb{E}|X-5| = \frac{(5-1.5)^2 + (8.8-5)^2}{2\cdot(8.8-1.5)} \approx 1.83
\]

Baseline 1.845 and the 1.875 artifact both sit next to that floor. Live HEAD
1.730 is **below** the constant-5 expectation because the polarity planner
plus 200-sentence budget recover more non-neutral dims (still with large
missing-evidence rates). **Inferred analytic check; not in the evaluator.**
It explains how MAE can stay flat (baseline → 1.875 artifact) while job-side
behavior changes, and why live HEAD can move MAE without anyone “tuning”
coefficients.

### 3.4 Three concrete subjects (live HEAD)

#### Example A — `v2-subject-001` (design)

Full calculator walk: `docs/ALGORITHM_SPEC.md` §10.

- Occupation: Validation Engineers `17-2112.02` (exposure only)
- Prefs: “building small tools to remove drudgery”
- Dislikes: “root-cause investigation”
- Empty-lexicon PREFERENCE/ASPIRATION: “well-fenced area…”, “fast observable feedback”
- Subject MAE **1.8447216317457538**
- Contribution: \(1.84472/450 = 0.004099\)
- Predicted top function: `modeling-simulation` (overall 5.42)
- Derived hidden-best: `operations-coordination` (truth-fit 8.336)

#### Example B — `v2-subject-150` (design)

- Occupation: Arbitrators, Mediators, and Conciliators `23-1022.00`
- Prefs: “solo deep work”; “I enjoy wide-open greenfield creation”
- Dislikes: “work that never repeats”; “I avoid real equipment and real users”
- Subject MAE **1.7456320109727042**
- Contribution: \(1.74563/450 = 0.003879\)
- Predicted top function: `research-inquiry`
- Derived hidden-best: `financial-analysis-audit` (truth-fit 8.030)

#### Example C — `v2-subject-003` (design)

- Occupation: Web Developers `15-1254.00`
- Prefs: “building small tools to remove drudgery”; “I enjoy working directly from raw data”
- Dislikes: “physical systems I can observe”
- Subject MAE **2.1325972115274197**
- Contribution: \(2.13260/450 = 0.004739\)
- Predicted top function: `research-inquiry`
- Derived hidden-best: `investigative-analysis` (truth-fit 8.010)

### 3.5 How three errors sit inside the headline

These three do **not** average to 1.730. Official MAE is the mean of **all 450**
subject MAEs. The three contribute

\[
\frac{1.84472 + 1.74563 + 2.13260}{450} \approx 0.01272
\]

of the 1.730 total. The remaining 447 subjects contribute the rest. Because
weighting is uniform, live worst subject `v2-subject-107` (MAE 2.541) moves
the headline by \(2.541/450 \approx 0.00565\); live best `v2-subject-122`
(MAE 0.871) by \(0.00194\).

**Explicit aggregation order:** subject-level mean over 17 dims, then
unweighted mean over subjects, optionally sliced by `cohort`.

The frozen 1.875 check (artifact only):

\[
\frac{150\cdot 1.900921 + 100\cdot 1.861987 + 100\cdot 1.816938 + 100\cdot 1.907287}{450}
= 1.875021
\]

---

## 4. The 450 subjects

**Generator:** `generateOnetSubjects` / `sampleOccupationsForCohorts`
**Corpus:** official O*NET 30.3, `data/derived/onet/30.3/occupation-corpus.json.gz`
(1,016 occupations; 923 with tasks). Usable pool: ≥3 tasks and >0 GWAs.
**Kind:** fully **synthetic**, templated from real occupational text + independent
preference draws. Not real people. Not LLM-written.

| Cohort | Code name in truth | n | Occupation sampler |
|---|---|---|---|
| development | stored as `"design"` | 150 | stratified in-scope knowledge work |
| validation | `"validation"` | 100 | same round-robin, next occupations |
| holdout | `"holdout"` | 100 | same, further along the cursor |
| adversarial | `"adversarial"` | 100 | 60% in-scope hard regimes, 40% out-of-scope |

Same occupations can reappear across cohorts when a stratum is small
(`cursor % members.length`). Subjects are **not** independent occupational
draws; they are **independent preference draws** on a cycling occupation list.
Multiple subjects can share an occupation archetype and still have different
truths.

| Flag | Count |
|---|---|
| `occupationFitsPreference` | 140 / 450 |
| sparse observation regime | 72 / 450 |

Each subject has: resume text, work-history task sentences, optional stuffing,
explicit pref/dislike lists, statedSkills, a generated network intake,
quality metadata (sparse/contradictory/misleadingTitle).

**Predictions contributing to MAE:** 450 × 17 = 7,650 dimension errors.
**Work-Fit distribution stats:** 450 × 22 = 9,900 job scores (not in MAE).

Training/dev/holdout are **generated independently** (separate index seeds)
but **share the coefficient set** (there is no training). Coefficients were
not fit on any split. Holdout subjects were not used to choose α, lexicon, or
Hireability constants in this pass (paired holdout ΔMAE ≈ 0; see §7).

---

## 5. Holdout MAE vs hidden-truth MAE

| | Hidden-truth MAE | Holdout MAE |
|---|---|---|
| Equation | identical `mae_s` | identical `mae_s` |
| Population | all 450 | `cohort === "holdout"` (100) |
| Live HEAD | 1.730477 | 1.705023 |
| Frozen candidate artifact | 1.875021 | 1.816938 |
| Frozen baseline | 1.845228 | ~1.820 (same formula) |

**Conceptual difference:** holdout is a **locked slice of the same synthetic
lab**, not a different target and not real-world outcomes.

**Data-level difference:** different `index` values (250–349) → different
occupations and independent RNG draws. Same generator, same seed family.

**Were holdout subjects used in development?** Not as a tuning set in this
repository’s Pass 2 work. Engine changes were justified by Phase A failure
modes (collapse, exposure leak, stuffing), not by minimizing holdout MAE.
Paired holdout mean ΔMAE = **−0.003**.

**Are coefficients tuned on either set?** No least-squares / search against
MAE appears in the repo. Values are hand-chosen in `scoringConfig` and
hardcoded functions. **0 empirically estimated.**

**Is the holdout locked?** Locked as a **generation recipe** (seed + sizes +
sampler), not as a frozen subject file. Changing `ONET_LAB_SEED`,
`COHORT_SIZES`, `sampleOccupationsForCohorts`, `generateOnetSubject`,
`PREFERENCE_PHRASES`, or the corpus rebuild would silently produce a
different holdout. **Files that define the recipe:** `src/lab/onetLab.ts`,
`src/onet/corpus.ts`, `scripts/build-onet-corpus.ts`.

**What could contaminate it:** editing the generator; rebuilding corpus with
different filters; reading holdout MAE while hand-tuning (not done here, but
the number is visible in every shock run); using holdout subjects as few-shot
examples in future prompts.

---

## 6. Frozen baseline

| Item | Value |
|---|---|
| Commit that generated it | `80312e2` (Phase A: O*NET ingest + v2 lab + first shock run) |
| File | `artifacts/logic_audit/onet_external_shock_baseline.json` |
| Algorithm | pre–evidence-class, title/neutral job fallback (Phase A engine) |
| Dataset | same `generateOnetSubjects(20260823)` recipe + same 22 shared jobs |
| Seed / lab version in file | 20260823 / `subject-lab.v2-onet` |

Later runs write `artifacts/logic_audit/onet_shock_latest.json` only.

### 6.1 “Baseline file was not overwritten”

**File:** `scripts/onet-external-shock.ts`

```
if (!existsSync(baselinePath)) {
  writeFileSync(baselinePath, JSON.stringify(report, null, 2));
} else {
  console.log("... NOT overwritten.");
}
writeFileSync(latestPath, ...);
```

**Mechanism:** existence check on the path. No checksum compare. No git hook.
**Guarantees:** a second `pnpm` shock run will not replace the file.
**Does not guarantee:** a human `rm` + rerun; a different working tree;
editing the JSON by hand. The file is also committed, so git history is the
second lock.

### 6.2 Apples-to-apples check

**Apples-to-apples at the artifact layer:** same 450 subject IDs, same seed,
same 22 shared jobs. Baseline file and `onet_shock_latest.json` both list
identical `sharedEvalJobs` and `cohortSizes`. MAE is the same equation.

**Paired per-subject Δ (candidate − baseline) is not stored.** Neither JSON
contains a 450-row error vector. A prior forensic note (same files) claimed
29.3% improved / 42.4% worsened / 28.2% unchanged for the **1.875 artifact**
versus baseline. This audit **did not** check out `80312e2` to recompute that,
and **must not** overwrite the baseline to obtain it.

**Live HEAD vs baseline paired Δ is therefore unknown.** Live MAE 1.730 is a
different generator+extractor snapshot than both frozen files. Do not treat
the old 29%/42% split as a live-HEAD result.

---

## 7. Why MAE can stay flat while behavior looks better

Evidence, not a single letter:

**A — MAE measures the right construct for preference recovery, and the
1.875 artifact did not improve it.** Artifact mean Δ vs baseline +0.030.
Coordination MAE rose after exposure was zeroed (intended). The 1.875
candidate is not a better 17-d decoder than the 1.845 baseline.

Live HEAD MAE **did** fall (1.730) after polarity-planner + evidence-budget
changes. That is a **generator/extractor** change, not coefficient tuning,
and it is a different snapshot than the cited 1.875.

**B — Hidden truth is weakly observed.** Many PREFERENCE phrases do not match
the extractor (`v2-subject-001` measurable truth 8.64 → inferred 5). The
label is clean; the *observation channel* is lossy. That is a noisy/weak
**likelihood**, not a noisy label file.

**C — MAE ignores the product behaviors that changed.** Job-vector
discrimination, function-collapse, Hireability stuffing, NBA apply-gate are
outside \(\mathrm{mae}_s\). Spread 0.29 → 1.99 never enters the headline.

**D — Baseline Work-Fit “success” was a dataset/engine artifact.** All-5s jobs
make every Work Fit ≈ \(10-\mathrm{mean}|u-5|\). That looks like a high mean
(9.53) and is not preference skill. Baseline MAE near 1.83 is the constant-5
floor plus a little leftover from exposure leak (which helped some dims that
happened to match occupation-nudged truths).

**E (additional):** function ranking uses Overall (Hireability-heavy), so even
perfect TaskDNA would not guarantee top-1 function accuracy.

**Conclusion:** A + B + C + D together. Do not pick one. The slight MAE
regression is compatible with a more honest job model.

---

## 8. Other official measurements (not MAE)

From `aggregate` / shock script:

| Statistic | Equation | Live HEAD | 1.875 artifact | Baseline |
|---|---|---|---|---|
| meanFitSpread | mean of per-subject **range** of predictedFit on 22 jobs | 1.949 | 1.986 | 0.293 |
| meanHireabilitySpread | same for hireability | 4.873 | 4.857 | 3.460 |
| technicalDemoTopFunctionShare | # subjects whose top function is `function.v1` / 450 | 0.331 | 0.358 | 0.320 |
| Work-Fit pair mean / SD | over 9,900 pairs | 7.411 / — | 7.408 / 0.625 | 9.532 / 0.403 |
| propertyPassRate | mean of boolean property tests | 0.995 | 0.999 | 0.959 |
| stuffingBuysHireability | stuffed mean H > unstuffed-adv H + 0.5 | not re-run (would write latest.json) | false (2.06 vs 2.51) | false (3.53 vs 3.34) |
| rankStability Spearman | job-rank stability under ±0.05 TaskDNA noise — **not** vs truth | not re-run | 0.999 | 1.000 |

### 8.1 Ranking metrics we can compute but do **not** officially report

Derived in the forensic audit from already-available
`(taskDnaTruth, scoreFunctions)` — **not** stored, **not** a gate:

Hidden-best \(f^\star_s = \arg\max_f \mathrm{vectorFit}(u^\star_s, v_f)\).

Live HEAD (n=450, derived 2026-08-23; **not** an official gate):

| Metric | Value |
|---|---|
| top-1 accuracy vs \(f^\star\) | **10.67%** (48/450) |
| top-3 recall | **30.22%** |
| mean Spearman (pred function order vs truth-fit order over 23 functions) | **0.506** |
| mean regret `predFit(top) − predFit(hiddenBest)` on the **inferred** user vector | 0.134 |

Chance top-1 among 23 functions ≈ 4.3%. 10.7% is above chance and far from
useful. Official evaluator does **not** compute NDCG, pairwise accuracy, or
per-subject rank correlation vs hidden-best. This audit computed the table
above from already-available `(taskDnaTruth, scoreFunctions)` without changing
the harness.

**MAE is not sufficient for the product objective** (recommend jobs/functions).
We already have the data to add ranking metrics; they are not in the harness.

---

## 9. Error decomposition (live HEAD MAE 1.730)

Equal subject weight. Source: 2026-08-23 recompute.

### 9.1 By dimension

| Worst | MAE | bias (inferred − truth) | missing-evidence rate |
|---|---|---|---|
| measurable_feedback | 1.931 | −0.097 | 0.567 |
| creation_style | 1.862 | −0.226 | 0.629 |
| scope_preference | 1.857 | −0.203 | 0.404 |
| software_as_tool | 1.811 | −0.520 | 0.856 |
| investigation_orientation | 1.793 | −0.475 | 0.544 |

| Best | MAE | missing-evidence rate |
|---|---|---|
| repetition_tolerance | 1.507 | 0.622 |
| coordination_preference | 1.570 | 0.460 |
| integration_preference | 1.624 | 0.771 |
| customer_interaction_preference | 1.649 | 0.796 |

Every dimension’s bias is **negative** (inferred pulled toward/below 5).
Missing-evidence rates of 0.40–0.86 mean the prior-5 floor still dominates.

### 9.2 By occupational stratum (subject `family`)

Worst: supply_chain 1.859 (n=13), compliance 1.834 (n=13), software 1.818 (n=14).
Best: policy 1.621 (n=13), product 1.626, project_program 1.652.
Spread across strata is **narrow** (~0.24). Error is not a single-domain bug.

### 9.3 By observation regime / flags

| Slice | n | MAE |
|---|---|---|
| occupationFitsPreference | 140 | 1.724 |
| not | 310 | 1.733 |
| sparse | 72 | **1.855** |
| not sparse | 378 | 1.707 |
| contradictory | 109 | 1.761 |
| keywordStuffed | 25 | 1.705 |
| misleadingTitle | 208 | 1.761 |
| burnedOut | 79 | 1.725 |
| accidentalCareer | 146 | 1.756 |

Sparse is the only large regime gap (~+0.15). Occupation-fit vs not is
essentially flat — consistent with “occupation is not preference.”

### 9.4 By predicted top function

Largest groups: research-inquiry 136 subjects (MAE 1.711), people-operations
95 (1.717), modeling-simulation 88 (1.744). Smallest-n worst: verification-
validation n=2 MAE 2.094. operations-coordination n=4 MAE 1.439 (best group,
too small to over-interpret).

### 9.5 By confidence

| Bucket | n | meanMae |
|---|---|---|
| <0.35 | **391** | 1.738 |
| 0.35–0.5 | 59 | 1.683 |
| ≥0.5 | **0** | — |

391/450 subjects sit in the lowest bucket. The 59 “higher” subjects are only
0.055 better. **No subject reaches 0.5.** High-confidence predictions do not
exist on this lab, so calibration versus error cannot be shown beyond “almost
everyone is low-confidence and ~1.73 MAE.” Artifact-era Pearson(+0.063) is
not re-estimated here; the live distribution is even more collapsed.

### 9.6 Outliers (live)

Worst: `v2-subject-107` 2.541, `v2-subject-135` 2.442, `v2-subject-120` 2.393.
Best: `v2-subject-122` 0.871, `v2-subject-364` 0.967, `v2-subject-234` 1.025.
Distribution: min 0.871, p10 1.371, median 1.729, p90 2.094, max 2.541.

### 9.7 Paired subject deltas

**Unknown for live HEAD vs baseline.** Artifacts store aggregates only.
See §6.2. The 1.875 artifact vs baseline “more worsened than improved” claim
from a prior pass is about **vector recovery on that snapshot**, not live HEAD
and not Work-Fit discrimination (which did change: spread 0.29 → ~1.95).

---

## 10. Leakage audit

| Path | Class | Why |
|---|---|---|
| `taskDnaTruth` never passed to engine | **safe** | `observationsToProfile` omits `truth` |
| Occupation tasks as EXPOSURE weight 0 | **safe** by design | `PREFERENCE_SIGNAL_WEIGHT` |
| `nudgeTowardOccupation` writes truth only | **safe** | not in observations |
| Title → job vector (candidate) | **safe** | title-fallback does not mint |
| Title → job vector (baseline) | **questionable** historically | title could copy a demo prototype |
| `statedSkills` from occupation skills | **questionable** for Hireability; **safe** for MAE | skills are not TaskDNA inputs |
| `expectedGeneralProperties` / property tests | **safe** | eval-only; do not update profile |
| Cached vectors | **safe** | no TaskDNA cache keyed on truth |
| Coefficient tuning on holdout | **safe** in this pass | no search; holdout Δ ≈ 0 |
| Baseline generation | **safe** | frozen file; later runs → latest.json |
| Lab phrase vs extractor mismatch | **not leakage** | validity hole (B) |
| Function label used as MAE target | **n/a** | it isn’t |
| Twin / variant generators | **safe** | they re-observe or retarget truth explicitly |

No **actual leakage** of `taskDnaTruth` into \(\hat u\) was found.

---

## 11. What the test suite actually measures

Do not call a construct “validated” because a unit test exists.

| Concept | Officially measured? | How |
|---|---|---|
| Construct validity (TaskDNA = preference) | **partial** | evidence-class unit tests; occupation-not-preference property; not human labels |
| Predictive validity (jobs/outcomes) | **no** | no hire/offer/satisfaction outcomes |
| Generalization | **partial** | holdout + adversarial MAE / properties; still same generator |
| Calibration | **attempted, fails** | confidence buckets; Pearson +0.06 |
| Ranking quality vs hidden-best | **no** | only noise-stability Spearman |
| Discrimination / spread | **yes** | meanFitSpread, technical-demo share |
| Robustness | **partial** | twins, observation variants, ±0.05 rank stability |
| Anti-gaming | **yes** | stuffingBuysHireability; skills-dump unit tests |
| Hireability correctness vs real reqs | **no** | synthetic requirements from O*NET names |
| NBA quality | **partial** | feasibility 100%; golden cases still fixture-shaped on O*NET graphs |

`tests/virtual-subjects.test.ts` and `tests/logic-invariants.test.ts` assert
invariants, not recovery quality. `pnpm eval` still covers 15 demo personas.

---

## 12. Known evaluation limitations (ranked)

See also final report §H. Short list:

1. Headline MAE is the wrong product objective (ranking / Work Fit unused).
2. Observation phrases often do not identify the dimensions they were written for.
3. The cited 1.875 is a stale transient artifact; live HEAD is already 1.730.
4. Holdout is a locked RNG slice, not an external population.
5. Hidden-best function is not a stored label; ranking metrics are unofficial.
6. Baseline overwrite lock is “file exists,” not a hash pin in the writer
   (SHA is recorded in `config/baseline-manifest.json` after the fact).
7. 74-count inventory undercounts free numbers actually affecting scores.
8. Per-subject baseline predictions were never frozen, so paired Δ cannot
   be audited without checking out the Phase A engine.
