import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  S01_DESIGN,
  S01_EXPERIMENT_ID,
  S01_SUPERSEDED_EXPERIMENT_ID,
  S01_FOUR_TRIAL_JUSTIFICATION,
  S01_VERDICT_DIMENSIONS,
  architectureDecisionFlip,
  fieldAgreement,
  pairwiseJaccard,
  recommendationChurn,
  spearmanRankCorrelation,
  summaryStats,
  top1Agreement,
  topKOverlap,
  workIdentity,
} from "@/agent/s01Stability";
import type { Registry } from "@/agent/researchProgramView";
import type { Program } from "@/agent/researchProgramView";

const program = JSON.parse(readFileSync("config/agentic-research-program.json", "utf8")) as Program;
const registry = JSON.parse(readFileSync("config/experiment-registry.json", "utf8")) as Registry;

describe("S-01 recommendation churn is preregistered, not invented after results", () => {
  it("uses 1 - |TopK ∩ TopK| / K", () => {
    expect(recommendationChurn(["a", "b", "c", "d"], ["a", "b", "c", "d"], 4)).toBe(0);
    expect(recommendationChurn(["a", "b", "c", "d"], ["e", "f", "g", "h"], 4)).toBe(1);
    expect(recommendationChurn(["a", "b", "c", "d"], ["a", "x", "y", "z"], 4)).toBe(0.75);
  });

  it("treats a short list as higher churn against K, not against |A ∪ B|", () => {
    expect(recommendationChurn(["a", "b"], ["a", "b"], 4)).toBe(0.5);
  });

  it("keeps quality-overlap helpers distinct from churn", () => {
    expect(topKOverlap(["a", "b", "c"], ["a", "x", "y"], 3)).toBeCloseTo(1 / 3);
    expect(top1Agreement(["a", "b"], ["a", "c"])).toBe(1);
    expect(top1Agreement(["a", "b"], ["b", "a"])).toBe(0);
  });

  it("returns Spearman 1 for identical order and -1 for a full reversal of the same ids", () => {
    expect(spearmanRankCorrelation(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBeCloseTo(1);
    expect(spearmanRankCorrelation(["a", "b", "c", "d"], ["d", "c", "b", "a"])).toBeCloseTo(-1);
  });
});

describe("S-01 representation helpers distinguish identity from field bags", () => {
  const a = { action: "Close", object: "the books", purpose: "report", method: "reconcile", domain: "finance" };
  const b = { action: "close", object: "the books", purpose: "report", method: "reconcile", domain: "finance" };
  const c = { action: "close", object: "the deal", purpose: "report", method: "negotiate", domain: "sales" };

  it("normalizes role identity so case and spacing do not invent instability", () => {
    expect(workIdentity(a)).toBe(workIdentity(b));
    expect(workIdentity(a)).not.toBe(workIdentity(c));
  });

  it("reports field-level Jaccard separately from whole-item identity", () => {
    expect(fieldAgreement([a], [c], "action")).toBe(1);
    expect(fieldAgreement([a], [c], "object")).toBe(0);
    expect(pairwiseJaccard(["close|books"], ["close|deal"])).toBe(0);
  });
});

describe("S-01 architecture-decision flips use P-01's published rules, not new margins", () => {
  it("keeps Case A standing when contamination is clean and experience CI still spans zero", () => {
    expect(architectureDecisionFlip({
      contaminationMax: 0,
      experienceCiExcludesZeroDownward: false,
      directionCiExcludesZeroDownward: false,
    })).toEqual({ primaryCaseAWouldStand: true, directionStoryWouldChange: false });
  });

  it("flips Case A on contamination or an experience regression whose CI excludes zero", () => {
    expect(architectureDecisionFlip({
      contaminationMax: 0.06,
      experienceCiExcludesZeroDownward: false,
      directionCiExcludesZeroDownward: false,
    }).primaryCaseAWouldStand).toBe(false);
    expect(architectureDecisionFlip({
      contaminationMax: 0,
      experienceCiExcludesZeroDownward: true,
      directionCiExcludesZeroDownward: false,
    }).primaryCaseAWouldStand).toBe(false);
  });

  it("treats a Direction CI excluding zero downward as a story change, not a primary Case A fail", () => {
    const flip = architectureDecisionFlip({
      contaminationMax: 0,
      experienceCiExcludesZeroDownward: false,
      directionCiExcludesZeroDownward: true,
    });
    expect(flip.primaryCaseAWouldStand).toBe(true);
    expect(flip.directionStoryWouldChange).toBe(true);
  });
});

describe("S-01 summary stats retain the distribution, not only the sign", () => {
  it("reports mean, median, range, and sample SD", () => {
    const stats = summaryStats([-0.06, -0.02, 0.01, 0.03]);
    expect(stats.n).toBe(4);
    expect(stats.mean).toBeCloseTo(-0.01);
    expect(stats.median).toBeCloseTo(-0.005);
    expect(stats.range).toBeCloseTo(0.09);
    expect(stats.sd).not.toBeNull();
  });
});

describe("the amended S-01 preregistration replaced the sign-majority design", () => {
  it("supersedes the unexecuted first draft instead of rewriting it", () => {
    const original = registry.records.find((record) => record.experimentId === S01_SUPERSEDED_EXPERIMENT_ID);
    const amended = registry.records.find((record) => record.experimentId === S01_EXPERIMENT_ID);
    expect(original?.status).toBe("SUPERSEDED");
    expect(original?.supersededBy).toBe(S01_EXPERIMENT_ID);
    expect(original?.actualCalls).toBeNull();
    expect(amended?.status).toBe("PREREGISTERED");
    expect(amended?.supersedes).toBe(S01_SUPERSEDED_EXPERIMENT_ID);
    expect(amended?.estimatedCalls).toBe(48);
    expect(amended?.estimatedCostUsd).toBe(3.73);
  });

  it("does not use sign majority as the success or failure rule", () => {
    const amended = registry.records.find((record) => record.experimentId === S01_EXPERIMENT_ID)!;
    expect(amended.successCriterion.toLowerCase()).not.toMatch(/3-to-1|sign majority|sign is identical/);
    expect(amended.failureCriterion.toLowerCase()).not.toMatch(/sign flips in 2/);
    expect(amended.primaryMetrics.join(" ").toLowerCase()).toMatch(/recommendation churn|architecture-decision/);
    expect(S01_FOUR_TRIAL_JUSTIFICATION.rejectedJustification).toMatch(/NOT justified because they permit a 3-to-1/);
    expect(S01_DESIGN.signCountsAreDescriptiveOnly).toBe(true);
    expect(S01_DESIGN.nonInferiorityMargins).toBeNull();
  });

  it("keeps four distinct verdict dimensions and identical input bytes", () => {
    expect([...S01_VERDICT_DIMENSIONS]).toEqual([
      "REPRESENTATION_STABILITY",
      "RANKING_STABILITY",
      "PROVENANCE_STABILITY",
      "ARCHITECTURE_DECISION_STABILITY",
    ]);
    const s01 = program.items.find((item) => item.id === "S-01")!;
    expect(s01.question.toLowerCase()).toMatch(/identical/);
    expect(s01.question.toLowerCase()).toMatch(/representation|recommend|architecture/);
    expect(s01.successCriterion).toMatch(/REPRESENTATION_STABILITY/);
    expect(s01.successCriterion).toMatch(/RANKING_STABILITY/);
    expect(s01.status).toBe("DEFERRED");
    expect(s01.nextAction.toLowerCase()).toMatch(/deferred/);
    expect(s01.nextAction.toLowerCase()).toMatch(/not authorized|without approval|do not.*paid|do not execute/);
  });

  it("refuses paid execution and spends under the amended id", () => {
    const source = readFileSync("scripts/experiment-stochastic-stability.ts", "utf8");
    expect(source).toContain(S01_EXPERIMENT_ID);
    expect(source).toContain("Paid execution of S-01 is not authorized");
    expect(source).not.toMatch(/smallest N that can show a 3-to-1 sign majority/);
    expect(source).toContain("trialId");
  });
});
