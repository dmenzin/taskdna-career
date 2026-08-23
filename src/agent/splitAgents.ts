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
import { NORMALISATION_V1, NON_IMPLICATION_SPLIT_V1 } from "@/agent/semanticContract";

export const SPLIT_AGENT_VERSION = "split-agents.v2";

/**
 * WHAT v2 CORRECTS
 * ----------------
 * v1's Direction Agent defined WANTED as "stated goals, aspirations, work they enjoy and want more
 * of" — and "work they enjoy" IS the Preference channel. It emitted exactly 11.0 items per person
 * against 4 planted desired, which is 7 planted liked plus 4 planted desired, and the provenance
 * audit confirmed the mechanism directly: 81 of 129 desired claims were sourced from LIKE evidence.
 * Direction retrieval collapsed 0.732 to 0.457. That was a malformed channel definition, not
 * evidence about whether a dedicated Direction Agent works.
 *
 * v1's "isolation" was also only half-built. The isolated Direction Agent was shown LIKES,
 * DISLIKES *and* WANTS NEXT together, so it was never isolated from Preference at all — which is
 * why its contamination rate (0.629) is indistinguishable from the full-context arm's (0.628).
 *
 * v2 fixes both. The Direction Agent emits ONLY desired future work, and in the isolated variant it
 * sees ONLY aspiration evidence. Liking work and wanting it next are distinct facts, and an agent
 * responsible for both rebuilds channel contamination one level up.
 *
 * Preference is deliberately NOT produced by this architecture. It is a separate architectural
 * question deserving its own preregistered screen, so the preference channel must be reported as
 * NOT PRODUCED rather than as a regression to zero.
 */

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

/**
 * Work the person wants to do next.
 *
 * There is no `unwanted` counterpart, and that is a deliberate match to the benchmark rather than
 * an omission: the frozen corpus plants `desired` (4 per person) as its only Direction construct.
 * `disliked` is a PREFERENCE construct, not an undesired-future one. Inventing an unwanted-future
 * output with no planted truth behind it would produce a channel nothing could score.
 */
export interface DirectionWork extends StructuredWork {
  evidence: string;
}

export interface ExperienceAgentOutput {
  performed: ExperienceWork[];
}

