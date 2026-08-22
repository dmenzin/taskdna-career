# Algorithm specification (as-is)

This document describes the **current implementation**, not the intended future design.
Every equation and constant below is taken from code. Where behavior is inferred rather
than explicit, that is labeled.

**Source of truth:** branch `cursor/onet-generalization-pass-2-5159` at the commit that
added these specs. Do not treat older docs (`docs/TASK_DNA.md`, `docs/SCORING.md`) as
authoritative if they conflict with this file.

**What the product score is not:** Hidden-truth MAE does **not** measure Work Fit.
MAE measures 17-dimensional preference-vector recovery. Work Fit is a separate
displayed score. See `docs/EVALUATION_SPEC.md`.

---

## 1. End-to-end pipeline

### 1.1 Entry points

| Path | Function | File | Used by |
|---|---|---|---|
| Lab / O*NET eval | `observationsToProfile` | `src/lab/evaluate.ts` | `evaluateOnetSubject` |
| Generic user / paste | `buildProfileFromCareerInput` | `src/domain/engine.ts` | lab + UI |
| Demo persona | `buildUserProfile(personaId)` | `src/domain/engine.ts` | demo fixtures |
| Job scoring | `scoreJobs` | `src/domain/engine.ts` | eval + UI |
| Function scoring | `scoreFunctions` | `src/domain/engine.ts` | eval + UI |
| Hireability | `buildRequirementMatrix` | `src/domain/hireability.ts` | `scoreJobs` |
| Network / NBA | `createHumanOpportunityGraphFromIntake` | `src/domain/networkEngine.ts` | eval subsample + UI |

Lab subjects always take the generic path with `neutralPrior: true`.
`subject.truth` is never an argument to any inference function. **Explicit.**

### 1.2 Order of computation

```
raw text / CareerInput
  -> extractEvidence (first 10 sentences + up to 4 prefs + up to 4 dislikes)
      -> classifyEvidenceSentence + sentenceWorkSignals
  -> inferTaskDna (17 dimensions, 0–10)
  -> inferCapabilities (skill lexicon ∩ text, dumps stripped)
  -> profile.confidence = mean(dimension.confidence)
  -> for each job:
        inferJobVector
        pickPrimaryFunction (+ 2 secondaries)
        rawPredictedFit = vectorFit(user, job)
        predictedFit = rawPredictedFit - negativeFitRisk * 0.5
        jobConfidence = mean(profile.confidence, classificationConfidence)
        CAF = predictedFit - 2 * (1 - jobConfidence)
        hireability = matrix.hireability - seniorityPenalty * 0.35
        overall = 0.40*H + 0.30*CAF + 0.15*direction + 0.10*growth + 0.05*durability
                  - 0.12*negativeFitRisk
        actionTier, sellability, novelty
  -> scoreFunctions (same vectorFit vs function prototypes)
  -> network assessments (does not change TaskDNA or Work Fit)
  -> Next Best Action portfolio
```

Work Fit does not depend on Hireability. Overall depends on both.
Network scores do not feed back into TaskDNA or Work Fit. **Explicit.**

### 1.3 Inputs that exist

From `CareerInput` / lab `VirtualSubjectObservations`:

| Input | Influences | Ignored for preference? |
|---|---|---|
| `careerText` / `resumeText` | evidence class, TaskDNA (if preference-class), capabilities, Hireability haystack, novelty title-overlap | Exposure/success/unknown sentences do not move TaskDNA |
| `explicitPreferences` (max 4) | forced PREFERENCE class; TaskDNA if lexicon hits | Phrase with no lexicon hit contributes nothing |
| `explicitDislikes` (max 4) | forced DISLIKE (`10 - signal`); TaskDNA if lexicon hits | Same |
| `statedSkills` / `skills` | `capabilityKeywords` → Hireability / function hireability, not TaskDNA | Safe for MAE; questionable for Hireability |
| `currentField` / `apparentField` | novelty obviousness, evidence `context` | Not a TaskDNA prior |
| Occupation title | display; misleading-title regime substitutes generic titles | Title must not mint a job vector (candidate) |
| Occupation tasks / GWAs | exposure sentences; job description/responsibilities | `signalWeight = 0` for EXPOSURE |
| Occupation skills/knowledge | stuffing string; statedSkills | Keyword dumps stripped for Hireability |
| `taskDnaTruth` | evaluation only | Never passed to engine |
| Network intake | referrals / NBA only | Does not change Work Fit |
| O*NET importance/level ratings | ingested into corpus | **Not used** in `inferJobVector` |

Sentences after the first 10 unique sentences in `careerText` are dropped
(`extractEvidence` slice). Explicit lists are still appended. **Explicit.**
Potential bug: a late preference sentence can be discarded.

### 1.4 Pseudocode

