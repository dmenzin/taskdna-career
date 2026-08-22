import { describe, expect, it } from "vitest";
import { buildProfileFromCareerInput, scoreJobs } from "../src/domain/engine";
import { analogInvestigationJobs } from "../src/lab/analogJobs";
import { evaluateTwins } from "../src/lab/evaluate";
import { generateTwins, generateVirtualSubjects } from "../src/lab/generate";
import { spearman } from "../src/lab/invariants";

describe("metamorphic scoring properties", () => {
  it("does not change Work Fit when only the network variant changes", () => {
    const twins = evaluateTwins(generateTwins(generateVirtualSubjects()).filter((pair) => pair.kind === "same_user_different_network").slice(0, 10));
    expect(twins.every((item) => item.pass)).toBe(true);
  });

  it("keeps ranking stable under tiny Task-DNA noise", () => {
    const profile = buildProfileFromCareerInput({
      careerText: "I diagnose failures with logs and experiments and dislike documentation marathons.",
      skills: ["python", "root cause"],
    });
    const a = scoreJobs(profile, analogInvestigationJobs);
    const noisy = {
      ...profile,
      taskDna: profile.taskDna.map((dimension, index) => ({ ...dimension, value: Math.min(10, Math.max(0, dimension.value + (index % 2 === 0 ? 0.04 : -0.04))) })),
    };
    const b = scoreJobs(noisy, analogInvestigationJobs);
    expect(spearman(a.map((item) => item.score.overall), b.map((item) => item.score.overall))).toBeGreaterThan(0.9);
  });
});
