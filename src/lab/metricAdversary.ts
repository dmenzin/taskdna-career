import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 } from "@/lab/preferenceTarget";
import { summarizePreferenceRecords, type PreferenceMetricRecord } from "@/lab/iterationMetrics";

export interface MetricAttackResult {
  id: string;
  name: string;
  resistedByPrimary: boolean;
  exposedByGuardrail: boolean;
  detail: string;
  before: ReturnType<typeof summarizePreferenceRecords>;
  after: ReturnType<typeof summarizePreferenceRecords>;
}

const eligible = (record: PreferenceMetricRecord, dimensions = AUTONOMOUS_PREFERENCE_DIMENSIONS_V1) =>
  dimensions.includes(record.id);

export function attackRecognizeFewer(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  return records.map((record) => {
    if (!eligible(record) || !record.available || !record.recognized) return record;
    if (Math.abs(record.truth - 5) >= 2) return { ...record, recognized: false, evidenceCount: 0 };
    return record;
  });
}

export function attackAbstain(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  return records.map((record) => eligible(record) ? { ...record, recognized: false, evidenceCount: 0 } : record);
}

export function attackConstant5(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  return records.map((record) => ({ ...record, prediction: 5 }));
}

export function attackShrinkToward5(records: PreferenceMetricRecord[], lambda = 0.5): PreferenceMetricRecord[] {
  return records.map((record) => ({ ...record, prediction: lambda * record.prediction + (1 - lambda) * 5 }));
}

export function attackDropDifficultDimensions(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  const remaining = AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.filter((id) => {
    const slice = records.filter((record) => record.id === id && record.available);
    const mae = slice.length ? slice.reduce((sum, record) => sum + Math.abs(record.prediction - record.truth), 0) / slice.length : 0;
    return mae === Math.min(...AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.map((candidate) => {
      const values = records.filter((record) => record.id === candidate && record.available);
      return values.length ? values.reduce((sum, record) => sum + Math.abs(record.prediction - record.truth), 0) / values.length : 0;
    }));
  });
  return records.map((record) => remaining.includes(record.id) ? record : { ...record, available: false, recognized: false });
}

export function attackHideHardAvailableEvidence(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  return records.map((record) => {
    if (!eligible(record) || !record.available) return record;
    if (Math.abs(record.truth - 5) >= 2) return { ...record, available: false, recognized: false };
    return record;
  });
}

export function attackChangeGeneratorVisibility(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  return records.map((record) => eligible(record) ? { ...record, available: false, recognized: record.recognized } : record);
}

export function attackDuplicateEasyEvidence(records: PreferenceMetricRecord[]): PreferenceMetricRecord[] {
  const extras = records.filter((record) => eligible(record) && record.available && Math.abs(record.truth - 5) < 1.5).map((record) => ({
    ...record,
    subjectId: `${record.subjectId}::dup`,
    evidenceCount: record.evidenceCount + 1,
  }));
  return [...records, ...extras];
}

export function evaluateMetricAttacks(records: PreferenceMetricRecord[]): MetricAttackResult[] {
  const before = summarizePreferenceRecords(records);
  const run = (
    id: string,
    name: string,
    mutate: (input: PreferenceMetricRecord[]) => PreferenceMetricRecord[],
    verdict: (after: ReturnType<typeof summarizePreferenceRecords>) => { resistedByPrimary: boolean; exposedByGuardrail: boolean; detail: string },
  ): MetricAttackResult => {
    const after = summarizePreferenceRecords(mutate(records));
    return { id, name, before, after, ...verdict(after) };
  };

  return [
    run("recognize-fewer", "Make the extractor recognize fewer / harder cases", attackRecognizeFewer, (after) => ({
      resistedByPrimary: after.availableEvidencePreferenceMacroMae === before.availableEvidencePreferenceMacroMae,
      exposedByGuardrail: after.availableToRecognizedRecall < before.availableToRecognizedRecall,
      detail: "Primary available-evidence MAE must stay put; recall must fall.",
    })),
    run("abstain", "Abstain from all eligible recognition", attackAbstain, (after) => ({
      resistedByPrimary: after.availableEvidencePreferenceMacroMae === before.availableEvidencePreferenceMacroMae,
      exposedByGuardrail: after.availableToRecognizedRecall === 0 && after.recognizedEligibleCount === 0,
      detail: "Abstention cannot empty the primary denominator; recall becomes 0.",
    })),
    run("constant-5", "Predict constant 5", attackConstant5, (after) => ({
      resistedByPrimary: after.availableEvidencePreferenceMacroMae === after.constant5.availableEvidenceMicroMae,
      exposedByGuardrail: true,
      detail: "Constant-5 is reported beside the primary metric and cannot hide inside recognized-only selection.",
    })),
    run("shrink-toward-5", "Shrink predictions toward 5", (input) => attackShrinkToward5(input, 0.5), (after) => ({
      resistedByPrimary: after.distribution.predictionVariance <= before.distribution.predictionVariance,
      exposedByGuardrail: after.shrinkage.some((point) => point.lambda === 0.5),
      detail: "Shrinkage is a published diagnostic curve, not an automatic selector.",
    })),
    run("drop-difficult-dimensions", "Keep only the easier eligible dimension", attackDropDifficultDimensions, (after) => ({
      resistedByPrimary: after.availableEligibleDimensionIds.length < before.availableEligibleDimensionIds.length
        ? after.availableEvidenceCoverage <= before.availableEvidenceCoverage
        : true,
      exposedByGuardrail: after.availableEligibleDimensionIds.join(",") !== AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.join(","),
      detail: "Changing the eligible set is a metric-contract change and is visible in the dimension list.",
    })),
    run("hide-hard-available-evidence", "Hide difficult available evidence from the inclusion set", attackHideHardAvailableEvidence, (after) => ({
      resistedByPrimary: after.availableEvidenceCoverage < before.availableEvidenceCoverage,
      exposedByGuardrail: after.availableEvidenceCoverage < before.availableEvidenceCoverage,
      detail: "Removing hard available cases shrinks coverage rather than silently improving a recognized-only MAE.",
    })),
    run("change-generator-visibility", "Zero generator-visible preference phrases", attackChangeGeneratorVisibility, (after) => ({
      resistedByPrimary: after.availableEligibleCount === 0,
      exposedByGuardrail: after.availableEvidenceCoverage === 0,
      detail: "If the generator no longer exposes phrases, the primary denominator becomes empty and coverage is 0.",
    })),
    run("duplicate-easy-evidence", "Duplicate easy available cases", attackDuplicateEasyEvidence, (after) => ({
      resistedByPrimary: after.availableEvidencePreferenceMacroMae === before.availableEvidencePreferenceMacroMae
        || after.warnings.includes("DUPLICATED_EVIDENCE_RECORD"),
      exposedByGuardrail: after.availableEligibleSubjectCount >= before.availableEligibleSubjectCount,
      detail: "Records are unique per subject-dimension; cloned easy subjects are either ignored or increase subject count explicitly.",
    })),
  ];
}

export function unusedEligibleDimensions() {
  return DIMENSION_IDS.filter((id) => !AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(id));
}