```
function runPipeline(input):
  sentences = unique(split(input.careerText))[0:10]
  evidence = []
  for i, s in enumerate(sentences):
    cls = classifyEvidenceSentence(s)          # dislike > aspiration > pref > success > exposure > unknown
    work = sentenceWorkSignals(s)              # lexicon; missing dims omitted
    pref = invert(work) if cls == DISLIKE else work if weight(cls) > 0 else {}
    evidence.append({cls, pref, work, weight: PREFERENCE_SIGNAL_WEIGHT[cls],
                     reliability: evidenceReliability(s, i),
                     sourceGroup: sourceType + ":career text"})
  for phrase in input.explicitPreferences[0:4]:
    evidence.append({PREFERENCE, sentenceWorkSignals(phrase), weight: 1, reliability: 0.78,
                     sourceGroup: "explicit_preference:stated preferences"})
  for phrase in input.explicitDislikes[0:4]:
    sig = sentenceWorkSignals(phrase)
    evidence.append({DISLIKE, invert(sig), weight: 1, reliability: 0.78,
                     sourceGroup: "explicit_dislike:stated dislikes"})

  for dim in 17 dimensions:
    signals = evidence where pref[dim] is number AND signalWeight > 0
    base = 5 if neutralPrior else persona.preferenceVector[dim]
    evidenceValue = weightedAverage(signals, w = reliability * signalWeight) or base
    effective = min(4, nDistinctGroups + 0.5 * extraWithinGroupCappedAt2)
    w = 0.62 if effective >= 2 else 0.42 if effective >= 1 else 0
    value[dim] = clamp(base*(1-w) + evidenceValue*w, 0, 10)
    confidence[dim] = unknownAndNeutral ? 0.24 : clamp(formula, 0.2, 0.94)

  profile.confidence = mean(confidence)
  capabilities = inferCapabilities(text with Skills:/Keywords: stripped)

  for job in jobs:
    jobVec = inferJobVector(job)
    rawFit = clamp(10 - mean_d |user[d]-job[d]|, 1, 10)
    predictedFit = clamp(rawFit - negativeFit(friction)*0.5, 1, 10)
    hireability = clamp(matrixHireability(profile, job) - seniorityPenalty(job)*0.35, 1, 10)
    ... overall, tier ...
```

---

## 2. Evidence classification

**File:** `src/domain/evidence.ts`
**Functions:** `classifyEvidenceSentence`, `classifySentence`, `PREFERENCE_SIGNAL_WEIGHT`
**Version:** `evidence-classes.v1`

Priority (first match wins):

1. `DISLIKE_PATTERN` → `DISLIKE` (outranks preference so “I say I dislike X” stays dislike)
2. `ASPIRATION_PATTERN` → `ASPIRATIONAL`
3. `PREFERENCE_PATTERN` → `PREFERENCE`
4. `SUCCESS_PATTERN` → `SUCCESS`
5. `EXPOSURE_PATTERN` or resume-bullet verb → `EXPOSURE`
6. else `UNKNOWN`

| Class | `signalWeight` | Preference signals | Work signals |
|---|---|---|---|
| PREFERENCE | 1 | copy of work signals | lexicon |
| DISLIKE | 1 | `10 - work[d]` per hit dim | lexicon (uninverted) |
| ASPIRATIONAL | 0.7 | copy of work signals | lexicon |
| SUCCESS | 0 | empty | lexicon |
| EXPOSURE | 0 | empty | lexicon |
| UNKNOWN | 0 | empty | lexicon |

`inferTaskDna` additionally filters `signalWeight > 0`. Exposure/success/unknown
cannot move preference even if `inferredTaskDimensions` were populated.

### 2.1 “Exposure never moves TaskDNA”

**Mathematical meaning:** for every dimension \(d\),

\[
\text{signals}_d = \{ e : e.\text{inferredTaskDimensions}[d] \in \mathbb{R} \land e.\text{signalWeight} > 0 \}
\]

and `PREFERENCE_SIGNAL_WEIGHT.EXPOSURE = 0`, so exposure is excluded before the blend.

**In code:** `src/domain/evidence.ts` lines setting `signalWeight`, plus
`src/domain/engine.ts` `inferTaskDna` filter. **Explicit.**

Exposure still writes `workSignals` (used for job reading, not preference blend).
Lab occupation tasks are wrapped as `In this role I would …` so they classify as
EXPOSURE. **Explicit** in `observeOnetSubject`.

### 2.2 Reliability

`evidenceReliability(sentence, index)` in `src/domain/engine.ts`:

\[
r = \mathrm{clamp}\bigl(0.5 + \min(0.24, \mathrm{words}\cdot 0.015) + 0.08\cdot\mathbf{1}_{\text{specific}} - 0.18\cdot\mathbf{1}_{\text{vague}} + 0.01\cdot\mathrm{index},\; 0.35,\; 0.92\bigr)
\]

Specific regex: `\d|python|c\+\+|sql|matlab|logs|protocol|customers|experiments|root cause|stakeholder`.
Vague regex: `some projects|not sure|things|stuff|maybe`.
Explicit lists skip this and use **0.78**. **Hand-chosen.**

### 2.3 Source groups

`sourceGroupFor(sourceType, sourceReference)` → `"${sourceType}:${sourceReference}".toLowerCase()`.

Typical lab groups:

- `resume:career text` (first sentence only)
- `work_history:career text`
- `explicit_dislike:career text` (dislike-class sentences after the first)
- `explicit_preference:stated preferences`
- `explicit_dislike:stated dislikes`

Repeated sentences from one group get diminishing effective-signal credit (below).

---

## 3. TaskDNA / preference model

**File:** `src/domain/engine.ts` `inferTaskDna`
**Dimension list:** `DIMENSION_IDS` in `src/config/model.ts` (17 ids)
**Scale:** each dimension is a real number on **[0, 10]**. High = definition `high` pole; low = `low` pole. Neutral default **5** via `vector()`.
**Inference version:** `taskdna.v2` (`scoringConfig.inference.version`)

