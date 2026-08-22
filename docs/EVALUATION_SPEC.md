# Evaluation specification (as-is)

This document describes how the current system is measured. It does not propose
new metrics or change hidden truth.

Companion: `docs/ALGORITHM_SPEC.md`, `docs/COEFFICIENT_REGISTRY.md`.

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

Overall (candidate 1.875):

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

### 3.2 Reported numbers (candidate, seed 20260823)

Verified by recomputing `evaluateOnetSubject` over `generateOnetSubjects(20260823)`:

| Split | n | meanMae |
|---|---|---|
| design (development) | 150 | 1.900921405143544 |
| validation | 100 | 1.8619872971926392 |
| holdout | 100 | 1.8169384777024278 |
| adversarial | 100 | 1.9072870934676516 |
| **all** | **450** | **1.875021105795119** |

Headline “1.875” is this overall mean, rounded.

Frozen baseline overall: **1.8452277688400356** (`artifacts/logic_audit/onet_external_shock_baseline.json`).

### 3.3 Neutral-prior floor (why ~1.83 is unsurprising)

`randomVector` ~ Unif(1.5, 8.8). A constant-5 predictor has

\[
\mathbb{E}|X-5| = \frac{(5-1.5)^2 + (8.8-5)^2}{2\cdot(8.8-1.5)} \approx 1.83
\]

Baseline 1.845 and candidate 1.875 both sit next to that floor. **Inferred
analytic check; not in the evaluator.** It explains how MAE can stay flat
while job-side behavior changes.

### 3.4 Three concrete subjects

Errors from the live candidate engine.

#### Example A — `v2-subject-001` (design)

- Occupation: Validation Engineers `17-2112.02` (exposure only)
- `occupationFitsPreference=false`, burnedOut, misleading title “Analyst”
- Visible prefs: “work where I can see the numbers move”, “a well-fenced area of responsibility”
- Those PREFERENCE rows have **empty** `preferenceSignals` (lexicon miss)
- Visible dislikes move coordination down and, via invert, raise
  `investigation_orientation` / `creation_style`

| dim | truth | inferred | \|err\| |
|---|---|---|---|
| problem_structure | 5.217 | 6.116 | 0.899 |
| measurable_feedback | 8.636 | 5.000 | 3.636 |
| investigation_orientation | 1.805 | 5.744 | 3.939 |
| evidence_density | 6.398 | 5.000 | 1.398 |
| experimentation_preference | 5.678 | 5.000 | 0.678 |
| scope_preference | 8.661 | 5.000 | 3.661 |
| software_as_tool | 7.349 | 5.000 | 2.349 |
| reasoning_style | 4.749 | 5.000 | 0.251 |
| creation_style | 2.608 | 6.116 | 3.508 |
| real_system_grounding | 1.530 | 5.000 | 3.470 |
| closure_preference | 7.931 | 5.000 | 2.931 |
| causal_reasoning | 5.302 | 5.000 | 0.302 |
| integration_preference | 6.177 | 5.000 | 1.177 |
| customer_interaction_preference | 7.618 | 5.000 | 2.618 |
| coordination_preference | 5.180 | 2.768 | 2.412 |
| theory_vs_application | 5.384 | 5.000 | 0.384 |
| repetition_tolerance | 7.100 | 5.000 | 2.100 |
| **mae_s** | | | **2.1007806055846023** |

Sum of abs errors = 35.713; 35.713 / 17 = 2.1008.
Contribution to overall: \(2.10078/450 = 0.004668\).

The largest errors are dims the person *stated* (measurable, scope) that the
extractor did not hear, plus invert damage on investigation/creation.

#### Example B — `v2-subject-150` (design)

- Occupation: Arbitrators, Mediators, and Conciliators `23-1022.00`
- Prefs: “well-scoped problems I can finish”, “running targeted experiments”
- Dislikes: “long-horizon work without clear metrics”, “sprawling many-team problems”
- Subject MAE **1.7578150848981244**
- Contribution: \(1.75782/450 = 0.003906\)
- Predicted top function: `operations-coordination` (fit 9.24)
- Derived hidden-best: `financial-analysis-audit` (truth-fit 8.03)

“Long-horizon…” dislike still often empty; “well-scoped…finish” leaks into
`measurable_feedback` (same collision as subject 003).

#### Example C — `v2-subject-003` (design)

Full walk in `docs/ALGORITHM_SPEC.md` §10.
MAE **1.8347581779845115**. Contribution **0.004077**.

### 3.5 How three errors sit inside 1.875

These three do **not** average to 1.875. Official MAE is the mean of **all 450**
subject MAEs. The three contribute

\[
\frac{2.10078 + 1.75782 + 1.83476}{450} \approx 0.01265
\]

of the 1.875 total. The remaining 447 subjects contribute the rest. Because
weighting is uniform, a subject with MAE 2.80 (`v2-subject-016`) moves the
headline by \(2.80/450 \approx 0.0062\); a subject with MAE 1.12
(`v2-subject-216`) by \(0.0025\).

Check on the four cohort means:

\[
\frac{150\cdot 1.900921 + 100\cdot 1.861987 + 100\cdot 1.816938 + 100\cdot 1.907287}{450}
= 1.875021
\]

**Explicit aggregation order:** subject-level mean over 17 dims, then
unweighted mean over subjects, optionally sliced by `cohort`.

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
| Candidate | 1.875021 | 1.816938 |
| Baseline | 1.845228 | 1.820 (report rounded; same formula) |

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

