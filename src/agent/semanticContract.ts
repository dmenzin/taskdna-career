// The single source of truth for what each semantic channel MEANS.
//
// WHY THIS FILE EXISTS
// --------------------
// The Direction-v1 failure was not "a bad prompt". It was a configuration-management failure: two
// source files were each independently allowed to define what a semantic construct meant, and they
// drifted. `agentArchitecture.ts` and `splitAgents.ts` each carried their own copy of the
// normalisation instruction and their own, DIFFERENT, formulation of the non-implication rule.
//
// The drift is visible in the extracted fragments below, and it is exactly where the failure landed:
//
//   the SHARED prompt says "These four are independent. Never infer one from another", which
//   covers liked -> desired implicitly by covering all four channels;
//
//   the SPLIT prompt says only "Work someone has done is NOT automatically work they want. Work
//   they want is NOT automatically work they have done", which covers performed <-> desired and
//   says NOTHING about liked -> desired.
//
// The v1 Direction Agent then defined WANTED as "work they enjoy and want more of" — a definition
// no rule in its own contract forbade. The weaker of two divergent contracts is the one that broke.
//
// EXTRACTION IS BEHAVIOUR-PRESERVING, ON PURPOSE
// ----------------------------------------------
// Every `*_V1` constant here is BYTE-IDENTICAL to the text it replaced. The paid caches are keyed
// on rendered prompt text, so changing a single character would orphan them and silently redefine
// the experimental arm. `config/prompt-render-freeze.json` holds SHA-256 of every rendered prompt
// captured BEFORE this extraction, and `tests/prompt-render-freeze.test.ts` fails if any of them
// moves.
//
// The improvements the contract makes possible — contrastive examples, explicit abstention, the
// full non-implication set — are deliberately NOT applied to v1. They are scientifically meaningful
// prompt changes and belong to a future prompt version, evaluated as an experiment.

export const SEMANTIC_CONTRACT_VERSION = "semantic-contract.v1";

// ---------------------------------------------------------------------------
// v1 fragments — byte-identical to what they replaced. DO NOT EDIT.
// ---------------------------------------------------------------------------

/**
 * Normalisation instruction. Genuinely identical in both source files before extraction, so this
 * is a true de-duplication rather than a reconciliation.
 *
 * This is the load-bearing text of the entire program: it is what produced the +0.241
 * SEMANTIC_BRIDGE effect replicated across two vendors. Editing it invalidates every arm.
 */
export const NORMALISATION_V1 = [
  "Rewrite every field in plain, general, industry-neutral English.",
  "Use the most ordinary word for each idea, not the wording of the source text.",
  "Two people describing the same work in different styles must produce the same fields.",
  "Never copy a distinctive phrase from the input if a plainer word means the same thing.",
].join(" ");

/**
 * The SHARED interpreter's channel-separation text, verbatim.
 *
 * Covers all four channels by asserting independence, which is why the shared architecture never
 * exhibited the liked-into-desired collapse.
 */
export const SHARED_CHANNEL_SEPARATION_V1 = [
  "Separate what they HAVE DONE from what they LIKE, what they DISLIKE, and what they WANT NEXT.",
  "These four are independent. Never infer one from another: work someone has done is not",
  "automatically work they enjoy, and work they want next is not work they have done.",
];

/**
 * The SPLIT agents' non-implication text, verbatim.
 *
 * PRESERVED WITH ITS DEFECT. It covers performed <-> desired only. It is the weaker contract, and
 * the reason v1 Direction was free to absorb Preference. Kept exactly so v1 stays reconstructible;
 * a future prompt version should use `NON_IMPLICATIONS` below instead.
 */
export const NON_IMPLICATION_SPLIT_V1 = [
  "Work someone has done is NOT automatically work they want. Work they want is NOT automatically",
  "work they have done. Never infer one from the other.",
].join(" ");

// ---------------------------------------------------------------------------
// The contract proper — for FUTURE prompt versions
// ---------------------------------------------------------------------------

export type ChannelName = "EXPERIENCE" | "PREFERENCE" | "QUALIFICATION" | "DIRECTION";

export interface ChannelContract {
  channel: ChannelName;
  definition: string;
  includes: string[];
  excludes: string[];
  /** What the interpreter must do when the evidence does not support a claim. */
  abstain: string;
  /**
   * Contrastive example pairs. One sentence that DOES establish the construct and one that looks
   * similar and does not. Deliberately few: the failure mode was an ambiguous definition, not a
   * shortage of prose, and a long prompt has its own costs in tokens and attention.
   */
  contrastiveExamples: { qualifies: string; doesNotQualify: string; because: string }[];
  /** Whether an interpreter for this channel exists today. */
  implemented: boolean;
}

