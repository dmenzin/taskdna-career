import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId, UserEvidence, UserProfile } from "@/domain/types";
import { PREFERENCE_PHRASES } from "@/lab/onetLab";
import type { VirtualSubject, VirtualSubjectObservations } from "@/lab/types";

/**
 * Evaluation-only availability.
 *
 * AVAILABLE evidence asks: did the generator actually place a dimension-specific
 * preference/dislike phrase into a field the inference path can see?
 *
 * This function may inspect the generator phrase catalog. It must not be used
 * by production inference, and it must not use hidden-truth thresholds alone.
 */
export const GENERIC_FALLBACK_PHRASES = ["work that suits me", "work that drains me"] as const;

/** Fields `observationsToProfile` concatenates into career text / explicit lists. */
export const INFERENCE_VISIBLE_PREFERENCE_FIELDS = [
  "resumeText",
  "explicitPreferences",
  "explicitDislikes",
  "contradictoryStatements",
] as const;

export type InferenceVisiblePreferenceField = (typeof INFERENCE_VISIBLE_PREFERENCE_FIELDS)[number];
export type PreferencePolarity = "preference" | "dislike";

export interface ExposedPreferencePlacement {
  dimensionId: DimensionId;
  polarity: PreferencePolarity;
  phrase: string;
  field: InferenceVisiblePreferenceField;
}

/** v1 lab phrases plus O*NET-lab catalog. Evaluation matching only. */
const V1_PREFERENCE_PHRASES: Partial<Record<DimensionId, [string[], string[]]>> = {
  investigation_orientation: [["root-cause investigation"], ["status coordination"]],
  evidence_density: [["logs and measurements"], ["administrative packets"]],
  coordination_preference: [["stakeholder orchestration"], ["solo deep work"]],
  customer_interaction_preference: [["customer-facing troubleshooting"], ["internal-only analysis"]],
  repetition_tolerance: [["repeatable protocols"], ["novel problem solving"]],
  software_as_tool: [["building tools"], ["hands-on field work"]],
  problem_structure: [["bounded diagnostic problems"], ["open-ended ambiguity"]],
  theory_vs_application: [["applied experiments"], ["abstract modeling"]],
};

export function generatorPreferencePhraseCatalog(): Record<DimensionId, { preference: string[]; dislike: string[] }> {
  return Object.fromEntries(DIMENSION_IDS.map((id) => {
    const onet = PREFERENCE_PHRASES[id];
    const v1 = V1_PREFERENCE_PHRASES[id];
    const preference = uniquePhrases([...(onet?.[0] ?? []), ...(v1?.[0] ?? [])]);
    const dislike = uniquePhrases([...(onet?.[1] ?? []), ...(v1?.[1] ?? [])]);
    return [id, { preference, dislike }];
  })) as Record<DimensionId, { preference: string[]; dislike: string[] }>;
}

export function inferenceVisiblePreferenceTexts(observations: VirtualSubjectObservations): string[] {
  return [
    observations.resumeText,
    ...observations.explicitPreferences,
    ...observations.explicitDislikes,
    ...observations.contradictoryStatements,
  ];
}

export function visiblePreferenceFieldTexts(observations: VirtualSubjectObservations): Record<InferenceVisiblePreferenceField, string[]> {
  return {
    resumeText: observations.resumeText ? [observations.resumeText] : [],
    explicitPreferences: observations.explicitPreferences,
    explicitDislikes: observations.explicitDislikes,
    contradictoryStatements: observations.contradictoryStatements,
  };
}

/** Phrase placements that are visible to inference. Independent of extractor output. */
export function availablePreferencePlacements(subject: VirtualSubject): ExposedPreferencePlacement[] {
  const fields = visiblePreferenceFieldTexts(subject.observations);
  const catalog = generatorPreferencePhraseCatalog();
  const placements: ExposedPreferencePlacement[] = [];
  for (const id of DIMENSION_IDS) {
    for (const polarity of ["preference", "dislike"] as const) {
      for (const phrase of catalog[id][polarity]) {
        if (isGenericFallback(phrase)) continue;
        for (const field of INFERENCE_VISIBLE_PREFERENCE_FIELDS) {
          if (fieldContainsPhrase(fields[field], phrase)) {
            placements.push({ dimensionId: id, polarity, phrase, field });
          }
        }
      }
    }
  }
  return placements;
}

export function availablePreferenceDimensions(subject: VirtualSubject): Set<DimensionId> {
  return new Set(availablePreferencePlacements(subject).map((item) => item.dimensionId));
}

export function recognizedPreferenceEvidence(evidence: UserEvidence[]) {
  return evidence.filter((item) => item.evidenceClass === "PREFERENCE" || item.evidenceClass === "DISLIKE");
}

/** Extractor-recognized dimensions. Depends on decoder/lexicon output. */
export function recognizedPreferenceDimensions(profile: UserProfile): Set<DimensionId> {
  return new Set(
    recognizedPreferenceEvidence(profile.evidence).flatMap((item) => Object.keys(item.inferredTaskDimensions) as DimensionId[]),
  );
}

export function recognizedPreferenceCount(profile: UserProfile, id: DimensionId) {
  return recognizedPreferenceEvidence(profile.evidence).filter((item) => id in item.inferredTaskDimensions).length;
}

function fieldContainsPhrase(texts: string[], phrase: string) {
  const needle = phrase.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(needle));
}

function isGenericFallback(phrase: string) {
  return GENERIC_FALLBACK_PHRASES.some((fallback) => fallback.toLowerCase() === phrase.toLowerCase());
}

function uniquePhrases(phrases: string[]) {
  return [...new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))];
}
