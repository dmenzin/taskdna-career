// PTA-01 / DATA-01 machine checks. DEVELOPMENT only. Never open VALIDATION instances.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONCEPTS, IDENTITY_ROLES, SEMANTIC_FRAME_VERSION } from "@/bench/semanticFrame";
import { FRAME_BENCH_SEED, FRAME_CORPUS_VERSION, QUALIFICATION_POOL, buildFrameCorpus } from "@/bench/frameCorpus";
import { CHANNEL_CONTRACTS } from "@/agent/semanticContract";
import { PERSON_BLUEPRINT_PROMPT, PERSON_BLUEPRINT_PROMPT_V2, JOB_BLUEPRINT_PROMPT } from "@/agent/agentArchitecture";
import { DIRECTION_AGENT_PROMPT, DIRECTION_AGENT_PROMPT_V1, EXPERIENCE_AGENT_PROMPT } from "@/agent/splitAgents";
import { divergenceContrast } from "@/agent/channelIntegrity";
import { PROMPTS } from "@/agent/runtime";
import type { Registry } from "@/agent/researchProgramView";

const registry = JSON.parse(readFileSync("config/experiment-registry.json", "utf8")) as Registry;
const freeze = JSON.parse(readFileSync("config/frame-corpus-freeze.json", "utf8")) as {
  corpusVersion: string;
  frameVersion: string;
  lockedConfirmationFrozen: boolean;
  entries: Record<string, { people: number; jobs: number }>;
};

const identityOverlap = (a: { action: string; object: string; purpose: string; method: string; domain: string }, b: typeof a) =>
  (IDENTITY_ROLES as readonly string[]).filter((role) => a[role as keyof typeof a] === b[role as keyof typeof b]).length;

describe("PTA-01 registry and freeze hygiene", () => {
  it("records no VALIDATION or LOCKED agent experiment", () => {
    const scored = registry.records.filter((record) => typeof record.split === "string" && record.split !== "n/a");
    expect(scored.length).toBeGreaterThan(0);
    for (const record of scored) {
      expect(record.split, record.experimentId).toBe("DEVELOPMENT");
    }
  });

  it("leaves LOCKED unfrozen", () => {
    expect(freeze.lockedConfirmationFrozen).toBe(false);
    expect(Object.keys(freeze.entries).some((key) => key.startsWith("LOCKED"))).toBe(false);
  });

  it("keeps S-01 unpaid in the registry and DEFERRED in the program", () => {
    const s01 = registry.records.find((record) => record.experimentId === "stochastic-stability:openai:LEXICAL_TRAP:low:amended");
    expect(s01?.status).toBe("PREREGISTERED");
    expect(s01?.actualCalls).toBeNull();
    expect(s01?.actualCostUsd).toBeNull();
    expect(s01?.estimatedCostUsd).toBe(3.73);
    expect(s01?.result).toMatch(/not authorized/i);
  });

  it("ranks each DEVELOPMENT person against a person-specific pool of about 24 jobs", () => {
    const corpus = buildFrameCorpus({ people: 12, split: "DEVELOPMENT", family: "LEXICAL_TRAP" });
    const sizes = corpus.people.map((person) => corpus.jobsByPerson.get(person.personId)!.length);
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBeGreaterThanOrEqual(20);
    expect(sizes[0]).toBeLessThanOrEqual(28);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(12 * sizes[0]!);
  });
});

