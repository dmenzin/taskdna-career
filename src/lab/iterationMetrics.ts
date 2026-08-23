import { DIMENSION_IDS } from "@/config/model";
import { observationsToProfile } from "@/lab/evaluate";
import type { DimensionId, UserEvidence } from "@/domain/types";
import type { VirtualSubject } from "@/lab/types";
import { availabilityForSubject } from "@/lab/evidenceAvailability";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, PRIMARY_PREFERENCE_DECODER_METRIC, SUPERSEDED_PRIMARY_PREFERENCE_DECODER_METRIC } from "@/lab/preferenceTarget";

export const ITERATION_EVALUATOR_VERSION = "iteration-readiness.v2";
export type EvaluationMode = "DEVELOPMENT" | "VALIDATION" | "LOCKED_CONFIRMATION";

export function selectEvaluationSplit(subjects: VirtualSubject[], mode: EvaluationMode, unlock = false) {
  if (mode === "LOCKED_CONFIRMATION" && !unlock) {
    throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
  }
  const cohort = mode === "DEVELOPMENT" ? "design" : mode === "VALIDATION" ? "validation" : "holdout";
  return subjects.filter((subject) => subject.truth.cohort === cohort);
}

function preferenceEvidence(evidence: UserEvidence) {
  return evidence.evidenceClass === "PREFERENCE" || evidence.evidenceClass === "DISLIKE";
}

/**
 * Autonomous preference-decoder diagnostics.
 *
 * Two independent concepts drive every metric below, per the readiness-hardening audit:
 *
 *  - AVAILABLE:   the observation GENERATOR placed valid preference/dislike phrase
 *                 evidence for this dimension in fields visible to the inference system
 *                 (explicitPreferences / explicitDislikes). Computed by
 *                 src/lab/evidenceAvailability.ts, entirely independent of the
 *                 extractor/decoder under test.
 *  - RECOGNIZED:  the extractor (src/domain/evidence.ts + src/domain/workStructure.ts)
 *                 actually produced a PREFERENCE/DISLIKE evidence item that maps to this
 *                 dimension (profile.evidence -> inferredTaskDimensions).
 *
 * The PRIMARY metric (AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1) is scoped by AVAILABLE,
 * never by RECOGNIZED. If the extractor misses evidence the generator exposed, that
 * subject/dimension still counts in the primary denominator with whatever prediction the
 * decoder produced (typically the neutral prior); it cannot vanish from the metric the
 * way it could under the superseded recognized-evidence-gated definition
 * (AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1, still reported under `legacySuperseded`
 * for direct comparison). See tests/available-evidence.test.ts for the mandatory
 * regression coverage of this property.
 */
