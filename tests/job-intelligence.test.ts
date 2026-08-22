import { describe, expect, it } from "vitest";
import {
  analyzeJob,
  buildUserProfile,
  canonicalizeObservations,
  createDemoDataset,
  estimateSimulatedCommute,
  hardFilterJobs,
  scoreJobs,
  transitionFreshnessState,
} from "../src/domain/engine";

describe("job intelligence, freshness, canonicalization, and commute", () => {
  const dataset = createDemoDataset();

  it("writes actual-work summaries that describe recurring work rather than restating title", () => {
    const systemsDebug = dataset.jobs.find((job) => job.canonicalId === "job-title-bias-systems-debug")!;
    const analysis = analyzeJob(systemsDebug);
    expect(analysis.whatThisJobIsReallyAbout).toMatch(/logs|system tests|hardware\/software|integration failures/i);
    expect(analysis.whatThisJobIsReallyAbout.toLowerCase()).not.toBe(systemsDebug.title.toLowerCase());
  });

  it("scores same title / different work differently and different titles / same work similarly", () => {
    const scored = scoreJobs(buildUserProfile("failure-analyst"), dataset.jobs);
    const systemsDebug = scored.find((item) => item.job.canonicalId === "job-title-bias-systems-debug")!;
    const systemsMbse = scored.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse")!;
    const fa1 = scored.find((item) => item.job.canonicalId === "job-diff-title-same-fa-1")!;
    const fa2 = scored.find((item) => item.job.canonicalId === "job-diff-title-same-fa-2")!;
    expect(systemsDebug.job.title).toBe(systemsMbse.job.title);
    expect(systemsDebug.score.predictedFit - systemsMbse.score.predictedFit).toBeGreaterThan(1.5);
    expect(Math.abs(fa1.score.predictedFit - fa2.score.predictedFit)).toBeLessThan(0.7);
  });

  it("requires novelty to be relevant, transferable, and non-obvious", () => {
    const failureAnalystJobs = scoreJobs(buildUserProfile("failure-analyst"), dataset.jobs);
    const relevantNovel = failureAnalystJobs.find((item) => item.job.canonicalId === "job-title-bias-systems-debug")!;
    const irrelevantNovel = failureAnalystJobs.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse")!;
    expect(relevantNovel.score.novelty).toBeGreaterThanOrEqual(7.5);
    expect(irrelevantNovel.score.predictedFit).toBeLessThan(relevantNovel.score.predictedFit);
    expect(irrelevantNovel.score.novelty).toBeLessThan(7.5);
  });

  it("does not turn failed reverification into confirmed closed", () => {
    expect(transitionFreshnessState("VERIFIED_LIVE", "reverify_failed")).toBe("POSSIBLY_STALE");
    expect(transitionFreshnessState("PREVIOUSLY_FOUND_NOT_RECHECKED", "reverify_failed")).toBe("POSSIBLY_STALE");
    expect(transitionFreshnessState("POSSIBLY_STALE", "closure_evidence")).toBe("CONFIRMED_CLOSED");
    expect(transitionFreshnessState("CONFIRMED_CLOSED", "reverify_failed")).toBe("CONFIRMED_CLOSED");
  });

  it("canonicalizes duplicate raw observations without calling raw rows unique jobs", () => {
    const duplicate = { ...dataset.rawObservations[0], id: "raw-duplicate" };
    const canonical = canonicalizeObservations([dataset.rawObservations[0], duplicate, dataset.rawObservations[1]]);
    expect(canonical).toHaveLength(2);
    expect(canonical[0].sourceObservationIds).toHaveLength(2);
  });

  it("hard filters and commute rules are configurable domain behavior", () => {
    const decisions = hardFilterJobs(dataset.jobs);
    expect(decisions.some((decision) => !decision.pass && decision.reasons.join(" ").includes("extreme seniority"))).toBe(true);
    const remote = estimateSimulatedCommute({ location: "Remote - US", workMode: "Remote" });
    const onsite = estimateSimulatedCommute({ location: "Seattle, WA", workMode: "Onsite" }, "Boston, MA", 45);
    expect(remote.penalty).toBe(0);
    expect(onsite.penalty).toBeGreaterThan(remote.penalty);
  });
});
