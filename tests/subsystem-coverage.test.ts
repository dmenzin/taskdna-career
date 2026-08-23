// No product-critical subsystem may become an opaque orphan: something the product depends on
// with no defined construct, no evaluator, no baseline, no known-answer test, and no path to
// an alternative strategy. These tests keep the registry honest and keep it pointing at files
// that actually exist.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STRATEGY_BOUNDARIES } from "@/v3/strategy";

interface Subsystem {
  id: string;
  construct: string;
  inputs: string;
  outputs: string;
  implementation: string;
  evaluator: string;
  baseline: string;
  knownAnswerTests: string[];
  failureCases: string[];
  alternativeStrategyPath: string;
  humanValidationBoundary: string;
}

const registry = JSON.parse(readFileSync("config/product-critical-subsystems.json", "utf8")) as { version: string; subsystems: Subsystem[] };

describe("product-critical subsystem coverage", () => {
  it("registers a non-trivial set of subsystems", () => {
    expect(registry.subsystems.length).toBeGreaterThanOrEqual(10);
    expect(new Set(registry.subsystems.map((entry) => entry.id)).size).toBe(registry.subsystems.length);
  });

  it.each(registry.subsystems.map((entry) => [entry.id, entry] as const))("%s has a construct, evaluator, baseline, and human-validation boundary", (_id, subsystem) => {
    for (const key of ["construct", "inputs", "outputs", "implementation", "evaluator", "baseline", "alternativeStrategyPath", "humanValidationBoundary"] as const) {
      expect(subsystem[key], `${subsystem.id}.${key}`).toBeTruthy();
      expect(subsystem[key].length, `${subsystem.id}.${key}`).toBeGreaterThan(10);
    }
    expect(subsystem.knownAnswerTests.length, `${subsystem.id}.knownAnswerTests`).toBeGreaterThan(0);
    expect(subsystem.failureCases.length, `${subsystem.id}.failureCases`).toBeGreaterThan(0);
  });

  it.each(registry.subsystems.map((entry) => [entry.id, entry] as const))("%s points at known-answer tests that exist", (_id, subsystem) => {
    for (const path of subsystem.knownAnswerTests) expect(existsSync(path), `${subsystem.id} -> ${path}`).toBe(true);
  });

  it.each(registry.subsystems.map((entry) => [entry.id, entry] as const))("%s points at implementation files that exist", (_id, subsystem) => {
    const paths = subsystem.implementation.match(/src\/[A-Za-z0-9/_.-]+\.ts/g) ?? [];
    expect(paths.length, `${subsystem.id} names no implementation file`).toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(path), `${subsystem.id} -> ${path}`).toBe(true);
  });

  it("covers every one of the four fit channels", () => {
    for (const channel of ["preference-fit", "experience-fit", "qualification-fit", "direction-fit"]) {
      expect(registry.subsystems.map((entry) => entry.id)).toContain(channel);
    }
  });

  it("covers every strategy boundary that has a distinct construct", () => {
    // semantic_retrieval and contextual_reranking are alternatives to, and refinements of,
    // task_candidate_retrieval, so they are covered by the task-dwa-mapping subsystem rather
    // than getting their own registry entries.
    const covered = new Set(registry.subsystems.map((entry) => entry.id));
    const boundaryToSubsystem: Record<string, string> = {
      preference_evidence_extraction: "preference-evidence-extraction",
      preference_representation: "preference-representation",
      task_candidate_retrieval: "task-dwa-mapping",
      semantic_retrieval: "task-dwa-mapping",
      contextual_reranking: "task-dwa-mapping",
      abstention_policy: "abstention-policy",
      preference_fit: "preference-fit",
      experience_fit: "experience-fit",
      qualification_fit: "qualification-fit",
      direction_fit: "direction-fit",
    };
    for (const boundary of STRATEGY_BOUNDARIES) {
      const subsystem = boundaryToSubsystem[boundary.boundary];
      expect(subsystem, `no subsystem mapped for boundary ${boundary.boundary}`).toBeTruthy();
      expect(covered.has(subsystem!), `${boundary.boundary} -> ${subsystem}`).toBe(true);
    }
  });

  it("states a human-validation boundary rather than claiming autonomous validity", () => {
    for (const subsystem of registry.subsystems) {
      expect(subsystem.humanValidationBoundary.length).toBeGreaterThan(20);
    }
  });
});
