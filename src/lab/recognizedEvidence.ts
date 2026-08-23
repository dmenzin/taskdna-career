import type { DimensionId, UserEvidence, UserProfile } from "@/domain/types";

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
