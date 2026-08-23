import { describe, expect, it } from "vitest";
import { diagnosePreference } from "@/lab/iterationMetrics";
import { generateOnetSubjects, ONET_LAB_SEED, PREFERENCE_PHRASES } from "@/lab/onetLab";
import type { VirtualSubject } from "@/lab/types";

const base = generateOnetSubjects(ONET_LAB_SEED)[0]!;

/**
 * Replace the explicit-preference list on an otherwise preference-free observation set. The
 * narrative and the other lists are cleared so the injected phrases are the ONLY exposed
 * preference language -- otherwise a phrase the generator already placed in `resumeText`
 * would legitimately trip the cross-source duplicate detector and confuse the assertion.
 */
function withExplicitPreferences(subject: VirtualSubject, explicitPreferences: string[]): VirtualSubject {
  return {
    truth: subject.truth,
    observations: {
      ...subject.observations,
      resumeText: "Analyst working in engineering.",
      explicitPreferences,
      explicitDislikes: [],
      contradictoryStatements: [],
    },
  };
}

describe("red-team guardrail: duplicated evidence", () => {
  it("flags a within-field duplicate when a subject repeats the same phrase", () => {
    const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject = withExplicitPreferences(base, [phrase, phrase]);
    const report = diagnosePreference([subject], [subject]);
    expect(report.warnings).toContain("DUPLICATED_EVIDENCE_PHRASES_WITHIN_FIELD");
  });

  it("does not flag a duplicate for two distinct phrases", () => {
    const [feedbackHigh] = PREFERENCE_PHRASES.measurable_feedback;
    const subject = withExplicitPreferences(base, [feedbackHigh[0]!, feedbackHigh[1]!]);
    const report = diagnosePreference([subject], [subject]);
    expect(report.warnings).not.toContain("DUPLICATED_EVIDENCE_PHRASES_WITHIN_FIELD");
    expect(report.warnings).not.toContain("DUPLICATED_EVIDENCE_ACROSS_SOURCES");
  });

  it("flags a cross-source duplicate when one statement is carried by two plumbing paths", () => {
    const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject: VirtualSubject = {
      truth: base.truth,
      observations: {
        ...base.observations,
        resumeText: `Analyst working in engineering. I enjoy ${phrase}.`,
        explicitPreferences: [phrase],
        explicitDislikes: [],
        contradictoryStatements: [],
      },
    };
    const report = diagnosePreference([subject], [subject]);
    expect(report.warnings).toContain("DUPLICATED_EVIDENCE_ACROSS_SOURCES");
  });

  it("the honest generated corpus contains no duplicate of either kind", () => {
    const all = generateOnetSubjects(ONET_LAB_SEED);
    const report = diagnosePreference(all, all);
    expect(report.warnings).not.toContain("DUPLICATED_EVIDENCE_PHRASES_WITHIN_FIELD");
    expect(report.warnings).not.toContain("DUPLICATED_EVIDENCE_ACROSS_SOURCES");
  });
});

describe("red-team guardrail: recognition outside the available set", () => {
  it("reports recognized-but-unavailable as a measured quantity rather than hiding it", () => {
    const all = generateOnetSubjects(ONET_LAB_SEED);
    const report = diagnosePreference(all, all);
    // The extractor's work-structure lexicon fires on exposure vocabulary that happens to sit
    // inside a preference sentence, so it genuinely attributes preference signal to dimensions
    // the generator exposed no preference language for. That is a real extractor property and a
    // live research question, not an attack -- so it must be VISIBLE and QUANTIFIED, never
    // silently folded into the primary metric.
    expect(report.recognizedOutsideAvailableRate).toBeGreaterThanOrEqual(0);
    expect(report.recognizedOutsideAvailableRate).toBeLessThanOrEqual(1);
    // Recall is defined as recognized-AND-available over available, so recognition claims
    // outside the available set can never inflate it above 1.
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL).not.toBeNull();
    expect(report.AVAILABLE_TO_RECOGNIZED_RECALL!).toBeLessThanOrEqual(1);
  });
});
