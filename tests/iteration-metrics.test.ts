import { describe, expect, it } from "vitest";
import { generateOnetSubjects, ONET_LAB_SEED } from "@/lab/onetLab";
import { diagnosePreference, selectEvaluationSplit } from "@/lab/iterationMetrics";

describe("iteration metric contracts", () => {
  const subjects = generateOnetSubjects(ONET_LAB_SEED);
  it("guards locked confirmation", () => {
    expect(() => selectEvaluationSplit(subjects, "LOCKED_CONFIRMATION")).toThrow(/guarded/);
  });
  it("implements available/recognized macro, micro, zero-evidence, baselines, and fixed diagnostic shrinkage", () => {
    const development = selectEvaluationSplit(subjects, "DEVELOPMENT");
    const report = diagnosePreference(development, development);
    expect(report.primaryPreferenceDecoderMetric).toBe("AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1");
    expect(report.supersededPrimaryPreferenceDecoderMetric).toBe("AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1");
    expect(report.autonomousPreferenceDimensions).toEqual(["measurable_feedback", "experimentation_preference"]);
    expect(report.AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1).toBeGreaterThanOrEqual(0);
    expect(report.AVAILABLE_EVIDENCE_PREFERENCE_MICRO_MAE).toBeGreaterThanOrEqual(0);
    expect(report.RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE).toBeGreaterThanOrEqual(0);
    expect(report.RECOGNIZED_EVIDENCE_PREFERENCE_MICRO_MAE).toBeGreaterThanOrEqual(0);
    expect(report.ZERO_AVAILABLE_EVIDENCE_MAE).toBeGreaterThanOrEqual(0);
    expect(report.LEGACY_ALL_DIMENSION_MAE).toBeGreaterThanOrEqual(0);
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL).not.toBeNull();
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL!).toBeGreaterThanOrEqual(0);
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL!).toBeLessThanOrEqual(1);
    expect(report.shrinkage.map((point) => point.lambda)).toEqual([0, .25, .5, .75, 1]);
    expect(report.availableEligibleCoverage).toBeGreaterThan(0);
    expect(report.availableEligibleCoverage).toBeLessThan(1);
    // The extractor recognizes strictly less (or equal) generator-exposed evidence than
    // was actually made available -- the whole point of the available/recognized split.
    expect(report.recognizedEligibleCoverage).toBeLessThanOrEqual(report.availableEligibleCoverage);
  });
  it("keeps the legacy recognized-evidence-gated metric visible for comparison, never as primary", () => {
    const development = selectEvaluationSplit(subjects, "DEVELOPMENT");
    const report = diagnosePreference(development, development);
    expect(report.legacySuperseded.autonomousObservedPreferenceMacroMae).toBeGreaterThanOrEqual(0);
    expect(report.legacySuperseded.autonomousEvidenceCoverage).toBeGreaterThan(0);
    expect(report.legacySuperseded.autonomousEvidenceCoverage).toBeLessThanOrEqual(1);
  });
});