export function diagnosePreference(subjects: VirtualSubject[], developmentSubjects: VirtualSubject[]) {
  const devPrior = Object.fromEntries(DIMENSION_IDS.map((id) => [id, mean(developmentSubjects.map((s) => s.truth.taskDnaTruth[id]))])) as Record<DimensionId, number>;
  const records = subjects.flatMap((subject) => {
    const profile = observationsToProfile(subject);
    const dimensions = new Map(profile.taskDna.map((item) => [item.dimensionId, item]));
    const recognizedSet = new Set(profile.evidence.filter(preferenceEvidence).flatMap((item) => Object.keys(item.inferredTaskDimensions) as DimensionId[]));
    const availability = availabilityForSubject(subject);
    return DIMENSION_IDS.map((id) => {
      const dimension = dimensions.get(id)!;
      return {
        subjectId: subject.truth.subjectId, cohort: subject.truth.cohort, id,
        truth: subject.truth.taskDnaTruth[id], prediction: dimension.value,
        confidence: dimension.confidence,
        available: availability[id].available,
        recognized: recognizedSet.has(id),
        evidenceCount: profile.evidence.filter((e) => preferenceEvidence(e) && id in e.inferredTaskDimensions).length,
        prior: devPrior[id],
      };
    });
  });

  const subjectIdsOf = (recs: typeof records) => [...new Set(recs.map((r) => r.subjectId))];
  const macroMae = (recs: typeof records) => mean(subjectIdsOf(recs).map((id) => mean(recs.filter((r) => r.subjectId === id).map(error))));

  const eligible = records.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id));
  const availableEligible = eligible.filter((r) => r.available);
  const recognizedEligible = eligible.filter((r) => r.recognized);
  const recognizedAndAvailableEligible = availableEligible.filter((r) => r.recognized);
  const zeroAvailableEligible = eligible.filter((r) => !r.available);

  // All-17-dimension recognized-based sets, kept ONLY for the legacy/all-dimension
  // diagnostics that predate this audit; never used to define the primary metric.
  const recognizedAll = records.filter((r) => r.recognized);
  const unrecognizedAll = records.filter((r) => !r.recognized);

  const predictionVariance = variance(records.map((r) => r.prediction));
  const truthVariance = variance(records.map((r) => r.truth));
  const constant = (slice: typeof records) => mae(slice.map((r) => ({ ...r, prediction: 5 })));
  const prior = (slice: typeof records) => mae(slice.map((r) => ({ ...r, prediction: r.prior })));

  const shrinkage = [0, .25, .5, .75, 1].map((lambda) => {
    const shrunk = records.map((r) => ({ ...r, prediction: lambda * r.prediction + (1 - lambda) * 5 }));
    const availableEligibleShrunk = shrunk.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id) && r.available);
    const zeroAvailableEligibleShrunk = shrunk.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id) && !r.available);
    return {
      lambda,
      allDimensionMae: mae(shrunk),
      availableEvidencePreferenceMacroMae: macroMae(availableEligibleShrunk),
      availableEvidencePreferenceMicroMae: mae(availableEligibleShrunk),
      zeroAvailableEvidenceMae: mae(zeroAvailableEligibleShrunk),
      predictionVariance: variance(shrunk.map((r) => r.prediction)),
    };
  });

  const byDimension = DIMENSION_IDS.map((id) => {
    const slice = records.filter((r) => r.id === id);
    const available = slice.filter((r) => r.available);
    const recognized = slice.filter((r) => r.recognized);
    const recognizedAndAvailable = available.filter((r) => r.recognized);
    return {
      id,
      eligible: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(id),
      availableCoverage: available.length / slice.length,
      recognizedCoverage: recognized.length / slice.length,
      availableToRecognizedRecall: available.length ? recognizedAndAvailable.length / available.length : null,
      availableMae: mae(available),
      recognizedMae: mae(recognized),
      allMae: mae(slice),
      predictionVariance: variance(slice.map((r) => r.prediction)),
      truthVariance: variance(slice.map((r) => r.truth)),
    };
  });

  const confidencePairs = records.map((r) => [r.confidence, error(r)] as [number, number]);
  const subjectPairs = subjects.map((s) => {
    const slice = records.filter((r) => r.subjectId === s.truth.subjectId);
    return [mean(slice.map((r) => r.confidence)), mae(slice)] as [number, number];
  });

  // NOTE: a naive "duplicate (subjectId, dimensionId, evidenceCount) triple" check is a
  // structural no-op here, because `records` already has exactly one row per
  // (subject, dimension) by construction (see the DIMENSION_IDS.map above) -- that key
  // can never repeat regardless of evidenceCount, so such a check could never fire. The
  // real "duplicating easy evidence" attack surface is the generator/extractor emitting
  // the SAME phrase more than once for one subject to farm coverage/confidence; that is
  // what duplicatePhraseSubjects actually detects.
  const duplicatePhraseSubjects = subjects.filter((s) =>
    new Set(s.observations.explicitPreferences).size !== s.observations.explicitPreferences.length ||
    new Set(s.observations.explicitDislikes).size !== s.observations.explicitDislikes.length,
  );
  const warnings = [
    ...(Math.abs(mean(records.map((r) => r.prediction)) - 5) < .1 ? ["PREDICTION_TO_5_RISK"] : []),
    ...(predictionVariance / truthVariance < .1 ? ["VARIANCE_COLLAPSE"] : []),
    ...(availableEligible.length / Math.max(1, eligible.length) < .1 ? ["LOW_AVAILABLE_EVIDENCE_COVERAGE"] : []),
    ...(duplicatePhraseSubjects.length ? ["DUPLICATED_EVIDENCE_PHRASES"] : []),
    ...(recognizedEligible.length > availableEligible.length ? ["RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE"] : []),
  ];

  return {
    metricVersion: ITERATION_EVALUATOR_VERSION,
    subjects: subjects.length, dimensionRecords: records.length,
    primaryPreferenceDecoderMetric: PRIMARY_PREFERENCE_DECODER_METRIC,
    supersededPrimaryPreferenceDecoderMetric: SUPERSEDED_PRIMARY_PREFERENCE_DECODER_METRIC,
    autonomousPreferenceDimensions: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1,

    // --- Primary metric and mandated companion metrics (never remove any of these) ---
    AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1: macroMae(availableEligible),
    AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE: mae(availableEligible),
    RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE: macroMae(recognizedEligible),
    RECOGNIZED_EVIDENCE_PREFERENCE_MICRO_MAE: mae(recognizedEligible),
    AVAILABLE_TO_RECOGNIZED_RECALL: availableEligible.length ? recognizedAndAvailableEligible.length / availableEligible.length : null,
    ZERO_AVAILABLE_EVIDENCE_MAE: mae(zeroAvailableEligible),
    LEGACY_ALL_DIMENSION_MAE: mae(records),

    eligibleDimensionRecordCount: eligible.length,
    availableEligibleCoverage: eligible.length ? availableEligible.length / eligible.length : 0,
    recognizedEligibleCoverage: eligible.length ? recognizedEligible.length / eligible.length : 0,
    availableEligibleSubjectCount: subjectIdsOf(availableEligible).length,
    recognizedEligibleSubjectCount: subjectIdsOf(recognizedEligible).length,

    constant5: { availableEligibleMicroMae: constant(availableEligible), zeroAvailableEvidenceMae: constant(zeroAvailableEligible), allDimensionMae: constant(records) },
    developmentPopulationPrior: { availableEligibleMicroMae: prior(availableEligible), zeroAvailableEvidenceMae: prior(zeroAvailableEligible), allDimensionMae: prior(records), warning: "Prior estimated on DEVELOPMENT truth; diagnostic only." },
    pairedDecoderVsConstant: {
      meanErrorDelta: mean(availableEligible.map((r) => error(r) - Math.abs(5 - r.truth))),
      decoderWins: availableEligible.filter((r) => error(r) < Math.abs(5 - r.truth)).length,
      constantWins: availableEligible.filter((r) => error(r) > Math.abs(5 - r.truth)).length,
      ties: availableEligible.filter((r) => error(r) === Math.abs(5 - r.truth)).length,
    },
    distribution: { predictionMean: mean(records.map((r) => r.prediction)), predictionVariance, truthMean: mean(records.map((r) => r.truth)), truthVariance, varianceRatio: predictionVariance / truthVariance },
    byCohort: [...new Set(records.map((r) => r.cohort))].map((cohort) => ({ cohort, n: new Set(records.filter((r) => r.cohort === cohort).map((r) => r.subjectId)).size, mae: mae(records.filter((r) => r.cohort === cohort)) })),
    byDimension,
    byEvidenceCount: [...new Set(records.map((r) => r.evidenceCount))].sort((a, b) => a - b).map((count) => ({ count, n: records.filter((r) => r.evidenceCount === count).length, mae: mae(records.filter((r) => r.evidenceCount === count)) })),
    confidence: { dimensionPearsonError: pearson(confidencePairs), dimensionSpearmanError: spearman(confidencePairs), subjectPearsonMae: pearson(subjectPairs), subjectSpearmanMae: spearman(subjectPairs), buckets: confidenceBuckets(records), monotonicErrorDecrease: false, governance: "UNVALIDATED: must not modify V3 scoring without an explicit experiment and metric contract" },
    complementary: complementaryDiagnostics(availableEligible),
    antiGoodhart: {
      meanCollapse: Math.abs(mean(records.map((r) => r.prediction)) - 5) < .1,
      varianceCollapse: predictionVariance / truthVariance < .1,
      predictionTo5Gaming: mae(records) >= constant(records) && predictionVariance < truthVariance * .2,
      improvementOnlyZeroAvailableEvidence: mae(availableEligible) >= constant(availableEligible) && mae(zeroAvailableEligible) < constant(zeroAvailableEligible),
      reducedCoverage: "compare against preregistered before value",
      excessiveAbstention: "not applicable to preference decoder; required for mapper evaluation",
      duplicatedEvidence: `checked for literal duplicate phrases within a subject's explicitPreferences/explicitDislikes; ${duplicatePhraseSubjects.length} of ${subjects.length} subjects flagged`,
      availableDenominatorIsExtractorIndependent: "AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1's denominator is fixed by src/lab/evidenceAvailability.ts before the extractor runs; the extractor recognizing fewer cases cannot shrink it (see tests/available-evidence.test.ts).",
    },
    shrinkage, shrinkageGovernance: "DIAGNOSTIC ONLY: never automatically select or adopt the minimum-MAE lambda", warnings,

    // Superseded, recognized-evidence-gated metrics. Retained ONLY to demonstrate, side
    // by side, the selection-bias difference the hardening audit fixed. Never treat
    // anything in this block as the primary metric or as a target to optimize.
    legacySuperseded: {
      warning: "Recognized-evidence-gated inclusion lets the extractor shrink its own denominator by missing evidence. Superseded by AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1.",
      autonomousObservedPreferenceMacroMae: macroMae(recognizedEligible),
      autonomousObservedPreferenceMicroMae: mae(recognizedEligible),
      autonomousEvidenceCoverage: eligible.length ? recognizedEligible.length / eligible.length : 0,
      allDimensionRecognizedMacroMae: macroMae(recognizedAll),
      allDimensionRecognizedMicroMae: mae(recognizedAll),
      allDimensionRecognizedCoverage: records.length ? recognizedAll.length / records.length : 0,
      allDimensionZeroRecognizedMae: mae(unrecognizedAll),
    },
  };
}

