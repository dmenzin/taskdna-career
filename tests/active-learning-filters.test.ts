import { describe, expect, it } from "vitest";
import { applyFeedback, buildUserProfile, createDemoDataset, filterAndSortJobs, scoreJobs } from "../src/domain/engine";

describe("active learning, profile updates, filtering, and sorting", () => {
  const dataset = createDemoDataset();

  it("stores before/after snapshots and does not fabricate capability", () => {
    const profile = buildUserProfile("failure-analyst");
    const jobs = scoreJobs(profile, dataset.jobs);
    const target = jobs.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse")!;
    const result = applyFeedback(profile, jobs, {
      jobId: target.job.canonicalId,
      reaction: "DISLIKE",
      reasonTags: ["too much documentation", "too much coordination"],
    });

    expect(result.beforeProfileSnapshot.capabilityIds).toEqual(result.afterProfileSnapshot.capabilityIds);
    expect(result.feedbackEvent.reaction).toBe("DISLIKE");
    expect(result.changedDimensions.some((dimension) => dimension.id === "coordination_preference")).toBe(true);
    expect(result.explanation).toContain("Capability evidence was not changed");
  });

  it("repeated dislike for coordination-heavy work lowers coordination-heavy jobs", () => {
    const profile = buildUserProfile("failure-analyst");
    const before = scoreJobs(profile, dataset.jobs);
    const target = before.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse")!;
    const updated = applyFeedback(profile, before, {
      jobId: target.job.canonicalId,
      reaction: "DISLIKE",
      reasonTags: ["too much stakeholder coordination", "too much documentation"],
    }).updatedProfile;
    const afterTarget = scoreJobs(updated, dataset.jobs).find((item) => item.job.canonicalId === target.job.canonicalId)!;
    expect(afterTarget.score.predictedFit).toBeLessThan(target.score.predictedFit);
    expect(afterTarget.score.overall).toBeLessThan(target.score.overall);
  });

  it("filters by search/function/novelty and sorts deterministically", () => {
    const jobs = scoreJobs(buildUserProfile("failure-analyst"), dataset.jobs);
    const searched = filterAndSortJobs(jobs, "reliability", "", "fit", false);
    expect(searched.every((item) => `${item.job.title} ${item.analysis.whatThisJobIsReallyAbout} ${item.job.domain}`.toLowerCase().includes("reliability") || item.analysis.requiredCapabilities.join(" ").toLowerCase().includes("reliability"))).toBe(true);

    const functionFiltered = filterAndSortJobs(jobs, "", "failure-analysis", "overall", false);
    expect(functionFiltered.every((item) => item.analysis.primaryFunctionId === "failure-analysis")).toBe(true);

    const novelty = filterAndSortJobs(jobs, "", "", "novelty", true);
    expect(novelty.length).toBeGreaterThan(0);
    expect(novelty.every((item) => item.score.novelty >= 7.5)).toBe(true);
    expect(novelty[0].score.novelty).toBeGreaterThanOrEqual(novelty.at(-1)!.score.novelty);
  });
});
