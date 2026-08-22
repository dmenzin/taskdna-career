import { describe, expect, it } from "vitest";
import { buildUserProfile } from "../src/domain/engine";

describe("evidence extraction and Task-DNA inference", () => {
  it("career text materially changes Task DNA instead of only using persona fixture priors", () => {
    const baseline = buildUserProfile("failure-analyst");
    const custom = buildUserProfile(
      "failure-analyst",
      "I love stakeholder coordination, customer discovery, ambiguous product strategy, roadmap tradeoffs and requirements workshops. I dislike logs, root cause debugging, bench tests and isolated technical investigation.",
    );

    const value = (profile: typeof baseline, id: string) => profile.taskDna.find((dimension) => dimension.dimensionId === id)!.value;
    expect(value(custom, "coordination_preference")).toBeGreaterThan(value(baseline, "coordination_preference") + 1.5);
    expect(value(custom, "customer_interaction_preference")).toBeGreaterThan(value(baseline, "customer_interaction_preference") + 1.2);
    expect(value(custom, "investigation_orientation")).toBeLessThan(value(baseline, "investigation_orientation") - 1.5);
  });

  it("keeps provenance from raw text to evidence signals to dimensions", () => {
    const profile = buildUserProfile("failure-analyst");
    const investigation = profile.taskDna.find((dimension) => dimension.dimensionId === "investigation_orientation")!;
    expect(investigation.supportingEvidenceIds.length).toBeGreaterThan(0);
    const supportingEvidence = profile.evidence.find((item) => item.id === investigation.supportingEvidenceIds[0]);
    // Supporting evidence must be preference-class (exposure never moves preference)
    // and must carry a same-side signal for the dimension it supports.
    expect(["PREFERENCE", "DISLIKE", "ASPIRATIONAL"]).toContain(supportingEvidence?.evidenceClass);
    expect(supportingEvidence?.inferredTaskDimensions.investigation_orientation).toBeGreaterThan(5);
  });

  it("stores contradictory evidence and lowers confidence for conflict", () => {
    const profile = buildUserProfile(
      "field-troubleshooter",
      "I dislike customer-facing work. I loved troubleshooting systems directly with customers in the field using logs and fast feedback.",
    );
    const customer = profile.taskDna.find((dimension) => dimension.dimensionId === "customer_interaction_preference")!;
    expect(profile.contradictions.join(" ")).toMatch(/Customer exposure|customer/i);
    expect(customer.contradictoryEvidenceIds.length).toBeGreaterThan(0);
    expect(customer.confidence).toBeLessThan(0.75);
  });

  it("sparse evidence produces materially lower confidence", () => {
    const sparse = buildUserProfile("low-information");
    const rich = buildUserProfile("failure-analyst");
    expect(sparse.confidence).toBeLessThan(rich.confidence);
    expect(sparse.confidence).toBeLessThan(0.55);
  });
});
