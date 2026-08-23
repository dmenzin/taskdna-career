// Split-agent person interpretation: one agent for performed work, one for wanted work.
//
// THE HYPOTHESIS
// --------------
// The shared `CareerBlueprint` prompt asks one model call to fill four labelled channels at
// once. A dedicated Experience Agent and a dedicated Direction Agent might each do its own job
// better, because neither has to hold four contradictory extraction goals in mind, and because
// the instruction not to conflate "has done" with "wants next" becomes structural rather than
// merely stated.
//
// WHY THERE ARE TWO SPLIT VARIANTS, NOT ONE
// -----------------------------------------
// A naive split hands each agent only its own evidence, which makes cross-channel contamination
// impossible BY CONSTRUCTION rather than by understanding. That is a legitimate architectural
// advantage, but it is a different claim from "dedicated prompts interpret better", and reporting
// one as the other would be the kind of result that collapses on contact with real input — where
// aspiration and experience arrive interleaved in one narrative rather than pre-sorted.
//
// So the comparison is three-way:
//
//   shared              1 call,  ALL evidence, four channels at once   (existing baseline)
//   split-full-context  2 calls, ALL evidence, each agent extracts its own channel
//   split-isolated      2 calls, PARTITIONED evidence, separation by construction
//
// `split-full-context` is the fair architectural comparison against `shared`: same information,
// different call structure. `split-isolated` measures what withholding evidence buys on top.
//
// WHAT IS DELIBERATELY HELD FIXED
// -------------------------------
// The matcher sees the SAME five role fields it always has. The Experience Agent additionally
// reports ownership/depth and supporting evidence, and both agents report confidence, but the
// matcher IGNORES those fields. They are captured for the product-level questions and for a
// later, separately preregistered experiment. Feeding them to the matcher in the same change
// would confound "dedicated prompts help" with "more fields help", and the run would not be able
// to say which.
import type { PromptSpec } from "@/agent/runtime";
import type { CareerBlueprint, StructuredWork } from "@/agent/agentArchitecture";
import type { PlantedFramePerson } from "@/bench/frameCorpus";

export const SPLIT_AGENT_VERSION = "split-agents.v1";

/** Which evidence an agent is shown. The axis that separates the two split variants. */
export type EvidenceScope = "full-context" | "isolated";

export type SplitArchitectureId = "split-full-context" | "split-isolated";

/**
 * Work as the Experience Agent understands it.
 *
 * The five role fields are identical to `StructuredWork`, so the matcher is unchanged. The extra
 * fields are recorded and NOT matched on.
 */
export interface ExperienceWork extends StructuredWork {
  /** How much of this work the person owned: did it, ran it, or led others doing it. */
  ownership: string;
  /** Depth signal in the person's own terms — routine, occasional, deep, formative. */
  depth: string;
  /** The phrase in the evidence that supports this entry. Provenance, not decoration. */
  evidence: string;
}

/** Work the person wants, or explicitly does not want, next. */
export interface DirectionWork extends StructuredWork {
  /** `WANTED` or `UNWANTED`. The sign of the direction, kept explicit rather than positional. */
  stance: string;
  evidence: string;
}

export interface ExperienceAgentOutput {
  performed: ExperienceWork[];
}

export interface DirectionAgentOutput {
  wanted: DirectionWork[];
  unwanted: DirectionWork[];
}

const WORK_ROLE_FIELDS = {
  action: { type: "string", description: "the core verb, in plain general English" },
  object: { type: "string", description: "what the action is performed on, in plain general English" },
  purpose: { type: "string", description: "why it is done" },
  method: { type: "string", description: "how it is done" },
  domain: { type: "string", description: "the industry or setting" },
} as const;

