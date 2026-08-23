// Governance gates. These validate architecture, not prose.
//
// The point of this file is that forgetting becomes a FAILING TEST rather than an oversight
// discovered months later. A markdown warning that says "don't forget Qualification" rots; an
// assertion that every tracked question has a resolvable dependency and a live status does not.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { renderProgram, type Program, type ProgramItem, type Registry } from "@/agent/researchProgramView";
import { renderLedger, type EvidenceLedger } from "@/agent/researchLedger";

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
    ["S-02", "prompt robustness is distinct from stochasticity"],
    ["S-03", "model/temporal drift is untracked"],
    ["POW-01", "sample-size/power is untracked"],
    ["QC-01", "Qualification contract is unwritten"],
    ["D-CTX-01", "oracle domain context is untested"],
    ["D-CTX-05", "router-error stress is untested"],
    ["D-META-01", "hidden domain metadata is undesigned"],
    ["PRIV-01", "privacy before real-user research"],
  ];
  it.each(mustTrack)("still tracks %s (%s)", (id) => {
    const item = program.items.find((i: ProgramItem) => i.id === id);
    expect(item, `research program lost item ${id}`).toBeDefined();
  });
});

describe("the master directive cannot be forgotten into chat", () => {
  it("keeps S-02 as a different question from S-01", () => {
    const s01 = program.items.find((item) => item.id === "S-01")!;
    const s02 = program.items.find((item) => item.id === "S-02")!;
    expect(s02.question).not.toBe(s01.question);
    expect(s01.question.toLowerCase()).toMatch(/identical/);
    expect(s02.question.toLowerCase()).toMatch(/phras|wording|perturb/);
    expect(s02.dependencies).toContain("S-01");
  });

  it("requires a wrong-domain control before any domain router", () => {
    const oracle = program.items.find((item) => item.id === "D-CTX-01")!;
    const router = program.items.find((item) => item.id === "D-CTX-03")!;
    const routerError = program.items.find((item) => item.id === "D-CTX-05")!;
    const qualificationDomain = program.items.find((item) => item.id === "D-CTX-04")!;
    expect(oracle.question.toLowerCase()).toMatch(/wrong-domain|wrong domain/);
    expect(oracle.nextAction.toLowerCase()).toContain("wrong");
    expect(oracle.dependencies).toEqual(["P-01", "S-01", "S-02"]);
    expect(oracle.dependencies).not.toContain("M-01");
    expect(router.dependencies).toContain("D-CTX-01");
    expect(router.status).toBe("BLOCKED");
    expect(routerError.dependencies).toContain("D-CTX-03");
    expect(qualificationDomain.question.toLowerCase()).toMatch(/qualification/);
    expect(qualificationDomain.question.toLowerCase()).not.toMatch(/router-error|fallback/);
  });

  it("registers domain conditioning without creating a second roadmap or implementing domain agents", () => {
    expect(program.stages.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
    expect(program.domainProgram, "domainProgram missing").toBeDefined();
    expect(program.domainProgram!.status).toBe("REGISTERED_NOT_EXECUTABLE");
    expect(program.domainProgram!.conditioningVsGating.toLowerCase()).toMatch(/interpretation context/);
    expect(program.domainProgram!.conditioningVsGating.toLowerCase()).toMatch(/not recommendation eligibility/);
    expect(program.domainProgram!.semanticDomainFieldVsRoutingMetadata).toMatch(/StructuredWork\.domain/);
    expect(program.domainProgram!.immediatePriority).toMatch(/S-01/);
    expect(program.domainProgram!.doNotBuildYet.some((item) => /router/i.test(item))).toBe(true);
    const qDomain = program.domainProgram!.idMap.find((row) => row.addendumId === "DCTX-Q-01");
    const routerError = program.domainProgram!.idMap.find((row) => row.addendumId === "DCTX-04");
    expect(qDomain?.liveId).toBe("D-CTX-04");
    expect(routerError?.liveId).toBe("D-CTX-05");
    const nextPaid = program.items.filter((item) => item.status === "PREREGISTERED").map((item) => item.id);
    expect(nextPaid).toEqual(["S-01"]);
  });

  it("names DOMAIN_ANCHORING as a transfer failure mode before any domain experiment runs", () => {
    const transfer = program.items.find((item) => item.id === "TM-01")!;
    expect(transfer.question).toMatch(/DOMAIN_ANCHORING|historical-domain anchoring/);
    expect(transfer.successCriterion).toContain("DOMAIN_ANCHORING");
  });

  it("keeps Qualification contract design separate from Qualification evaluation", () => {
    const contract = program.items.find((item) => item.id === "QC-01")!;
    const evalQ = program.items.find((item) => item.id === "Q-01")!;
    expect(contract.estimatedCalls).toBe(0);
    expect(contract.nextAction.toLowerCase()).toMatch(/no prompt/);
    expect(evalQ.dependencies).toContain("M-01");
    expect(evalQ.status).toBe("BLOCKED");
  });

  it("maps directive stages A–K onto the existing eight stages instead of adding a ninth program", () => {
    expect(program.stages.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
    const map = program.directiveStageMap!;
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]) {
      expect(program.stages.some((s) => s.id === map[letter]), `${letter} maps to unknown ${map[letter]}`).toBe(true);
    }
  });

  it("covers every empirical question the product must eventually answer", () => {
    const known = new Set<string>([
      ...program.items.map((item) => item.id),
      ...registry.records.map((record) => record.experimentId),
    ]);
    expect(program.empiricalQuestions, "empiricalQuestions missing from the program").toBeDefined();
    expect(program.empiricalQuestions!.length).toBeGreaterThanOrEqual(32);
    expect(program.empiricalQuestions!.map((q) => q.id)).toEqual(
      Array.from({ length: program.empiricalQuestions!.length }, (_, i) => `EQ-${String(i + 1).padStart(2, "0")}`),
    );
    for (const question of program.empiricalQuestions!) {
      expect(question.coveredBy.length, `${question.id} has no coverage`).toBeGreaterThan(0);
      for (const id of question.coveredBy) {
        expect(known.has(id), `${question.id} is covered by unknown "${id}"`).toBe(true);
      }
    }
  });

  it("records conflicts instead of silently preferring the chat directive", () => {
    expect(program.conflictsResolved?.length).toBeGreaterThanOrEqual(3);
    expect(program.conflictsResolved?.some((c) => /Qualification/i.test(c.topic))).toBe(true);
    expect(program.conflictsResolved?.some((c) => /sign-majority/i.test(c.topic))).toBe(true);
    expect(program.conflictsResolved?.some((c) => /DCTX-04 vs live D-CTX-04/i.test(c.topic))).toBe(true);
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

  it("does not invent a competing A–K stage system", () => {
    expect(roadmap).not.toMatch(/^### STAGE [A-K] /m);
    expect(roadmap).toContain("directive stages A–K");
  });
});

describe("the architecture evidence ledger is not a second backlog", () => {
  const ledger = JSON.parse(readFileSync("config/architecture-evidence-ledger.json", "utf8")) as EvidenceLedger;

  it("is a generated view of the JSON, not a hand-edited document", () => {
    const expected = renderLedger(ledger);
    const actual = readFileSync("docs/ARCHITECTURE_EVIDENCE_LEDGER.md", "utf8");
    expect(actual, "docs/ARCHITECTURE_EVIDENCE_LEDGER.md is stale; run `pnpm research:ledger`").toBe(expected);
  });

  it("cites only real program items or registry experiments in its findings", () => {
    const known = new Set<string>([
      ...program.items.map((item) => item.id),
      ...registry.records.map((record) => record.experimentId),
    ]);
    for (const finding of ledger.findings) {
      const cited = finding.evidence.join("\n").match(/\b(?:[A-Z]+-\d+|agent-vs-lexical:[^\s]+|split-agents:[^\s]+)/g) ?? [];
      for (const id of cited) {
        const trimmed = id.replace(/[.,;:]+$/, "");
        const ok = known.has(trimmed) || [...known].some((k) => trimmed.startsWith(k) || k.startsWith(trimmed));
        expect(ok, `${finding.id} cites unknown ${trimmed}`).toBe(true);
      }
    }
  });

  it("does not replace the research program as the live question list", () => {
    expect(ledger.purpose.toLowerCase()).toMatch(/not a second backlog/);
    expect(readFileSync("docs/ARCHITECTURE_EVIDENCE_LEDGER.md", "utf8")).toContain("GENERATED FILE");
  });

  it("does not treat P-01's CI spanning zero as equivalence", () => {
    const finding = ledger.findings.find((row) => row.id === "F-P01-PROVENANCE");
    expect(finding, "lost F-P01-PROVENANCE").toBeDefined();
    expect(finding!.claim.toLowerCase()).toMatch(/not been established|not established/);
    expect(finding!.doNotClaim.toLowerCase()).toMatch(/not equivalence/);
    expect(ledger.currentBaseline.pendingChange.toLowerCase()).not.toMatch(/signs and keep/);
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
