// Regression coverage for the extractor-side polarity defect the product benchmark found.
//
// THE DEFECT: "I do not enjoy stakeholder orchestration" was classified PREFERENCE (a LIKE),
// because the bare preference pattern matched `enjoy` and nothing checked for the negator. The
// extractor then produced coordination_preference 8.50 -- the HIGH pole -- for a sentence that
// means the opposite. Measured on the product extraction benchmark, 17 of 48 planted dislike
// statements were read as likes.
//
// This is the extractor-side twin of the generator polarity defect fixed in the scientific
// preflight: the same "behaviour side x stance" rule applies, and a negator flips the stance.
import { describe, expect, it } from "vitest";
import { classifyEvidenceSentence, classifySentence } from "@/domain/evidence";
import { runExtractionBenchmark } from "@/bench/extraction";

/** Read the extractor's coordination_preference signal out of a complete sentence. */
function coordinationSignal(sentence: string) {
  return classifySentence(sentence).preferenceSignals.coordination_preference;
}

describe("negated preference verbs are dislikes", () => {
  it.each([
    "I do not enjoy stakeholder orchestration.",
    "I don't enjoy stakeholder orchestration.",
    "I really do not enjoy coordinating stakeholder activities.",
    "I did not like stakeholder orchestration.",
    "I never liked stakeholder orchestration.",
    "I would rather not spend my week on stakeholder orchestration.",
    "I no longer enjoy stakeholder orchestration.",
    "I am not keen on stakeholder orchestration.",
  ])("classifies %s as DISLIKE", (sentence) => {
    expect(classifyEvidenceSentence(sentence)).toBe("DISLIKE");
  });

  it("moves the predicted dimension to the LOW pole, not the HIGH pole", () => {
    // The whole point: the numeric consequence, not just the label.
    const negated = coordinationSignal("I do not enjoy stakeholder orchestration.");
    expect(negated).toBeDefined();
    expect(negated!).toBeLessThan(5);
    const positive = coordinationSignal("I genuinely enjoy stakeholder orchestration.");
    expect(positive!).toBeGreaterThan(5);
  });

  it("still reads an unnegated preference as a preference", () => {
    for (const sentence of ["I genuinely enjoy stakeholder orchestration.", "I love root-cause investigation.", "Stakeholder orchestration is my favorite part."]) {
      expect(classifyEvidenceSentence(sentence)).toBe("PREFERENCE");
    }
  });

  it("still reads a genuine forward-looking aspiration as aspirational", () => {
    for (const sentence of ["Longer term I want to move into root-cause investigation.", "I hope to do more experimentation.", "My goal is to work on stakeholder orchestration."]) {
      expect(classifyEvidenceSentence(sentence)).toBe("ASPIRATIONAL");
    }
  });

  it("keeps explicit dislike verbs working", () => {
    for (const sentence of ["I avoid stakeholder orchestration.", "The part that drains me is stakeholder orchestration.", "I am not interested in stakeholder orchestration."]) {
      expect(classifyEvidenceSentence(sentence)).toBe("DISLIKE");
    }
  });

  it("does not fire on a negation that is not attached to a preference verb", () => {
    // The negator window is deliberately tight, so an unrelated negation elsewhere in the
    // sentence must not turn a genuine preference into a dislike.
    expect(classifyEvidenceSentence("I enjoy root-cause investigation, though the tooling was not modern.")).toBe("PREFERENCE");
  });
});

describe("product extraction benchmark confirms the fix", () => {
  it("reports zero preference polarity inversions on the planted corpus", () => {
    const report = runExtractionBenchmark({ people: 8, difficulty: "hard" });
    expect(report.contamination.preferencePolarityInversion).toBe(0);
    // The four cross-channel contaminations the architecture exists to prevent.
    expect(report.contamination.dislikeReadAsExperience).toBe(0);
    expect(report.contamination.aspirationReadAsExperience).toBe(0);
    expect(report.contamination.experienceReadAsPreference).toBe(0);
  });

  it("recovers planted dislike statements at full recall", () => {
    const report = runExtractionBenchmark({ people: 8, difficulty: "hard" });
    const dislike = report.classes.find((row) => row.planted === "PREFERENCE_DISLIKE")!;
    expect(dislike.support).toBeGreaterThan(0);
    expect(dislike.recall!).toBe(1);
  });
});