export const EXPERIENCE_AGENT_SCHEMA = {
  type: "object",
  properties: {
    performed: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...WORK_ROLE_FIELDS,
          ownership: { type: "string", description: "did it personally, ran it, or led others doing it" },
          depth: { type: "string", description: "routine, occasional, deep, or formative" },
          evidence: { type: "string", description: "the phrase from the evidence that supports this entry" },
        },
        required: ["action", "object", "purpose", "method", "domain", "ownership", "depth", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["performed"],
  additionalProperties: false,
} as const;

const DIRECTION_ITEMS = {
  type: "array",
  items: {
    type: "object",
    properties: {
      ...WORK_ROLE_FIELDS,
      stance: { type: "string", description: "WANTED or UNWANTED" },
      evidence: { type: "string", description: "the phrase from the evidence that supports this entry" },
    },
    required: ["action", "object", "purpose", "method", "domain", "stance", "evidence"],
    additionalProperties: false,
  },
} as const;

export const DIRECTION_AGENT_SCHEMA = {
  type: "object",
  properties: { wanted: DIRECTION_ITEMS, unwanted: DIRECTION_ITEMS },
  required: ["wanted", "unwanted"],
  additionalProperties: false,
} as const;

/**
 * The normalisation instruction, copied VERBATIM from the shared prompt.
 *
 * It must be byte-identical, or the comparison silently becomes "these words normalise better"
 * rather than "a dedicated agent extracts better". This is the load-bearing text in both arms.
 */
const NORMALISE = [
  "Rewrite every field in plain, general, industry-neutral English.",
  "Use the most ordinary word for each idea, not the wording of the source text.",
  "Two people describing the same work in different styles must produce the same fields.",
  "Never copy a distinctive phrase from the input if a plainer word means the same thing.",
].join(" ");

/**
 * The non-implication, stated the same way to both agents.
 *
 * This is the product's most important negative constraint: recommending someone back into the
 * work they are trying to leave is the failure mode that loses a user's trust permanently.
 */
const NON_IMPLICATION = [
  "Work someone has done is NOT automatically work they want. Work they want is NOT automatically",
  "work they have done. Never infer one from the other.",
].join(" ");

export const EXPERIENCE_AGENT_PROMPT: PromptSpec = {
  id: "experience-agent",
  version: "v1",
  hypothesis:
    "A prompt dedicated solely to performed work recovers experience more completely than a shared prompt that must fill four channels at once, and admits less wanted-but-never-done work into the experience channel.",
  render: (input) =>
    [
      "You are reading one person's description of their own working life.",
      "Extract ONLY work this person has ACTUALLY PERFORMED.",
      "",
      NON_IMPLICATION,
      "Exclude anything they merely want, hope for, are training toward, or admire in others.",
      "Exclude work they say they dislike UNLESS they also did it — disliking work you performed",
      "is still experience.",
      "",
      NORMALISE,
      "",
      "For each piece of work also record how much of it the person owned, how deep the",
      "involvement was, and the phrase in the text that supports it.",
      "",
      "Use only what the text supports. Do not invent work. If the text does not describe",
      "performed work, return an empty list rather than guessing.",
      "",
      "--- EVIDENCE ---",
      String(input.evidence ?? ""),
    ].join("\n"),
};

export const DIRECTION_AGENT_PROMPT: PromptSpec = {
  id: "direction-agent",
  version: "v1",
  hypothesis:
    "A prompt dedicated solely to desired and undesired future work recovers direction more completely than a shared prompt, and does not import the person's history as though it were their ambition.",
  render: (input) =>
    [
      "You are reading one person's description of their own working life.",
      "Extract ONLY the work this person WANTS to do next, and the work they do NOT want to do.",
      "",
      NON_IMPLICATION,
      "A long history in some work is NOT evidence that they want more of it. Many people are",
      "trying to leave the work they are best at.",
      "",
      "WANTED covers stated goals, aspirations, work they enjoy and want more of, and transitions",
      "they are moving toward. UNWANTED covers work they dislike, are moving away from, or have",
      "ruled out.",
      "",
      NORMALISE,
      "",
      "Record the phrase in the text that supports each entry.",
      "",
      "Use only what the text supports. Do not invent direction. If the text states no direction,",
      "return empty lists rather than guessing from their history.",
      "",
      "--- EVIDENCE ---",
      String(input.evidence ?? ""),
    ].join("\n"),
};

/**
 * The evidence text each agent is shown, for one person.
 *
 * `full-context` gives both agents the SAME text the shared prompt sees, so the only difference
 * from the baseline is the call structure. `isolated` partitions it, which is the variant that
 * cannot contaminate because it never sees the other channel's words.
 *
 * The section labels and ordering match the shared prompt exactly in the `full-context` case, so
 * neither arm gets a formatting advantage.
 */
export function agentEvidence(
  person: PlantedFramePerson,
  scope: EvidenceScope,
): { experience: string; direction: string } {
  const experienceText = person.experienceEvidence.map((entry) => entry.text).join("\n");
  const liked = person.preferenceEvidence.filter((entry) => entry.stance === "LIKE").map((entry) => entry.text).join("\n");
  const disliked = person.preferenceEvidence.filter((entry) => entry.stance === "DISLIKE").map((entry) => entry.text).join("\n");
  const desired = person.aspirationEvidence.map((entry) => entry.text).join("\n");

  if (scope === "isolated") {
    return {
      experience: ["--- EXPERIENCE (what they have done) ---", experienceText].join("\n"),
      direction: [
        "--- LIKES ---", liked,
        "", "--- DISLIKES ---", disliked,
        "", "--- WANTS NEXT ---", desired,
      ].join("\n"),
    };
  }

  const full = [
    "--- EXPERIENCE (what they have done) ---", experienceText,
    "", "--- LIKES ---", liked,
    "", "--- DISLIKES ---", disliked,
    "", "--- WANTS NEXT ---", desired,
  ].join("\n");
  return { experience: full, direction: full };
}

/**
 * Fold two agent outputs into the SAME `CareerBlueprint` shape the matcher already consumes.
 *
 * Doing the fold here rather than in the matcher is what keeps this an ablation: downstream code
 * cannot tell which architecture produced a blueprint, so it cannot treat them differently.
 *
 * `liked` is populated from WANTED and `disliked` from UNWANTED, mirroring how the shared
 * blueprint's preference channel is scored (liked minus disliked). `desired` also receives
 * WANTED, because the shared architecture's direction channel reads `desired` — both arms must
 * therefore express direction through the same field or the channel comparison is meaningless.
 */
export function foldSplitOutputs(
  personId: string,
  experience: ExperienceAgentOutput | null,
  direction: DirectionAgentOutput | null,
): CareerBlueprint {
  const strip = (work: StructuredWork): StructuredWork => ({
    action: work.action, object: work.object, purpose: work.purpose, method: work.method, domain: work.domain,
  });
  const wanted = (direction?.wanted ?? []).map(strip);
  return {
    personId,
    experience: (experience?.performed ?? []).map(strip),
    liked: wanted,
    disliked: (direction?.unwanted ?? []).map(strip),
    desired: wanted,
  };
}
