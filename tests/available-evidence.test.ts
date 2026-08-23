// Mandatory regression coverage for the available-vs-recognized evidence split
// (readiness-hardening audit, section 4): a missed extractor example must remain in the
// primary metric's denominator and instead show up as reduced extractor recall.
import { describe, expect, it } from "vitest";
import { availabilityForObservations, textContainsAnyPhrase } from "@/lab/evidenceAvailability";
import { ALL_GENERATOR_PHRASES } from "@/lab/preferencePhrases";
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
    // truth vector. Every inference-visible field must be cleared, because availability is
    // now read from all four of them, not just the two explicit lists.
    const subject = withObservations(baseSubject, {
      resumeText: "Analyst working in engineering.",
      explicitPreferences: [],
      explicitDislikes: [],
      contradictoryStatements: [],
    });
    const availability = availabilityForObservations(subject.observations);
    expect(availability.measurable_feedback.available).toBe(false);
  });

  it("counts preference language the inference system receives via resumeText, not only the explicit lists", () => {
    // The previous availability definition read only explicitPreferences/explicitDislikes,
    // so evidence the engine genuinely receives through the career narrative was excluded
    // from the primary denominator. It must be included.
    const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject = withObservations(baseSubject, {
      resumeText: `Analyst working in engineering. I enjoy ${phrase}.`,
      explicitPreferences: [],
      explicitDislikes: [],
      contradictoryStatements: [],
    });
    const availability = availabilityForObservations(subject.observations);
    expect(availability.measurable_feedback.available).toBe(true);
    expect(availability.measurable_feedback.availableHigh).toBe(true);
    expect(availability.measurable_feedback.placements.map((placement) => placement.field)).toEqual(["resumeText"]);
  });

  it("counts preference language exposed only through contradictoryStatements", () => {
    const phrase = PREFERENCE_PHRASES.measurable_feedback[1][0]!;
    const subject = withObservations(baseSubject, {
      resumeText: "Analyst working in engineering.",
      explicitPreferences: [],
      explicitDislikes: [],
      contradictoryStatements: [`Claims to dislike ${phrase} while reporting paid success doing it.`],
    });
    const availability = availabilityForObservations(subject.observations);
    // Dislike of the LOW-side behaviour means the person leans HIGH.
    expect(availability.measurable_feedback.available).toBe(true);
    expect(availability.measurable_feedback.availableHigh).toBe(true);
    expect(availability.measurable_feedback.availableLow).toBe(false);
  });

  it("resolves stance, not phrase location: the same phrase means opposite things in the two lists", () => {
    const lowSidePhrase = PREFERENCE_PHRASES.measurable_feedback[1][0]!;
    const cleared = { resumeText: "Analyst working in engineering.", contradictoryStatements: [] };
    const liked = availabilityForObservations(
      withObservations(baseSubject, { ...cleared, explicitPreferences: [lowSidePhrase], explicitDislikes: [] }).observations,
    );
    const disliked = availabilityForObservations(
      withObservations(baseSubject, { ...cleared, explicitPreferences: [], explicitDislikes: [lowSidePhrase] }).observations,
    );
    // LIKE + LOW-side means LOW; DISLIKE + LOW-side means HIGH. The pre-fix definition
    // labelled both of these as low-side evidence.
    expect(liked.measurable_feedback.availableLow).toBe(true);
    expect(liked.measurable_feedback.availableHigh).toBe(false);
    expect(disliked.measurable_feedback.availableHigh).toBe(true);
    expect(disliked.measurable_feedback.availableLow).toBe(false);
  });

  it("ignores text that names a behaviour without expressing any stance", () => {
    const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject = withObservations(baseSubject, {
      resumeText: `Analyst working in engineering. In this role I would report on ${phrase}.`,
      explicitPreferences: [],
      explicitDislikes: [],
      contradictoryStatements: [],
    });
    expect(availabilityForObservations(subject.observations).measurable_feedback.available).toBe(false);
  });

  it("phrase matching is unambiguous: no cross-dimension or cross-side substring collisions", () => {
    // Checked over the UNION catalog the availability reader actually matches against, so a
    // legacy-lab phrase cannot silently alias an O*NET-lab phrase for another dimension or
    // the opposite pole. Same-dimension, same-side nesting (e.g. "abstract modeling" inside
    // "abstract modeling and theory") is harmless and permitted.
    const all: { id: string; side: number; phrase: string }[] = [];
    for (const [id, [high, low]] of Object.entries(ALL_GENERATOR_PHRASES)) {
      for (const phrase of high) all.push({ id, side: 0, phrase });
      for (const phrase of low) all.push({ id, side: 1, phrase });
    }
    for (const a of all) {
      for (const b of all) {
        if (a.phrase === b.phrase) continue;
        if (a.id === b.id && a.side === b.side) continue;
        expect(textContainsAnyPhrase([b.phrase], [a.phrase])).toBe(false);
      }
    }
  });
});
