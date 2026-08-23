import { describe, expect, it } from "vitest";
import { generateVirtualSubjects } from "@/lab/generate";
import { diagnosePreference, selectEvaluationSplit } from "@/lab/iterationMetrics";

describe("iteration metric contracts", () => {
  const subjects = generateVirtualSubjects();
  it("guards locked confirmation", () => {
    expect(() => selectEvaluationSplit(subjects, "LOCKED_CONFIRMATION")).toThrow(/guarded/);
  });
  it("implements macro, micro, zero evidence, baselines, and fixed diagnostic shrinkage", () => {
    const development = selectEvaluationSplit(subjects, "DEVELOPMENT");
    const report = diagnosePreference(development, development);
    expect(report.primaryPreferenceDecoderMetric).toBe("AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1");
    expect(report.autonomousPreferenceDimensions).toEqual(["measurable_feedback", "experimentation_preference"]);
    expect(report.availableEvidencePreferenceMacroMae).toBeGreaterThanOrEqual(0);
    expect(report.availableEvidencePreferenceMicroMae).toBeGreaterThanOrEqual(0);
    expect(report.recognizedEvidencePreferenceMacroMae).toBeGreaterThanOrEqual(0);
    expect(report.recognizedEvidencePreferenceMicroMae).toBeGreaterThanOrEqual(0);
    expect(report.availableToRecognizedRecall).toBeGreaterThanOrEqual(0);
    expect(report.availableToRecognizedRecall).toBeLessThanOrEqual(1);
    expect(report.zeroAvailableEvidenceMae).toBeGreaterThanOrEqual(0);
    expect(report.legacyAllDimensionMae).toBeGreaterThanOrEqual(0);
    expect(report.autonomousObservedPreferenceMacroMae).toBeGreaterThanOrEqual(0);
    expect(report.observedPreferenceMacroMae).toBeGreaterThanOrEqual(0);
    expect(report.observedPreferenceMicroMae).toBeGreaterThanOrEqual(0);
    expect(report.zeroEvidenceMae).toBeGreaterThanOrEqual(0);
    expect(report.shrinkage.map((point) => point.lambda)).toEqual([0, .25, .5, .75, 1]);
    expect(report.evidenceCoverage).toBeGreaterThan(0);
    expect(report.evidenceCoverage).toBeLessThan(1);
  });
});
