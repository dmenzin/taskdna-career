import { describe, expect, it } from "vitest";
import { sweepProvenanceThresholds, SENSITIVITY_FLOORS, SENSITIVITY_MARGINS } from "@/agent/provenanceSensitivity";
import type { CareerBlueprintV2 } from "@/agent/agentArchitecture";
import type { PlantedFramePerson } from "@/bench/frameCorpus";

const person = {
  personId: "p1",
  performed: ["a"],
  liked: ["b"],
  disliked: ["c"],
  desired: ["d"],
  experienceEvidence: [{ id: "e1", text: "I investigated equipment failures for three years." }],
  preferenceEvidence: [
    { id: "l1", stance: "LIKE", text: "What I liked most: reviewing near misses on the wards." },
    { id: "d1", stance: "DISLIKE", text: "What I disliked: writing the monthly board pack." },
  ],
  aspirationEvidence: [{ id: "a1", text: "I want to move into patient-safety investigation." }],
} as unknown as PlantedFramePerson;

const blueprint: CareerBlueprintV2 = {
  personId: "p1",
  experience: [{
    action: "investigate", object: "failures", purpose: "safety", method: "review", domain: "healthcare",
    evidence: "I investigated equipment failures for three years.",
  }],
  liked: [{
    action: "review", object: "near misses", purpose: "safety", method: "review", domain: "healthcare",
    evidence: "What I liked most: reviewing near misses on the wards.",
  }],
  disliked: [{
    action: "write", object: "board pack", purpose: "reporting", method: "writing", domain: "healthcare",
    evidence: "What I disliked: writing the monthly board pack.",
  }],
  desired: [{
    action: "investigate", object: "safety", purpose: "prevention", method: "analysis", domain: "healthcare",
    evidence: "I want to move into patient-safety investigation.",
  }],
};

describe("T-01 threshold grid", () => {
  it("covers 25 combinations and does not invent a winner", () => {
    expect(SENSITIVITY_FLOORS.length * SENSITIVITY_MARGINS.length).toBe(25);
    const result = sweepProvenanceThresholds([person], new Map([["p1", blueprint]]));
    expect(result.cells).toHaveLength(25);
    expect(result.cells.filter((cell) => cell.isDefault)).toHaveLength(1);
    expect(result.defaultKeeps.experience).toBe(true);
    expect(result.defaultKeeps.desired).toBe(true);
  });
});
