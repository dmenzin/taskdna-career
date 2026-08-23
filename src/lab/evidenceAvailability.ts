// Evaluation-only availability signal for the synthetic preference decoder metric.
//
// PROBLEM THIS FILE SOLVES: the primary preference metric must not be defined from
// what the extractor (src/domain/evidence.ts, src/domain/workStructure.ts) happened to
// recognize, because the algorithm under evaluation would then influence which
// observations count in its own metric (a Goodhart/selection-bias path). We need a
// notion of evidence AVAILABILITY that is computed purely from what the observation
// GENERATOR placed in fields visible to the inference system
// (VirtualSubjectObservations.explicitPreferences / explicitDislikes), independent of
// whether the extractor later recognized it.
//
// This module is evaluation-only. It may read generator/lab internals (PREFERENCE_PHRASES)
// because it exists to grade the lab, but it must NEVER be imported by production
// inference code (src/domain/**). Availability is derived strictly from the same
// generated observation text the inference pipeline receives -- never from the hidden
// truth vector directly -- so it cannot leak un-observable information into predictions.
import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { PREFERENCE_PHRASES } from "@/lab/onetLab";
import type { VirtualSubject, VirtualSubjectObservations } from "@/lab/types";

export const EVIDENCE_AVAILABILITY_VERSION = "evidence-availability.v1";

export interface DimensionAvailability {
  id: DimensionId;
  /** The generator placed a high-pole (LIKE-side) phrase for this dimension in explicitPreferences. */
  availableLike: boolean;
  /** The generator placed a low-pole (DISLIKE-side) phrase for this dimension in explicitDislikes. */
  availableDislike: boolean;
  /** availableLike || availableDislike: the generator exposed *some* directional preference/dislike evidence. */
  available: boolean;
}

/**
 * Exact (case-insensitive) substring match of a known phrase inside generated text.
 * Shared by the availability evaluator and the generator-monotonicity auditor so both
 * agree on what "the generator exposed this phrase" means. `PREFERENCE_PHRASES` has no
 * duplicate or substring-colliding entries across dimensions/directions (see
 * tests/evidence-availability.test.ts), so this containment check is unambiguous.
 */
export function textContainsAnyPhrase(haystacks: readonly string[], phrases: readonly string[]): boolean {
  return haystacks.some((text) => phrases.some((phrase) => text.toLowerCase().includes(phrase.toLowerCase())));
}

/** Per-dimension availability for one subject's actually-generated observation fields. */
export function availabilityForObservations(observations: VirtualSubjectObservations): Record<DimensionId, DimensionAvailability> {
  const entries = DIMENSION_IDS.map((id) => {
    const [highPhrases, lowPhrases] = PREFERENCE_PHRASES[id];
    const availableLike = textContainsAnyPhrase(observations.explicitPreferences, highPhrases);
    const availableDislike = textContainsAnyPhrase(observations.explicitDislikes, lowPhrases);
    return [id, { id, availableLike, availableDislike, available: availableLike || availableDislike }] as const;
  });
  return Object.fromEntries(entries) as Record<DimensionId, DimensionAvailability>;
}

export function availabilityForSubject(subject: VirtualSubject): Record<DimensionId, DimensionAvailability> {
  return availabilityForObservations(subject.observations);
}