Paired recompute: Phase A engine at `80312e2` vs current candidate, **same
450 subject IDs**, same seed, same truths.

| | |
|---|---|
| `sameIds` | true |
| baseline mean MAE | 1.8452277688400356 |
| candidate mean MAE | 1.875021105795119 |
| mean Δ (cand − base) | +0.029793 |
| median Δ | +0.016976 |
| improved (Δ < −0.05) | 29.3% |
| worsened (Δ > 0.05) | 42.4% |
| unchanged (\|Δ\| ≤ 0.05) | 28.2% |
| holdout mean Δ | −0.003009 |
| mean fitSpread | 0.293 → 1.986 |

Same subjects and truths. Job vectors and evidence weighting differ. MAE is
comparable; Work-Fit means are comparable **as product scores** but baseline
Work Fit was saturated by the all-5s artifact.

---

## 7. Why MAE can stay flat while behavior looks better

Evidence, not a single letter:

**A — MAE measures the right construct for preference recovery, and that
construct did not improve.** Mean Δ +0.030; 42% of subjects worsened on
vector recovery. Coordination MAE +0.220 because exposure no longer moves
preference (intended). Candidate is not a better 17-d decoder.

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

| Statistic | Equation | Candidate |
|---|---|---|
| meanFitSpread | mean of per-subject **range** of predictedFit on 22 jobs | 1.986 |
| meanHireabilitySpread | same for hireability | (in latest.json) |
| technicalDemoTopFunctionShare | fraction of subjects whose top function is `function.v1` | 0.3578 |
| propertyPassRate | mean of boolean property tests | ~high 90s |
| stuffingBuysHireability | stuffed mean H > unstuffed-adv H + 0.5 | false |
| twin pass | `evaluateTwins` same-pref/diff-exp etc. | 85% overall |
| rankStability Spearman | job-rank stability under ±0.05 TaskDNA noise — **not** vs truth | ~0.999 |

### 8.1 Ranking metrics we can compute but do **not** officially report

Derived in the forensic audit from already-available
`(taskDnaTruth, scoreFunctions)` — **not** stored, **not** a gate:

Hidden-best \(f^\star_s = \arg\max_f \mathrm{vectorFit}(u^\star_s, v_f)\).

| Metric | Value (n=450) |
|---|---|
| top-1 accuracy vs \(f^\star\) | 11.3% |
| top-3 recall | 27.8% |
| mean Spearman (pred fit vs truth fit over 23 functions) | 0.523 |
| mean regret \(\mathrm{fit}(u^\star,\hat f)-\mathrm{fit}(u^\star,f^\star)\) wait: engine uses user vector for \(\hat f\); regret was `truthFit(best) - truthFit(predictedTop)` | 0.269 |
| mean rank of hidden-best | 7.76 |

Chance top-1 among 23 functions ≈ 4.3%. 11.3% is above chance and far from
useful. Official evaluator does **not** compute NDCG, pairwise accuracy, or
per-subject rank correlation vs hidden-best.

**MAE is not sufficient for the product objective** (recommend jobs/functions).
We already have the data to add ranking metrics; they are not in the harness.

---

## 9. Error decomposition (candidate MAE 1.875)

### 9.1 By dimension (equal subject weight)

| Worst | MAE | bias (inferred − truth) |
|---|---|---|
| coordination_preference | 2.118 | −1.231 |
| measurable_feedback | 2.035 | (see forensic) |
| creation_style | 2.023 | |
| scope_preference | 2.003 | |
| reasoning_style | 1.950 | |

| Best | MAE |
|---|---|
| software_as_tool | 1.652 |
| evidence_density | 1.722 |
| real_system_grounding | 1.759 |
| investigation_orientation | 1.785 |

Coordination got **worse** vs baseline (+0.220) after exposure was zeroed.

### 9.2 By occupational stratum (subject `family`)

Worst: business_development 1.975 (n=13), cybersecurity 1.957 (n=14),
operations 1.954. Best: product 1.755 (n=13), sales 1.765, insurance_risk 1.772.
Spread across strata is **narrow** (~0.22). Error is not a single-domain bug.

### 9.3 By observation regime

| Slice | MAE |
|---|---|
| occupationFitsPreference | 1.858 |
| not | 1.883 |
| sparse | 1.869 |
| rich | 1.876 |

Almost no difference. Sparse subjects sit at prior 5; rich subjects often
state phrases the lexicon misses — both land near the 1.83 floor.

### 9.4 By confidence

Pearson(confidence, MAE) = +0.063. High-confidence predictions do **not** have
lower error. Calibration: fail.

### 9.5 Outliers

Worst subjects: `v2-subject-016` 2.797, `v2-subject-120` 2.728,
`v2-subject-374` 2.718. Best: `v2-subject-216` 1.117, `v2-subject-264` 1.122.

### 9.6 Paired subject deltas (candidate − baseline)

Largest improvements: `v2-subject-264` −0.821, `v2-subject-311` −0.630.
Largest regressions: `v2-subject-066` +0.667, `v2-subject-071` +0.578.

The candidate does **not** mainly trade a few catastrophes for many moderate
wins on MAE: more subjects **worsened** (42%) than improved (29%) on vector
error. The “sensible behavior” win is on **job-side discrimination**, which
MAE does not score. On MAE, the candidate is a small, broad regression plus
a few large wins.

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
3. Holdout is a locked RNG slice, not an external population.
4. Hidden-best function is not a stored label; ranking metrics are unofficial.
5. Baseline overwrite lock is “file exists,” not a hash pin.
6. 74-count inventory undercounts free numbers actually affecting scores.
