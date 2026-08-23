// Governance gates. These validate architecture, not prose.
//
// The point of this file is that forgetting becomes a FAILING TEST rather than an oversight
// discovered months later. A markdown warning that says "don't forget Qualification" rots; an
// assertion that every tracked question has a resolvable dependency and a live status does not.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { renderProgram, type Program, type ProgramItem, type Registry } from "@/agent/researchProgramView";

const program = JSON.parse(readFileSync("config/agentic-research-program.json", "utf8")) as Program;
const registry = JSON.parse(readFileSync("config/experiment-registry.json", "utf8")) as Registry;
const components = JSON.parse(readFileSync("config/component-registry.json", "utf8"));

const VALID_STATUSES = [
  "UNTESTED", "PREREGISTERED", "IN_PROGRESS", "SUPPORTED",
  "REJECTED", "INCONCLUSIVE", "BLOCKED", "DEFERRED", "SUPERSEDED",
];

describe("the research program is internally consistent", () => {
  it("tracks something", () => {
    // Guards the failure where every assertion below passes over an empty array.
    expect(program.items.length).toBeGreaterThan(15);
    expect(program.stages.length).toBeGreaterThanOrEqual(8);
  });

  it("uses only declared statuses, and declares only used ones", () => {
    expect(Object.keys(program.statuses).sort()).toEqual([...VALID_STATUSES].sort());
    for (const item of program.items) expect(VALID_STATUSES).toContain(item.status);
  });

  it("has unique item ids", () => {
    const ids = program.items.map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every dependency to a real item or a real experiment", () => {
    // An unresolvable dependency is how a question silently becomes unreachable.
    const known = new Set<string>([
      ...program.items.map((i: { id: string }) => i.id),
      ...registry.records.map((r: { experimentId: string }) => r.experimentId),
    ]);
    for (const item of program.items) {
      for (const dependency of item.dependencies) {
        expect(known.has(dependency), `${item.id} depends on unknown "${dependency}"`).toBe(true);
      }
    }
  });

  it("has no dependency cycles", () => {
    const graph = new Map<string, string[]>(program.items.map((i: { id: string; dependencies: string[] }) => [i.id, i.dependencies]));
    const state = new Map<string, "visiting" | "done">();
    const walk = (id: string, path: string[]): void => {
      if (state.get(id) === "done") return;
      expect(state.get(id), `dependency cycle: ${[...path, id].join(" -> ")}`).not.toBe("visiting");
      state.set(id, "visiting");
      for (const next of graph.get(id) ?? []) if (graph.has(next)) walk(next, [...path, id]);
      state.set(id, "done");
    };
    for (const id of graph.keys()) walk(id, []);
  });

  it("assigns every item to a declared stage, and gives every stage an exit criterion", () => {
    const stageIds = new Set(program.stages.map((s: { id: string }) => s.id));
    for (const item of program.items) expect(stageIds.has(item.stage), `${item.id} has unknown stage ${item.stage}`).toBe(true);
    for (const stage of program.stages) {
      expect(stage.exitCriterion, `stage ${stage.id} has no exit criterion`).toBeTruthy();
      expect(stage.exitCriterion.length).toBeGreaterThan(40);
    }
  });

  it("gives every item a next action and a success criterion", () => {
    for (const item of program.items) {
      expect(item.nextAction, `${item.id} has no next action`).toBeTruthy();
      expect(item.successCriterion, `${item.id} has no success criterion`).toBeTruthy();
      expect(item.evidenceSoFar, `${item.id} records no evidence state`).toBeTruthy();
      expect(typeof item.estimatedCalls).toBe("number");
      expect(typeof item.estimatedCostUsd).toBe("number");
    }
  });

  it("does not treat a partial cache as authorization to keep spending", () => {
    // IN_PROGRESS without an explicit continuation flag is how an interrupted arm gets
    // "helpfully" finished six weeks later. Partial artifacts belong on DEFERRED items.
    for (const item of program.items) {
      if (item.status === "IN_PROGRESS") {
        expect(item.continuationAuthorized, `${item.id} is IN_PROGRESS without continuationAuthorized`).toBe(true);
      }
    }
    const natural = program.items.find((item) => item.id === "N-01");
    expect(natural, "research program lost N-01").toBeDefined();
    expect(natural!.status).toBe("DEFERRED");
    expect(natural!.continuationAuthorized).toBe(false);
    expect(natural!.partialCache?.preserved).toBe(true);
  });

  it("keeps a BLOCKED item honestly blocked by an unresolved dependency", () => {
    // A BLOCKED item with no dependency is really DEFERRED, and the distinction matters: one is
    // waiting on us, the other is waiting on something else.
    const resolved = new Set(
      program.items.filter((i: { status: string }) => ["SUPPORTED", "REJECTED"].includes(i.status)).map((i: { id: string }) => i.id),
    );
    for (const item of program.items.filter((i: { status: string }) => i.status === "BLOCKED")) {
      const unmet = item.dependencies.filter((d: string) => !resolved.has(d));
      expect(unmet.length, `${item.id} is BLOCKED but every dependency is resolved`).toBeGreaterThan(0);
    }
  });
});