export interface DirectionAgentOutput {
  desired: DirectionWork[];
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

export const DIRECTION_AGENT_SCHEMA = {
  type: "object",
  properties: {
    desired: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...WORK_ROLE_FIELDS,
          evidence: { type: "string", description: "the phrase from the evidence that supports this entry" },
        },
        required: ["action", "object", "purpose", "method", "domain", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["desired"],
  additionalProperties: false,
} as const;

/**
 * Both fragments now come from the one file that owns channel ontology.
 *
 * `NON_IMPLICATION_SPLIT_V1` is preserved WITH ITS DEFECT: it covers performed <-> desired and says
 * nothing about liked -> desired, which is precisely the gap the v1 Direction Agent walked through.
 * It is kept byte-identical so the v1 arm stays reconstructible from its cache. A future prompt
 * version should compose from `NON_IMPLICATIONS` instead, which enumerates all nine rules.
 */
const NORMALISE = NORMALISATION_V1;
const NON_IMPLICATION = NON_IMPLICATION_SPLIT_V1;

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
  version: "v2",
  hypothesis:
    "A prompt scoped strictly to FUTURE work — excluding both history and mere enjoyment — recovers direction more completely than a shared prompt, and does not absorb Preference items into Direction.",
  render: (input) =>
    [
      "You are reading one person's description of their own working life.",
      "Extract ONLY the work this person WANTS TO DO NEXT.",
      "",
      NON_IMPLICATION,
      "A long history in some work is NOT evidence that they want more of it. Many people are",
      "trying to leave the work they are best at.",
      "",
      // v1 lost the whole channel here by defining WANTED to include "work they enjoy". Liking
      // work and wanting it in the future are different facts about a person, and merging them
      // rebuilds the contamination the four-channel architecture exists to prevent.
      "ENJOYING work is NOT the same as WANTING it next. Do not include work merely because the",
      "person says they liked it. Include work only where the text says they want to move into it,",
      "are aiming for it, or state it as a goal for the future.",
      "",
      NORMALISE,
      "",
      "Record the phrase in the text that supports each entry.",
      "",
      "Use only what the text supports. Do not invent direction. If the text states no future",
      "intent, return an empty list rather than guessing from their history or their preferences.",
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
      // v2 CORRECTION. v1 handed the "isolated" Direction Agent LIKES, DISLIKES *and* WANTS NEXT
      // together, so it was never isolated from Preference — and its measured contamination rate
      // (0.629) was indistinguishable from the full-context arm's (0.628). Isolating Direction
      // means showing it aspiration evidence and nothing else.
      direction: ["--- WANTS NEXT ---", desired].join("\n"),
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
 * `liked` and `disliked` are left EMPTY, and that is the correction v2 exists for. v1 populated
 * them from the Direction Agent's output, which made a single agent responsible for two channels
 * and destroyed both. This architecture covers Experience and Direction only; Preference is a
 * separate architectural question with its own screen.
 *
 * The consequence must be reported honestly: the preference channel score for this architecture is
 * NOT PRODUCED, not a regression to zero. Reading it as a loss would penalise the architecture for
 * a capability it never claimed.
 */
export function foldSplitOutputs(
  personId: string,
  experience: ExperienceAgentOutput | null,
  direction: DirectionAgentOutput | null,
): CareerBlueprint {
  const strip = (work: StructuredWork): StructuredWork => ({
    action: work.action, object: work.object, purpose: work.purpose, method: work.method, domain: work.domain,
  });
  return {
    personId,
    experience: (experience?.performed ?? []).map(strip),
    liked: [],
    disliked: [],
    desired: (direction?.desired ?? []).map(strip),
  };
}

/** Channels this architecture produces. Anything absent must be reported as NOT PRODUCED. */
export const SPLIT_PRODUCED_CHANNELS = ["experience", "direction"] as const;

// ---------------------------------------------------------------------------
// Retained v1 definitions — AUDIT ONLY, never for a new run
// ---------------------------------------------------------------------------
//
// The v1 Direction Agent is the defect that motivated v2, and the provenance audit that diagnosed
// it is the evidence the redesign rests on. Prompt version participates in the cache key, so
// deleting v1 would make its 24 paid interpretations unreadable and the motivating measurement
// unreproducible. That is the exact failure mode that lost the Anthropic arm, so the old
// definitions stay, frozen, reachable only by the audit path.

/** v1 output shape: `wanted`/`unwanted`, with Preference merged into Direction. */
export interface DirectionAgentOutputV1 {
  wanted: (StructuredWork & { stance: string; evidence: string })[];
  unwanted: (StructuredWork & { stance: string; evidence: string })[];
}

const DIRECTION_ITEMS_V1 = {
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

export const DIRECTION_AGENT_SCHEMA_V1 = {
  type: "object",
  properties: { wanted: DIRECTION_ITEMS_V1, unwanted: DIRECTION_ITEMS_V1 },
  required: ["wanted", "unwanted"],
  additionalProperties: false,
} as const;

export const DIRECTION_AGENT_PROMPT_V1: PromptSpec = {
  id: "direction-agent",
  version: "v1",
  hypothesis:
    "SUPERSEDED. Defined WANTED to include work the person merely enjoys, which merged Preference into Direction and collapsed the channel. Retained so the v1 cache stays readable.",
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

/** v1 evidence routing: the "isolated" Direction Agent also saw LIKES and DISLIKES. */
export function agentEvidenceV1(person: PlantedFramePerson, scope: EvidenceScope): { experience: string; direction: string } {
  if (scope !== "isolated") return agentEvidence(person, scope);
  const liked = person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n");
  const disliked = person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n");
  const desired = person.aspirationEvidence.map((e) => e.text).join("\n");
  return {
    experience: agentEvidence(person, "isolated").experience,
    direction: ["--- LIKES ---", liked, "", "--- DISLIKES ---", disliked, "", "--- WANTS NEXT ---", desired].join("\n"),
  };
}
