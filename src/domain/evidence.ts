// Evidence-class separation for career text.
//
// EXPOSURE   — "I did X."            → describes work done; NEVER moves preference.
// SUCCESS    — "I performed X well." → capability signal; never moves preference.
// PREFERENCE — "I liked/chose X."    → moves TaskDNA toward the depicted work.
// DISLIKE    — "I hated/avoided X."  → moves TaskDNA away from the depicted work.
// ASPIRATIONAL — "I want X."         → weaker preference-side signal.
// UNKNOWN    — ambiguous             → contributes nothing to preference.
//
// This is the enforcement point for the hard invariant that occupational exposure is
// not preference ground truth.
import type { Vector } from "@/domain/types";
import { sentenceWorkSignals } from "@/domain/workStructure";

export const EVIDENCE_MODEL_VERSION = "evidence-classes.v1";

export type EvidenceClass = "EXPOSURE" | "SUCCESS" | "PREFERENCE" | "DISLIKE" | "ASPIRATIONAL" | "UNKNOWN";

const DISLIKE_PATTERN = /\b(dislike|hate|hated|avoid(?:ed|s)?|drain(?:ed|ing|s)?|dread|burn(?:ed|t)? out|struggl(?:e|ed|ing)|can'?t stand|less interested|not (?:a fan|interested)|aversion|tolerated?\b)/i;
const PREFERENCE_PATTERN = /\b(enjoy(?:ed|s)?|love(?:d|s)?|prefer(?:red|s)?|energi[sz]e[ds]?|thrive[ds]?|drawn to|favorite|liked?\b|chose|sought out|volunteer(?:ed)? for|happiest)/i;
const ASPIRATION_PATTERN = /\b(want(?:s|ed)? (?:to|more)|looking for|hope to|aim(?:ing)? (?:to|for)|longer term|aspire|wish(?:ed)? (?:i|to)|goal is|would rather)/i;
const SUCCESS_PATTERN = /\b(improved|delivered|achieved|led to|reduced|increased|awarded|promoted|recogni[sz]ed|succe(?:ss|eded)|solved|shipped|launched|resolved \d|record results)/i;
const EXPOSURE_PATTERN = /\b(i (?:would|had to|was responsible|managed|worked|built|ran|handled|performed|conducted|analyzed|maintained|prepared)|in this role|my job (?:was|involved)|responsible for|day.?to.?day|worked (?:on|with|in))/i;
// Resume-style bullets that open with an action verb describe exposure, not preference.
const RESUME_BULLET_PATTERN = /^(led|built|managed|designed|developed|conducted|analyzed|analysed|coordinated|maintained|prepared|created|ran|handled|owned|drove|implemented|supported|operated|delivered|wrote|reviewed|investigated|supervised|trained|planned|organized)\b/i;

export function classifyEvidenceSentence(sentence: string): EvidenceClass {
  // Dislike outranks preference so "I say I dislike X, but ..." stays a dislike signal.
  if (DISLIKE_PATTERN.test(sentence)) return "DISLIKE";
  if (ASPIRATION_PATTERN.test(sentence)) return "ASPIRATIONAL";
  if (PREFERENCE_PATTERN.test(sentence)) return "PREFERENCE";
  if (SUCCESS_PATTERN.test(sentence)) return "SUCCESS";
  if (EXPOSURE_PATTERN.test(sentence) || RESUME_BULLET_PATTERN.test(sentence.trim())) return "EXPOSURE";
  return "UNKNOWN";
}

/** Weight applied to a sentence's TaskDNA signals by evidence class. Exposure is 0 by design. */
export const PREFERENCE_SIGNAL_WEIGHT: Record<EvidenceClass, number> = {
  PREFERENCE: 1,
  DISLIKE: 1,
  ASPIRATIONAL: 0.7,
  SUCCESS: 0,
  EXPOSURE: 0,
  UNKNOWN: 0,
};

export interface ClassifiedSignal {
  evidenceClass: EvidenceClass;
  /** Preference-side dimension signals (already inverted for DISLIKE). Empty for non-preference classes. */
  preferenceSignals: Partial<Vector>;
  /** Work-structure content of the sentence regardless of class (exposure vocabulary). */
  workSignals: Partial<Vector>;
  signalWeight: number;
}

export function classifySentence(sentence: string): ClassifiedSignal {
  const evidenceClass = classifyEvidenceSentence(sentence);
  const workSignals = sentenceWorkSignals(sentence);
  const signalWeight = PREFERENCE_SIGNAL_WEIGHT[evidenceClass];
  let preferenceSignals: Partial<Vector> = {};
  if (signalWeight > 0) {
    preferenceSignals = evidenceClass === "DISLIKE" ? invert(workSignals) : { ...workSignals };
  }
  return { evidenceClass, preferenceSignals, workSignals, signalWeight };
}

/**
 * Source-dependence grouping: many bullets from one document/role are one observation
 * stream, not independent samples. Group key drives effective-signal counting.
 */
export function sourceGroupFor(sourceType: string, sourceReference: string): string {
  return `${sourceType}:${sourceReference}`.toLowerCase();
}

function invert(input: Partial<Vector>): Partial<Vector> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, 10 - (value ?? 5)])) as Partial<Vector>;
}
