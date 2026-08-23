// The split-agent architecture is only a controlled ablation if a specific set of things are
// held identical to the shared baseline. These tests pin those things, because every one of them
// is a way the comparison could quietly stop measuring what it claims to measure.
import { describe, expect, it } from "vitest";
import {
  DIRECTION_AGENT_PROMPT,
  DIRECTION_AGENT_SCHEMA,
  EXPERIENCE_AGENT_PROMPT,
  EXPERIENCE_AGENT_SCHEMA,
  agentEvidence,
  foldSplitOutputs,
  type DirectionAgentOutput,
  type ExperienceAgentOutput,
} from "@/agent/splitAgents";
import { PERSON_BLUEPRINT_PROMPT, PERSON_BLUEPRINT_SCHEMA, createAgentFieldMatchArchitecture } from "@/agent/agentArchitecture";
import { channelIntegrityFor, channelVolumes, divergenceContrast, personDivergence, summarizeIntegrity } from "@/agent/channelIntegrity";
import { buildFrameCorpus } from "@/bench/frameCorpus";
import { IDENTITY_ROLES } from "@/bench/semanticFrame";

const corpus = buildFrameCorpus({ people: 4, split: "DEVELOPMENT", family: "LEXICAL_TRAP" });
const person = corpus.people[0]!;

const work = (over: Partial<Record<string, string>> = {}) => ({
  action: "review", object: "records", purpose: "accuracy", method: "checking", domain: "retail", ...over,
});

describe("the normalisation instruction is identical across arms", () => {
  it("appears verbatim in the shared prompt and in both split prompts", () => {
    // If this text drifts, the experiment silently becomes "these words normalise better" rather
    // than "a dedicated agent extracts better". It is the load-bearing instruction in every arm.
    const NORMALISE = "Rewrite every field in plain, general, industry-neutral English. " +
      "Use the most ordinary word for each idea, not the wording of the source text. " +
      "Two people describing the same work in different styles must produce the same fields. " +
      "Never copy a distinctive phrase from the input if a plainer word means the same thing.";
    const shared = PERSON_BLUEPRINT_PROMPT.render({ experience: "x", liked: "", disliked: "", desired: "" });
    expect(shared).toContain(NORMALISE);
    expect(EXPERIENCE_AGENT_PROMPT.render({ evidence: "x" })).toContain(NORMALISE);
    expect(DIRECTION_AGENT_PROMPT.render({ evidence: "x" })).toContain(NORMALISE);
  });

  it("states the non-implication to both agents", () => {
    // Neither agent may infer desire from history or history from desire. Both must be told.
    for (const prompt of [EXPERIENCE_AGENT_PROMPT, DIRECTION_AGENT_PROMPT]) {
      expect(prompt.render({ evidence: "x" })).toMatch(/Never infer one from the other/);
    }
  });
});

describe("evidence scope is the axis that separates the two split variants", () => {
  it("gives full-context agents the same evidence the shared prompt sees", () => {
    const scoped = agentEvidence(person, "full-context");
    // Same information, different call structure: that is the fair architectural comparison.
    expect(scoped.experience).toBe(scoped.direction);
    for (const text of person.experienceEvidence.map((e) => e.text)) expect(scoped.experience).toContain(text);
    for (const text of person.aspirationEvidence.map((e) => e.text)) expect(scoped.experience).toContain(text);
  });

  it("withholds the other channel's evidence in the isolated variant", () => {
    const scoped = agentEvidence(person, "isolated");
    expect(scoped.experience).not.toBe(scoped.direction);
    // The Experience Agent cannot import an aspiration it was never shown.
    for (const text of person.aspirationEvidence.map((e) => e.text)) expect(scoped.experience).not.toContain(text);
    // And the Direction Agent cannot mine a history it was never shown.
    for (const text of person.experienceEvidence.map((e) => e.text)) expect(scoped.direction).not.toContain(text);
  });

  it("produces different evidence for the two variants, so their caches cannot collide", () => {
    expect(agentEvidence(person, "isolated").experience).not.toBe(agentEvidence(person, "full-context").experience);
  });
});

