import { describe, expect, it } from "vitest";
import { evaluateSubject, evaluateTwins, observationsToProfile } from "../src/lab/evaluate";
import { generateTwins, generateVirtualSubjects } from "../src/lab/generate";
import { occupationSkeletons } from "../src/lab/occupations";
import { families } from "../src/lab/occupations";

describe("virtual subject laboratory", () => {
  const subjects = generateVirtualSubjects();

  it("generates the required population and occupational coverage", () => {
    expect(subjects).toHaveLength(200);
    expect(subjects.filter((subject) => subject.truth.cohort === "design")).toHaveLength(80);
    expect(subjects.filter((subject) => subject.truth.cohort === "validation")).toHaveLength(40);
    expect(subjects.filter((subject) => subject.truth.cohort === "holdout")).toHaveLength(40);
    expect(subjects.filter((subject) => subject.truth.cohort === "adversarial")).toHaveLength(40);
    expect(families.length).toBeGreaterThanOrEqual(20);
    expect(new Set(subjects.map((subject) => subject.truth.occupationalSkeleton.family)).size).toBeGreaterThanOrEqual(20);
    expect(occupationSkeletons.every((occupation) => occupation.source === "onet-inspired-local-snapshot")).toBe(true);
  });

  it("does not treat occupation as preference ground truth", () => {
    const mismatched = subjects.filter((subject) => !subject.truth.careerHistoryTruth.occupationFitsPreference);
    expect(mismatched.length).toBeGreaterThan(40);
    expect(subjects.some((subject) => subject.truth.careerHistoryTruth.accidentalCareer)).toBe(true);
    expect(subjects.some((subject) => subject.truth.careerHistoryTruth.careerChanger)).toBe(true);
  });

  it("keeps hidden truth out of the production profile path", () => {
    const subject = subjects[0]!;
    const profile = observationsToProfile(subject);
    expect(profile.persona.careerText).toContain(subject.observations.resumeText.slice(0, 20));
    expect(JSON.stringify(profile)).not.toContain("taskDnaTruth");
    expect(profile.persona.id).toBe(subject.observations.subjectId);
  });

  it("evaluates holdout subjects against hidden properties without requiring exact job order", () => {
    const holdout = subjects.filter((subject) => subject.truth.cohort === "holdout").slice(0, 12).map(evaluateSubject);
    const results = holdout.flatMap((item) => item.propertyResults);
    const passRate = results.filter((item) => item.pass).length / results.length;
    expect(passRate).toBeGreaterThanOrEqual(0.65);
  });

  it("keeps counterfactual twins honest", () => {
    const twins = evaluateTwins(generateTwins(subjects).filter((pair) => pair.kind === "same_user_different_network").slice(0, 8));
    expect(twins.every((item) => item.pass)).toBe(true);
  });
});
