import { describe, expect, it } from "vitest";
import { DWA_PARTIAL_CREDIT, EXPERIENCE_OWNERSHIP_WEIGHTS, EXPERIENCE_STRENGTH_WEIGHTS, PREFERENCE_SCORE_CENTER, PREFERENCE_SCORE_SPAN, PREFERRED_REQUIREMENT_WEIGHT } from "@/v3/fit";
import { V3_COEFFICIENT_GOVERNANCE, type CoefficientGovernanceStatus } from "@/v3/coefficientGovernance";

const ALLOWED_STATUSES: CoefficientGovernanceStatus[] = ["STRUCTURAL", "PROVISIONAL_BASELINE", "EMPIRICALLY_JUSTIFIED", "UNJUSTIFIED", "EXPERIMENTAL_DISABLED"];
const LIVE_VALUES: Record<string, unknown> = { DWA_PARTIAL_CREDIT, PREFERENCE_SCORE_CENTER, PREFERENCE_SCORE_SPAN, EXPERIENCE_STRENGTH_WEIGHTS, EXPERIENCE_OWNERSHIP_WEIGHTS, PREFERRED_REQUIREMENT_WEIGHT };

describe("V3 coefficient governance registry", () => {
  it("covers every currently exported V3 fit coefficient", () => {
    const registeredIds = new Set(V3_COEFFICIENT_GOVERNANCE.map((r) => r.id));
    for (const id of Object.keys(LIVE_VALUES)) expect(registeredIds.has(id)).toBe(true);
    expect(V3_COEFFICIENT_GOVERNANCE.length).toBe(Object.keys(LIVE_VALUES).length);
  });

  it("never drifts from the live coefficient values in src/v3/fit.ts", () => {
    for (const record of V3_COEFFICIENT_GOVERNANCE) {
      expect(record.value).toEqual(LIVE_VALUES[record.id]);
    }
  });

  it("assigns every coefficient an explicit governance status from the allowed set", () => {
    for (const record of V3_COEFFICIENT_GOVERNANCE) {
      expect(ALLOWED_STATUSES).toContain(record.status);
      expect(record.rationale.length).toBeGreaterThan(20);
    }
  });

  it("never claims a coefficient is EMPIRICALLY_JUSTIFIED without saying so explicitly (no silent calibration claims)", () => {
    for (const record of V3_COEFFICIENT_GOVERNANCE) {
      if (record.status === "EMPIRICALLY_JUSTIFIED") {
        expect(record.rationale.toLowerCase()).toMatch(/estimat|fit to data|empirical/);
      }
    }
  });
});
