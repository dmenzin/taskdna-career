import { DIMENSION_IDS } from "@/config/model";
import { observationsToProfile } from "@/lab/evaluate";
import {
  availablePreferenceDimensions,
  recognizedPreferenceCount,
  recognizedPreferenceDimensions,
} from "@/lab/availableEvidence";
import type { DimensionId } from "@/domain/types";
import type { VirtualSubject } from "@/lab/types";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, PRIMARY_PREFERENCE_DECODER_METRIC } from "@/lab/preferenceTarget";

export const ITERATION_EVALUATOR_VERSION = "iteration-readiness.v3";
export type EvaluationMode = "DEVELOPMENT" | "VALIDATION" | "LOCKED_CONFIRMATION";

export interface PreferenceMetricRecord {
  subjectId: string;
  cohort: string;
  id: DimensionId;
  truth: number;
  prediction: number;
  confidence: number;
  available: boolean;
  recognized: boolean;
  supported: boolean;
  evidenceCount: number;
  prior: number;
}

export function selectEvaluationSplit(subjects: VirtualSubject[], mode: EvaluationMode, unlock = false) {
  if (mode === "LOCKED_CONFIRMATION" && !unlock) {
    throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
  }
  const cohort = mode === "DEVELOPMENT" ? "design" : mode === "VALIDATION" ? "validation" : "holdout";
  return subjects.filter((subject) => subject.truth.cohort === cohort);
}

export function preferenceMetricRecords(subjects: VirtualSubject[], developmentSubjects: VirtualSubject[]): PreferenceMetricRecord[] {
  const devPrior = Object.fromEntries(DIMENSION_IDS.map((id) => [id, mean(developmentSubjects.map((subject) => subject.truth.taskDnaTruth[id]))])) as Record<DimensionId, number>;
  return subjects.flatMap((subject) => {
    const profile = observationsToProfile(subject);
    const dimensions = new Map(profile.taskDna.map((item) => [item.dimensionId, item]));
    const available = availablePreferenceDimensions(subject);
    const recognized = recognizedPreferenceDimensions(profile);
    return DIMENSION_IDS.map((id) => {
      const dimension = dimensions.get(id)!;
      return {
        subjectId: subject.truth.subjectId,
        cohort: subject.truth.cohort,
        id,
        truth: subject.truth.taskDnaTruth[id],
        prediction: dimension.value,
        confidence: dimension.confidence,
        available: available.has(id),
        recognized: recognized.has(id),
        supported: recognized.has(id),
        evidenceCount: recognizedPreferenceCount(profile, id),
        prior: devPrior[id],
      };
    });
  });
}

