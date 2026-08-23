import { describe, expect, it } from "vitest";
import { vector } from "@/config/model";
import { sentenceWorkSignals } from "@/domain/workStructure";
import { observationsToProfile } from "@/lab/evaluate";
import {
  availablePreferenceDimensions,
  availablePreferencePlacements,
  recognizedPreferenceDimensions,
} from "@/lab/availableEvidence";
import { diagnosePreference, preferenceMetricRecords } from "@/lab/iterationMetrics";
import type { VirtualSubject, VirtualSubjectObservations, VirtualSubjectTruth } from "@/lab/types";

const MISSED_MEASURABLE_PHRASE = "work where I can see the numbers move";

function fixtureSubject(): VirtualSubject {
  const truth: VirtualSubjectTruth = {
    subjectId: "missed-extractor-measurable",
    seed: 1,
    cohort: "design",
    occupationalSkeleton: {
      onetCode: "00-0000.00",
      title: "Analyst",
      family: "data_analytics",
      industry: "analytics",
      tasks: ["compiled weekly status reports"],
      generalizedWorkActivities: [],
      skills: ["writing"],
      knowledge: ["english"],
      workContext: ["office"],
      source: "onet-inspired-local-snapshot",
    },
    careerHistoryTruth: { years: 4, accidentalCareer: false, careerChanger: false, burnedOut: false, occupationFitsPreference: false },
    taskDnaTruth: vector({ measurable_feedback: 8.4, experimentation_preference: 5 }),
    capabilityTruth: ["writing"],
    capabilityConfidenceTruth: { writing: 0.7 },
    attractorsTruth: ["measurable_feedback"],
    repellentsTruth: [],
    goalsTruth: ["Move toward preferred task structure"],
    constraintsTruth: ["open to hybrid"],
    interpersonalStyleTruth: "brief",
    networkingComfortTruth: 4,
    expectedGeneralProperties: [],
    invariantExpectations: [],
    generationVersion: "fixture",
  };
  const observations: VirtualSubjectObservations = {
    subjectId: truth.subjectId,
    apparentField: "analytics",
    resumeText: `Analyst. I enjoy ${MISSED_MEASURABLE_PHRASE}.`,
    workHistory: ["compiled weekly status reports"],
    projects: [],
    achievements: [],
    failuresOrStruggles: [],
    scenarioResponses: [],
    explicitPreferences: [MISSED_MEASURABLE_PHRASE],
    explicitDislikes: [],
    incompleteInformation: [],
    contradictoryStatements: [],
    statedSkills: ["writing"],
    networkIntake: { people: [], relationships: [], interactions: [] },
    evidenceQualityMetadata: { sparse: false, contradictory: false, misleadingTitle: false, stale: false },
  };
  return { truth, observations };
}

describe("available vs recognized preference evidence", () => {
  it("treats a generator-exposed missed phrase as available, not recognized", () => {
    expect(Object.keys(sentenceWorkSignals(MISSED_MEASURABLE_PHRASE))).not.toContain("measurable_feedback");
    const subject = fixtureSubject();
    const available = availablePreferenceDimensions(subject);
    const recognized = recognizedPreferenceDimensions(observationsToProfile(subject));
    expect(available.has("measurable_feedback")).toBe(true);
    expect(recognized.has("measurable_feedback")).toBe(false);
    expect(availablePreferencePlacements(subject).some((item) => item.field === "explicitPreferences" && item.dimensionId === "measurable_feedback")).toBe(true);
  });

  it("keeps the missed extractor example in AVAILABLE_EVIDENCE_MAE and lowers recognized coverage instead of dropping the case", () => {
    const subject = fixtureSubject();
    const recognizedWell = {
      ...subject,
      truth: { ...subject.truth, subjectId: "recognized-experimentation", taskDnaTruth: vector({ measurable_feedback: 5, experimentation_preference: 8.1 }) },
      observations: {
        ...subject.observations,
        subjectId: "recognized-experimentation",
        resumeText: "Analyst. I enjoy running targeted experiments.",
        explicitPreferences: ["running targeted experiments"],
      },
    };
    const both = diagnosePreference([subject, recognizedWell], [subject, recognizedWell]);
    const recognizedOnly = diagnosePreference([recognizedWell], [recognizedWell]);
    const records = preferenceMetricRecords([subject, recognizedWell], [subject, recognizedWell]);
    const missed = records.find((record) => record.subjectId === subject.truth.subjectId && record.id === "measurable_feedback");
    const recognizedMissed = records.filter((record) => record.recognized && record.id === "measurable_feedback" && record.subjectId === subject.truth.subjectId);
    expect(missed?.available).toBe(true);
    expect(missed?.recognized).toBe(false);
    expect(recognizedMissed).toHaveLength(0);
    expect(both.primaryPreferenceDecoderMetric).toBe("AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1");
    expect(both.availableEligibleCount).toBeGreaterThan(recognizedOnly.availableEligibleCount);
    expect(both.availableToRecognizedRecall).toBeLessThan(1);
    expect(both.availableEvidencePreferenceMacroMae).not.toBe(recognizedOnly.availableEvidencePreferenceMacroMae);
    expect(both.antiGoodhart.extractorMissDoesNotLeavePrimary).toBe(true);
  });

  it("does not use hidden-truth thresholds alone to label availability", () => {
    const subject = fixtureSubject();
    const hiddenOnly: VirtualSubject = {
      ...subject,
      truth: { ...subject.truth, subjectId: "hidden-only", taskDnaTruth: vector({ measurable_feedback: 9.5 }) },
      observations: {
        ...subject.observations,
        subjectId: "hidden-only",
        resumeText: "Analyst. Compiled weekly status reports.",
        explicitPreferences: [],
        explicitDislikes: [],
        contradictoryStatements: [],
      },
    };
    expect(hiddenOnly.truth.taskDnaTruth.measurable_feedback).toBeGreaterThan(6.5);
    expect(availablePreferenceDimensions(hiddenOnly).has("measurable_feedback")).toBe(false);
  });
});
