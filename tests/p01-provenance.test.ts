import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_PROMPT_V2,
  PERSON_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_SCHEMA_V2,
  createAgentFieldMatchArchitecture,
  stripProvenance,
  type CareerBlueprintV2,
} from "@/agent/agentArchitecture";
import { NORMALISATION_V1, SHARED_CHANNEL_SEPARATION_V1 } from "@/agent/semanticContract";

const quoted = (action: string) => ({
  action,
  object: "failures",
  purpose: "reduce risk",
  method: "review",
  domain: "healthcare",
  evidence: "I investigated equipment failures for three years.",
});

describe("P-01 is a minimal prompt/schema change", () => {
  it("keeps person-blueprint@v1 as the canonical export", () => {
    expect(PERSON_BLUEPRINT_PROMPT.version).toBe("v1");
    expect(PERSON_BLUEPRINT_PROMPT_V2.version).toBe("v2");
    expect(PERSON_BLUEPRINT_PROMPT_V2.id).toBe("person-blueprint");
  });

  it("reuses the v1 semantic contract and only adds the evidence instruction", () => {
    const v1 = PERSON_BLUEPRINT_PROMPT.render({ experience: "x", liked: "", disliked: "", desired: "" });
    const v2 = PERSON_BLUEPRINT_PROMPT_V2.render({ experience: "x", liked: "", disliked: "", desired: "" });
    expect(v2).toContain(NORMALISATION_V1);
    for (const line of SHARED_CHANNEL_SEPARATION_V1) expect(v2).toContain(line);
    expect(v2).toContain("copy the supporting phrase from the text into `evidence`");
    expect(v1).not.toContain("`evidence`");
    expect(JSON.stringify(PERSON_BLUEPRINT_SCHEMA)).not.toContain("evidence");
    expect(JSON.stringify(PERSON_BLUEPRINT_SCHEMA_V2)).toContain("evidence");
  });

  it("strips provenance before matching so the matcher cannot see quotes", () => {
    const raw: CareerBlueprintV2 = {
      personId: "p1",
      experience: [quoted("investigate")],
      liked: [],
      disliked: [],
      desired: [],
    };
    const stripped = stripProvenance(raw);
    expect(JSON.stringify(stripped)).not.toContain("evidence");
    expect(JSON.stringify(stripped)).not.toContain("three years");
    const jobWork = new Map([["j1", [{ action: "investigate", object: "failures", purpose: "reduce risk", method: "review", domain: "healthcare" }]]]);
    const withQuotes = createAgentFieldMatchArchitecture(new Map([["p1", stripProvenance(raw)]]), jobWork);
    const without = createAgentFieldMatchArchitecture(
      new Map([["p1", { personId: "p1", experience: [quoted("investigate")], liked: [], disliked: [], desired: [] }]]),
      jobWork,
    );
    // Same five role fields → same score even if someone forgot to strip, because the matcher
    // only reads ROLE_FIELDS. The strip is still required so a future matcher cannot cheat.
    const person = { personId: "p1" } as { personId: string };
    const job = { jobId: "j1" } as { jobId: string };
    expect(withQuotes.score(withQuotes.prepare(person as never), job as never, "experience")).toBe(
      without.score(without.prepare(person as never), job as never, "experience"),
    );
  });

  it("can spend only after preregistration, a dry-run census, and full job-cache reuse", () => {
    const source = readFileSync("scripts/experiment-p01.ts", "utf8");
    expect(source).toContain("assertPreregistered");
    expect(source).toContain("stripProvenance");
    expect(source).toContain("--dry-run");
    expect(source).toContain("STOP CONDITION");
    expect(source).toContain("checkArmReadiness");
    expect(source).not.toContain("Paid execution is not authorized in this session");
  });
});

describe("T-01 does not retune thresholds after seeing results", () => {
  it("sweeps a fixed grid and reports flips without picking a winner", () => {
    const source = readFileSync("scripts/experiment-t01.ts", "utf8");
    expect(source).toContain("sweepProvenanceThresholds");
    expect(source).toContain("were not selected post-hoc");
    expect(readFileSync("src/agent/provenanceSensitivity.ts", "utf8")).toContain("never selected post-hoc");
  });
});
