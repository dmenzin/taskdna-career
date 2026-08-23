import { describe, expect, it } from "vitest";
import { generateOnetSubjects } from "@/lab/onetLab";
import { eligibilitySensitivityTable } from "@/lab/eligibilitySensitivity";
import { selectEvaluationSplit } from "@/lab/iterationMetrics";
import { ELIGIBILITY_COVERAGE_FLOOR_IS_POLICY, ELIGIBILITY_GENERATOR_COVERAGE_FLOOR } from "@/lab/preferenceTarget";

describe("eligibility coverage policy", () => {
  it("treats the coverage floor as a policy parameter and isolates threshold-only flips", () => {
    expect(ELIGIBILITY_COVERAGE_FLOOR_IS_POLICY).toBe(true);
    expect(ELIGIBILITY_GENERATOR_COVERAGE_FLOOR).toBe(0.10);
    const table = eligibilitySensitivityTable(selectEvaluationSplit(generateOnetSubjects(), "DEVELOPMENT"));
    expect(table.policyFloorIsAssumption).toBe(true);
    expect(table.floors).toEqual([0, 0.05, 0.10, 0.20]);
    const integration = table.rows.find((row) => row.id === "integration_preference")!;
    expect(integration.constructValidForContinuousMae).toBe(true);
    expect(integration.currentMaeEligible).toBe(false);
    expect(integration.classification).toBe("CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE");
    expect(table.dimensionsWhoseEligibilityChangesSolelyFromThreshold.every((row) => row.id === "integration_preference" || row.note.includes("coverage-floor"))).toBe(true);
    for (const row of table.rows.filter((item) => !item.constructValidForContinuousMae)) {
      expect(Object.values(row.eligibilityByFloor).every((eligible) => eligible === false)).toBe(true);
    }
  });
});
