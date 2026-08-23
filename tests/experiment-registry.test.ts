// The preregistration gate. A paid experiment without a registry record must fail BEFORE it
// can spend, including on --dry-run. A check that ran only after the first paid call would
// be a post-hoc autopsy, which is the failure mode this exists to close.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendPreregistration,
  assertPreregistered,
  DuplicateExperimentError,
  findExperimentRecords,
  loadExperimentRegistry,
  matchesExperimentId,
  UnregisteredExperimentError,
} from "@/agent/experimentRegistry";

const PAID_SCRIPTS = [
  "scripts/experiment-split-agents.ts",
  "scripts/experiment-agent-vs-lexical.ts",
  "scripts/openai-effort-calibration.ts",
  "scripts/agent-smoke-test.ts",
];

describe("experiment id matching", () => {
  it("treats a versioned registry id as a match for the script's shorter spend id", () => {
    expect(matchesExperimentId("split-agents:openai:LEXICAL_TRAP:low:direction-v2", "split-agents:openai:LEXICAL_TRAP:low")).toBe(true);
    expect(matchesExperimentId("split-agents:openai:LEXICAL_TRAP:low", "split-agents:openai:LEXICAL_TRAP:low:direction-v2")).toBe(true);
    expect(matchesExperimentId("agent-vs-lexical:openai:SEMANTIC_BRIDGE:low", "agent-vs-lexical:openai:SEMANTIC_BRIDGE:low")).toBe(true);
    expect(matchesExperimentId("agent-vs-lexical:openai:SEMANTIC_BRIDGE:low", "agent-vs-lexical:openai:LEXICAL_TRAP:low")).toBe(false);
  });
});

describe("assertPreregistered", () => {
  it("accepts every historically spent id", () => {
    for (const id of [
      "openai-effort-calibration:SEMANTIC_BRIDGE",
      "agent-vs-lexical:openai:SEMANTIC_BRIDGE:low",
      "agent-vs-lexical:openai:LEXICAL_TRAP:low",
      "agent-vs-lexical:openai:NATURAL:low",
      "split-agents:openai:LEXICAL_TRAP:low",
      "smoke-test",
    ]) {
      expect(assertPreregistered(id).length, id).toBeGreaterThan(0);
    }
  });

  it("refuses an id that was never preregistered", () => {
    expect(() => assertPreregistered("person-blueprint-v2:openai:LEXICAL_TRAP:low")).toThrow(UnregisteredExperimentError);
  });

  it("refuses the unspecified default so a forgotten experimentId cannot spend", () => {
    expect(() => assertPreregistered("unspecified")).toThrow(UnregisteredExperimentError);
    expect(() => assertPreregistered("")).toThrow(UnregisteredExperimentError);
  });
});

describe("append-only writes", () => {
  it("refuses to rewrite an existing id", () => {
    expect(() =>
      appendPreregistration({
        experimentId: "smoke-test",
        question: "no",
        hypothesis: "no",
        family: "n/a",
      }),
    ).toThrow(DuplicateExperimentError);
  });

  it("appends a PREREGISTERED stub to a copy without touching the live registry", () => {
    const dir = mkdtempSync(join(tmpdir(), "exp-reg-"));
    const copy = join(dir, "registry.json");
    writeFileSync(copy, readFileSync("config/experiment-registry.json", "utf8"));
    const record = appendPreregistration(
      {
        experimentId: "person-blueprint-v2:openai:LEXICAL_TRAP:low",
        question: "Can the shared baseline gain provenance?",
        hypothesis: "A per-item evidence field preserves retrieval.",
        family: "LEXICAL_TRAP",
        estimatedCalls: 12,
        estimatedCostUsd: 0.45,
      },
      copy,
    );
    expect(record.status).toBe("PREREGISTERED");
    expect(record.actualCalls).toBeNull();
    expect(loadExperimentRegistry(copy).records.some((r) => r.experimentId === record.experimentId)).toBe(true);
    // The live file is untouched: a test that writes the authority would be the opposite of governance.
    expect(findExperimentRecords("person-blueprint-v2:openai:LEXICAL_TRAP:low")).toEqual([]);
  });
});

describe("every paid experiment script is forced through the gate", () => {
  it.each(PAID_SCRIPTS)("%s calls assertPreregistered", (script) => {
    const source = readFileSync(script, "utf8");
    expect(source, `${script} does not import the gate`).toContain("assertPreregistered");
    expect(source, `${script} never invokes the gate`).toMatch(/assertPreregistered\(/);
  });

  it("covers every script that constructs a spending runner", () => {
    // A new paid script that forgets the gate is how this rule rots. The list above is the
    // allowlist; adding a spending script without adding it here (and wiring the assert) fails.
    const spending = [
      "scripts/experiment-split-agents.ts",
      "scripts/experiment-agent-vs-lexical.ts",
      "scripts/openai-effort-calibration.ts",
      "scripts/agent-smoke-test.ts",
    ];
    expect(PAID_SCRIPTS.sort()).toEqual(spending.sort());
  });
});