export function summarizePreferenceRecords(records: PreferenceMetricRecord[], eligibleDimensions = AUTONOMOUS_PREFERENCE_DIMENSIONS_V1) {
  const unique = uniqueSubjectDimensions(records);
  const eligible = unique.filter((record) => eligibleDimensions.includes(record.id));
  const availableEligible = eligible.filter((record) => record.available);
  const recognizedEligible = eligible.filter((record) => record.recognized);
  const recognizedAvailableEligible = availableEligible.filter((record) => record.recognized);
  const zeroAvailableEligible = eligible.filter((record) => !record.available);
  const recognizedAny = unique.filter((record) => record.recognized);
  const zeroRecognized = unique.filter((record) => !record.recognized);
  const availableSubjects = macroMeans(availableEligible);
  const recognizedSubjects = macroMeans(recognizedEligible);
  const recognizedAnySubjects = macroMeans(recognizedAny);
  const predictionVariance = variance(unique.map((record) => record.prediction));
  const truthVariance = variance(unique.map((record) => record.truth));
  const constant = (slice: PreferenceMetricRecord[]) => mae(slice.map((record) => ({ ...record, prediction: 5 })));
  const prior = (slice: PreferenceMetricRecord[]) => mae(slice.map((record) => ({ ...record, prediction: record.prior })));
  const shrinkage = [0, .25, .5, .75, 1].map((lambda) => {
    const shrunk = unique.map((record) => ({ ...record, prediction: lambda * record.prediction + (1 - lambda) * 5 }));
    const available = shrunk.filter((record) => eligibleDimensions.includes(record.id) && record.available);
    const recognized = shrunk.filter((record) => eligibleDimensions.includes(record.id) && record.recognized);
    const zero = shrunk.filter((record) => eligibleDimensions.includes(record.id) && !record.available);
    return {
      lambda,
      allDimensionMae: mae(shrunk),
      availableEvidenceMacroMae: mean(macroMeans(available)),
      availableEvidenceMicroMae: mae(available),
      recognizedEvidenceMacroMae: mean(macroMeans(recognized)),
      recognizedEvidenceMicroMae: mae(recognized),
      zeroAvailableEvidenceMae: mae(zero),
      predictionVariance: variance(shrunk.map((record) => record.prediction)),
    };
  });
  const byDimension = DIMENSION_IDS.map((id) => {
    const slice = unique.filter((record) => record.id === id);
    const available = slice.filter((record) => record.available);
    const recognized = slice.filter((record) => record.recognized);
    return {
      id,
      availableCoverage: available.length / Math.max(1, slice.length),
      recognizedCoverage: recognized.length / Math.max(1, slice.length),
      availableMae: mae(available),
      recognizedMae: mae(recognized),
      allMae: mae(slice),
      predictionVariance: variance(slice.map((record) => record.prediction)),
      truthVariance: variance(slice.map((record) => record.truth)),
    };
  });
  const confidencePairs = unique.map((record) => [record.confidence, error(record)] as [number, number]);
  const subjectIds = [...new Set(unique.map((record) => record.subjectId))];
  const subjectPairs = subjectIds.map((subjectId) => {
    const slice = unique.filter((record) => record.subjectId === subjectId);
    return [mean(slice.map((record) => record.confidence)), mae(slice)] as [number, number];
  });
  const availableCoverage = availableEligible.length / Math.max(1, eligible.length);
  const recognizedCoverage = recognizedEligible.length / Math.max(1, eligible.length);
  const warnings = [
    ...(Math.abs(mean(unique.map((record) => record.prediction)) - 5) < .1 ? ["PREDICTION_TO_5_RISK"] : []),
    ...(predictionVariance / Math.max(truthVariance, 1e-9) < .1 ? ["VARIANCE_COLLAPSE"] : []),
    ...(availableCoverage < .1 ? ["LOW_AVAILABLE_EVIDENCE_COVERAGE"] : []),
    ...(recognizedCoverage < availableCoverage ? ["EXTRACTOR_RECALL_GAP"] : []),
    ...(new Set(records.map((record) => `${record.subjectId}:${record.id}`)).size !== unique.length ? ["DUPLICATED_EVIDENCE_RECORD"] : []),
  ];
  return {
    metricVersion: ITERATION_EVALUATOR_VERSION,
    subjects: subjectIds.length,
    dimensionRecords: unique.length,
    primaryPreferenceDecoderMetric: PRIMARY_PREFERENCE_DECODER_METRIC,
    primaryMetricEquation: "mean_s( mean_{d in D* and available(s,d)} |yhat(s,d)-y(s,d)| ) where D* is the mae-eligible set and available(s,d) is generator-exposed preference/dislike phrase visibility, independent of extractor recognition",
    autonomousPreferenceDimensions: eligibleDimensions,
    availableEligibleDimensionIds: [...new Set(availableEligible.map((record) => record.id))],
    availableEligibleCount: availableEligible.length,
    recognizedEligibleCount: recognizedEligible.length,
    availableEligibleSubjectCount: availableSubjects.length,
    recognizedEligibleSubjectCount: recognizedSubjects.length,
    availableEvidencePreferenceMacroMae: mean(availableSubjects),
    availableEvidencePreferenceMicroMae: mae(availableEligible),
    recognizedEvidencePreferenceMacroMae: mean(recognizedSubjects),
    recognizedEvidencePreferenceMicroMae: mae(recognizedEligible),
    availableToRecognizedRecall: availableEligible.length ? recognizedAvailableEligible.length / availableEligible.length : 0,
    zeroAvailableEvidenceMae: mae(zeroAvailableEligible),
    legacyAllDimensionMae: mae(unique),
    autonomousObservedPreferenceMacroMae: mean(recognizedSubjects),
    autonomousObservedPreferenceMicroMae: mae(recognizedEligible),
    autonomousEvidenceCoverage: recognizedCoverage,
    observedPreferenceMacroMae: mean(recognizedAnySubjects),
    observedPreferenceMicroMae: mae(recognizedAny),
    zeroEvidenceMae: mae(zeroRecognized),
    availableEvidenceCoverage: availableCoverage,
    recognizedEvidenceCoverage: recognizedCoverage,
    evidenceCoverage: recognizedCoverage,
    constant5: {
      allDimensionMae: constant(unique),
      availableEvidenceMicroMae: constant(availableEligible),
      recognizedEvidenceMicroMae: constant(recognizedEligible),
      observedMicroMae: constant(recognizedAny),
      zeroAvailableEvidenceMae: constant(zeroAvailableEligible),
      zeroEvidenceMae: constant(zeroRecognized),
    },
    developmentPopulationPrior: {
      allDimensionMae: prior(unique),
      availableEvidenceMicroMae: prior(availableEligible),
      recognizedEvidenceMicroMae: prior(recognizedEligible),
      observedMicroMae: prior(recognizedAny),
      zeroAvailableEvidenceMae: prior(zeroAvailableEligible),
      zeroEvidenceMae: prior(zeroRecognized),
      warning: "Prior estimated on DEVELOPMENT truth; diagnostic only.",
    },
    pairedDecoderVsConstant: {
      meanErrorDelta: mean(unique.map((record) => error(record) - Math.abs(5 - record.truth))),
      decoderWins: unique.filter((record) => error(record) < Math.abs(5 - record.truth)).length,
      constantWins: unique.filter((record) => error(record) > Math.abs(5 - record.truth)).length,
      ties: unique.filter((record) => error(record) === Math.abs(5 - record.truth)).length,
    },
    distribution: {
      predictionMean: mean(unique.map((record) => record.prediction)),
      predictionVariance,
      truthMean: mean(unique.map((record) => record.truth)),
      truthVariance,
      varianceRatio: predictionVariance / Math.max(truthVariance, 1e-9),
    },
    byCohort: [...new Set(unique.map((record) => record.cohort))].map((cohort) => ({
      cohort,
      n: new Set(unique.filter((record) => record.cohort === cohort).map((record) => record.subjectId)).size,
      mae: mae(unique.filter((record) => record.cohort === cohort)),
    })),
    byDimension,
    byEvidenceCount: [...new Set(unique.map((record) => record.evidenceCount))].sort((a, b) => a - b).map((count) => ({
      count,
      n: unique.filter((record) => record.evidenceCount === count).length,
      mae: mae(unique.filter((record) => record.evidenceCount === count)),
    })),
    confidence: {
      dimensionPearsonError: pearson(confidencePairs),
      dimensionSpearmanError: spearman(confidencePairs),
      subjectPearsonMae: pearson(subjectPairs),
      subjectSpearmanMae: spearman(subjectPairs),
      buckets: confidenceBuckets(unique),
      monotonicErrorDecrease: false,
      governance: "UNVALIDATED: must not modify V3 scoring without an explicit experiment and metric contract",
    },
    complementary: complementaryDiagnostics(availableEligible),
    antiGoodhart: {
      meanCollapse: Math.abs(mean(unique.map((record) => record.prediction)) - 5) < .1,
      varianceCollapse: predictionVariance / Math.max(truthVariance, 1e-9) < .1,
      predictionTo5Gaming: mae(unique) >= constant(unique) && predictionVariance < truthVariance * .2,
      improvementOnlyZeroEvidence: mae(availableEligible) >= constant(availableEligible) && mae(zeroAvailableEligible) < constant(zeroAvailableEligible),
      reducedCoverage: "compare availableEvidenceCoverage and availableToRecognizedRecall against the preregistered before values",
      extractorMissDoesNotLeavePrimary: availableEligible.some((record) => !record.recognized) || availableEligible.length === 0,
      excessiveAbstention: "not applicable to preference decoder; required for mapper evaluation",
      duplicatedEvidence: "support counted once per subject and dimension",
    },
    shrinkage,
    shrinkageGovernance: "DIAGNOSTIC ONLY: never automatically select or adopt the minimum-MAE lambda",
    warnings,
  };
}

