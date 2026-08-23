// Canonical semantics for every generated preference statement in the synthetic lab.
//
// THE DEFECT THIS MODULE FIXES
// ----------------------------
// The pre-fix generator selected a LOW-side behaviour phrase for a LOW hidden truth and
// then placed it inside a DISLIKE construction ("I avoid solo deep work",
// explicitDislikes: ["solo deep work"]). The extractor correctly inverts a dislike, so a
// LOW truth produced a HIGH prediction. Measured on the DEVELOPMENT split before the fix:
// mean hidden truth 2.68 versus mean prediction 5.64 over 261 such placements, and
// directional accuracy 0.147 -- worse than chance. The generated language was semantically
// backwards, not the decoder.
//
// THE RULE
// --------
// A preference statement has three independent parts:
//
//   dimension        which TaskDNA dimension the statement is about
//   behaviour side   which POLE of that dimension the phrase describes (HIGH or LOW)
//   stance           whether the person LIKES or DISLIKES that behaviour
//
// The preference direction the statement actually MEANS is a function of the last two:
//
//   LIKE    + HIGH-side behaviour  ->  HIGH
//   DISLIKE + LOW-side  behaviour  ->  HIGH
//   LIKE    + LOW-side  behaviour  ->  LOW
//   DISLIKE + HIGH-side behaviour  ->  LOW
//
// So a HIGH hidden truth may be expressed as "I enjoy <high-side>" or "I avoid <low-side>",
// and a LOW hidden truth as "I enjoy <low-side>" or "I avoid <high-side>". Any other
// pairing is semantically backwards and is only permitted for an explicitly flagged
// adversarial case (`adversarialPolarityInversion`).
//
// This module is lab/evaluation infrastructure. It defines what the generator MEANT and
// what a reader of the generated text SHOULD conclude. It must never import production
// inference code (src/domain/evidence.ts, engine.ts, workStructure.ts) so that the
// availability evaluator built on top of it stays extractor-independent.
import type { DimensionId, Vector } from "@/domain/types";
import type { Rng } from "@/lab/rng";

export const PREFERENCE_SEMANTICS_VERSION = "preference-semantics.v1";

/** Which pole of the dimension a phrase describes. */
export type BehaviorSide = "HIGH" | "LOW";
/** Whether the person likes or dislikes the described behaviour. */
export type PreferenceStance = "LIKE" | "DISLIKE";
/** The preference direction a statement means once side and stance are combined. */
export type PreferenceDirection = "HIGH" | "LOW";

/**
 * The four distinct observable sources a generated preference statement can occupy. One
 * underlying statement is placed in exactly ONE source so a single piece of evidence can
 * never be counted twice through two plumbing paths.
 */
export const PREFERENCE_EVIDENCE_SOURCES = [
  "RESUME_NARRATIVE",
  "EXPLICIT_PREFERENCE_LIST",
  "EXPLICIT_DISLIKE_LIST",
  "CONTRADICTORY_STATEMENT",
] as const;
export type PreferenceEvidenceSource = (typeof PREFERENCE_EVIDENCE_SOURCES)[number];

/** Natural-language frame used to render a statement into the career narrative. */
export type PreferenceConstruction =
  | "ENJOY"
  | "ASPIRATION"
  | "AVOID"
  | "STRUGGLE"
  | "BURNOUT"
  | "CLAIMED_DISLIKE_WITH_EXPOSURE"
  | "BARE_LIST_ENTRY";

/** Constructions whose stance is LIKE (including the weaker aspirational form). */
export const LIKE_CONSTRUCTIONS: PreferenceConstruction[] = ["ENJOY", "ASPIRATION"];
/** Constructions whose stance is DISLIKE. */
export const DISLIKE_CONSTRUCTIONS: PreferenceConstruction[] = ["AVOID", "STRUGGLE", "BURNOUT", "CLAIMED_DISLIKE_WITH_EXPOSURE"];

/**
 * The single semantic rule. Everything else in the lab -- generator, availability
 * evaluator, monotonicity audit, regression tests -- derives direction from here so they
 * can never disagree about what a statement means.
 */
export function intendedDirection(behaviorSide: BehaviorSide, stance: PreferenceStance): PreferenceDirection {
  if (stance === "LIKE") return behaviorSide;
  return behaviorSide === "HIGH" ? "LOW" : "HIGH";
}

/** The behaviour side a statement must describe to mean `direction` under `stance`. */
export function behaviorSideFor(direction: PreferenceDirection, stance: PreferenceStance): BehaviorSide {
  return stance === "LIKE" ? direction : direction === "HIGH" ? "LOW" : "HIGH";
}

/**
 * Truth thresholds at which the generator considers a dimension expressible. These are
 * evaluation-design parameters carried over unchanged from the pre-fix generator; moving
 * them would change the metric contract, not the decoder.
 */
export const EXPRESSIBLE_HIGH_TRUTH_FLOOR = 6.5;
export const EXPRESSIBLE_LOW_TRUTH_CEILING = 4;