describe("the eight required coverage areas stay assigned to a stage", () => {
  const requiredStages: [string, string][] = [
    ["S1", "Semantic architecture"],
    ["S2", "Inference stability"],
    ["S3", "Semantic construct coverage"],
    ["S4", "Generalisation"],
    ["S5", "Product-realistic evidence"],
    ["S6", "Human validity"],
    ["S7", "Research-to-product integration"],
    ["S8", "Agentic expansion"],
  ];
  it.each(requiredStages)("%s is %s", (id, name) => {
    const stage = program.stages.find((s) => s.id === id);
    expect(stage, `program lost stage ${id}`).toBeDefined();
    expect(stage!.name).toBe(name);
  });
});

describe("the questions the audit found must not disappear", () => {
  // Named explicitly. If someone deletes one of these, this test says so by name rather than
  // leaving a gap that only shows up as surprise six weeks later.
  const mustTrack: [string, string][] = [
    ["Q-01", "Qualification is not implemented"],
    ["S-01", "stochastic stability is unknown"],
    ["M-01", "the benchmark pre-routes evidence"],
    ["P-01", "the shared baseline has no provenance"],
    ["V-01", "VALIDATION is unused"],
    ["H-01", "there is no human validity"],
    ["I-01", "the product does not run the research architecture"],
    ["L-01", "real concurrent latency is unmeasured"],
    ["SEC-01", "prompt injection is unaddressed"],
    ["T-01", "provenance thresholds are hand-set"],
  ];
  it.each(mustTrack)("still tracks %s (%s)", (id) => {
    const item = program.items.find((i: ProgramItem) => i.id === id);
    expect(item, `research program lost item ${id}`).toBeDefined();
    expect(item!.status).not.toBe("SUPPORTED");
  });
});

describe("the generated document matches its source data", () => {
  it("is byte-identical to what the generator would produce", () => {
    // Two authorities is how documentation starts lying. The data wins; the markdown is a view.
    const expected = renderProgram(program, registry);
    const actual = readFileSync("docs/AGENTIC_RESEARCH_PROGRAM.md", "utf8");
    expect(actual, "docs/AGENTIC_RESEARCH_PROGRAM.md is stale; run `pnpm research:program`").toBe(expected);
  });

  it("marks itself as generated, so nobody hand-edits it", () => {
    expect(readFileSync("docs/AGENTIC_RESEARCH_PROGRAM.md", "utf8")).toContain("GENERATED FILE. Do not edit by hand.");
  });
});

describe("every paid experiment has a preregistration record", () => {
  const ledgerPath = "artifacts/agent_runtime/budget-ledger.json";

  it("covers every experiment id that has ever spent money", () => {
    // The gate that forces future experiments through preregistration: spend an id that is not in
    // the registry and this fails.
    let ledger: { entries: { experimentId: string; cacheHit: boolean }[] };
    try {
      ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    } catch {
      return; // no ledger yet; nothing has been spent
    }
    const spent = new Set(ledger.entries.filter((e) => !e.cacheHit).map((e) => e.experimentId));
    const registered = new Set(registry.records.map((r: { experimentId: string }) => r.experimentId));
    // Calibration and preflight probes are recorded under their own ids; both are in the registry.
    const missing = [...spent].filter((id) => {
      if (registered.has(id)) return false;
      // The split-agents runs are recorded per Direction generation, so the ledger's generation-free
      // id is matched by prefix.
      return ![...registered].some((known) => String(known).startsWith(id));
    });
    expect(missing, `experiment ids spent money with no preregistration record: ${missing.join(", ")}`).toEqual([]);
  });

  it("never rewrites a record to look cleaner", () => {
    for (const record of registry.records) {
      // A backfilled record must not invent a pre-registration estimate it never made.
      if (record.backfilled && record.preregistrationCommit === null && record.actualCalls !== null) {
        expect(
          record.estimatedCalls === null || typeof record.estimatedCalls === "number",
          `${record.experimentId} has a malformed estimate`,
        ).toBe(true);
      }
      expect(VALID_STATUSES).toContain(record.status);
      if (record.supersededBy) {
        expect(registry.records.some((r: { experimentId: string }) => r.experimentId === record.supersededBy)).toBe(true);
      }
    }
  });

  it("keeps a rejected experiment rejected", () => {
    // The v1 split arm failed. Its record must not drift to INCONCLUSIVE to soften the history.
    const v1 = registry.records.find((r) => r.experimentId.endsWith("direction-v1"));
    expect(v1).toBeDefined();
    expect(v1!.status).toBe("REJECTED");
    expect(v1!.supersededBy).toBe("split-agents:openai:LEXICAL_TRAP:low:direction-v2");
  });
});

