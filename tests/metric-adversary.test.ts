import { describe, expect, it } from "vitest";
import { generateOnetSubjects } from "@/lab/onetLab";
import { evaluateMetricAttacks } from "@/lab/metricAdversary";
import { preferenceMetricRecords, selectEvaluationSplit } from "@/lab/iterationMetrics";

describe("primary metric anti-Goodhart attacks", () => {
  it("resists extractor gaming or exposes every attack with a guardrail", () => {
    const subjects = selectEvaluationSplit(generateOnetSubjects(), "DEVELOPMENT").slice(0, 40);
    const records = preferenceMetricRecords(subjects, subjects);
    const attacks = evaluateMetricAttacks(records);
    expect(attacks).toHaveLength(8);
    for (const attack of attacks) {
      expect(attack.resistedByPrimary || attack.exposedByGuardrail, attack.id).toBe(true);
    }
    const recognizeFewer = attacks.find((attack) => attack.id === "recognize-fewer")!;
    expect(recognizeFewer.resistedByPrimary).toBe(true);
    expect(recognizeFewer.after.availableToRecognizedRecall).toBeLessThan(recognizeFewer.before.availableToRecognizedRecall);
    const abstain = attacks.find((attack) => attack.id === "abstain")!;
    expect(abstain.resistedByPrimary).toBe(true);
    expect(abstain.after.availableToRecognizedRecall).toBe(0);
  });
});
