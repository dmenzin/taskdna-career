import { describe, expect, it } from "vitest";
import { scenarioBank } from "../src/config/scenarios";
import { applyScenarioResponses, buildUserProfile, selectAdaptiveScenarios } from "../src/domain/engine";

describe("adaptive scenario interview", () => {
  it("has a scenario bank large enough for multi-step adaptive interviews", () => {
    expect(scenarioBank.length).toBeGreaterThanOrEqual(10);
    expect(new Set(scenarioBank.flatMap((scenario) => scenario.targetDimensions)).size).toBeGreaterThanOrEqual(10);
  });

  it("selects different scenarios for different uncertainty and preference states", () => {
    const lowInfo = buildUserProfile("low-information");
    const coordination = buildUserProfile("coordination-pro");

    const lowInfoPlan = selectAdaptiveScenarios(lowInfo, [], 3);
    const coordinationPlan = selectAdaptiveScenarios(coordination, [], 3);

    expect(lowInfoPlan.earlyStopped).toBe(false);
    expect(coordinationPlan.earlyStopped).toBe(false);
    expect(lowInfoPlan.scenarios.map((scenario) => scenario.id)).not.toEqual(coordinationPlan.scenarios.map((scenario) => scenario.id));
  });

  it("applies scenario responses as preference evidence without adding capabilities", () => {
    const profile = buildUserProfile("robotics-no-cpp");
    const beforeCapabilities = profile.capabilities.map((capability) => capability.name).join("|");
    const plan = selectAdaptiveScenarios(profile, [], 2);
    const result = applyScenarioResponses(profile, [{ scenarioId: plan.scenarios[0].id, answer: "DISLIKE", confidence: 0.8 }]);

    expect(result.addedEvidence[0].sourceType).toBe("SCENARIO_RESPONSE");
    expect(result.changedDimensions.length).toBeGreaterThan(0);
    expect(result.updatedProfile.capabilities.map((capability) => capability.name).join("|")).toBe(beforeCapabilities);
  });

  it("early-stops when profile confidence is strong and contradictions are absent", () => {
    const profile = buildUserProfile("failure-analyst");
    const confident = {
      ...profile,
      contradictions: [],
      confidence: 0.86,
      taskDna: profile.taskDna.map((dimension) => ({ ...dimension, confidence: 0.9 })),
    };
    const plan = selectAdaptiveScenarios(confident);
    expect(plan.earlyStopped).toBe(true);
    expect(plan.scenarios).toHaveLength(0);
  });
});
