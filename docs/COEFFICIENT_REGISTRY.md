# Coefficient registry (as-is)

Official count **74** comes from `inventoryParameters()` in `src/lab/parameters.ts`,
written to `artifacts/logic_audit/parameters.json` by `pnpm audit:parameters`.

That function concatenates:

| Block | Count |
|---|---|
| `scoringConfig.inference` (7 numbers + 1 version string) | 8 |
| `scoringConfig.weights` | 5 |
| `scoringConfig.tiers` (flattened) | 8 |
| `scoringConfig.novelty` | 3 |
| `networkModelConfig.accessWeights` | 5 |
| `networkModelConfig.pathWeights` | 10 |
| `networkModelConfig.actionWeights` | 9 |
| `askRules.*.socialCost` | 26 |
| **Total** | **74** |

**Important:** the 74th “coefficient” includes `inference.version = "taskdna.v2"`
(a string). The inventory **omits** Hireability constants, evidence-class
weights, work-structure lexicon values, `emphasizeWorkStructure(1.7)`,
`confidenceAdjustedFitPenalty` (2), overall `-0.12 * negativeFitRisk`,
reliability formula, and many other free numbers. Those are listed in §2.

**Provenance legend**

| Class | Meaning |
|---|---|
| empirically estimated | fit to data with a stated estimator |
| tuned against development evaluation | changed to improve design/validation MAE or properties |
| hand-chosen | authored as a product/heuristic judgment |
| legacy | carried from earlier scoring.v1 / network.v1 without re-derivation |
| arbitrary/default | round number or placeholder with no recorded rationale beyond “needed a number” |
| unknown | no comment in code or docs beyond a generic justification string |

In this pass: **0 empirically estimated**, **0 tuned against development or
holdout MAE**. Holdout paired ΔMAE ≈ 0. Justifications in `parameters.json`
are boilerplate (“Versioned heuristic; not a calibrated probability.”).

Sensitivity: `pnpm audit:sensitivity` exists for the v1 lab; **no published
sensitivity of the 74 against the 450-subject O*NET MAE** was found.

---

## 1. Official 74

### 1.1 TaskDNA inference — `src/config/model.ts` `scoringConfig.inference`

Used by `inferTaskDna` / `scoreJobs` in `src/domain/engine.ts`.

| ID | Value | Kind | Affects | Rationale in code | Provenance | Sensitivity known? |
|---|---|---|---|---|---|---|
| `inference.version` | `"taskdna.v2"` | version | stamped on each dimension | version label, not a weight | legacy | n/a |
| `inference.evidenceWeightTwoPlus` | 0.62 | coefficient | blend α when effective ≥ 2 | move toward evidence but keep prior | hand-chosen | no (O*NET) |
| `inference.evidenceWeightSingle` | 0.42 | coefficient | blend α when effective = 1 | weaker single-signal pull | hand-chosen | no |
| `inference.maxEffectiveSignals` | 4 | coefficient | cap on effective count | duplicate evidence cannot farm confidence | hand-chosen | no |
| `inference.signalConfidenceStep` | 0.075 | coefficient | +0.075×1.6 per effective signal | confidence ramp | hand-chosen | no |
| `inference.sparseEvidenceThreshold` | 3 | coefficient | `evidence.length < 3` → conf cap 0.5 | sparse cliff | hand-chosen | no |
| `inference.unknownDimensionConfidence` | 0.24 | coefficient | empty dim + neutralPrior | unknown ≠ confident 5 | hand-chosen | no |
| `inference.negativeFitPenalty` | 0.5 | coefficient | `predictedFit -= risk * 0.5` | Work Fit haircut | hand-chosen | no |

**Interactions:** α ∈ {0, 0.42, 0.62} interacts with source-group effective-count
and with prior 5. `signalConfidenceStep` is hardcoded-multiplied by **1.6**.
`negativeFitPenalty` interacts with `negativeFit` (2.2 per overlapping repellent),
which is **not** in the 74.

### 1.2 Overall weights — `scoringConfig.weights`

Used by `calculateOverallScore`.

