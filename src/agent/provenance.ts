// Evidence-source contamination: did a channel's claim come from another channel's evidence?
//
// WHY THE IDENTITY DETECTOR WAS NOT ENOUGH
// ----------------------------------------
// `channelIntegrity.ts` asks whether an output accidentally resolves to a truth frame belonging to
// another channel. That is a real question, but it is not the one the product is exposed to. In the
// first split-agent screen the full-context Experience Agent inflated performed work from 6 planted
// entries to 10.4, and strict identity collision reported 0.008 — essentially clean. The inflation
// was invisible to it because a claim built from "work this person LIKED" often resolves to a frame
// that is not any planted DESIRED frame either, so it collides with nothing.
//
// The question that matters is provenance: WHERE DID THIS CLAIM COME FROM? An Experience claim
// whose supporting evidence is the sentence "What I liked most: ..." is a claim that the person
// performed work which the text only says they enjoyed. That is the error that recommends someone
// back into a job they are trying to leave.
//
// This is computable for free, from interpretations already paid for, because both split agents
// were required to emit the supporting phrase alongside each work item.
//
// TWO FAILURES THAT MUST NOT BE CONFLATED
// ---------------------------------------
//   evidence contamination   the claim was built from another channel's evidence
//   interpretation drift     the claim was built from the right evidence but landed on a frame
//                            belonging to another channel
//
// An agent that was never SHOWN another channel's evidence cannot contaminate from it, however
// wrong its output is. Reporting drift as contamination would make evidence isolation look like it
// had failed when what actually failed was interpretation. `classifyChannelError` keeps them apart.
import type { StructuredWork } from "@/agent/agentArchitecture";
import type { PlantedFramePerson } from "@/bench/frameCorpus";

export const PROVENANCE_VERSION = "provenance.v1";

/** The observable evidence arrays a claim can be sourced from. */
export type EvidenceChannel = "EXPERIENCE" | "PREFERENCE_LIKE" | "PREFERENCE_DISLIKE" | "ASPIRATION";

/** The output channel a claim was emitted into. */
export type OutputChannel = "EXPERIENCE" | "PREFERENCE" | "DIRECTION";

/**
 * Which evidence channels legitimately support which output channel.
 *
 * `EXPERIENCE` is supported only by experience evidence. Liking work is not doing it, and wanting
 * work is not doing it. `DIRECTION` is supported only by aspiration evidence — a long history is
 * not an ambition, which is the non-implication the whole four-channel contract rests on.
 * `PREFERENCE` is supported by the preference statements.
 */
export const LEGITIMATE_SOURCES: Record<OutputChannel, EvidenceChannel[]> = {
  EXPERIENCE: ["EXPERIENCE"],
  PREFERENCE: ["PREFERENCE_LIKE", "PREFERENCE_DISLIKE"],
  DIRECTION: ["ASPIRATION"],
};

export interface EvidenceEntry {
  id: string;
  channel: EvidenceChannel;
  text: string;
}

/** Every observable evidence sentence for one person, tagged with the channel it came from. */
export function evidenceIndex(person: PlantedFramePerson): EvidenceEntry[] {
  return [
    ...person.experienceEvidence.map((entry) => ({ id: entry.id, channel: "EXPERIENCE" as const, text: entry.text })),
    ...person.preferenceEvidence.map((entry) => ({
      id: entry.id,
      channel: (entry.stance === "LIKE" ? "PREFERENCE_LIKE" : "PREFERENCE_DISLIKE") as EvidenceChannel,
      text: entry.text,
    })),
    ...person.aspirationEvidence.map((entry) => ({ id: entry.id, channel: "ASPIRATION" as const, text: entry.text })),
  ];
}

const tokens = (text: string) => (text.toLowerCase().match(/[a-z]{3,}/g) ?? []);

/**
 * Containment of the quoted phrase in a source sentence.
 *
 * Containment rather than Jaccard because an agent quotes a FRAGMENT: a short accurate quote from a
 * long sentence should score 1.0, and Jaccard would penalise it for the sentence's other words.
 */
function containment(quote: string, source: string): number {
  const quoteTokens = tokens(quote);
  if (!quoteTokens.length) return 0;
  const sourceTokens = new Set(tokens(source));
  let shared = 0;
  for (const token of quoteTokens) if (sourceTokens.has(token)) shared += 1;
  return shared / quoteTokens.length;
}

/** Below this, the quote matches nothing well enough to attribute; treated as unattributable. */
export const ATTRIBUTION_FLOOR = 0.6;
/**
 * The winning source must beat the best source from any OTHER channel by this margin.
 *
 * Necessary because the corpus deliberately plants liked work that overlaps performed work, so the
 * same normalised phrase — "went through it carefully" — appears in both an experience sentence and
 * a preference sentence. Without a margin, provenance would be decided by a coin flip and the
 * resulting rate would be noise presented as a measurement.
 */
export const AMBIGUITY_MARGIN = 0.1;

export type Attribution =
  | { kind: "ATTRIBUTED"; channel: EvidenceChannel; evidenceId: string; score: number }
  | { kind: "AMBIGUOUS"; candidates: EvidenceChannel[]; score: number }
  | { kind: "UNATTRIBUTABLE"; bestScore: number };

export interface AttributionOptions {
  floor?: number;
  margin?: number;
}

