// Rendered prompts are frozen, because the paid caches are keyed on their exact text.
//
// $10.76 of interpretations across 741 calls sit behind these hashes. A cache key includes the
// prompt id and version but the CACHE ENTRY was produced by the rendered string, so a source
// refactor that changes one character does something worse than invalidate the cache: it leaves the
// key intact while the text behind it has moved, which silently redefines the experimental arm.
//
// `config/prompt-render-freeze.json` was captured BEFORE the semantic-contract extraction. If this
// test fails, either the refactor was not behaviour-preserving, or a prompt was edited without a
// version bump. Both are scientific problems, not build problems, and neither is fixed by
// regenerating the fixture.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildFrameCorpus, allFrameJobs } from "@/bench/frameCorpus";
import { PERSON_BLUEPRINT_PROMPT, JOB_BLUEPRINT_PROMPT } from "@/agent/agentArchitecture";
import {
  EXPERIENCE_AGENT_PROMPT,
  DIRECTION_AGENT_PROMPT,
  DIRECTION_AGENT_PROMPT_V1,
  agentEvidence,
  agentEvidenceV1,
} from "@/agent/splitAgents";
import {
  CHANNEL_CONTRACTS,
  NORMALISATION_V1,
  NON_IMPLICATION_SPLIT_V1,
  SHARED_CHANNEL_SEPARATION_V1,
} from "@/agent/semanticContract";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const freeze = JSON.parse(readFileSync("config/prompt-render-freeze.json", "utf8")) as {
  version: string;
  hashes: Record<string, string>;
};

/** Recompute every hash the same way the capture did. */
function renderAll(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const family of ["NATURAL", "SEMANTIC_BRIDGE", "LEXICAL_TRAP"] as const) {
    const corpus = buildFrameCorpus({ people: 12, split: "DEVELOPMENT", family });
    const person = corpus.people[0]!;
    out[`${family}/person-blueprint@${PERSON_BLUEPRINT_PROMPT.version}`] = sha(
      PERSON_BLUEPRINT_PROMPT.render({
        experience: person.experienceEvidence.map((e) => e.text).join("\n"),
        liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
        disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
        desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
      }),
    );
    const job = allFrameJobs(corpus)[0]!;
    out[`${family}/job-blueprint@${JOB_BLUEPRINT_PROMPT.version}`] = sha(
      JOB_BLUEPRINT_PROMPT.render({ responsibilities: job.responsibilities.map((r) => r.text).join("\n") }),
    );
    for (const scope of ["full-context", "isolated"] as const) {
      const v2 = agentEvidence(person, scope);
      out[`${family}/${scope}/experience-agent@${EXPERIENCE_AGENT_PROMPT.version}`] = sha(EXPERIENCE_AGENT_PROMPT.render({ evidence: v2.experience }));
      out[`${family}/${scope}/direction-agent@${DIRECTION_AGENT_PROMPT.version}`] = sha(DIRECTION_AGENT_PROMPT.render({ evidence: v2.direction }));
      const v1 = agentEvidenceV1(person, scope);
      out[`${family}/${scope}/direction-agent@${DIRECTION_AGENT_PROMPT_V1.version}`] = sha(DIRECTION_AGENT_PROMPT_V1.render({ evidence: v1.direction }));
    }
  }
  return out;
}

describe("rendered prompts are byte-identical to the pre-refactor freeze", () => {
  const rendered = renderAll();

  it("covers every frozen entry, and adds none silently", () => {
    expect(Object.keys(rendered).sort()).toEqual(Object.keys(freeze.hashes).sort());
  });

  it.each(Object.keys(freeze.hashes))("%s renders unchanged", (key) => {
    expect(rendered[key], `rendered prompt for ${key} changed; a paid cache is keyed on this text`).toBe(freeze.hashes[key]);
  });

  it("has something to check", () => {
    // Guards the failure where the fixture is empty and every assertion vacuously passes.
    expect(Object.keys(freeze.hashes).length).toBeGreaterThanOrEqual(24);
  });
});

describe("the semantic contract is the only definition of channel ontology", () => {
  it("is the sole source of the normalisation instruction", () => {
    // The load-bearing text of the whole program: it produced the +0.241 bridge effect replicated
    // across two vendors. Exactly one definition of it may exist.
    const sources = ["src/agent/agentArchitecture.ts", "src/agent/splitAgents.ts"].map((file) => readFileSync(file, "utf8"));
    for (const source of sources) {
      expect(source).not.toContain("Rewrite every field in plain, general, industry-neutral English.");
    }
    expect(readFileSync("src/agent/semanticContract.ts", "utf8")).toContain("Rewrite every field in plain, general, industry-neutral English.");
  });

  it("is the sole source of the split agents' non-implication rule", () => {
    expect(readFileSync("src/agent/splitAgents.ts", "utf8")).not.toContain("Work someone has done is NOT automatically work they want.");
  });

  it("still reaches every active channel prompt after extraction", () => {
    // Composing from one source is only useful if the composed text actually arrives.
    const shared = PERSON_BLUEPRINT_PROMPT.render({ experience: "x", liked: "", disliked: "", desired: "" });
    expect(shared).toContain(NORMALISATION_V1);
    for (const line of SHARED_CHANNEL_SEPARATION_V1) expect(shared).toContain(line);
    for (const prompt of [EXPERIENCE_AGENT_PROMPT, DIRECTION_AGENT_PROMPT, DIRECTION_AGENT_PROMPT_V1]) {
      const text = prompt.render({ evidence: "x" });
      expect(text, `${prompt.id}@${prompt.version} lost the normalisation instruction`).toContain(NORMALISATION_V1);
      expect(text, `${prompt.id}@${prompt.version} lost the non-implication rule`).toContain(NON_IMPLICATION_SPLIT_V1);
    }
    expect(JOB_BLUEPRINT_PROMPT.render({ responsibilities: "x" })).toContain(NORMALISATION_V1);
  });

  it("does not silently feed the future contract into a frozen v1 prompt", () => {
    // Contrastive examples and the full non-implication set are scientifically meaningful
    // prompt changes. If they appear in a v1 rendering, the extraction was not behaviour-preserving.
    const v1 = [
      PERSON_BLUEPRINT_PROMPT.render({ experience: "x", liked: "", disliked: "", desired: "" }),
      JOB_BLUEPRINT_PROMPT.render({ responsibilities: "x" }),
      EXPERIENCE_AGENT_PROMPT.render({ evidence: "x" }),
      DIRECTION_AGENT_PROMPT.render({ evidence: "x" }),
      DIRECTION_AGENT_PROMPT_V1.render({ evidence: "x" }),
    ].join("\n");
    for (const example of CHANNEL_CONTRACTS.DIRECTION.contrastiveExamples) {
      expect(v1).not.toContain(example.qualifies);
      expect(v1).not.toContain(example.doesNotQualify);
    }
    expect(CHANNEL_CONTRACTS.QUALIFICATION.implemented).toBe(false);
  });
});
