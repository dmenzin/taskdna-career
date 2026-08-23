import { describe, expect, it } from "vitest";
import { diagnosePreference } from "@/lab/iterationMetrics";
import { generateOnetSubjects, ONET_LAB_SEED, PREFERENCE_PHRASES } from "@/lab/onetLab";
import type { VirtualSubject } from "@/lab/types";

const base = generateOnetSubjects(ONET_LAB_SEED)[0]!;

function withExplicitPreferences(subject: VirtualSubject, explicitPreferences: string[]): VirtualSubject {
  return { truth: subject.truth, observations: { ...subject.observations, explicitPreferences } };
}

describe("red-team guardrail: duplicated evidence", () => {
  it("flags DUPLICATED_EVIDENCE_PHRASES when a subject repeats the same phrase", () => {
    const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
    const subject = withExplicitPreferences(base, [phrase, phrase]);
    const report = diagnosePreference([subject], [subject]);
    expect(report.warnings).toContain("DUPLICATED_EVIDENCE_PHRASES");
  });

  it("does not flag DUPLICATED_EVIDENCE_PHRASES for two distinct phrases", () => {
    const [feedbackHigh] = PREFERENCE_PHRASES.measurable_feedback;
    const subject = withExplicitPreferences(base, [feedbackHigh[0]!, feedbackHigh[1]!]);
    const report = diagnosePreference([subject], [subject]);
    expect(report.warnings).not.toContain("DUPLICATED_EVIDENCE_PHRASES");
  });

  it("flags RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE only when recognition outpaces availability, never in the honest baseline", () => {
    const all = generateOnetSubjects(ONET_LAB_SEED);
    const report = diagnosePreference(all, all);
    // In the real (unattacked) pipeline the extractor cannot invent recognition for
    // dimensions the generator never exposed, so this warning must not fire here.
    expect(report.warnings).not.toContain("RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE");
  });
});