describe("DATA-01 generator provenance", () => {
  it("uses the frozen frame substrate, not O*NET atoms, as the current corpus versions", () => {
    expect(FRAME_CORPUS_VERSION).toBe("frame-corpus.v1");
    expect(SEMANTIC_FRAME_VERSION).toBe("semantic-frame.v2");
    expect(FRAME_BENCH_SEED).toBe(20260823);
    expect(freeze.corpusVersion).toBe(FRAME_CORPUS_VERSION);
    expect(freeze.frameVersion).toBe(SEMANTIC_FRAME_VERSION);
  });

  it("has 75 invented concepts with the documented role/family counts", () => {
    expect(CONCEPTS).toHaveLength(75);
    const count = (role: string, family: string) => CONCEPTS.filter((concept) => concept.role === role && concept.family === family).length;
    expect(count("action", "core")).toBe(10);
    expect(count("action", "held-out")).toBe(5);
    expect(count("object", "core")).toBe(10);
    expect(count("object", "held-out")).toBe(5);
    expect(count("purpose", "core")).toBe(7);
    expect(count("purpose", "held-out")).toBe(4);
    expect(count("method", "core")).toBe(6);
    expect(count("method", "held-out")).toBe(4);
    expect(count("domain", "core")).toBe(6);
    expect(count("domain", "held-out")).toBe(4);
    expect(count("instrument", "core")).toBe(4);
    expect(count("instrument", "held-out")).toBe(3);
    expect(count("output", "core")).toBe(4);
    expect(count("output", "held-out")).toBe(3);
    expect(CONCEPTS.filter((concept) => concept.family === "core")).toHaveLength(47);
    expect(CONCEPTS.filter((concept) => concept.family === "held-out")).toHaveLength(28);
  });

  it("plants a rigid 6/7/2/4 channel profile on DEVELOPMENT people", () => {
    const corpus = buildFrameCorpus({ people: 12, split: "DEVELOPMENT", family: "LEXICAL_TRAP" });
    expect(corpus.people).toHaveLength(12);
    for (const person of corpus.people) {
      expect(person.performed).toHaveLength(6);
      expect(person.liked).toHaveLength(7);
      expect(person.disliked).toHaveLength(2);
      expect(person.desired).toHaveLength(4);
      expect(person.qualifications).toHaveLength(5);
      const performedIds = new Set(person.performed.map((entry) => entry.work.identity));
      for (const disliked of person.disliked) {
        expect(performedIds.has(disliked.identity), "every disliked frame is also performed").toBe(true);
        const source = person.performed.find((entry) => entry.work.identity === disliked.identity)!;
        expect(identityOverlap(source.work.frame, disliked.frame)).toBe(5);
      }
      expect(person.desired.every((work) => !performedIds.has(work.identity))).toBe(true);
    }
    expect(divergenceContrast(corpus.people).desiredOverlapHistogram).toEqual([0, 0, 5, 7, 0, 0]);
    expect(divergenceContrast(corpus.people).dislikedOverlapHistogram).toEqual([0, 0, 0, 0, 0, 12]);
  });

  it("does not implement Qualification and does not feed narrative to the executed person prompts", () => {
    expect(CHANNEL_CONTRACTS.QUALIFICATION.implemented).toBe(false);
    expect(QUALIFICATION_POOL.length).toBeGreaterThanOrEqual(13);
    const v1 = PERSON_BLUEPRINT_PROMPT.render({
      experience: "EXP", liked: "LIKE", disliked: "DISLIKE", desired: "WANT", narrative: "SKILLS MUST NOT APPEAR",
    });
    const v2 = PERSON_BLUEPRINT_PROMPT_V2.render({
      experience: "EXP", liked: "LIKE", disliked: "DISLIKE", desired: "WANT", narrative: "SKILLS MUST NOT APPEAR",
    });
    expect(v1).toContain("--- EXPERIENCE (what they have done) ---");
    expect(v1).toContain("--- LIKES ---");
    expect(v1).toContain("--- DISLIKES ---");
    expect(v1).toContain("--- WANTS NEXT ---");
    expect(v1).not.toContain("SKILLS MUST NOT APPEAR");
    expect(v2).not.toContain("SKILLS MUST NOT APPEAR");
    expect(v2).toContain("copy the supporting phrase");
  });
});

