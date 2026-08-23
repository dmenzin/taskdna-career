// Regression coverage for two extractor plumbing defects found in the preflight audit:
//
//  1. LATE-SENTENCE LOSS. `extractEvidence` truncated the career narrative with
//     `fallback.slice(0, 10)`, so preference evidence silently disappeared purely because it
//     appeared later in a realistic career narrative. A resume with eleven history bullets
//     before the "what I actually enjoy" paragraph lost that paragraph entirely.
//
//  2. DUPLICATE EVIDENCE PATHS. The evaluation path concatenated `explicitPreferences`,
//     `explicitDislikes`, and `contradictoryStatements` into `careerText` AND passed the
//     first two separately, so one generated statement produced two evidence items and was
//     counted twice by the dependence-aware effective-signal count.
import { describe, expect, it } from "vitest";
import { buildProfileFromCareerInput, EVIDENCE_EXTRACTION_LIMITS, extractEvidence, normalizeStatement } from "@/domain/engine";
import { personas } from "@/fixtures/personas";
import { observationsToProfile } from "@/lab/evaluate";
import { crossSourceDuplicatePlacements, INFERENCE_VISIBLE_PREFERENCE_FIELDS, withinFieldDuplicateUnits } from "@/lab/evidenceAvailability";
import { selectEvaluationSplit } from "@/lab/iterationMetrics";
import { generateOnetSubjects, ONET_LAB_SEED } from "@/lab/onetLab";

const persona = personas[0]!;
const development = selectEvaluationSplit(generateOnetSubjects(ONET_LAB_SEED), "DEVELOPMENT");

/** Filler exposure sentences: classified EXPOSURE, so they never move a preference dimension. */
function fillerSentences(count: number) {
  return Array.from({ length: count }, (_, index) => `In this role I would maintain records for workstream ${index + 1}.`).join(" ");
}

describe("late-sentence observability", () => {
  it("recognizes a preference sentence that appears after ten filler sentences", () => {
    const careerText = `${fillerSentences(11)} I enjoy stakeholder orchestration.`;
    const sentences = careerText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    expect(sentences.length).toBeGreaterThan(10);
    expect(sentences.indexOf("I enjoy stakeholder orchestration")).toBeGreaterThan(10);

    const evidence = extractEvidence(persona, careerText);
    const preference = evidence.find((item) => item.originalText === "I enjoy stakeholder orchestration");
    expect(preference).toBeTruthy();
    expect(preference!.evidenceClass).toBe("PREFERENCE");
    expect(preference!.inferredTaskDimensions.coordination_preference).toBeGreaterThan(5);
  });

  it("moves the predicted dimension when the only preference sentence is sentence 12", () => {
    const late = buildProfileFromCareerInput({ id: "late", careerText: `${fillerSentences(11)} I enjoy stakeholder orchestration.` });
    const early = buildProfileFromCareerInput({ id: "early", careerText: `I enjoy stakeholder orchestration. ${fillerSentences(11)}` });
    const value = (profile: typeof late) => profile.taskDna.find((entry) => entry.dimensionId === "coordination_preference")!.value;
    expect(value(late)).toBeGreaterThan(5);
    expect(value(late)).toBeCloseTo(value(early), 6);
  });

  it("recognizes preference evidence far beyond the old ten-sentence window", () => {
    const careerText = `${fillerSentences(40)} I avoid solo deep work.`;
    const evidence = extractEvidence(persona, careerText);
    const dislike = evidence.find((item) => item.originalText === "I avoid solo deep work");
    expect(dislike).toBeTruthy();
    expect(dislike!.evidenceClass).toBe("DISLIKE");
  });

  it("still bounds work on pathological input", () => {
    const huge = `${fillerSentences(5000)} I enjoy stakeholder orchestration.`;
    const started = Date.now();
    const evidence = extractEvidence(persona, huge);
    expect(Date.now() - started).toBeLessThan(10000);
    expect(evidence.length).toBeLessThanOrEqual(EVIDENCE_EXTRACTION_LIMITS.maxSentences + 12);
  });
});

