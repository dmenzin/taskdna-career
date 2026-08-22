import { describe, expect, it } from "vitest";
import { applyFeedback, buildUserProfile, createDemoDataset, runEvaluation, scoreFunctions, scoreJobs } from "../src/domain/engine";

describe("TaskDNA recommendation engine", () => {
  const dataset = createDemoDataset();

  it("keeps the synthetic search funnel honest", () => {
    expect(dataset.rawObservations).toHaveLength(180);
    expect(dataset.jobs.length).toBeGreaterThanOrEqual(100);
    expect(dataset.searchRun.rawCount).toBe(180);
    expect(dataset.searchRun.deepAnalysisCount).toBeGreaterThanOrEqual(75);
  });

  it("separates preference fit from current hireability", () => {
    const roboticsProfile = buildUserProfile("robotics-no-cpp");
    const roboticsJob = scoreJobs(roboticsProfile, dataset.jobs).find((item) => item.job.canonicalId === "job-high-fit-low-hireability-robotics");
    expect(roboticsJob?.score.predictedFit).toBeGreaterThan(8);
    expect(roboticsJob?.score.hireability).toBeLessThan(roboticsJob!.score.predictedFit);
    expect(roboticsJob?.score.sellability).toMatch(/STRATEGIC_STRETCH|REAL_SKILL_GAP/);

    const qualityProfile = buildUserProfile("quality-dislikes-compliance");
    const complianceJob = scoreJobs(qualityProfile, dataset.jobs).find((item) => item.job.canonicalId === "job-high-hire-low-fit-compliance");
    expect(complianceJob?.score.hireability).toBeGreaterThan(complianceJob!.score.predictedFit);
    expect(complianceJob?.score.negativeFitRisk).toBeGreaterThan(2);
  });

  it("does not collapse title into actual work structure", () => {
    const profile = buildUserProfile("failure-analyst");
    const scored = scoreJobs(profile, dataset.jobs);
    const systemsDebug = scored.find((item) => item.job.canonicalId === "job-title-bias-systems-debug");
    const systemsMbse = scored.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse");
    const productPerformance = scored.find((item) => item.job.canonicalId === "job-diff-title-same-fa-1");
    const reliabilityInvestigation = scored.find((item) => item.job.canonicalId === "job-diff-title-same-fa-2");

    expect(systemsDebug?.job.title).toEqual(systemsMbse?.job.title);
    expect(systemsDebug!.score.predictedFit - systemsMbse!.score.predictedFit).toBeGreaterThan(1.5);
    expect(productPerformance?.job.title).not.toEqual(reliabilityInvestigation?.job.title);
    expect(Math.abs(productPerformance!.score.predictedFit - reliabilityInvestigation!.score.predictedFit)).toBeLessThan(0.7);
  });

  it("changes recommendations from preference feedback without adding capability evidence", () => {
    const profile = buildUserProfile("failure-analyst");
    const beforeCapabilities = profile.capabilities.map((capability) => `${capability.name}:${capability.evidenceLevel}`).join("|");
    const scored = scoreJobs(profile, dataset.jobs);
    const documentationJob = scored.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse")!;
    const result = applyFeedback(profile, scored, {
      jobId: documentationJob.job.canonicalId,
      reaction: "DISLIKE",
      reasonTags: ["too much documentation", "too much coordination"],
    });
    const afterCapabilities = result.updatedProfile.capabilities.map((capability) => `${capability.name}:${capability.evidenceLevel}`).join("|");
    expect(result.changedDimensions.length).toBeGreaterThan(0);
    expect(afterCapabilities).toEqual(beforeCapabilities);
    expect(result.explanation).toContain("Capability evidence was not changed");
  });

  it("low-information users stay lower-confidence", () => {
    const lowInfo = buildUserProfile("low-information");
    const failureAnalyst = buildUserProfile("failure-analyst");
    expect(lowInfo.confidence).toBeLessThan(failureAnalyst.confidence);
    expect(scoreFunctions(lowInfo)[0].confidence).toBeLessThan(0.55);
  });

  it("passes the formal deterministic evaluation harness", () => {
    const evaluation = runEvaluation();
    expect(evaluation.checks).toEqual(expect.arrayContaining([expect.objectContaining({ id: "same-title-different-tasks", pass: true })]));
    expect(evaluation.passed).toBe(true);
  });
});