describe("PTA-01 executed prompt lineage", () => {
  it("keeps every executed prompt version and the unused scaffolds", () => {
    expect(PERSON_BLUEPRINT_PROMPT.version).toBe("v1");
    expect(PERSON_BLUEPRINT_PROMPT_V2.version).toBe("v2");
    expect(JOB_BLUEPRINT_PROMPT.version).toBe("v1");
    expect(EXPERIENCE_AGENT_PROMPT.version).toBe("v1");
    expect(DIRECTION_AGENT_PROMPT.version).toBe("v2");
    expect(DIRECTION_AGENT_PROMPT_V1.version).toBe("v1");
    expect(DIRECTION_AGENT_PROMPT_V1.hypothesis).toMatch(/SUPERSEDED/);
    expect(Object.keys(PROMPTS)).toEqual(["discover-work-content.v1", "transfer-hypotheses.v1"]);
  });

  it("does not inject contrastive examples into executed v1/v2 prompts", () => {
    const rendered = [
      PERSON_BLUEPRINT_PROMPT.render({ experience: "e", liked: "l", disliked: "d", desired: "w" }),
      PERSON_BLUEPRINT_PROMPT_V2.render({ experience: "e", liked: "l", disliked: "d", desired: "w" }),
      JOB_BLUEPRINT_PROMPT.render({ responsibilities: "r" }),
      EXPERIENCE_AGENT_PROMPT.render({ evidence: "e" }),
      DIRECTION_AGENT_PROMPT.render({ evidence: "e" }),
      DIRECTION_AGENT_PROMPT_V1.render({ evidence: "e" }),
    ].join("\n");
    for (const contract of Object.values(CHANNEL_CONTRACTS)) {
      for (const example of contract.contrastiveExamples) {
        expect(rendered).not.toContain(example.qualifies);
        expect(rendered).not.toContain(example.doesNotQualify);
      }
    }
  });

  it("records the Direction v1 liked-into-desired definition that v2 retracts", () => {
    const v1 = DIRECTION_AGENT_PROMPT_V1.render({ evidence: "e" });
    const v2 = DIRECTION_AGENT_PROMPT.render({ evidence: "e" });
    expect(v1).toMatch(/work they enjoy and want more of/);
    expect(v2).toMatch(/ENJOYING work is NOT the same as WANTING it next/);
    expect(v2).not.toMatch(/work they enjoy and want more of/);
  });
});

describe("second-pass audit language", () => {
  const pta = readFileSync("docs/PTA01_PROMPT_BENCHMARK_LINEAGE.md", "utf8");
  const data = readFileSync("docs/DATA01_BENCHMARK_PROVENANCE.md", "utf8");
  const truth = readFileSync("docs/TRUTH01_EVALUATION_MANIFEST.md", "utf8");
  const ont = readFileSync("docs/ONT01_ONTOLOGY_REVIEW.md", "utf8");
  const m01 = readFileSync("docs/M01_INDEPENDENCE_PROTOCOL.md", "utf8");

  it("does not call VALIDATION blindly untouched, and names the procedural holdout", () => {
    expect(pta).toMatch(/procedural generator holdout/);
    expect(pta).toMatch(/held-out vocabulary and source definitions are visible/i);
    expect(pta).toMatch(/instantiate VALIDATION corpora and inspect planted identity/);
    expect(data).toMatch(/procedural generator holdout/);
  });

  it("records person-specific ~24-job pools and NDCG@10 as top 10 of that pool", () => {
    expect(pta).toMatch(/person-specific/);
    expect(pta).toMatch(/NDCG@10/);
    expect(pta).toMatch(/~24/);
    expect(data).toMatch(/shared market/);
    expect(truth).toContain("GRADE_THRESHOLDS");
    expect(truth).toContain("INCIDENTAL_LABEL_WEIGHT");
  });

  it("keeps ONT-01 and M-01 as protocols, not implementations", () => {
    expect(ont).toMatch(/not.*H-01/s);
    expect(ont).toMatch(/Adjudication/);
    expect(m01).toMatch(/Do not render/);
    expect(m01).toMatch(/Renderer author/);
  });

  it("splits P-01, defers S-01, and records sibling-branch authority", () => {
    expect(pta).toMatch(/provenance\/auditability = SUPPORTED/i);
    expect(pta).toMatch(/INCONCLUSIVE/);
    expect(pta).toMatch(/DEFERRED/);
    expect(pta).toContain("PR #8");
    expect(pta).toContain("PR #9");
    expect(pta).toMatch(/do not merge or rebase unless authorized/i);
    expect(data).toMatch(/LOCK-01/);
    expect(truth).toMatch(/Do not.*mutate current truth|does not\s+mutate current truth/i);
  });
});
