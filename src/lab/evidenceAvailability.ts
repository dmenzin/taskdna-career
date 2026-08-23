// THE canonical evaluation-only availability implementation for the synthetic preference
// metric. Nothing else in the repository may define "available evidence".
//
// WHY THIS EXISTS
// ---------------
// The primary preference metric must not be scoped by what the extractor
// (src/domain/evidence.ts + src/domain/workStructure.ts) happened to recognize, or the
// algorithm under evaluation would decide which observations count in its own metric -- a
// selection-bias/Goodhart path. Availability is therefore computed from the generated
// observation TEXT alone.
//
// WHAT CHANGED IN THIS REVISION
// -----------------------------
// 1. Field scope. The previous version looked only at `explicitPreferences` and
//    `explicitDislikes`, so preference language the inference system genuinely receives via
//    `resumeText` and `contradictoryStatements` was excluded from the denominator. All four
//    inference-visible fields are now read; INFERENCE_VISIBLE_PREFERENCE_FIELDS is asserted
//    against what src/lab/evaluate.ts actually passes to the engine
//    (tests/available-evidence.test.ts).
// 2. Semantic stance. The previous version treated "a low-side phrase appears in
//    explicitDislikes" as low-side evidence. That is wrong: "I avoid solo deep work" is a
//    dislike of LOW-side behaviour and therefore means HIGH. Availability now resolves each
//    placement's stance from the surrounding construction (or from the list it sits in) and
//    reports the direction the language actually MEANS, via
//    src/lab/preferenceSemantics.ts.
//
// PROPERTIES THIS MODULE MUST KEEP
// --------------------------------
//  - extractor-independent: imports nothing from src/domain/{evidence,engine,workStructure}
//  - hidden-truth-independent for INCLUSION: truth is never consulted to decide whether a
//    dimension is available (it is only compared afterwards, by the polarity audit)
//  - based on exposed language, not generator metadata: placements are recovered by reading
//    the rendered text, so a generator that emits backwards language cannot assert its way
//    to a correct label
//  - not shrinkable by the model under evaluation: the denominator is fixed before the
//    extractor runs
import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { ALL_GENERATOR_PHRASES, GENERIC_FALLBACK_PHRASES, type PreferencePhraseCatalog } from "@/lab/preferencePhrases";
import {
  intendedDirection,
  stanceFromText,
  type PreferenceDirection,
  type PreferenceStance,
} from "@/lab/preferenceSemantics";
import type { VirtualSubject, VirtualSubjectObservations } from "@/lab/types";

export const EVIDENCE_AVAILABILITY_VERSION = "evidence-availability.v2-stance-aware";

/**
 * The observation fields the inference system actually receives. Kept in sync with
 * src/lab/evaluate.ts `observationsToProfile` by an assertion in
 * tests/available-evidence.test.ts -- if the evaluation path starts or stops passing a
 * field, that test fails rather than the denominator silently drifting.
 */
export const INFERENCE_VISIBLE_PREFERENCE_FIELDS = ["resumeText", "explicitPreferences", "explicitDislikes", "contradictoryStatements"] as const;
export type InferenceVisiblePreferenceField = (typeof INFERENCE_VISIBLE_PREFERENCE_FIELDS)[number];

/** List fields whose membership itself declares the stance of a bare phrase. */
const FIELD_IMPLIED_STANCE: Partial<Record<InferenceVisiblePreferenceField, PreferenceStance>> = {
  explicitPreferences: "LIKE",
  explicitDislikes: "DISLIKE",
};

export interface PreferencePlacement {
  dimensionId: DimensionId;
  field: InferenceVisiblePreferenceField;
  /** The statement unit (sentence or list entry) the phrase was found in. */
  unit: string;
  phrase: string;
  /** Pole of the dimension the matched phrase describes. */
  behaviorSide: PreferenceDirection;
  /** Stance read from the surrounding construction, or implied by the list field. */
  stance: PreferenceStance;
  /** intendedDirection(behaviorSide, stance): what this placement MEANS. */
  meaning: PreferenceDirection;
}

export interface DimensionAvailability {
  id: DimensionId;
  /** The exposed language means the person leans toward the HIGH pole. */
  availableHigh: boolean;
  /** The exposed language means the person leans toward the LOW pole. */
  availableLow: boolean;
  /** Some directional preference language for this dimension was exposed. */
  available: boolean;
  /** Both directions were exposed for the same dimension (genuinely mixed evidence). */
  conflicting: boolean;
  placements: PreferencePlacement[];
  /**
   * Back-compatible aliases. `availableLike` means "a LIKE-stance placement exists"; it is
   * NOT the same as `availableHigh`, because a LIKE of low-side behaviour means LOW.
   */
  availableLike: boolean;
  availableDislike: boolean;
}

/**
 * Exact (case-insensitive) substring match of a known phrase inside generated text. Shared
 * by every consumer so they agree on what "the generator exposed this phrase" means.
 */
export function textContainsAnyPhrase(haystacks: readonly string[], phrases: readonly string[]): boolean {
  return haystacks.some((text) => phrases.some((phrase) => text.toLowerCase().includes(phrase.toLowerCase())));
}