type RecordRow = { prediction:number; truth:number; confidence:number };
const error = (r: RecordRow) => Math.abs(r.prediction-r.truth);
const mean = (x:number[]) => x.length ? x.reduce((a,b)=>a+b,0)/x.length : 0;
const mae = <T extends RecordRow>(x:T[]) => mean(x.map(error));
const variance = (x:number[]) => { const m=mean(x); return mean(x.map(v=>(v-m)**2)); };
function pearson(pairs:[number,number][]) { const x=pairs.map(p=>p[0]),y=pairs.map(p=>p[1]),mx=mean(x),my=mean(y); const den=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)*y.reduce((s,v)=>s+(v-my)**2,0)); return den ? pairs.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/den : 0; }
function spearman(pairs:[number,number][]) { const rank=(xs:number[])=>xs.map(v=>xs.filter(x=>x<v).length+xs.filter(x=>x===v).length/2); const x=rank(pairs.map(p=>p[0])),y=rank(pairs.map(p=>p[1])); return pearson(x.map((v,i)=>[v,y[i]!])); }
function confidenceBuckets(records: (RecordRow & {available:boolean})[]) { return [[0,.35],[.35,.5],[.5,.65],[.65,1.01]].map(([min,max])=>{const s=records.filter(r=>r.confidence>=min!&&r.confidence<max!);return {bucket:`${min}-${max}`,n:s.length,mae:mae(s)};}); }
function complementaryDiagnostics(records: (RecordRow & {id:DimensionId})[]) {
  const directional = records.filter(r=>Math.abs(r.truth-5)>=1);
  const extreme = records.filter(r=>Math.abs(r.truth-5)>=3);
  const slopeDen = records.reduce((s,r)=>s+(r.prediction-mean(records.map(x=>x.prediction)))**2,0);
  return {
    directionalAccuracy: directional.length ? directional.filter(r=>Math.sign(r.prediction-5)===Math.sign(r.truth-5)).length/directional.length : 0,
    withinDimensionRankSpearman: mean(DIMENSION_IDS.map(id=>spearman(records.filter(r=>r.id===id).map(r=>[r.prediction,r.truth])))),
    extremePreferenceRecall: extreme.length ? extreme.filter(r=>Math.sign(r.prediction-5)===Math.sign(r.truth-5)&&Math.abs(r.prediction-5)>=1).length/extreme.length : 0,
    calibrationSlopeTruthOnPrediction: slopeDen ? records.reduce((s,r)=>s+(r.prediction-mean(records.map(x=>x.prediction)))*(r.truth-mean(records.map(x=>x.truth))),0)/slopeDen : 0,
  };
}