| ID | Value | Affects | Provenance |
|---|---|---|---|
| `overall.weight.hireability` | 0.40 | job/function Overall | hand-chosen; **dominates rank** |
| `overall.weight.confidenceAdjustedFit` | 0.30 | Overall via CAF | hand-chosen |
| `overall.weight.careerDirection` | 0.15 | Overall | hand-chosen |
| `overall.weight.technicalGrowth` | 0.10 | Overall | hand-chosen / arbitrary |
| `overall.weight.durability` | 0.05 | Overall | hand-chosen / arbitrary |

Must sum to 1.0 (they do). Interact with CAF penalty 2 and Hireability scale.
A hireability-1.6 / fit-9.2 function loses to hireability-4.6 / fit-8.7
(`v2-subject-003`).

### 1.3 Action-tier cliffs — `scoringConfig.tiers`

Used by `determineActionTier`.

| ID | Value | Rule |
|---|---|---|
| `tier.attackFirst.overall` | 8.2 | AND with hire≥7.5 and fit≥8.4 → ATTACK_FIRST |
| `tier.attackFirst.hireability` | 7.5 | |
| `tier.attackFirst.fit` | 8.4 | |
| `tier.coreApply.hireability` | 7.5 | else hire≥7.5 → CORE_APPLY |
| `tier.highFitStretch.hireabilityMin` | 6.5 | window + fit≥8.7 + conf≥0.65 + hardGaps<2 |
| `tier.highFitStretch.hireabilityMax` | 7.49 | |
| `tier.highFitStretch.fit` | 8.7 | |
| `tier.highFitStretch.confidence` | 0.65 | **almost never fires** (lab max conf ≈ 0.50) |

Provenance: hand-chosen cliffs. `FUTURE_EXEMPLAR` uses a **hardcoded** fit≥8.2
not in the inventory.

### 1.4 Novelty — `scoringConfig.novelty`

Used by `noveltyScore`.

| ID | Value | Affects | Provenance |
|---|---|---|---|
| `novelty.threshold` | 7.5 | consumer novelty gate; also cap when gate fails (`threshold-0.1`) | hand-chosen |
| `novelty.minimumRelevantFit` | 7.4 | must clear before title-distance can promote | hand-chosen |
| `novelty.minimumCapabilityTransfer` | 0.35 | same gate | hand-chosen |

Interacts with hardcoded `titleDistance` 2.4/1.0, `titleObvious` −1.1/1.8,
`transfer*2.6`, `fit*0.46`.

### 1.5 Network access mix — `src/config/network.ts` `accessWeights`

Used when aggregating opportunity access (not Work Fit).

| ID | Value | Role | Provenance |
|---|---|---|---|
| `network.access.information` | 0.25 | access mix | hand-chosen / legacy |
| `network.access.routing` | 0.25 | | hand-chosen / legacy |
| `network.access.credibility` | 0.22 | | hand-chosen |
| `network.access.advocacy` | 0.18 | | hand-chosen |
| `network.access.secondDegree` | 0.10 | | hand-chosen / arbitrary |

Sum = 1.00. **Does not unlock referral** (`askIsEligible` uses gates, not this mix).

### 1.6 Pathfinding — `pathWeights`

| ID | Value | Role | Provenance |
|---|---|---|---|
| `network.path.destinationRelevance` | 0.22 | pathScore term | hand-chosen / legacy |
| `network.path.firstHopReadiness` | 0.20 | | hand-chosen |
| `network.path.edgeCertainty` | 0.14 | | hand-chosen |
| `network.path.routingPlausibility` | 0.14 | | hand-chosen |
| `network.path.credibilityTransfer` | 0.10 | | hand-chosen |
| `network.path.advocacyPotential` | 0.08 | | hand-chosen |
| `network.path.currentOrgRelevance` | 0.07 | | hand-chosen |
| `network.path.confidence` | 0.05 | | hand-chosen |
| `network.path.hopPenalty` | 0.75 | multiplicative / subtractive hop cost | hand-chosen |
| `network.path.socialCostPenalty` | 0.18 | path penalty | hand-chosen |

Terms interact; hopPenalty is a different unit than the 0–1 mix.