describe("duplicate evidence paths", () => {
  it("keeps the four observable sources distinct instead of concatenating them into careerText", () => {
    const subject = development.find((item) => item.observations.explicitPreferences.length > 0)!;
    const profile = observationsToProfile(subject);
    const narrativeTexts = profile.evidence.filter((item) => item.sourceReference === "career text").map((item) => normalizeStatement(item.originalText));
    for (const phrase of subject.observations.explicitPreferences) {
      expect(narrativeTexts).not.toContain(normalizeStatement(phrase));
    }
    expect(new Set(profile.evidence.map((item) => item.sourceReference)).size).toBeGreaterThan(1);
  });

  it("counts one underlying statement once even when two plumbing paths carry it", () => {
    const statement = "I enjoy stakeholder orchestration";
    // The narrative already contains the statement; passing it again as an explicit
    // preference is the duplicate plumbing path.
    const profile = buildProfileFromCareerInput({
      id: "dup",
      careerText: `Coordinator working in operations. ${statement}.`,
      explicitPreferences: [statement],
    });
    const matches = profile.evidence.filter((item) => normalizeStatement(item.originalText) === normalizeStatement(statement));
    expect(matches).toHaveLength(1);
  });

  it("normalizes punctuation and case before deduplicating", () => {
    const profile = buildProfileFromCareerInput({
      id: "dup-normalized",
      careerText: "Coordinator working in operations. I enjoy Stakeholder Orchestration!",
      explicitPreferences: ["i enjoy stakeholder orchestration"],
    });
    expect(profile.evidence.filter((item) => normalizeStatement(item.originalText) === "i enjoy stakeholder orchestration")).toHaveLength(1);
  });

  it("still admits a genuinely distinct explicit-list statement", () => {
    const profile = buildProfileFromCareerInput({
      id: "distinct",
      careerText: "Coordinator working in operations. I enjoy stakeholder orchestration.",
      explicitPreferences: ["running targeted experiments"],
    });
    expect(profile.evidence.some((item) => item.sourceType === "EXPLICIT_PREFERENCE" && item.originalText === "running targeted experiments")).toBe(true);
  });

  it("treats contradictory statements as their own dependence group", () => {
    const profile = buildProfileFromCareerInput({
      id: "contra",
      careerText: "Coordinator working in operations. I enjoy stakeholder orchestration.",
      contradictoryStatements: ["Claims to dislike solo deep work while reporting paid success doing it."],
    });
    const contradictory = profile.evidence.find((item) => item.sourceReference === "contradictory statements")!;
    expect(contradictory).toBeTruthy();
    expect(contradictory.sourceGroup).not.toBe(profile.evidence[0]!.sourceGroup);
  });

  it("no generated subject exposes the same statement twice, within a field or across sources", () => {
    const withinField = development.filter((subject) => withinFieldDuplicateUnits(subject.observations).length > 0);
    const crossSource = development.filter((subject) => crossSourceDuplicatePlacements(subject.observations).length > 0);
    expect(withinField.map((subject) => subject.truth.subjectId)).toEqual([]);
    expect(crossSource.map((subject) => subject.truth.subjectId)).toEqual([]);
  });

  it("detects a cross-source duplicate when one is deliberately introduced", () => {
    const subject = development[0]!;
    const attacked = {
      ...subject.observations,
      resumeText: "Analyst working in operations. I enjoy stakeholder orchestration.",
      explicitPreferences: ["stakeholder orchestration"],
    };
    const duplicates = crossSourceDuplicatePlacements(attacked);
    expect(duplicates.length).toBeGreaterThan(0);
    expect(new Set(duplicates[0]!.map((placement) => placement.field))).toEqual(new Set(["resumeText", "explicitPreferences"]));
  });

  it("detects a within-field duplicate when one is deliberately introduced", () => {
    const attacked = { ...development[0]!.observations, explicitPreferences: ["running targeted experiments", "running targeted experiments"] };
    expect(withinFieldDuplicateUnits(attacked)).toEqual([{ field: "explicitPreferences", unit: "running targeted experiments" }]);
  });

  it("the declared inference-visible field list matches what the evaluation path actually passes", () => {
    expect([...INFERENCE_VISIBLE_PREFERENCE_FIELDS].sort()).toEqual(["contradictoryStatements", "explicitDislikes", "explicitPreferences", "resumeText"]);
    // observationsToProfile must pass exactly these and nothing else that carries preference
    // language, so the availability denominator cannot drift away from what inference sees.
    const source = observationsToProfile.toString();
    for (const field of INFERENCE_VISIBLE_PREFERENCE_FIELDS) expect(source).toContain(field);
    for (const excluded of ["failuresOrStruggles", "workHistory", "projects", "achievements"]) expect(source).not.toContain(excluded);
  });
});