### 3.1 Dimensions

| id | High pole | Low pole |
|---|---|---|
| `problem_structure` | bounded and diagnosable | open-ended and poorly scoped |
| `measurable_feedback` | observable feedback loops | long uncertain feedback loops |
| `investigation_orientation` | diagnose, test, improve | document, coordinate, administer |
| `evidence_density` | logs, signals, measurements | administrative information |
| `experimentation_preference` | targeted experiments | rote execution |
| `scope_preference` | bounded subsystems | massive ambiguous systems |
| `software_as_tool` | software used to solve another problem | software detached from a real system |
| `reasoning_style` | hypothesis and causality | memorization and compliance |
| `creation_style` | constrained creation | blank-sheet invention |
| `real_system_grounding` | physical or observable systems | abstract process only |
| `closure_preference` | verify and close the loop | endless exploration |
| `causal_reasoning` | why did this happen | what happened |
| `integration_preference` | connect systems and evidence streams | isolated work |
| `customer_interaction_preference` | field/customer interaction | internal technical work |
| `coordination_preference` | stakeholder orchestration | individual deep investigation |
| `theory_vs_application` | applied behavior and testing | theoretical abstraction |
| `repetition_tolerance` | routine workflows acceptable | novel problem solving preferred |

There is **no normalization across dimensions**. They are independent 0–10 scores.
Missing evidence leaves the dimension at the prior (5 for lab). **Explicit.**

### 3.2 Initialization

- Lab / generic (`neutralPrior: true`): `baseValue = 5` for every dimension.
- Demo persona (`neutralPrior` false): `baseValue = persona.preferenceVector[d]` from fixtures.

### 3.3 Per-dimension blend

\[
\text{evidenceValue} = \frac{\sum_i r_i w_i x_i}{\sum_i r_i w_i}
\]

\[
\text{effective} = \min\bigl(4,\; G + 0.5 \sum_g \min(2, n_g-1)\bigr)
\]

\[
\alpha =
\begin{cases}
0.62 & \text{effective} \ge 2 \\
0.42 & \text{effective} \ge 1 \\
0 & \text{otherwise}
\end{cases}
\]

\[
\text{value} = \mathrm{clamp}\bigl((1-\alpha)\cdot\text{base} + \alpha\cdot\text{evidenceValue},\; 0,\; 10\bigr)
\]

- \(G\) = number of distinct `sourceGroup`s with a signal on this dimension.
- Extra sentences inside one group add 0.5 each, max 2 extras per group.
- Cap `maxEffectiveSignals = 4`.
- Repeated evidence **does accumulate**, with diminishing within-group credit. **Explicit.**

### 3.4 Conflict

`sameSide(signal, polarity)` plus distance ≥ **2.2** → `contradictoryEvidenceIds`.
Those signals still enter `evidenceValue` (they are averaged, not dropped).
They subtract **0.14** from confidence each. **Explicit.** Ambiguity: “side” vs
numeric invert can fight (dislike of “ambiguous scope” becomes high
`scope_preference` via `10-value`; see subject `v2-subject-003`).

### 3.5 Missing evidence

`signals.length === 0` → value stays at prior; if `neutralPrior`, confidence **0.24**.

### 3.6 Dimension confidence

If unknown + neutralPrior: **0.24**.

Else:

\[
c_0 = 0.3 + \text{effective}\cdot 0.075\cdot 1.6 + \text{agreementBonus} - 0.14\cdot n_{\text{contradict}} - 0.06\cdot\mathbf{1}_{\text{aspirationalOnly}} + 0.12\cdot\mathbf{1}_{\neg\text{neutralPrior}}
\]

\[
c = \mathrm{clamp}\bigl(\min(c_0,\; \text{sparse} ? 0.5 : 0.94),\; 0.2,\; 0.94\bigr)
\]

- `agreementBonus = 0.06` if ≥2 signals and range < 2.
- `sparse` if `evidence.length < 3` (whole-profile evidence count, not per dimension).
- Profile confidence = arithmetic mean of 17 dimension confidences.

**Not a probability.** No calibration against error. See Evaluation spec.

### 3.7 How evidence types change dimensions

| Evidence | How much |
|---|---|
| PREFERENCE | weight 1; lexicon value as-is; then blended with α ∈ {0.42, 0.62} |
| DISLIKE | weight 1; each hit dim becomes `10 - v` |
| ASPIRATIONAL | weight 0.7 in the weighted average; α unchanged; −0.06 confidence if *only* aspirational |
| SUCCESS / EXPOSURE / UNKNOWN | 0 |

Occupation/title never enter `inferTaskDna` as a prior. **Explicit.**
O*NET interacts with TaskDNA only by (a) supplying exposure text that is
zero-weighted, and (b) supplying job text that is read into a *job* vector.

Aspirations are weaker preference-side signals, not a separate vector.
Prior work exposure is work-structure vocabulary only.

### 3.8 Lexicon mismatch (evaluation validity, not leakage)

Lab phrases live in `PREFERENCE_PHRASES` (`src/lab/onetLab.ts`).
Extraction lives in `workStructureLexicon` (`src/domain/workStructure.ts`).
They are **not the same strings**.

Documented failures (explicit in forensic recompute):