### 1.7 Next Best Action — `actionWeights`

Used by `actionPriority`.

| ID | Value | Role | Provenance |
|---|---|---|---|
| `network.action.intrinsicOpportunityPriority` | 0.26 | × opportunityValue | hand-chosen |
| `network.action.expectedAccessGain` | 0.20 | × networkValue | hand-chosen |
| `network.action.informationGain` | 0.12 | | hand-chosen |
| `network.action.urgency` | 0.12 | | hand-chosen |
| `network.action.readiness` | 0.14 | often 0 on constructed actions | hand-chosen |
| `network.action.strategicNetworkValue` | 0.08 | often 0 | hand-chosen |
| `network.action.careerDirectionValue` | 0.08 | often 0 | hand-chosen |
| `network.action.socialCostPenalty` | 0.18 | minus | hand-chosen |
| `network.action.timeCostPenalty` | 0.06 | minus | hand-chosen |

Interacts with hardcoded 90-minute budget, 18-minute reserve, max 2 urgent
applies, 15-minute apply cost, 18-minute ask cost.

### 1.8 Ask social costs — `askRules`

Used as priors in interaction planning. **Not outcome probabilities.**

| ID | Value | Provenance |
|---|---|---|
| `ask.RECONNECT.socialCost` | 2 | arbitrary/legacy integer |
| `ask.CATCH_UP.socialCost` | 3 | arbitrary |
| `ask.CAREER_PERSPECTIVE.socialCost` | 3 | arbitrary |
| `ask.FUNCTION_INSIGHT.socialCost` | 3 | arbitrary |
| `ask.ROLE_REALITY.socialCost` | 3 | arbitrary |
| `ask.COMPANY_INFORMATION.socialCost` | 3 | arbitrary |
| `ask.TEAM_INFORMATION.socialCost` | 4 | arbitrary |
| `ask.SKILL_ADVICE.socialCost` | 2 | arbitrary |
| `ask.FIT_REALITY_CHECK.socialCost` | 4 | arbitrary |
| `ask.WHO_SHOULD_I_TALK_TO.socialCost` | 3 | arbitrary |
| `ask.INTRODUCTION_REQUEST.socialCost` | 6 | hand-chosen (higher-ask) |
| `ask.SECOND_DEGREE_INTRO_REQUEST.socialCost` | 6 | hand-chosen |
| `ask.REFERRAL_REQUEST.socialCost` | 8 | hand-chosen |
| `ask.RESUME_FORWARD_REQUEST.socialCost` | 7 | hand-chosen |
| `ask.HIRING_MANAGER_INTRO_REQUEST.socialCost` | 8 | hand-chosen |
| `ask.RECRUITER_INTRO_REQUEST.socialCost` | 6 | hand-chosen |
| `ask.REFERENCE_REQUEST.socialCost` | 8 | hand-chosen |
| `ask.HIDDEN_OPPORTUNITY_QUERY.socialCost` | 4 | arbitrary |
| `ask.APPLICATION_STATUS_HELP.socialCost` | 5 | arbitrary |
| `ask.POST_APPLICATION_NOTE.socialCost` | 4 | arbitrary |
| `ask.FOLLOW_UP.socialCost` | 3 | arbitrary |
| `ask.THANK_YOU.socialCost` | 1 | arbitrary |
| `ask.RELATIONSHIP_MAINTENANCE.socialCost` | 2 | arbitrary |
| `ask.SHARE_USEFUL_RESOURCE.socialCost` | 2 | arbitrary |
| `ask.SCHEDULE_CONVERSATION.socialCost` | 4 | arbitrary |
| `ask.SEND_REQUESTED_MATERIAL.socialCost` | 1 | hand-chosen (already offered) |

---

## 2. Free numbers **not** in the 74

These still change recommendations. Treating “74” as complete is incorrect.

### 2.1 Evidence / TaskDNA (uninventoried)

