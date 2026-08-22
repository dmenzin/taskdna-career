import { describe, expect, it } from "vitest";
import { buildProfileFromCareerInput, scoreFunctions, scoreJobs } from "../src/domain/engine";
import { createHumanOpportunityGraphFromIntake } from "../src/domain/networkEngine";
import { analogInvestigationJobs } from "../src/lab/analogJobs";
import { evaluateZeroOrigin } from "../src/lab/evaluate";
import { generateVirtualSubjects } from "../src/lab/generate";

describe("zero-origin generic engine", () => {
  it("initializes inference, ranking, and actions without demo persona fixtures", () => {
    const profile = buildProfileFromCareerInput({
      id: "zero-origin-accountant",
      name: "Generic accountant",
      currentField: "accounting",
      careerText: "Reconciled exceptions, tested audit evidence, and disliked endless close administration. Enjoyed finding why a number was wrong.",
      explicitPreferences: ["exception investigation"],
      explicitDislikes: ["endless close cycles"],
      skills: ["excel", "audit"],
    });
    const functions = scoreFunctions(profile);
    const jobs = scoreJobs(profile, analogInvestigationJobs);
    expect(profile.taskDna).toHaveLength(17);
    expect(functions.some((item) => item.function.id === "financial-analysis-audit" || item.function.id === "investigative-analysis")).toBe(true);
    expect(jobs[0]?.score.predictedFit).toBeGreaterThan(1);
  });

  it("can build a network graph from intake instead of golden persona contacts", () => {
    const subjects = generateVirtualSubjects();
    const subject = subjects.find((item) => item.truth.occupationalSkeleton.family === "finance")!;
    const profile = buildProfileFromCareerInput({
      id: subject.observations.subjectId,
      careerText: subject.observations.resumeText,
      skills: subject.observations.statedSkills,
    });
    const jobs = scoreJobs(profile, analogInvestigationJobs);
    const graph = createHumanOpportunityGraphFromIntake(profile, jobs, subject.observations.networkIntake);
    expect(graph.people.length).toBeGreaterThan(0);
    expect(graph.nextBestActions.length).toBeGreaterThan(0);
    expect(graph.scoredJobs.every((job, index) => job.score.predictedFit === jobs[index]?.score.predictedFit)).toBe(true);
  });

  it("passes the holdout zero-origin suite", () => {
    const cases = evaluateZeroOrigin(generateVirtualSubjects());
    expect(cases.every((item) => item.pass)).toBe(true);
  });
});