describe("the fold keeps the matcher blind to which architecture produced a blueprint", () => {
  it("emits exactly the five role fields the matcher reads, dropping the extra ones", () => {
    const experience: ExperienceAgentOutput = {
      performed: [{ ...work(), ownership: "led others", depth: "formative", evidence: "ran the close" }],
    };
    const direction: DirectionAgentOutput = {
      wanted: [{ ...work({ action: "analyze" }), stance: "WANTED", evidence: "want to move into analysis" }],
      unwanted: [{ ...work({ action: "file" }), stance: "UNWANTED", evidence: "done with filing" }],
    };
    const folded = foldSplitOutputs("p1", experience, direction);
    // Extra fields must not reach the matcher, or "dedicated prompts help" is confounded with
    // "more fields help" and the run cannot say which.
    expect(Object.keys(folded.experience[0]!).sort()).toEqual([...IDENTITY_ROLES].sort());
    expect(Object.keys(folded.desired[0]!).sort()).toEqual([...IDENTITY_ROLES].sort());
  });

  it("routes wanted work to both the preference and direction channels, as the shared arm does", () => {
    // The shared architecture scores direction from `desired` and preference from liked/disliked.
    // Both arms must express direction through the same field or the channel is not comparable.
    const folded = foldSplitOutputs("p1", { performed: [] }, {
      wanted: [{ ...work(), stance: "WANTED", evidence: "e" }],
      unwanted: [{ ...work({ action: "file" }), stance: "UNWANTED", evidence: "e" }],
    });
    expect(folded.desired).toHaveLength(1);
    expect(folded.liked).toHaveLength(1);
    expect(folded.disliked).toHaveLength(1);
  });

  it("survives an agent returning nothing, without inventing entries", () => {
    const folded = foldSplitOutputs("p1", null, null);
    expect(folded).toEqual({ personId: "p1", experience: [], liked: [], disliked: [], desired: [] });
  });

  it("produces a blueprint the existing matcher accepts unchanged", () => {
    const folded = foldSplitOutputs(person.personId, { performed: [{ ...work(), ownership: "o", depth: "d", evidence: "e" }] }, { wanted: [], unwanted: [] });
    const architecture = createAgentFieldMatchArchitecture(new Map([[person.personId, folded]]), new Map(), "split-test");
    expect(architecture.id).toBe("split-test");
    expect(typeof architecture.score(architecture.prepare(person), corpus.jobsByPerson.get(person.personId)![0]!, "experience")).toBe("number");
  });
});

describe("schemas are distinct, so one agent's cache cannot answer for another", () => {
  it("keeps the three person schemas different", () => {
    const shapes = [PERSON_BLUEPRINT_SCHEMA, EXPERIENCE_AGENT_SCHEMA, DIRECTION_AGENT_SCHEMA].map((s) => JSON.stringify(s));
    expect(new Set(shapes).size).toBe(3);
  });

  it("constrains both split schemas strictly, with no free-form extras", () => {
    expect(EXPERIENCE_AGENT_SCHEMA.additionalProperties).toBe(false);
    expect(DIRECTION_AGENT_SCHEMA.additionalProperties).toBe(false);
    expect(EXPERIENCE_AGENT_SCHEMA.properties.performed.items.additionalProperties).toBe(false);
  });
});