/** Which direction the hidden truth points, or null when the dimension is too neutral to express. */
export function truthDirection(value: number): PreferenceDirection | null {
  if (value >= EXPRESSIBLE_HIGH_TRUTH_FLOOR) return "HIGH";
  if (value <= EXPRESSIBLE_LOW_TRUTH_CEILING) return "LOW";
  return null;
}

export interface PreferenceStatement {
  dimensionId: DimensionId;
  /** Pole of the dimension the phrase describes. */
  behaviorSide: BehaviorSide;
  stance: PreferenceStance;
  /** intendedDirection(behaviorSide, stance) -- what the sentence MEANS. */
  intendedDirection: PreferenceDirection;
  /** Direction implied by the hidden truth. Equals intendedDirection unless deliberately inverted. */
  truthDirection: PreferenceDirection;
  phrase: string;
  construction: PreferenceConstruction;
  /** The complete generated natural-language statement a reader actually sees. */
  text: string;
  source: PreferenceEvidenceSource;
  /** True only for a deliberately backwards adversarial case. Never true in the default corpus. */
  adversarialPolarityInversion: boolean;
}

/** Render a phrase into a complete natural-language statement for the given construction. */
export function renderStatement(construction: PreferenceConstruction, phrase: string, context?: { workContext?: string }): string {
  switch (construction) {
    case "ENJOY":
      return `I enjoy ${phrase}.`;
    case "ASPIRATION":
      return `Longer term I want more of ${phrase} than my current role gives me.`;
    case "AVOID":
      return `I avoid ${phrase}.`;
    case "STRUGGLE":
      return `Struggled with ${phrase} even when the team called it a success.`;
    case "BURNOUT":
      return `Burned out on ${context?.workContext ?? "the daily grind"} and the parts of the job that felt like ${phrase}.`;
    case "CLAIMED_DISLIKE_WITH_EXPOSURE":
      return `Claims to dislike ${phrase} while reporting paid success doing it.`;
    case "BARE_LIST_ENTRY":
      return phrase;
  }
}

/** Stance implied by a construction. `BARE_LIST_ENTRY` takes its stance from the list it sits in. */
export function stanceForConstruction(construction: PreferenceConstruction): PreferenceStance | null {
  if (LIKE_CONSTRUCTIONS.includes(construction)) return "LIKE";
  if (DISLIKE_CONSTRUCTIONS.includes(construction)) return "DISLIKE";
  return null;
}

// ---------------------------------------------------------------------------
// Evaluation-only stance reader
// ---------------------------------------------------------------------------

/**
 * Stance markers used by the EVALUATION side to read a generated sentence's stance back
 * out of the text. Deliberately a separate, smaller lexicon from the production
 * extractor's (src/domain/evidence.ts): the availability evaluator must not inherit the
 * extractor's recognition behaviour, or the primary metric's denominator would once again
 * depend on the algorithm under test.
 *
 * Dislike is checked first so "I say I dislike X, but I also spent a year doing it" reads
 * as a dislike rather than as the exposure clause that follows it.
 */
export const EVALUATION_DISLIKE_MARKERS = /\b(?:avoid|avoids|avoided|dislike|dislikes|disliked|hate|hates|hated|drain|drains|drained|draining|dread|dreads|dreaded|burned out|burnt out|struggle|struggled|struggling|can'?t stand|cannot stand|aversion|less interested|not interested|not a fan)\b/i;
export const EVALUATION_LIKE_MARKERS = /\b(?:enjoy|enjoys|enjoyed|like|likes|liked|love|loves|loved|prefer|prefers|preferred|energi[sz]ed|thrive|thrives|thrived|drawn to|favorite|favourite|sought out|volunteered for|happiest|want more of|want to do more|looking for more|hope to do more|aspire to)\b/i;

/** Read the stance a generated sentence expresses, or null when it expresses neither. */
export function stanceFromText(text: string): PreferenceStance | null {
  if (EVALUATION_DISLIKE_MARKERS.test(text)) return "DISLIKE";
  if (EVALUATION_LIKE_MARKERS.test(text)) return "LIKE";
  return null;
}

// ---------------------------------------------------------------------------
// Unbiased dimension selection
// ---------------------------------------------------------------------------

/**
 * Deterministic seeded Fisher-Yates shuffle. Used to remove the positional sampling bias
 * of the pre-fix generator, which did `DIMENSION_IDS.filter(...).slice(0, N)` and so gave
 * dimensions near the front of DIMENSION_IDS systematically more exposure.
 */
export function seededShuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

export interface ExpressibleDimension {
  dimensionId: DimensionId;
  direction: PreferenceDirection;
}

/**
 * Every dimension whose hidden truth is far enough from neutral to be expressible. This
 * is the SELECTION OPPORTUNITY set: the denominator for the positional-bias diagnostic in
 * src/lab/generatorBias.ts. Returned in DIMENSION_IDS order; callers must shuffle before
 * truncating.
 */
export function expressibleDimensions(truth: Vector, dimensionIds: readonly DimensionId[]): ExpressibleDimension[] {
  return dimensionIds.flatMap((dimensionId) => {
    const direction = truthDirection(truth[dimensionId]);
    return direction ? [{ dimensionId, direction }] : [];
  });
}