/** Attribute one quoted phrase to the evidence channel it most likely came from. */
export function attributeQuote(quote: string, index: EvidenceEntry[], options: AttributionOptions = {}): Attribution {
  const floor = options.floor ?? ATTRIBUTION_FLOOR;
  const margin = options.margin ?? AMBIGUITY_MARGIN;
  const scored = index
    .map((entry) => ({ entry, score: containment(quote, entry.text) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < floor) return { kind: "UNATTRIBUTABLE", bestScore: best?.score ?? 0 };

  const rivalFromOtherChannel = scored.find((candidate) => candidate.entry.channel !== best.entry.channel);
  if (rivalFromOtherChannel && best.score - rivalFromOtherChannel.score < margin) {
    return {
      kind: "AMBIGUOUS",
      candidates: [...new Set([best.entry.channel, rivalFromOtherChannel.entry.channel])],
      score: best.score,
    };
  }
  return { kind: "ATTRIBUTED", channel: best.entry.channel, evidenceId: best.entry.id, score: best.score };
}

export type ChannelErrorKind =
  | "SUPPORTED"
  | "EVIDENCE_CONTAMINATION"
  | "UNSUPPORTED_CLAIM"
  | "AMBIGUOUS_PROVENANCE";

export interface ClaimProvenance {
  outputChannel: OutputChannel;
  /** Evidence channel the quote was attributed to, when attribution succeeded. */
  sourceChannel: EvidenceChannel | null;
  kind: ChannelErrorKind;
  /** True when the agent could not have contaminated from this source, having never seen it. */
  sourceWasVisibleToAgent: boolean;
  score: number;
}

/**
 * Classify one claim.
 *
 * `visibleChannels` is what the agent was actually shown. An isolated agent that never saw
 * preference evidence cannot have taken a claim from it, so a foreign attribution against an
 * invisible channel is recorded with `sourceWasVisibleToAgent: false` and must be read as
 * interpretation drift — or as a limitation of phrase matching — rather than as leakage.
 */
export function classifyChannelError(
  outputChannel: OutputChannel,
  attribution: Attribution,
  visibleChannels: EvidenceChannel[],
): ClaimProvenance {
  const legitimate = LEGITIMATE_SOURCES[outputChannel];
  if (attribution.kind === "UNATTRIBUTABLE") {
    return { outputChannel, sourceChannel: null, kind: "UNSUPPORTED_CLAIM", sourceWasVisibleToAgent: false, score: attribution.bestScore };
  }
  if (attribution.kind === "AMBIGUOUS") {
    // Only ambiguous in a way that matters if the candidates straddle the legitimacy boundary.
    const straddles = attribution.candidates.some((c) => legitimate.includes(c)) && attribution.candidates.some((c) => !legitimate.includes(c));
    return {
      outputChannel,
      sourceChannel: null,
      kind: straddles ? "AMBIGUOUS_PROVENANCE" : "SUPPORTED",
      sourceWasVisibleToAgent: attribution.candidates.some((c) => visibleChannels.includes(c)),
      score: attribution.score,
    };
  }
  const supported = legitimate.includes(attribution.channel);
  return {
    outputChannel,
    sourceChannel: attribution.channel,
    kind: supported ? "SUPPORTED" : "EVIDENCE_CONTAMINATION",
    sourceWasVisibleToAgent: visibleChannels.includes(attribution.channel),
    score: attribution.score,
  };
}

export interface ProvenanceSummary {
  claims: number;
  supported: number;
  /** Claims built from an evidence channel that does not support this output channel. */
  evidenceContamination: number;
  /** Of those, the subset the agent could actually see — genuine leakage rather than drift. */
  evidenceContaminationFromVisibleSource: number;
  /** Foreign attribution against a channel the agent was never shown: drift, not leakage. */
  interpretationDrift: number;
  /** Quotes matching no evidence sentence well enough to attribute. Possible fabrication. */
  unsupportedClaims: number;
  ambiguousProvenance: number;
  /** Contamination as a share of claims in the receiving channel. */
  evidenceContaminationRate: number;
  unsupportedClaimRate: number;
  /** Where the contamination came from, so the failure has a direction and not just a size. */
  bySourceChannel: Record<string, number>;
}

export function summarizeProvenance(rows: ClaimProvenance[]): ProvenanceSummary {
  const contaminated = rows.filter((row) => row.kind === "EVIDENCE_CONTAMINATION");
  const bySourceChannel: Record<string, number> = {};
  for (const row of contaminated) if (row.sourceChannel) bySourceChannel[row.sourceChannel] = (bySourceChannel[row.sourceChannel] ?? 0) + 1;
  const rate = (numerator: number) => (rows.length ? numerator / rows.length : 0);
  return {
    claims: rows.length,
    supported: rows.filter((row) => row.kind === "SUPPORTED").length,
    evidenceContamination: contaminated.length,
    evidenceContaminationFromVisibleSource: contaminated.filter((row) => row.sourceWasVisibleToAgent).length,
    interpretationDrift: contaminated.filter((row) => !row.sourceWasVisibleToAgent).length,
    unsupportedClaims: rows.filter((row) => row.kind === "UNSUPPORTED_CLAIM").length,
    ambiguousProvenance: rows.filter((row) => row.kind === "AMBIGUOUS_PROVENANCE").length,
    evidenceContaminationRate: rate(contaminated.length),
    unsupportedClaimRate: rate(rows.filter((row) => row.kind === "UNSUPPORTED_CLAIM").length),
    bySourceChannel,
  };
}

/** A work item carrying the phrase that supports it. Provenance never reaches the matcher. */
export interface QuotedWork extends StructuredWork {
  evidence?: string;
}

/** Classify every claim an agent emitted into one output channel. */
export function provenanceFor(
  works: QuotedWork[],
  outputChannel: OutputChannel,
  index: EvidenceEntry[],
  visibleChannels: EvidenceChannel[],
  options: AttributionOptions = {},
): ClaimProvenance[] {
  return works.map((work) => classifyChannelError(outputChannel, attributeQuote(work.evidence ?? "", index, options), visibleChannels));
}