| Coefficient | Value | File / function | Affects | Provenance |
|---|---|---|---|---|
| `PREFERENCE_SIGNAL_WEIGHT.PREFERENCE` | 1 | `evidence.ts` | who enters the blend | hand-chosen (invariant) |
| `PREFERENCE_SIGNAL_WEIGHT.DISLIKE` | 1 | | | hand-chosen |
| `PREFERENCE_SIGNAL_WEIGHT.ASPIRATIONAL` | 0.7 | | | hand-chosen |
| EXPOSURE / SUCCESS / UNKNOWN | 0 | | exposure never moves TaskDNA | hand-chosen invariant |
| invert | `10 - v` | `invert` | dislike polarity | arbitrary scale choice |
| contradiction gap | 2.2 | `inferTaskDna` | contradictoryEvidenceIds | hand-chosen |
| agreementBonus | 0.06 | | confidence | arbitrary |
| contradiction conf penalty | 0.14 | | confidence | arbitrary |
| aspirational-only penalty | 0.06 | | confidence | arbitrary |
| confidence intercept | 0.3 | | | arbitrary |
| confidence step multiplier | 1.6 | | with 0.075 | unknown |
| sparse conf cap | 0.5 | | | hand-chosen |
| conf clamps | [0.2, 0.94] | | | arbitrary |
| non-neutralPrior bonus | 0.12 | | demo personas only | legacy |
| extra-within-group credit | 0.5, max 2 extras | | effective signals | hand-chosen |
| sentence cap | 10 | `extractEvidence` | dropped evidence | arbitrary |
| explicit list cap | 4 + 4 | | | arbitrary |
| explicit reliability | 0.78 | | | arbitrary |
| reliability base / clamps | 0.5, 0.35–0.92, … | `evidenceReliability` | blend weights | hand-chosen |
| lexicon target values | ~3–9.2 per regex | `workStructure.ts` | every signal | hand-chosen domain knowledge |
| `emphasizeWorkStructure` factor | 1.7 | `workStructure.ts` | job vectors | hand-chosen |
| coverage threshold to emphasize | 3 dims | `inferJobVector` | else all-5s | hand-chosen |

### 2.2 Scoring (uninventoried)

| Coefficient | Value | Function | Affects | Provenance |
|---|---|---|---|---|
| `confidenceAdjustedFitPenalty` | 2 | `calculateConfidenceAdjustedFit` | CAF | hand-chosen; **in scoringConfig but not inventoried** |
| overall negative-fit term | 0.12 | `scoreJobs` | Overall | hand-chosen |
| job careerDirection mix | 0.62 / 0.18 / 0.20 | `scoreJobs` | D | unknown |
| capabilityAlignment mix | 8, 2 | `scoreJobs` | capAlign | unknown |
| technicalGrowth base / gaps | 6, 0.55, 0.05 | | G | arbitrary |
| durability | 7.9 / 6.8 | domain regex | U | arbitrary |
| function hireability mix | 0.75 / 0.25 | `scoreFunctions` | function H | legacy |
| function growth / durability | 7.2 / 7.1 | `scoreFunctions` | | arbitrary |
| function careerDirection | 0.7 fit + 0.3 novelty | | | unknown |
| `negativeFit` per repellent | 2.2 | `negativeFit` | risk | hand-chosen |
| documentation extra | 2 | | | arbitrary |
| FUTURE_EXEMPLAR fit gate | 8.2 | `determineActionTier` | tier | hand-chosen |
| HIGH_FIT_STRETCH hardGaps | < 2 | | tier | arbitrary |
| seniorityPenalty | 1.3 / 0.8 / 0.35 | `seniorityPenalty` | H | hand-chosen |
| novelty internals | 2.4, 1.0, −1.1, 1.8, 2.6, 0.46, 4.5, 0.2 | `noveltyScore` | novelty | unknown |
| function novelty | 6.5 / 8.2 | `noveltyFromFunction` | | arbitrary |
| commute minutes | 45 / 55 / 60 / 70 | `scoringConfig.commuteRules` | commute (if used) | arbitrary |
| default home | `"Boston, MA"` | | | legacy demo |

### 2.3 Hireability (entirely outside the 74)

`src/domain/hireability.ts` `buildRequirementMatrix`:

| Term | Value | Role | Provenance |
|---|---|---|---|
| intercept | 1.8 | | arbitrary |
| coreCoverage | 5.4 | | hand-chosen |
| preferredCoverage | 0.8 | | hand-chosen |
| professionalShare | 1.1 | | hand-chosen |
| adjacentShare | 0.35 | | hand-chosen |
| seniorityAlignment | 0.6 | | hand-chosen |
| recruiterLegibility | 0.5 | | hand-chosen |
| core∧prof bonus | 0.9 if C≥0.7 and P≥0.5 | | hand-chosen |
| fatal | 3.2 each | | hand-chosen |
| core gap | 1.15 each | | hand-chosen |
| significant | 0.45 each | | hand-chosen |
| minor tool | 0.12 each | | hand-chosen |
| empty-slice coverage default | 0.55 | | arbitrary |
| non-professional hit weight | 0.55 | | hand-chosen |
| match levels | 7.5 / 5.5 / 4.5 / 4.2 / 2.2 / 0 | | arbitrary |
| seniority delta | 0.22 per rank | | arbitrary |
| stuffing fail margin | 0.5 | `onet-external-shock.ts` | hand-chosen |

### 2.4 Network (uninventoried gates)

| Term | Value | Function | Provenance |
|---|---|---|---|
| observedWork credit | 5.5 vs 1 | `credibilityValue` | hand-chosen |
| trust / familiarity | 0.28 / 0.18 | | hand-chosen |
| ALUM penalty | 2.5 | | hand-chosen |
| companyRel / credibility in referralAbility | 0.45 / 0.32 | | hand-chosen |
| material-offer bump | 3 | | arbitrary |
| referral eligibility floors | 6 and 6 | `askIsEligible` | hand-chosen |
| reference floor | 7 | | hand-chosen |
| intro routing floor | 5.5 | | arbitrary |
| reconnect dormancy | 6 | | arbitrary |
| weak-job referral skip | overall < 6.8 | portfolio | hand-chosen |
| time budget | 90 min | `planNextBestActions` | hand-chosen |
| slack reserve | 18 min | | hand-chosen |
| max urgent applies | 2 | | hand-chosen |
| apply duration | 15 min | | arbitrary |
| ask duration | 18 min | | arbitrary |

### 2.5 Lab generator (affects MAE targets, not the engine)

| Term | Value | Role |
|---|---|---|
| Unif low / high | 1.5 / 8.8 | `randomVector` |
| occupationFits p | 0.35 / 0.20 | |
| nudge mix | 0.4 / 0.6 | `nudgeTowardOccupation` |
| attractor / repellent cut | 7.2 / 3.2 | |
| phrase eligibility | ≥6.5 / ≤4 | `preferencePhrases` |

These are **evaluation design parameters**. Changing them changes MAE without
changing the algorithm. They must not be tuned to flatter the engine.

---

## 3. Interaction map (high leverage)

1. **α (0.42/0.62) × lexicon hit/miss × prior 5** — empty lexicon ⇒ MAE ≈ |truth−5|.
2. **DISLIKE invert × majority-side job reading** — same phrase can raise user
   dim and job dim in opposite conceptual directions.
3. **Hireability 0.40 × CAF 0.30** — function/job rank ≠ Work-Fit rank.
4. **emphasize 1.7 × nearest-function** — stretches customer/public dims toward
   `field-applications` (281/1016).
5. **EXPOSURE weight 0 × occupation-nudge truths** — subjects who like their
   job lose the occupation-shaped signal; coordination MAE rose +0.22.
6. **confidence formula × CAF penalty 2** — uninformative conf still subtracts
   up to ~1.5 CAF points (`2*(1-0.24)=1.52`).
7. **HIGH_FIT_STRETCH conf 0.65 vs empirical max 0.50** — dead tier on this lab.

---

## 4. What “74 free coefficients” means in practice

It is an **inventory of `scoringConfig` + network weight/cost tables**, not a
complete parameter count and not a claim that 74 knobs were tuned.

A complete free-parameter count, if anyone needs one later, must include
§2. That count is **well above 74** (Hireability alone is ~20). Do not reduce
the official 74 without changing `inventoryParameters()`; do not claim
calibration of numbers that were never estimated.
