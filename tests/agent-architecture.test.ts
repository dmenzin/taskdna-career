// Invariants of the agent architecture. The interesting property is that the two matchers
// differ ONLY in how they compare identical interpretations, so a difference between them is
// a matcher difference and nothing else.
import { describe, expect, it } from "vitest";
import {
  createAgentArchitecture,
  createAgentFieldMatchArchitecture,
  PERSON_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_PROMPT,
  type CareerBlueprint,
  type StructuredWork,
} from "@/agent/agentArchitecture";
import type { PlantedFrameJob, PlantedFramePerson } from "@/bench/frameCorpus";

const work = (action: string, object: string, purpose: string, method: string, domain: string): StructuredWork =>
  ({ action, object, purpose, method, domain });

const blueprint: CareerBlueprint = {
  personId: "p1",
  experience: [work("investigate", "equipment failures", "reduce downtime", "elimination", "manufacturing")],
  liked: [work("train", "staff", "raise capability", "coaching", "healthcare")],
  disliked: [work("reconcile", "accounts", "improve accuracy", "record review", "finance")],
  desired: [work("forecast", "demand", "reduce cost", "statistics", "retail")],
};

const job = (id: string): PlantedFrameJob => ({ jobId: id } as PlantedFrameJob);
const person = { personId: "p1" } as PlantedFramePerson;

describe("prompts are versioned research objects", () => {
  it("carry an id, a version and a stated hypothesis", () => {
    for (const prompt of [PERSON_BLUEPRINT_PROMPT, JOB_BLUEPRINT_PROMPT]) {
      expect(prompt.id).toBeTruthy();
      expect(prompt.version).toBeTruthy();
      expect(prompt.hypothesis.length).toBeGreaterThan(40);
    }
  });

  // Handing the model the benchmark's own concept ids would make the comparison circular.
  it("never leak benchmark concept ids into the prompt text", () => {
    const rendered = PERSON_BLUEPRINT_PROMPT.render({ experience: "x", liked: "", disliked: "", desired: "" });
    expect(rendered).not.toMatch(/\b(act|obj|pur|met|dom)\.[a-z_]+/);
  });

  it("instruct the person prompt to keep the four channels independent", () => {
    const rendered = PERSON_BLUEPRINT_PROMPT.render({ experience: "", liked: "", disliked: "", desired: "" });
    expect(rendered).toMatch(/never infer one from another/i);
  });
});

describe("channel independence in scoring", () => {
  const jobWork = new Map([["j1", [work("train", "staff", "raise capability", "coaching", "healthcare")]]]);
  const blueprints = new Map([["p1", blueprint]]);

  it.each([
    ["agent-blueprint", createAgentArchitecture(blueprints, jobWork)],
    ["agent-field-match", createAgentFieldMatchArchitecture(blueprints, jobWork)],
  ])("%s scores a liked job on preference without crediting experience", (_name, architecture) => {
    const prepared = architecture.prepare(person);
    expect(architecture.score(prepared as never, job("j1"), "preference")).toBeGreaterThan(0);
    // The job is liked work the person has NOT performed; experience must not borrow from it.
    expect(architecture.score(prepared as never, job("j1"), "experience")).toBeLessThan(0.3);
  });

  it.each([
    ["agent-blueprint", createAgentArchitecture(blueprints, new Map([["j1", blueprint.disliked]]))],
    ["agent-field-match", createAgentFieldMatchArchitecture(blueprints, new Map([["j1", blueprint.disliked]]))],
  ])("%s scores a job full of disliked work at or below zero on preference", (_name, architecture) => {
    const prepared = architecture.prepare(person);
    // Signed preference: a job of purely disliked work must never read as preference-relevant.
    expect(architecture.score(prepared as never, job("j1"), "preference")).toBeLessThanOrEqual(0);
  });
});

describe("field-aware matching separates single-role differences", () => {
  // The property the bag-of-tokens matcher lacks: when four of five fields agree and one does
  // not, the score must fall meaningfully. This is the HARD_NEAR_MISS case that dominated the
  // agent's false positives.
  it("scores a one-field mismatch below an exact match", () => {
    const exact = [work("investigate", "equipment failures", "reduce downtime", "elimination", "manufacturing")];
    const nearMiss = [work("investigate", "equipment failures", "reduce downtime", "elimination", "healthcare")];
    const blueprints = new Map([["p1", blueprint]]);
    const architecture = createAgentFieldMatchArchitecture(blueprints, new Map([["exact", exact], ["near", nearMiss]]));
    const prepared = architecture.prepare(person);
    const exactScore = architecture.score(prepared, job("exact"), "experience");
    const nearScore = architecture.score(prepared, job("near"), "experience");
    expect(exactScore).toBeGreaterThan(nearScore);
    // A whole role's worth of similarity, not a fifth of a token bag.
    expect(exactScore - nearScore).toBeGreaterThan(0.1);
  });

  it("returns zero when the person has no interpretation at all", () => {
    const architecture = createAgentFieldMatchArchitecture(new Map(), new Map([["j1", blueprint.experience]]));
    expect(architecture.score(architecture.prepare(person), job("j1"), "experience")).toBe(0);
  });
});