- `"work where I can see the numbers move"` → PREFERENCE, **empty** `preferenceSignals`.
- `"a well-fenced area of responsibility"` → PREFERENCE, **empty** signals.
- `"long-horizon work without clear metrics"` as explicit dislike → often **empty** invert.
- `"well-scoped problems I can finish"` hits `bounded-defined` *and* `verify-close`, so it moves `measurable_feedback` even when the hidden truth on that dim is low.

### 3.9 Free coefficients inside TaskDNA inference

Official inventory (`inventoryParameters`): 7 numeric inference keys + 1 version string.
**Also hardcoded and not inventoried:** reliability formula, 2.2 contradiction gap,
0.06 agreement bonus, 0.14 contradiction penalty, 0.06 aspirational-only, 1.6
confidence multiplier, 0.3 intercept, 0.5 sparse cap, 0.2/0.94 clamps, lexicon
target values (~70 regex entries), `PREFERENCE_SIGNAL_WEIGHT`, invert `10-x`,
first-10 sentence cap, explicit-list caps of 4, reliability 0.78.

---

## 4. Job / function representation

### 4.1 O*NET 30.3 → `JobPosting`

**File:** `src/onet/adapter.ts` `occupationToJobPosting`
**Consumed tables:** `ONET_CONSUMED_TABLES` in `src/onet/types.ts`
(`occupation_data`, `task_statements`, `task_ratings`, `work_activities`,
`work_context`, skills, knowledge, abilities, education, job_zones, …).

**Used in the posting:**

- `title`, `description`
- top 8 GWA **names** concatenated into description
- top 8 task **statements** as `responsibilities`
- top 3 knowledge names + up to 3 non-generic essential skills as `requirements`
- up to 3 non-generic transferable skills as `preferredRequirements`
- `jobZone` → coarse seniority
- `stratumFor(occupation)` → `domain`

**Not used in the numeric job vector:** GWA importance/level, task ratings,
abilities, education tables, related occupations, reported titles.
Those fields may exist on the skeleton and still never enter `inferJobVector`.
**Explicit omission.**

Generic O*NET skills (Critical Thinking, Active Listening, …) are dropped.

### 4.2 `inferJobVector`

**File:** `src/fixtures/jobs.ts`

1. `matchFunctionByTasks(job)`
2. Special case `documentation-heavy-systems` → hardcoded vector
3. If `match.source === "task-content"` and the id is a **demo** `careerFunctions`
   member → return that function’s `taskDnaVector` (fixture mint)
4. Else `readWorkStructure(description + responsibilities + requirements)`
5. If `dimensionsCovered >= 3` → `emphasizeWorkStructure(reading.vector, 1.7)`
6. Else `vector({})` = all 5s

**“Titles no longer mint a vector”** means: a `source === "title-fallback"` match
does **not** copy a function prototype. Title can still affect function *label*
only if task-content missed and nearest-vector later picks a function; the
**vector itself** comes from work-structure text (or all-5s). **Explicit.**

Generic / O*NET jobs therefore get regex-derived 17-d vectors, missing dims = 5,
then non-neutral dims are stretched:

\[
x' = \mathrm{clamp}\bigl(5 + 1.7\cdot(x-5),\; 0,\; 10\bigr)
\]

`readWorkStructure` majority-side aggregation: for each dimension, if more
lexicon hits are on the high side (≥5) than the low side, average the high
hits; else average the low hits. Mixed language does not cancel to 5. **Explicit.**

### 4.3 Function assignment

**File:** `src/domain/engine.ts` `pickPrimaryFunction`, `analyzeJob`

- If task-content match is in the provided function set → that function
- Else nearest `vectorFit(jobVector, fn.taskDnaVector)` over the set
- One primary; two secondaries = next two nearest
- **A job has one primary.** It cannot map to multiple primaries. Secondaries are labels only.

Demo personas score against 13 `function.v1` functions.
Lab / generic profiles score against `allCareerFunctions` = 13 v1 + 10
`function.v2-extended` = **23** (`src/config/model.ts`).

### 4.4 Why `field-applications` maps 281 / 1,016

`field-applications` prototype (`function.v1`):

```
real_system_grounding 9.0
investigation_orientation 8.2
customer_interaction_preference 9.3
closure_preference 8.2
coordination_preference 7.2
evidence_density 7.4
(all others 5)
```

Nearest-vector assignment plus a lexicon that fires `customers|clients|public`,
`manage staff`, `supervise`, `equipment`, `operations` pulls many manager and
public-facing occupations here. **Inferred from vectors + `functionDistribution`
in the forensic recompute; not a dedicated pack.**

Forensic counts over 1,016 corpus occupations (candidate `pickPrimaryFunction`
on `allCareerFunctions`):

| Function | n |
|---|---|
| field-applications | **281** |
| operations-coordination | 178 |
| modeling-simulation | 81 |
| clinical-real-world-performance | 70 |
| product-discovery | 48 |
| customer-success-support | 45 |
| compliance-administration | 42 |
| consultative-selling | 40 |
| verification-validation | 34 |
| failure-analysis | 32 |
| test-development | 29 |
| investigative-analysis | 26 |
| instructional-delivery | 25 |
| sensor-algorithm-performance | 24 |
| controls-characterization | 22 |
| engineering-tools | 16 |
| people-operations | 14 |
| financial-analysis-audit | 7 |
| product-systems-engineering | 1 |
| scientific-software | 1 |

**Plausible mappings (same mechanism, closer to the written loop):** field-service /
applications-engineer style occupations with customer + equipment + diagnose language.

