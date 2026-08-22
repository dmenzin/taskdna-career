import { describe, expect, it } from "vitest";
import { runLogicInvariants } from "../src/lab/invariants";
import { scanPersonalizationLeakage } from "../src/lab/leakage";

describe("logic invariants", () => {
  it("passes the core computational invariants", () => {
    const result = runLogicInvariants();
    expect(result.checks.filter((check) => !check.pass)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("keeps production engine free of persona-id branching leaks", () => {
    const leakage = scanPersonalizationLeakage();
    expect(leakage.mustFix).toBe(0);
  });
});