export function diagnosePreference(subjects: VirtualSubject[], developmentSubjects: VirtualSubject[]) {
  return summarizePreferenceRecords(preferenceMetricRecords(subjects, developmentSubjects));
}

function uniqueSubjectDimensions(records: PreferenceMetricRecord[]) {
  const seen = new Map<string, PreferenceMetricRecord>();
  for (const record of records) {
    const key = `${record.subjectId}:${record.id}`;
    if (!seen.has(key)) seen.set(key, record);
  }
  return [...seen.values()];
}

function macroMeans(records: PreferenceMetricRecord[]) {
  return [...new Set(records.map((record) => record.subjectId))].map((subjectId) => mean(records.filter((record) => record.subjectId === subjectId).map(error)));
}

const error = (record: { prediction: number; truth: number }) => Math.abs(record.prediction - record.truth);
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const mae = <T extends { prediction: number; truth: number }>(rows: T[]) => mean(rows.map(error));
const variance = (values: number[]) => {
  const midpoint = mean(values);
  return mean(values.map((value) => (value - midpoint) ** 2));
};
function pearson(pairs: [number, number][]) {
  const x = pairs.map((pair) => pair[0]);
  const y = pairs.map((pair) => pair[1]);
  const mx = mean(x);
  const my = mean(y);
  const den = Math.sqrt(x.reduce((sum, value) => sum + (value - mx) ** 2, 0) * y.reduce((sum, value) => sum + (value - my) ** 2, 0));
  return den ? pairs.reduce((sum, pair) => sum + (pair[0] - mx) * (pair[1] - my), 0) / den : 0;
}
function spearman(pairs: [number, number][]) {
  const rank = (xs: number[]) => xs.map((value) => xs.filter((other) => other < value).length + xs.filter((other) => other === value).length / 2);
  const x = rank(pairs.map((pair) => pair[0]));
  const y = rank(pairs.map((pair) => pair[1]));
  return pearson(x.map((value, index) => [value, y[index]!]));
}
function confidenceBuckets(records: (PreferenceMetricRecord)[]) {
  return [[0, .35], [.35, .5], [.5, .65], [.65, 1.01]].map(([min, max]) => {
    const slice = records.filter((record) => record.confidence >= min! && record.confidence < max!);
    return { bucket: `${min}-${max}`, n: slice.length, mae: mae(slice) };
  });
}
function complementaryDiagnostics(records: PreferenceMetricRecord[]) {
  const directional = records.filter((record) => Math.abs(record.truth - 5) >= 1);
  const extreme = records.filter((record) => Math.abs(record.truth - 5) >= 3);
  const predictionMean = mean(records.map((record) => record.prediction));
  const truthMean = mean(records.map((record) => record.truth));
  const slopeDen = records.reduce((sum, record) => sum + (record.prediction - predictionMean) ** 2, 0);
  return {
    directionalAccuracy: directional.length ? directional.filter((record) => Math.sign(record.prediction - 5) === Math.sign(record.truth - 5)).length / directional.length : 0,
    withinDimensionRankSpearman: mean(DIMENSION_IDS.map((id) => spearman(records.filter((record) => record.id === id).map((record) => [record.prediction, record.truth])))),
    extremePreferenceRecall: extreme.length ? extreme.filter((record) => Math.sign(record.prediction - 5) === Math.sign(record.truth - 5) && Math.abs(record.prediction - 5) >= 1).length / extreme.length : 0,
    calibrationSlopeTruthOnPrediction: slopeDen ? records.reduce((sum, record) => sum + (record.prediction - predictionMean) * (record.truth - truthMean), 0) / slopeDen : 0,
  };
}