**Incorrect / over-absorbed examples (forensic sample):** Sales Managers,
Security Managers, Industrial Production Managers, Biofuels Production Managers,
Supply Chain Managers, Construction Managers, Food Service Managers,
Medical and Health Services Managers.

**Also questionable:** Data Scientists in shared eval (`onet-15-2051.00`) receiving
primaryFunction `field-applications` because the emphasized job vector has
`customer_interaction_preference = 10` and `real_system_grounding = 10`.

---

## 5. Work Fit

### 5.1 Vectors

- User: `profileVector(profile)` = the 17 inferred TaskDNA values
- Job: `analyzeJob(...).jobTaskDnaVector` = `inferJobVector`
- Missing job dims are 5 (`vector()`)

No learned weights. No cosine. Unweighted L1.

### 5.2 Equation

**File:** `src/domain/engine.ts` `vectorFit`, `scoreJobs`

\[
\mathrm{rawPredictedFit} = \mathrm{clamp}\Bigl(10 - \frac{1}{17}\sum_d |u_d - j_d|,\; 1,\; 10\Bigr)
\]

\[
\mathrm{predictedFit} = \mathrm{clamp}\bigl(\mathrm{rawPredictedFit} - r\cdot 0.5,\; 1,\; 10\bigr)
\]

where \(r =\) `negativeFit(profile, frictionFactors)`:

\[
r = \mathrm{clamp}\bigl(2.2\cdot |\{\text{persona.repellents overlapping friction text}\}| + 2\cdot\mathbf{1}_{\text{doc}+\text{doc repellent}},\; 0,\; 10\bigr)
\]

Lab generic personas have `repellents = explicitDislikes` (raw phrases). Overlap
is substring / word-length>4. Often \(r=0\) on O*NET jobs. **Partially inferred**
from empty `negativeFitRisk` on forensic top jobs.

Displayed Work Fit on a job is `predictedFit` (1–10). Function “fit” is
`vectorFit` with **no** negative-fit penalty.

### 5.3 Confidence-adjusted fit (CAF)

\[
\mathrm{CAF} = \mathrm{clamp}\bigl(\mathrm{predictedFit} - 2\cdot(1-c),\; 1,\; 10\bigr)
\]

Job \(c = \mathrm{clamp}((\text{profile.confidence} + \text{classificationConfidence})/2,\; 0.2,\; 0.95)\).

`classificationConfidence` = fixture canonicalization if task-content match;
else `min(job.canonicalizationConfidence, clamp(0.3 + coverage*0.75, 0.3, 0.9))`.
O*NET postings set `canonicalizationConfidence = 0.9`.

CAF is **not** Work Fit. It feeds Overall.

### 5.4 Overall (recommendation rank for jobs)

\[
\mathrm{overall} = \mathrm{clamp}(0.40 H + 0.30\,\mathrm{CAF} + 0.15 D + 0.10 G + 0.05 U,\; 1,\; 10) - 0.12 r
\]

- \(H\) hireability after seniority penalty
- \(D\) careerDirection \(= 0.62\cdot\mathrm{predictedFit} + 0.18\cdot\mathrm{capAlign} + 0.2\cdot(10-r)\)
- \(G\) technicalGrowth \(= 6 + 0.55\cdot|\text{hardGaps}| + 0.05\cdot|\text{requirements}|\)
- \(U\) durability = 7.9 if domain matches `software|analytics|robotics|medical|energy` else 6.8

