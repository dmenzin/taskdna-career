// The metric-contract rule made executable: the loop may not optimize a subsystem without a
// complete contract AND a runnable evaluator. These tests exist specifically to prevent the
// failure mode of registering impressive metric names that nothing behind them can compute.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditContracts, commandResolves, contractReport, REQUIRED_CONTRACT_FIELDS, type Contract } from "../scripts/audit-metric-contracts";

const registry = JSON.parse(readFileSync("config/metric-contracts.json", "utf8")) as { contracts: Contract[] };
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

describe("metric contract registry", () => {
  it("covers all 31 required subsystem rows exactly once", () => {
    expect(registry.contracts).toHaveLength(31);
    expect(registry.contracts.map((contract) => contract.row)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
  });

  it("passes its own audit", () => {
    const report = contractReport();
    expect(report.findings).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("gives every contract all 20 required fields", () => {
    for (const contract of registry.contracts) {
      for (const field of REQUIRED_CONTRACT_FIELDS) {
        expect(contract[field], `row ${contract.row} (${contract.subsystem}) missing ${field}`).toBeDefined();
      }
    }
  });

  it("names a resolvable command for every claimed runnable benchmark", () => {
    for (const contract of registry.contracts.filter((entry) => entry.runnableBenchmarkExists)) {
      expect(contract.runnableCommand, `row ${contract.row} claims runnable but names no command`).toBeTruthy();
      expect(commandResolves(contract.runnableCommand!, packageJson), `row ${contract.row}: ${contract.runnableCommand} does not resolve`).toBe(true);
    }
  });

  it("explicitly excludes every subsystem that has no runnable evaluator", () => {
    for (const contract of registry.contracts.filter((entry) => !entry.runnableBenchmarkExists)) {
      expect(contract.exclusion, `row ${contract.row} (${contract.subsystem}) has no evaluator and no exclusion`).toBeTruthy();
      expect(contract.exclusion!.length).toBeGreaterThan(40);
    }
  });

  it("claims no human gold anywhere, and says so", () => {
    // Every row is autonomous engineering signal only. If this ever changes, the human-validity
    // boundary language in the registry must change with it.
    for (const contract of registry.contracts) expect(contract.humanGoldExists).toBe(false);
    const human = registry.contracts.find((contract) => contract.row === 31)!;
    expect(human.runnableBenchmarkExists).toBe(false);
    expect(human.autonomouslyOptimizable).toBe(false);
    expect(human.exclusion).toMatch(/PERMANENTLY EXCLUDED/);
  });

  it("states a forbidden interpretation and a human-validation boundary for every row", () => {
    for (const contract of registry.contracts) {
      expect(String(contract.forbiddenInterpretation).length, `row ${contract.row}`).toBeGreaterThan(3);
      expect(String(contract.humanValidationBoundary).length, `row ${contract.row}`).toBeGreaterThan(3);
    }
  });

  it("declares the hard difficulty tier as the optimization target", () => {
    const full = JSON.parse(readFileSync("config/metric-contracts.json", "utf8"));
    expect(full.optimizationTarget.difficulty).toBe("hard");
    expect(full.optimizationTarget.minimumPeople).toBeGreaterThanOrEqual(12);
    expect(full.optimizationTarget.rationale).toMatch(/saturates/);
  });

  it("never claims a single overall TaskDNA accuracy number", () => {
    const raw = readFileSync("config/metric-contracts.json", "utf8");
    // "overall TaskDNA accuracy" may only appear as a FORBIDDEN interpretation.
    for (const match of raw.matchAll(/overall TaskDNA accuracy/gi)) {
      const context = raw.slice(Math.max(0, match.index! - 200), match.index!);
      expect(context).toMatch(/forbiddenInterpretation/);
    }
  });
});

describe("the audit rejects incomplete or faked contracts", () => {
  const base = registry.contracts[0]!;

  it("rejects a missing required field", () => {
    const broken = { ...base, primaryMetric: undefined } as unknown as Contract;
    expect(auditContracts([broken], packageJson).some((finding) => finding.rule === "REQUIRED_FIELD")).toBe(true);
  });

  it("rejects a runnable claim with no command", () => {
    const broken = { ...base, runnableBenchmarkExists: true, runnableCommand: null };
    expect(auditContracts([broken], packageJson).some((finding) => finding.rule === "RUNNABLE_COMMAND")).toBe(true);
  });

  it("rejects a runnable claim naming a command that does not exist", () => {
    const broken = { ...base, runnableCommand: "pnpm eval:imaginary-benchmark" };
    expect(auditContracts([broken], packageJson).some((finding) => finding.rule === "RUNNABLE_COMMAND")).toBe(true);
  });

  it("rejects a non-runnable subsystem left optimizable without an exclusion", () => {
    const broken = { ...base, runnableBenchmarkExists: false, runnableCommand: null, runtimeSeconds: null, autonomouslyOptimizable: true, exclusion: undefined };
    const findings = auditContracts([broken as unknown as Contract], packageJson);
    expect(findings.some((finding) => finding.rule === "EXCLUSION")).toBe(true);
  });

  it("rejects duplicate row numbers", () => {
    expect(auditContracts([base, base], packageJson).some((finding) => finding.rule === "UNIQUE_ROW")).toBe(true);
  });

  it("resolves real commands and rejects invented ones", () => {
    expect(commandResolves("pnpm bench:product", packageJson)).toBe(true);
    expect(commandResolves("pnpm exec vitest run tests/bench-traceability.test.ts", packageJson)).toBe(true);
    expect(commandResolves("pnpm exec vitest run tests/does-not-exist.test.ts", packageJson)).toBe(false);
    expect(commandResolves("pnpm totally:made:up", packageJson)).toBe(false);
  });
});