/** Inference-visible text per field, split into the statement units stance is read from. */
export function visiblePreferenceUnits(observations: VirtualSubjectObservations): Record<InferenceVisiblePreferenceField, string[]> {
  return {
    resumeText: splitSentences(observations.resumeText),
    explicitPreferences: [...observations.explicitPreferences],
    explicitDislikes: [...observations.explicitDislikes],
    contradictoryStatements: observations.contradictoryStatements.flatMap(splitSentences),
  };
}

/**
 * Every dimension-bearing preference placement the generator exposed, with the direction
 * each one means. Independent of the extractor and of the hidden truth.
 */
export function preferencePlacements(
  observations: VirtualSubjectObservations,
  catalog: PreferencePhraseCatalog = ALL_GENERATOR_PHRASES,
): PreferencePlacement[] {
  const units = visiblePreferenceUnits(observations);
  const placements: PreferencePlacement[] = [];
  for (const field of INFERENCE_VISIBLE_PREFERENCE_FIELDS) {
    for (const unit of units[field]) {
      if (isGenericFallbackOnly(unit)) continue;
      const stance = stanceFromText(unit) ?? FIELD_IMPLIED_STANCE[field] ?? null;
      if (!stance) continue;
      for (const id of DIMENSION_IDS) {
        for (const behaviorSide of ["HIGH", "LOW"] as const) {
          for (const phrase of catalog[id][behaviorSide === "HIGH" ? 0 : 1]) {
            if (!unit.toLowerCase().includes(phrase.toLowerCase())) continue;
            placements.push({ dimensionId: id, field, unit, phrase, behaviorSide, stance, meaning: intendedDirection(behaviorSide, stance) });
          }
        }
      }
    }
  }
  return dedupePlacements(placements);
}

/** Per-dimension availability for one subject's actually-generated observation fields. */
export function availabilityForObservations(
  observations: VirtualSubjectObservations,
  catalog: PreferencePhraseCatalog = ALL_GENERATOR_PHRASES,
): Record<DimensionId, DimensionAvailability> {
  const all = preferencePlacements(observations, catalog);
  const entries = DIMENSION_IDS.map((id) => {
    const placements = all.filter((placement) => placement.dimensionId === id);
    const availableHigh = placements.some((placement) => placement.meaning === "HIGH");
    const availableLow = placements.some((placement) => placement.meaning === "LOW");
    return [id, {
      id,
      availableHigh,
      availableLow,
      available: availableHigh || availableLow,
      conflicting: availableHigh && availableLow,
      placements,
      availableLike: placements.some((placement) => placement.stance === "LIKE"),
      availableDislike: placements.some((placement) => placement.stance === "DISLIKE"),
    }] as const;
  });
  return Object.fromEntries(entries) as Record<DimensionId, DimensionAvailability>;
}

export function availabilityForSubject(subject: VirtualSubject): Record<DimensionId, DimensionAvailability> {
  return availabilityForObservations(subject.observations);
}

/**
 * Net exposed direction for a dimension: +1 when only HIGH-meaning language was exposed,
 * -1 when only LOW-meaning language was, 0 when nothing or both. This is the quantity the
 * generator polarity/monotonicity audit correlates against hidden truth.
 */
export function exposedDirectionSignal(availability: DimensionAvailability): number {
  return Number(availability.availableHigh) - Number(availability.availableLow);
}

/**
 * Exact-normalized duplicate detection across observable sources. Two placements of the
 * same (dimension, phrase, meaning) in DIFFERENT fields are the same underlying statement
 * reaching the inference system twice through two plumbing paths.
 */
export function crossSourceDuplicatePlacements(observations: VirtualSubjectObservations): PreferencePlacement[][] {
  const groups = new Map<string, PreferencePlacement[]>();
  for (const placement of preferencePlacements(observations)) {
    const key = `${placement.dimensionId}|${normalize(placement.phrase)}|${placement.meaning}`;
    groups.set(key, [...(groups.get(key) ?? []), placement]);
  }
  return [...groups.values()].filter((group) => new Set(group.map((placement) => placement.field)).size > 1);
}

/** Exact-normalized duplicate statement units within a single field. */
export function withinFieldDuplicateUnits(observations: VirtualSubjectObservations): { field: InferenceVisiblePreferenceField; unit: string }[] {
  const units = visiblePreferenceUnits(observations);
  return INFERENCE_VISIBLE_PREFERENCE_FIELDS.flatMap((field) => {
    const seen = new Set<string>();
    return units[field].flatMap((unit) => {
      const key = normalize(unit);
      if (!key) return [];
      if (seen.has(key)) return [{ field, unit }];
      seen.add(key);
      return [];
    });
  });
}

function dedupePlacements(placements: PreferencePlacement[]): PreferencePlacement[] {
  const seen = new Set<string>();
  return placements.filter((placement) => {
    const key = `${placement.dimensionId}|${placement.field}|${normalize(placement.unit)}|${normalize(placement.phrase)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isGenericFallbackOnly(unit: string) {
  const normalized = normalize(unit);
  return Object.values(GENERIC_FALLBACK_PHRASES).some((phrase) => normalized === normalize(phrase));
}

function splitSentences(text: string): string[] {
  return text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