export const CHANNEL_CONTRACTS: Record<ChannelName, ChannelContract> = {
  EXPERIENCE: {
    channel: "EXPERIENCE",
    definition: "Work the person has actually performed.",
    includes: ["work they did personally", "work they ran or led", "work they performed and disliked"],
    excludes: ["work they only want to do", "work they admire in others", "work they are qualified for but never did"],
    abstain: "Return an empty list rather than inferring performed work from an aspiration or a credential.",
    contrastiveExamples: [
      {
        qualifies: "For three years I reconciled the month-end accounts.",
        doesNotQualify: "I'd love to move into month-end accounting.",
        because: "The second states an ambition. Wanting work is not having done it.",
      },
      {
        qualifies: "I ran the safety reviews, though I never enjoyed them.",
        doesNotQualify: "I'm certified in safety auditing.",
        because: "A credential is a qualification. Disliked work that was performed is still experience.",
      },
    ],
    implemented: true,
  },
  PREFERENCE: {
    channel: "PREFERENCE",
    definition: "Work the person likes or dislikes, independent of whether they did it or want it next.",
    includes: ["stated enjoyment", "stated dislike", "aversion to specific work content"],
    excludes: ["future goals", "work merely performed", "work they are qualified for"],
    abstain: "Return an empty list rather than inferring enjoyment from long tenure.",
    contrastiveExamples: [
      {
        qualifies: "The part I enjoyed most was untangling why a process kept failing.",
        doesNotQualify: "I want to move into process improvement.",
        because: "The second is Direction. Liking work and wanting it next are different facts.",
      },
    ],
    implemented: true,
  },
  QUALIFICATION: {
    channel: "QUALIFICATION",
    definition: "Capabilities, credentials, licences and education the person holds.",
    includes: ["credentials", "licences", "formal education", "demonstrated skills", "transferable capabilities"],
    excludes: ["work performed", "work enjoyed", "work desired"],
    abstain: "Return an empty list rather than inferring a credential from related experience.",
    contrastiveExamples: [
      {
        qualifies: "I hold a six sigma green belt.",
        doesNotQualify: "I've done a lot of process improvement work.",
        because: "Experience adjacent to a credential is not the credential. Qualified does not imply performed, and performed does not imply qualified.",
      },
    ],
    // NOT IMPLEMENTED. No interpreter emits this channel; the five planted qualifications per
    // person are visible only in `narrative`, which no architecture reads. Recorded here so the
    // gap is machine-visible rather than a claim in a document. See research program item Q-01.
    implemented: false,
  },
  DIRECTION: {
    channel: "DIRECTION",
    definition: "Work the person wants to do next.",
    includes: ["stated goals", "aspirations", "transitions they are moving toward"],
    excludes: [
      "work they merely enjoy",
      "work they have performed",
      "work they are qualified for",
    ],
    abstain: "Return an empty list rather than inferring direction from history or from preferences.",
    contrastiveExamples: [
      {
        qualifies: "What I want to move into next is contract negotiation.",
        doesNotQualify: "What I liked most was negotiating with suppliers.",
        because: "THIS IS THE v1 FAILURE. Enjoying work is not wanting it next. The v1 contract omitted this rule and the Direction Agent absorbed the entire Preference channel.",
      },
    ],
    implemented: true,
  },
};

export interface NonImplication {
  from: ChannelName;
  to: ChannelName;
  rule: string;
  /** Which v1 fragment, if any, actually stated this. `null` means v1 left it unstated. */
  statedInV1: "shared" | "split" | "both" | null;
}

/**
 * Every non-implication the four-channel architecture depends on, with v1 coverage recorded.
 *
 * The `statedInV1: null` rows are the gaps. `PREFERENCE -> DIRECTION` is the one that cost a
 * measured −0.274 and 24 paid calls; the rest are unenforceable today because Qualification has no
 * interpreter at all.
 */
export const NON_IMPLICATIONS: NonImplication[] = [
  { from: "EXPERIENCE", to: "PREFERENCE", rule: "performed does not imply liked", statedInV1: "shared" },
  { from: "EXPERIENCE", to: "DIRECTION", rule: "performed does not imply desired", statedInV1: "both" },
  { from: "DIRECTION", to: "EXPERIENCE", rule: "desired does not imply previously performed", statedInV1: "both" },
  // The v1 gap that broke Direction. Implicit in the shared prompt's "these four are independent";
  // entirely absent from the split agents' contract.
  { from: "PREFERENCE", to: "DIRECTION", rule: "liked does not imply desired", statedInV1: null },
  { from: "PREFERENCE", to: "DIRECTION", rule: "disliked does not by itself establish an explicit future prohibition", statedInV1: null },
  { from: "QUALIFICATION", to: "EXPERIENCE", rule: "qualified does not imply performed", statedInV1: null },
  { from: "QUALIFICATION", to: "PREFERENCE", rule: "qualified does not imply liked", statedInV1: null },
  { from: "QUALIFICATION", to: "DIRECTION", rule: "qualified does not imply desired", statedInV1: null },
  { from: "DIRECTION", to: "QUALIFICATION", rule: "desired does not imply qualified", statedInV1: null },
];

/** Non-implications no v1 prompt states. The backlog for the next contract version. */
export const V1_UNSTATED_NON_IMPLICATIONS = NON_IMPLICATIONS.filter((rule) => rule.statedInV1 === null);
