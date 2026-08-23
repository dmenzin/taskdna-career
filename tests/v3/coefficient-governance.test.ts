import { describe, expect, it } from "vitest";
import { coefficientGovernanceComplete, V3_COEFFICIENT_INVENTORY, V3_GOVERNANCE_STATUSES } from "@/v3/coefficientGovernance";

describe("V3 coefficient governance", () => {
  it("inventories every active coefficient with an explicit non-calibrated status", () => {
    expect(V3_COEFFICIENT_INVENTORY.length).toBeGreaterThanOrEqual(18);
    expect(coefficientGovernanceComplete()).toBe(true);
    for (const record of V3_COEFFICIENT_INVENTORY) {
      expect(V3_GOVERNANCE_STATUSES).toContain(record.status);
      expect(record.status).not.toBe("EMPIRICALLY_JUSTIFIED");
      expect(record.notes.toLowerCase()).not.toMatch(/\bis a calibrated weight\b/);
    }
    expect(V3_COEFFICIENT_INVENTORY.some((record) => record.id === "v3.fit.dwaPartialCredit" && record.status === "PROVISIONAL_BASELINE")).toBe(true);
    expect(V3_COEFFICIENT_INVENTORY.some((record) => record.id === "v3.mapper.reranker" && record.status === "EXPERIMENTAL_DISABLED")).toBe(true);
    expect(V3_COEFFICIENT_INVENTORY.some((record) => record.id === "v3.fit.overallScore" && record.status === "EXPERIMENTAL_DISABLED")).toBe(true);
  });
});