describe("contamination is detected, and cannot be faked by staying silent", () => {
  const performedFrame = person.performed[0]!.work.frame as unknown as Record<string, string>;
  const desiredFrame = person.desired[0]!.frame as unknown as Record<string, string>;
  // Built from the planted concept ids with the TYPE PREFIX REMOVED. Keeping the prefix would
  // make every role match every concept of that type, so the fixture would pass against a
  // detector that does nothing.
  const asWork = (frame: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const role of IDENTITY_ROLES) out[role] = frame[role]!.slice(frame[role]!.indexOf(".") + 1).replace(/[.\-_]/g, " ");
    return out as never;
  };

  it("flags history imported into the direction channel", () => {
    // The product-fatal error: because this corpus plants disliked work that the person actually
    // performed, "has done -> wants" necessarily recommends work they explicitly rejected.
    const contaminated = channelIntegrityFor(person, {
      personId: person.personId, experience: [], liked: [], disliked: [], desired: [asWork(performedFrame)],
    });
    expect(contaminated.experienceIntoDirection).toBeGreaterThan(0);
  });

  it("flags ambition imported into the experience channel", () => {
    const contaminated = channelIntegrityFor(person, {
      personId: person.personId, experience: [asWork(desiredFrame)], liked: [], disliked: [], desired: [],
    });
    expect(contaminated.directionIntoExperience).toBeGreaterThan(0);
  });

  it("does not flag a correctly separated blueprint", () => {
    const clean = channelIntegrityFor(person, {
      personId: person.personId, experience: [asWork(performedFrame)], liked: [], disliked: [], desired: [asWork(desiredFrame)],
    });
    expect(clean.directionIntoExperience).toBe(0);
    expect(clean.experienceIntoDirection).toBe(0);
  });

  it("reports the denominators, so an abstaining architecture cannot look clean", () => {
    // An architecture that emits nothing has a zero contamination COUNT. The empty-channel
    // counters are what stop that from reading as a win -- the denominator-shrinking path
    // AGENTS.md calls out for the preference metric.
    const silent = channelIntegrityFor(person, { personId: person.personId, experience: [], liked: [], disliked: [], desired: [] });
    const summary = summarizeIntegrity([silent]);
    expect(summary.experienceIntoDirectionRate).toBe(0);
    expect(summary.emptyExperienceChannels).toBe(1);
    expect(summary.emptyDesiredChannels).toBe(1);
    expect(summary.performedRecall).toBe(0);
  });
});

describe("volume inflation is caught, which the identity detector alone does not", () => {
  it("flags a channel that emits far more than was planted", () => {
    // The failure the first split-agent screen actually had: 10.4 experience entries against 6
    // planted, built from work the person liked or wanted rather than performed, while the strict
    // 5-of-5 contamination rate read 0.008 and cleared it.
    const inflated = channelVolumes(person, {
      personId: person.personId,
      experience: Array.from({ length: person.performed.length * 2 }, () => work()),
      liked: [], disliked: [], desired: [],
    });
    expect(inflated.experience.ratio).toBeCloseTo(2, 6);
    expect(inflated.experience.planted).toBe(person.performed.length);
  });

  it("reports an exact channel as a ratio of one", () => {
    const exact = channelVolumes(person, {
      personId: person.personId,
      experience: person.performed.map(() => work()),
      liked: [], disliked: [], desired: [],
    });
    expect(exact.experience.ratio).toBe(1);
  });

  it("distinguishes omission from inflation rather than reporting absolute error", () => {
    const sparse = channelVolumes(person, { personId: person.personId, experience: [work()], liked: [], disliked: [], desired: [] });
    expect(sparse.experience.ratio).toBeLessThan(1);
  });
});

describe("the corpus is checked for the divergence the hypothesis needs", () => {
  it("measures overlap per person rather than bucketing on an unmeasured threshold", () => {
    const row = personDivergence(person);
    expect(row.desiredToPerformedOverlap).toBeGreaterThanOrEqual(0);
    expect(row.desiredToPerformedOverlap).toBeLessThanOrEqual(IDENTITY_ROLES.length);
  });

  it("reports that this corpus cannot support a divergence claim", () => {
    // Recording the current fact deliberately: every person plants disliked work identical to
    // work they performed, and desired work overlapping it on 2-3 of 5 roles. There is no
    // low-experience/high-direction group to contrast against. If the generator ever changes,
    // this test should fail and be re-read rather than updated reflexively.
    const contrast = divergenceContrast(corpus.people);
    expect(contrast.supportsDivergenceHypothesis).toBe(false);
    expect(contrast.limitation).toBeTruthy();
    expect(contrast.dislikedOverlapHistogram[5]).toBe(corpus.people.length);
    expect(contrast.desiredOverlapHistogram.slice(0, 2)).toEqual([0, 0]);
    expect(contrast.desiredOverlapHistogram.slice(4)).toEqual([0, 0]);
  });
});
