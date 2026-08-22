import { describe, expect, it } from "vitest";
import { buildProfileFromCareerInput, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { buildRequirementMatrix } from "../src/domain/hireability";

describe("structured Hireability", () => {
  const dataset = createDemoDataset();

  it("keeps high fit / low hireability when a core tool is missing", () => {
    const profile = buildProfileFromCareerInput({
      id: "robotics-gap",
      careerText: "I enjoy debugging robot behavior from logs. I have professional Python experience and no professional C++ or ROS.",
      skills: ["python"],
    });
    const job = dataset.jobs.find((item) => item.canonicalId === "job-high-fit-low-hireability-robotics")!;
    const scored = scoreJobs(profile, [job])[0]!;
    const matrix = buildRequirementMatrix(profile, job);
    expect(scored.score.predictedFit).toBeGreaterThan(scored.score.hireability);
    expect(matrix.rows.some((row) => row.gapClass === "CORE" || row.evidence.matchType === "HARD_MISSING")).toBe(true);
  });

  it("does not treat an optional tool gap as fatal", () => {
    const profile = buildProfileFromCareerInput({
      id: "analyst",
      careerText: "I enjoy analyzing data and building forecasts in Excel. Delivered variance explanations for finance partners.",
      skills: ["excel", "financial modeling"],
    });
    const job = {
      ...dataset.jobs[0]!,
      canonicalId: "optional-tableau",
      requirements: ["excel", "financial modeling"],
      preferredRequirements: ["tableau"],
    };
    const matrix = buildRequirementMatrix(profile, job);
    expect(matrix.hardDisqualifiers).toHaveLength(0);
    expect(matrix.hireability).toBeGreaterThan(5);
  });

  it("treats a license gap as fatal and does not let Work Fit erase it", () => {
    const profile = buildProfileFromCareerInput({
      id: "nurse-no-license",
      careerText: "I enjoy patient assessment and clinical workflow. Coursework only; no RN license.",
      skills: ["clinical workflow"],
    });
    const job = {
      ...dataset.jobs[0]!,
      canonicalId: "rn-role",
      title: "Registered Nurse",
      requirements: ["RN license", "clinical workflow"],
      preferredRequirements: [],
    };
    const matrix = buildRequirementMatrix(profile, job);
    expect(matrix.hardDisqualifiers.some((item) => /rn license/i.test(item))).toBe(true);
    expect(matrix.hireability).toBeLessThan(5);
  });

  it("gives academic-only evidence less credit than professional evidence", () => {
    const academic = buildProfileFromCareerInput({
      id: "academic",
      careerText: "Coursework in Python and no professional software experience yet. I enjoy building small tools.",
      skills: ["python"],
    });
    const professional = buildProfileFromCareerInput({
      id: "pro",
      careerText: "Delivered Python analysis tools in production for three years. I enjoy building small tools.",
      skills: ["python"],
    });
    const job = {
      ...dataset.jobs[0]!,
      canonicalId: "python-role",
      requirements: ["Python"],
      preferredRequirements: [],
    };
    expect(buildRequirementMatrix(professional, job).hireability).toBeGreaterThan(buildRequirementMatrix(academic, job).hireability);
  });
});