Function overall uses Hireability from keyword overlap (`capabilityAlignment*0.75 +
legibility*0.25)*10`, growth **7.2**, durability **7.1**, and `noveltyFromFunction`.
**Different formula than jobs.** Functions are sorted by `overallPriority`, not by
Work Fit. Forensic example: `v2-subject-003` investigative-analysis has
predictedFit 9.25 but hireability 1.61 so it ranks 3rd.

### 5.5 Spread (evaluation, not a model output)

**File:** `src/lab/onetEvaluate.ts`

\[
\mathrm{fitSpread}_s = \max_j \mathrm{predictedFit}_{s,j} - \min_j \mathrm{predictedFit}_{s,j}
\]

over the **22** `SHARED_EVAL_OCCUPATION_CODES` jobs. Then
\(\overline{\mathrm{fitSpread}} = \frac{1}{n}\sum_s \mathrm{fitSpread}_s\).

This is a **range**, not a standard deviation. **Explicit.**

### 5.6 Technical-demo share

\[
\frac{|\{s : \text{top function by } \texttt{scoreFunctions} \text{ has } version=\texttt{function.v1}\}|}{n}
\]

Numerator: subjects whose #1 function (by **overallPriority**, not Work Fit) is
one of the 13 v1 demo functions. Denominator: 450. Candidate value **0.3578**.

### 5.7 Function collapse

Originally: unmatched jobs were all-5s; `modeling-simulation` is nearest to
neutral; ~1012/1016 occupations mapped there. **Inferred from Phase A behavior
+ nearest-to-neutral geometry; confirmed by frozen baseline report.**

Candidate collapse is different: `field-applications` over-absorbs (281) via
nearest-vector, not via all-5s.

### 5.8 Why baseline Work Fit mean 9.53 / spread 0.29

Phase A `inferJobVector` fell through to all-5s for ~99.6% of O*NET jobs.
Then \(\mathrm{vectorFit}(u, 5\mathbf{1}) = 10 - \mathrm{mean}|u_d-5|\).
Lab users are also near 5, so every job scores ~9.5 and the 22-job range is tiny.

### 5.9 Why candidate mean 7.41 / spread 1.99

Unmatched jobs now have distinct emphasized work-structure vectors, so L1
distances grow and the 22-job range becomes a real range. **This does not
require better preference recovery.** Same subjects, same truths, different
job vectors.

---

## 6. Hireability

**File:** `src/domain/hireability.ts` `buildRequirementMatrix`
**Version:** `hireability.v2`

### 6.1 Requirement × evidence

`parseJobRequirements` classifies each required/preferred string:

| Pattern | Category | Criticality |
|---|---|---|
| clinical credential, clearance, CPA, RN, 10+ years, PLC, high-voltage, … | LICENSE / WORK_AUTHORIZATION / OTHER | 1.0 FATAL-capable |
| C++, ROS, embedded, SysML, ISO 13485 | TOOL | 0.85 |
| seniority / years | SENIORITY | 0.55 |
| license/cert | LICENSE | 0.9 required / 0.4 preferred |
| degree | EDUCATION | 0.4 |
| python, sql, excel, … | TOOL | 0.45 / 0.2 |
| else | SKILL | 0.55 / 0.25 |

Generic O*NET skills dropped. Then `matchRequirement` against career text
**with `Skills:` / `Keywords:` dumps stripped** (`stripKeywordDumps`).

| MatchType | level | Typical gap |
|---|---|---|
| DIRECT_PROFESSIONAL | 7.5 | none / MINOR if preferred |
| DIRECT_PROJECT | 5.5 | none / MINOR |
| DIRECT_ACADEMIC | 4.5 | SIGNIFICANT if required |
| ADJACENT_TRANSFERABLE | 4.2 | SIGNIFICANT if required |
| INFERRED_WEAK (dump-only or no evidence) | 2.0–2.2 | CORE/SIGNIFICANT if required |
| HARD_MISSING | 0 | FATAL or CORE |
| CONTRADICTED | (negation regex) | treated as non-professional |

Years of experience: regex `(\d+)\s+years?` plus lead verbs → coarse rank vs
`job.seniority`; `seniorityAlignment = clamp(1 - 0.22*|Δrank|, 0.15, 1)`.
Degree: category only; no accredited-program model.
Hard requirements: FATAL/CORE gaps.
Preferred: lower criticality; miss is MINOR.

### 6.2 Score

Coverage of a slice = \((\text{nProf}\cdot 1 + \text{nOtherHit}\cdot 0.55)/n\), or 0.55 if empty.

\[
\begin{aligned}
H &= 1.8 + 5.4\,C_{\text{core}} + 0.8\,C_{\text{pref}} + 1.1\,P + 0.35\,A \\
  &\quad + 0.6\,S + 0.5\,L + 0.9\cdot\mathbf{1}_{C_{\text{core}}\ge 0.7 \land P\ge 0.5} \\
  &\quad - 3.2 n_{\text{fatal}} - 1.15 n_{\text{core}} - 0.45 n_{\text{sig}} - 0.12 n_{\text{minorTool}}
\end{aligned}
\]

then clamp [1, 10], then `scoreJobs` subtracts `seniorityPenalty*0.35`
(Manager 1.3, Staff 0.8, Senior 0.35).

None of these constants are in the official 74-count inventory. **Hand-chosen.**

### 6.3 “Skills dumps do not count as professional evidence”

**Explicit:**

- `stripKeywordDumps` removes `\b(?:skills|keywords)\s*:[^.]*`
- `keywordDumpOnly` → `INFERRED_WEAK` unless the needle also appears in
  professional context (`delivered|used|built|…`)
- `inferCapabilities` ignores evidence whose text matches `skills|keywords:`
- Lab stuffing is ` Skills: ${skills, knowledge, top 6 GWAs}.`

### 6.4 Test: “Stuffing buys Hireability = false”

**File:** `scripts/onet-external-shock.ts`

```
stuffed = mean hireability over jobScores of subjects with resume containing " Skills: "
unstuffed = mean hireability over non-stuffed adversarial subjects' jobScores
stuffingBuysHireability = stuffed > unstuffed + 0.5
```

Failure = stuffed mean exceeds unstuffed-adversarial mean by more than 0.5.
Stuffing is generated only on adversarial subjects with p=0.25
(`observeOnetSubject`). Current candidate: **false**.

---

## 7. Confidence (product)

**Supposed to represent:** heuristic certainty of the inferred preference
vector / job classification. **Not** P(correct) and **not** 1/error.

**Profile:** mean of 17 dim confidences (formula in §3.6).
**Job score confidence:** mean(profile, classificationConfidence).

Empirical (450 lab subjects, forensic recompute):

| | |
|---|---|
| mean | 0.343 |
| min | 0.240 |
| max | 0.505 |
| Pearson(confidence, subject MAE) | **+0.063** |

Almost nobody exceeds 0.5 because of the sparse cap and the 0.24 unknown floor
dominating empty dims. Higher confidence is **slightly associated with higher
error**. Uninformative as a ranking of reliability. **Do not fix in this pass.**

---

## 8. Referral / networking

**File:** `src/domain/networkEngine.ts` `assessContactForOpportunity`, `askIsEligible`

Does **not** modify TaskDNA or Work Fit.

\[
\begin{aligned}
\text{relationshipStrength} &= \mathrm{avg}(\text{warmth},\text{trust},\text{familiarity},\text{reciprocity}) - 0.15\cdot\text{dormancy} \\
\text{observedWork} &= |sharedWork|>0 \;\lor\; \exists\; k \in \text{whatTheyKnowAboutUser}: k \not\ni \text{``field interest only''} \\
\text{credibility} &= \mathrm{clamp}((5.5\text{ if observed else }1) + 0.28\cdot\text{trust} + 0.18\cdot\text{familiarity} - 2.5\cdot\mathbf{1}_{\text{ALUM}},\; 0,\; 10) \\
\text{referralAbility} &= 0 \text{ if boundary else } 0.45\cdot\text{companyRel} + 0.32\cdot\text{credibility} + 3\cdot\mathbf{1}_{\text{material offer}} \\
\text{access} &= 0.25 I + 0.25 R + 0.22 C + 0.18 A + 0.10 S
\end{aligned}
\]

`askIsEligible(REFERRAL)`:

```
explicitOffer OR (referralAbility ≥ 6 AND credibility ≥ 6 AND observedWork)
AND NOT boundary AND NOT already-submitted
```

**Good referral source:** someone who has seen the user’s work, is trusted,
and can speak to the company/function — even if their aggregate “access” is
modest.

**Poor referral source:** a highly connected alum/public contact with
`whatTheyKnowAboutUser = ["Knows field only"]` / no `sharedWork`.
**Ambiguity:** `assessContactForOpportunity` tests `"field interest only"`
while `askIsEligible` tests `"field only"`. Lab text is `"Knows field only"`.
The assessor `includes("field interest only")` may fail to treat lab phrasing
as non-observed. **Potential bug; not fixed here.**

Access is a mix used for path scoring. It does **not** unlock a forbidden ask
(`chooseAskType` comment: “Aggregate access never unlocks a forbidden ask”).

---

## 9. Next Best Action

**File:** `src/domain/networkEngine.ts` `planNextBestActions`
**Kind:** **rules + heuristic weighted priority**, not optimization (no ILP / bandit).

`DEFAULT_TIME_BUDGET_MINUTES = 90`. Reserve logic: skip adding if
`remaining < time + 18` when seeding deadline applies (keeps ~18 min slack).
Max **2** applies with `urgency ≥ 7`. Force one `APPLY_TO_JOB` if none
(“at least one live apply”). Cap 8 actions; max 3 of one type; max 4
referral/intro/advice combined.

Priority:

\[
p = 0.26\,V_{\text{opp}} + 0.20\,\text{networkValue} + 0.12\,I + 0.12\,U + 0.14\,\text{readiness}
  + 0.08\,\text{strategic} + 0.08\,\text{direction} - 0.18\,\text{social} - 0.06\,\text{time}
\]

(`actionPriority`; readiness/strategic/direction terms are 0 unless set on the action).

### Possible action types (`NextBestAction.actionType`)

| Type | Trigger |
|---|---|
| `APPLY_TO_JOB` | pursuit `applyNow`, or fallback if portfolio has no apply |
| `ASK_REFERRAL` | eligible referral/resume-forward ask |
| `ASK_INTRO` | intro / hiring-manager / second-degree ask |
| `ASK_ADVICE` | default remaining asks |
| `SEND_REQUESTED_MATERIAL` | explicit material offer |
| `RECONNECT_PERSON` | dormant former strong tie |
| `BUILD_NETWORK_IN_FUNCTION` | <2 contacts covering a top-2 function |
| `CONTACT_PERSON`, `FOLLOW_UP`, `THANK_CONTACT`, `SCHEDULE_CONVERSATION`, `LOG_OUTCOME`, `WAIT`, `DO_NOT_CONTACT`, `SKILL_GAP_ACTION` | typed in `networkTypes.ts`; not all are emitted by `planNextBestActions` |

Weak-job advocacy (`overall < 6.8`) is filtered at portfolio construction for
`REFERRAL_REQUEST`, not inside `askIsEligible`.

---

## 10. Worked example: `v2-subject-003`

Recomputed from the live engine (same seed `20260823`). Numbers are actual.

### Subject evidence (algorithm-visible)

- Occupation (hidden from preference): Web Developers `15-1254.00`, software
- `occupationFitsPreference = false`, burned out, career changer
- Title may be misleading; exposure sentences are O*NET web-dev tasks
- Stated prefs: “well-scoped problems I can finish”, “root-cause investigation”
- Stated dislikes: “long-horizon work without clear metrics”, “very broad ambiguous scope”

Preference-class rows that actually carry dims (others are EXPOSURE/SUCCESS/UNKNOWN or empty-lexicon):

| id | class | w | r | dims |
|---|---|---|---|---|
| ev-…-6 | PREFERENCE | 1 | 0.70 | problem 7.8, measurable 6.6, investigation 8.8, evidence 7.2, scope 7.2, closure 8, causal 8.6 |
| ev-…-7 | DISLIKE | 1 | 0.74 | problem 7.2, scope 6.8, coordination 3.2 |
| ev-…-9 | ASPIRATIONAL | 0.7 | 0.82 | problem 7.8, measurable 6.6, scope 7.2, closure 8 |
| pref-1 | PREFERENCE | 1 | 0.78 | problem 7.8, measurable 6.6, scope 7.2, closure 8 |
| pref-2 | PREFERENCE | 1 | 0.78 | investigation 8.8, evidence 7.2, causal 8.6 |
| dislike-2 | DISLIKE | 1 | 0.78 | problem 7.2, scope 6.8, coordination 3.2 |

Burnout sentence and explicit “long-horizon…” dislike: **empty dims**.

### Calculator check (`problem_structure`)

Signals: 7.8 (r=0.70), 7.2 (0.74), 7.8 (0.82·0.7=0.574), 7.8 (0.78), 7.2 (0.78)
evidenceValue ≈ 7.57
Groups: work_history, explicit_dislike:career text, explicit_preference, explicit_dislike:stated
effective ≥ 2 → α = 0.62
value = 5·0.38 + 7.57·0.62 ≈ **6.58** (engine: **6.578**)
truth **6.580**, abs error **0.002**

### `scope_preference` (failure mode)

Truth **1.965** (wants low/broad? wait: truth 1.965 = low-scope-preference =
aversion to bounded scope / lean toward massive scope — actually low means
“massive ambiguous systems” pole). The person *dislikes* “very broad ambiguous
scope”, which the lexicon maps to high `scope_preference` after invert
(`10-3.2` style hits become 6.8–7.2). Inferred **6.259**, error **4.294**.

### Full 17-d recovery

| dim | truth | inferred | \|err\| | conf |
|---|---|---|---|---|
| problem_structure | 6.580 | 6.578 | 0.002 | 0.66 |
| measurable_feedback | 2.892 | 5.992 | 3.100 | 0.72 |
| investigation_orientation | (see dump) | ~7.2 | ~1.1 | 0.60 |
| evidence_density | — | ~6.3 | — | 0.60 |
| experimentation_preference | — | 5 | — | 0.24 |
| scope_preference | 1.965 | 6.259 | 4.294 | 0.66 |
| software_as_tool | 6.670 | 5 | 1.670 | 0.24 |
| reasoning_style | 8.717 | 5 | 3.717 | 0.24 |
| creation_style | 8.102 | 5 | 3.102 | 0.24 |
| real_system_grounding | 3.258 | 5 | 1.742 | 0.24 |
| closure_preference | 7.672 | 6.860 | 0.812 | 0.66 |
| causal_reasoning | 7.928 | 7.232 | 0.696 | 0.60 |
| integration_preference | 6.194 | 5 | 1.194 | 0.24 |
| customer_interaction_preference | 6.464 | 5 | 1.464 | 0.24 |
| coordination_preference | 2.684 | 3.884 | 1.200 | 0.60 |
| theory_vs_application | 8.396 | 5 | 3.396 | 0.24 |
| repetition_tolerance | 2.395 | 5 | 2.605 | 0.24 |

Subject MAE **1.8347581779845115**
Contribution to overall MAE: \(1.834758/450 = 0.004077\)
Profile confidence **0.445**

Eight dimensions never leave 5. That is missing-lexicon evidence, not a 5-as-belief.

### Functions (sorted by overallPriority, not fit)

| rank | id | predictedFit | hireability | overall |
|---|---|---|---|---|
| 1 | research-inquiry | 8.732 | 4.594 | 6.485 |
| 2 | failure-analysis | 8.645 | 3.849 | 6.152 |
| 3 | investigative-analysis | **9.245** | 1.611 | 5.500 |
| derived hidden-best | investigative-analysis | truth-fit 8.010 | — | — |

Hidden-best is **not stored**. It is `argmax_f vectorFit(taskDnaTruth, f.vector)`.
The product ranks research-inquiry first because Hireability dominates.

### Shared-job Work Fit (top 3 by overall)

| Job | job primaryFunction | predictedFit | H | CAF | overall |
|---|---|---|---|---|---|
| Financial and Investment Analysts | instructional-delivery | 8.087 | 5.968 | 7.096 | 6.627 |
| Project Management Specialists | product-discovery | 7.953 | 5.968 | 7.051 | 6.601 |
| Data Scientists | field-applications | 7.477 | 5.968 | 6.618 | 6.482 |

`professionalShare = 0` on these rows: stated skills are generic O*NET names
that do not match job requirements after dump filters.
`fitSpread` for this subject on 22 jobs: **1.629**.

---

## 11. Score dependency graph

```
preference evidence ──► TaskDNA values ──► vectorFit ──► rawPredictedFit ──► predictedFit (Work Fit)
exposure evidence ─x─► TaskDNA (blocked)
exposure/job text ──► job vector ─────────► vectorFit
TaskDNA confidence ──► profile.confidence ──► job confidence ──► CAF ──► Overall
capabilities + job reqs ──► Hireability ──► Overall ──► action tier / NBA apply
repellents ∩ friction ──► negativeFitRisk ──► predictedFit and Overall
network ──► referral/NBA only
```

---

## 12. Known as-is ambiguities (not fixed here)

1. Lab preference lexicon ≠ work-structure lexicon → empty PREFERENCE rows.
2. DISLIKE invert can raise the dimension the person wanted low (`v2-subject-003` scope).
3. First-10-sentence cap.
4. `"field interest only"` vs `"field only"` vs lab `"Knows field only"`.
5. Function rank ≠ Work-Fit rank (Hireability 0.40).
6. `inventoryParameters` counts a version string as 1 of “74 coefficients” and
   omits Hireability / lexicon / emphasize / CAF / many hardcoded numbers.
7. Official evaluator does not compute ranking-vs-hidden-best.
8. GWA numeric ratings unused.
