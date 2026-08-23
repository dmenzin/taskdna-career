// Mandatory regression coverage for the available-vs-recognized evidence split
// (readiness-hardening audit, section 4): a missed extractor example must remain in the
// primary metric's denominator and instead show up as reduced extractor recall.
import { describe, expect, it } from "vitest";
import { availabilityForObservations, textContainsAnyPhrase } from "@/lab/evidenceAvailability";
import { diagnosePreference } from "@/lab/iterationMetrics";
import { observationsToProfile } from "@/lab/evaluate";
import { generateOnetSubjects, ONET_LAB_SEED, PREFERENCE_PHRASES } from "@/lab/onetLab";
import type { VirtualSubject, VirtualSubjectObservations } from "@/lab/types";
import { sentenceWorkSignals } from "@/domain/workStructure";

const baseSubject = generateOnetSubjects(ONET_LAB_SEED)[0]!;

function withObservations(subject: VirtualSubject, overrides: Partial<VirtualSubjectObservations>): VirtualSubject {
  return { truth: subject.truth, observations: { ...subject.observations, ...overrides } };
}

describe("evidence availability is defined independently of extractor output", () => {
  it("PREFERENCE_PHRASES for measurable_feedback are not recognized by the current keyword extractor lexicon", () => {
    // This traces hidden truth -> phrase chosen -> generator field text -> extractor
    // recognition for the whole eligible-dimension phrase pool: the extractor's
    // keyword lexicon (src/domain/workStructure.ts) has zero coverage for the exact
    // measurable_feedback phrases the generator places in explicitPreferences /
    // explicitDislikes. Availability must not depend on this recognition gap.
    const [high, low] = PREFERENCE_PHRASES.measurable_feedback;
    for (const phrase of [...high, ...low]) {
      expect(sentenceWorkSignals(phrase)).toEqual({});
    }
  });

  it("labels evidence AVAILABLE from generator-exposed fields even when the extractor recognizes nothing", () => {
    const unrecognizedPhrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!; // "work where I can see the numbers move"
    expect(sentenceWorkSignals(unrecognizedPhrase)).toEqual({});

    const subject = withObservations(baseSubject, { explicitPreferences: [unrecognizedPhrase], explicitDislikes: [] });
    const availability = availabilityForObservations(subject.observations);
    expect(availability.measurable_feedback.available).toBe(true);
    expect(availability.measurable_feedback.availableLike).toBe(true);

    const profile = observationsToProfile(subject);
    const recognizedDimensions = new Set(
      profile.evidence.filter((e) => e.evidenceClass === "PREFERENCE" || e.evidenceClass === "DISLIKE").flatMap((e) => Object.keys(e.inferredTaskDimensions)),
    );
    expect(recognizedDimensions.has("measurable_feedback")).toBe(false);
  });

  it("keeps a generator-exposed-but-extractor-missed dimension in the AVAILABLE_EVIDENCE denominator instead of letting it disappear", () => {
    const unrecognizedPhrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject = withObservations(baseSubject, {
      explicitPreferences: [unrecognizedPhrase],
      explicitDislikes: [],
      resumeText: `${baseSubject.observations.apparentField} role. I enjoy ${unrecognizedPhrase}.`,
    });
    const report = diagnosePreference([subject], [subject]);

    // The example is present in the available-evidence eligible set...
    const measurableFeedbackAvailable = report.byDimension.find((row) => row.id === "measurable_feedback")!;
    expect(measurableFeedbackAvailable.availableCoverage).toBe(1);
    // ...but the extractor did not recognize it...
    expect(measurableFeedbackAvailable.recognizedCoverage).toBe(0);
    // ...so recall drops below 1 (visible, quantified) instead of the subject/dimension
    // vanishing from the primary metric's denominator.
    expect(measurableFeedbackAvailable.availableToRecognizedRecall).toBe(0);
    expect(report.availableEligibleCoverage).toBeGreaterThan(0);
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL).not.toBeNull();
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL!).toBeLessThan(1);

    // Contrast with the superseded, recognition-gated definition: on a single-subject
    // report where recognition fails, its "supported" count would be exactly the failure
    // mode this audit fixes -- the subject would contribute nothing to the legacy
    // recognized-only autonomous coverage for this dimension.
    expect(report.legacySuperseded.autonomousEvidenceCoverage).toBeLessThan(report.availableEligibleCoverage);
  });

  it("never uses hidden truth thresholds directly; only the actual generated observation text", () => {
    // A subject whose hidden truth would make measurable_feedback "eligible" by value,
    // but whose generated observation fields contain no measurable_feedback phrase text,
    // must be labeled unavailable -- availability tracks generator OUTPUT, not the latent
    // truth vector.
    const subject = withObservations(baseSubject, { explicitPreferences: [], explicitDislikes: [] });
    const availability = availabilityForObservations(subject.observations);
    expect(availability.measurable_feedback.available).toBe(false);
  });

  it("phrase matching is unambiguous: no cross-dimension substring collisions", () => {
    const all: { id: string; phrase: string }[] = [];
    for (const [id, [high, low]] of Object.entries(PREFERENCE_PHRASES)) {
      for (const phrase of [...high, ...low]) all.push({ id, phrase });
    }
    for (const a of all) {
      for (const b of all) {
        if (a.phrase === b.phrase) continue;
        expect(textContainsAnyPhrase([b.phrase], [a.phrase])).toBe(false);
      }
    }
  });
});