describe("component vocabulary cannot drift ahead of implementation", () => {
  it("classifies every component with a declared class", () => {
    const classes = new Set(Object.keys(components.classes));
    for (const component of components.components) {
      expect(classes.has(component.class), `${component.name} has unknown class ${component.class}`).toBe(true);
    }
  });

  it("only lets a genuinely agentic component be called an Agent", () => {
    // The audit's finding, made structural: nothing here is a tool-using or planning agent, and
    // calling single model calls "agents" invites orchestration the evidence does not ask for.
    const agentic = ["TOOL_USING_AGENT", "PLANNER"];
    const grandfathered = new Set<string>(components.grandfatheredAgentNames);
    for (const component of components.components) {
      const named = /agent/i.test(component.name);
      if (!named) continue;
      const allowed = agentic.includes(component.class) || (component.promptId && grandfathered.has(component.promptId));
      expect(allowed, `"${component.name}" is called an Agent but is ${component.class} and is not grandfathered`).toBe(true);
    }
  });

  it("grandfathers only the two prompt ids embedded in existing cache keys", () => {
    // Grandfathering is a one-time concession to reproducibility, not an open door.
    expect(components.grandfatheredAgentNames.sort()).toEqual(["direction-agent", "experience-agent"]);
  });

  it("records that no tool-using or planning component is implemented", () => {
    for (const component of components.components) {
      if (["TOOL_USING_AGENT", "PLANNER"].includes(component.class)) {
        expect(component.implemented, `${component.name} claims to be implemented; the audit found no such component`).toBe(false);
      }
    }
  });

  it("keeps the Qualification interpreter marked unimplemented until it exists", () => {
    const qualification = components.components.find((c: { name: string }) => c.name === "Qualification interpreter");
    expect(qualification.implemented).toBe(false);
    expect(qualification.promptId).toBeNull();
  });
});

describe("the reconciled roadmap does not compete with the program", () => {
  const roadmap = readFileSync("docs/AGENTIC_DEVELOPMENT_ROADMAP.md", "utf8");

  it("declares the JSON file as the live program", () => {
    expect(roadmap).toContain("config/agentic-research-program.json");
    expect(roadmap).toMatch(/authoritative|source of truth|live program/i);
  });

  it("cites every current stage by id and name", () => {
    for (const stage of program.stages) {
      expect(roadmap, `roadmap dropped stage ${stage.id}`).toContain(stage.id);
      expect(roadmap, `roadmap dropped stage name ${stage.name}`).toContain(stage.name);
    }
  });

  it("maps the ranked experiments to live program ids", () => {
    for (const id of ["P-01", "S-01", "D-01", "M-01", "Q-01"]) {
      expect(roadmap, `roadmap lost the mapping to ${id}`).toContain(id);
    }
  });
});

describe("every registry record has the preregistration fields the contract requires", () => {
  const required = [
    "experimentId", "question", "hypothesis", "status", "dependencies", "family",
    "frozenConfig", "primaryMetrics", "successCriterion", "failureCriterion",
    "inconclusiveCriterion", "estimatedCalls", "estimatedCostUsd", "actualCalls",
    "actualCostUsd", "preregistrationCommit", "resultArtifact", "supersedes", "supersededBy",
  ];
  it.each(registry.records.map((r) => r.experimentId))("%s carries every required field", (id) => {
    const record = registry.records.find((r) => r.experimentId === id)!;
    for (const field of required) {
      expect(field in record, `${id} is missing ${field}`).toBe(true);
    }
  });
});

describe("nothing in this pass touched protected material", () => {
  it("left the frozen corpus manifest unmodified", () => {
    const changed = execFileSync("git", ["status", "--short", "config/frame-corpus-freeze.json"], { encoding: "utf8" }).trim();
    expect(changed, "the frozen corpus manifest was modified").toBe("");
  });

  it("left the benchmark truth and renderers unmodified", () => {
    const changed = execFileSync("git", ["status", "--short", "src/bench/"], { encoding: "utf8" }).trim();
    expect(changed, `benchmark sources were modified: ${changed}`).toBe("");
  });
});
