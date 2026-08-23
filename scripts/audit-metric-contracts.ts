// Enforces the metric-contract rule: the autonomous loop may not optimize a product-critical
// subsystem unless that subsystem has a complete contract AND a runnable evaluator.
//
// The failure mode this prevents is faking completeness by registering metric names that have
// no evaluator behind them. A row claiming `runnableBenchmarkExists: true` must name a command
// that actually resolves to a real package script or a real vitest invocation on a file that
// exists.
import { existsSync, readFileSync } from "node:fs";

export const REQUIRED_CONTRACT_FIELDS = [
  "subsystem", "productQuestion", "construct", "predictionOutput", "groundTruth", "observationUnit",
  "aggregation", "scale", "primaryMetric", "mandatoryGuardrails", "datasetSplit", "naiveBaseline",
  "knownFailureModes", "goodhartRisks", "allowedInterpretation", "forbiddenInterpretation",
  "humanValidationBoundary", "runnableBenchmarkExists", "runnableCommand", "runtimeSeconds",
] as const;

export interface Contract {
  row: number;
  subsystem: string;
  runnableBenchmarkExists: boolean;
  runnableCommand: string | null;
  autonomouslyOptimizable: boolean;
  humanGoldExists: boolean;
  blockingGap: boolean;
  exclusion?: string;
  [key: string]: unknown;
}

export interface Finding { row: number; subsystem: string; rule: string; message: string }

/** Does a claimed command actually exist? Package scripts and direct vitest paths only. */
export function commandResolves(command: string, packageJson: { scripts: Record<string, string> }): boolean {
  const trimmed = command.trim();
  const scriptMatch = /^pnpm\s+([a-z0-9:_-]+)/i.exec(trimmed);
  if (scriptMatch && scriptMatch[1] !== "exec" && packageJson.scripts[scriptMatch[1]!]) return true;
  const vitestMatch = /^pnpm\s+exec\s+vitest\s+run\s+(\S+)/.exec(trimmed);
  if (vitestMatch) return existsSync(vitestMatch[1]!);
  const tsxMatch = /^pnpm\s+exec\s+tsx\s+(\S+)/.exec(trimmed);
  if (tsxMatch) return existsSync(tsxMatch[1]!);
  return false;
}

export function auditContracts(contracts: Contract[], packageJson: { scripts: Record<string, string> }): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<number>();
  for (const contract of contracts) {
    const add = (rule: string, message: string) => findings.push({ row: contract.row, subsystem: contract.subsystem, rule, message });
    if (seen.has(contract.row)) add("UNIQUE_ROW", `duplicate row number ${contract.row}`);
    seen.add(contract.row);

    for (const field of REQUIRED_CONTRACT_FIELDS) {
      const value = contract[field];
      if (value === undefined) add("REQUIRED_FIELD", `missing required contract field: ${field}`);
      else if (typeof value === "string" && value.trim().length === 0) add("REQUIRED_FIELD", `empty required contract field: ${field}`);
      else if (Array.isArray(value) && value.length === 0) add("REQUIRED_FIELD", `empty required array field: ${field}`);
    }

    // The core anti-faking rule.
    if (contract.runnableBenchmarkExists) {
      if (!contract.runnableCommand) add("RUNNABLE_COMMAND", "claims a runnable benchmark but names no command");
      else if (!commandResolves(contract.runnableCommand, packageJson)) add("RUNNABLE_COMMAND", `command does not resolve to a real script or file: ${contract.runnableCommand}`);
      if (contract.runtimeSeconds === null || contract.runtimeSeconds === undefined) add("RUNTIME", "claims a runnable benchmark but reports no runtime");
    } else {
      if (contract.runnableCommand) add("RUNNABLE_COMMAND", "no runnable benchmark, but a command is named");
      // A subsystem with no evaluator must be explicitly excluded from the loop rather than
      // silently left optimizable.
      if (contract.autonomouslyOptimizable && !contract.exclusion) add("EXCLUSION", "no runnable benchmark and no explicit exclusion, but marked autonomously optimizable");
      if (!contract.exclusion) add("EXCLUSION", "no runnable benchmark and no explicit exclusion statement");
    }

    // Human-validity honesty.
    if (contract.humanGoldExists && contract.forbiddenInterpretation === "not applicable") {
      add("HUMAN_BOUNDARY", "claims human gold exists but states no interpretation boundary");
    }
  }
  return findings;
}

export function contractReport() {
  const registry = JSON.parse(readFileSync("config/metric-contracts.json", "utf8")) as { version: string; contracts: Contract[] };
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const findings = auditContracts(registry.contracts, packageJson);
  const runnable = registry.contracts.filter((contract) => contract.runnableBenchmarkExists);
  return {
    version: "metric-contract-audit.v1",
    registryVersion: registry.version,
    contracts: registry.contracts.length,
    runnable: runnable.length,
    notRunnable: registry.contracts.length - runnable.length,
    autonomouslyOptimizable: registry.contracts.filter((contract) => contract.autonomouslyOptimizable).length,
    excluded: registry.contracts.filter((contract) => contract.exclusion).map((contract) => ({ row: contract.row, subsystem: contract.subsystem, exclusion: contract.exclusion })),
    withHumanGold: registry.contracts.filter((contract) => contract.humanGoldExists).length,
    blockingGaps: registry.contracts.filter((contract) => contract.blockingGap).map((contract) => ({ row: contract.row, subsystem: contract.subsystem })),
    passed: findings.length === 0,
    findings,
  };
}

if (process.argv[1]?.endsWith("audit-metric-contracts.ts")) {
  const report = contractReport();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.passed) process.exitCode = 1;
}
