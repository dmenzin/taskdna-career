import { describe, expect, it } from "vitest";
import { buildUserProfile, calculateConfidenceAdjustedFit, calculateOverallScore, createDemoDataset, determineActionTier, determineSellability, scoreJobs } from "../src/domain/engine";

describe("scoring formulas and thresholds", () => {
  it("calculates CAF with the configured formula", () => {
    expect(calculateConfidenceAdjustedFit(9, 0.75)).toBeCloseTo(8.5);
    expect(calculateConfidenceAdjustedFit(5, 0.5)).toBeCloseTo(4);
  });

  it("calculates overall with the documented weights", () => {
    const overall = calculateOverallScore({ hireability: 8, confidenceAdjustedFit: 7, careerDirection: 6, technicalGrowth: 5, durability: 4 });
    expect(overall).toBeCloseTo(0.4 * 8 + 0.3 * 7 + 0.15 * 6 + 0.1 * 5 + 0.05 * 4);
  });

  it("handles action-tier boundaries intentionally", () => {
    expect(determineActionTier({ overall: 8.2, hireability: 7.5, predictedFit: 8.4, confidence: 0.65, hardGaps: [] })).toBe("ATTACK_FIRST");
    expect(determineActionTier({ overall: 7.8, hireability: 7.5, predictedFit: 8.7, confidence: 0.65, hardGaps: [] })).toBe("CORE_APPLY");
    expect(determineActionTier({ overall: 7.4, hireability: 7.49, predictedFit: 8.7, confidence: 0.65, hardGaps: [] })).toBe("HIGH_FIT_STRETCH");
    expect(determineActionTier({ overall: 7.4, hireability: 7.49, predictedFit: 8.69, confidence: 0.65, hardGaps: [] })).toBe("FUTURE_EXEMPLAR");
    expect(determineActionTier({ overall: 7.4, hireability: 7.49, predictedFit: 8.7, confidence: 0.64, hardGaps: [] })).toBe("FUTURE_EXEMPLAR");
  });

  it("classifies sellability from hireability, transfer, and hard gaps", () => {
    expect(determineSellability(8.1, 7, [])).toBe("DIRECT_SELL");
    expect(determineSellability(6.9, 6, [])).toBe("SELL_HARDER");
    expect(determineSellability(5.5, 4, [])).toBe("STRATEGIC_STRETCH");
    expect(determineSellability(8.2, 8, ["C++", "ROS", "embedded systems"])).toBe("REAL_SKILL_GAP");
  });

  it("preserves raw fit, confidence, CAF, overall, and scoring version in job scores and traces", () => {
    const job = scoreJobs(buildUserProfile("failure-analyst"), createDemoDataset().jobs)[0];
    expect(job.score.rawPredictedFit).toBeGreaterThanOrEqual(job.score.predictedFit);
    expect(job.score.confidenceAdjustedFit).toBeCloseTo(calculateConfidenceAdjustedFit(job.score.predictedFit, job.score.confidence));
    expect(job.score.scoringVersion).toBe("scoring.v1");
    expect(job.decisionTrace.join(" ")).toMatch(/Raw Work Fit|CAF|Overall|scoring config scoring.v1/);
  });
});
