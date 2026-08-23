// Micro-tuning guard for the autonomous run.
//
// PROBLEM: an 8-hour loop can degenerate into a hundred tiny redundant tweaks --
// 0.60 -> 0.62 -> 0.64 -> 0.66 -- that produce no trustworthy information while major
// architectural questions stay unresolved. This script makes that pattern a hard failure
// rather than a matter of discipline.
//
// It validates every experiment record in experiments/records/ against three rules:
//
//  1. DECLARATION. Every record declares WORKSTREAM, EXPECTED INFORMATION VALUE, SCOPE, and
//     MECHANISM, and the workstream must exist in config/research-portfolio.json.
//  2. ANTI-REPETITION. After two consecutive experiments on substantially the same mechanism,
//     a third requires a written justification for why it beats switching workstreams.
//  3. PREREGISTERED PARAMETER SEARCH. An experiment whose mechanism is threshold/coefficient/
//     regex/keyword/prompt nudging must carry an explicit PARAMETER SEARCH PREREGISTERED
//     declaration. Incremental hill climbing without one is rejected.
//
// Records are ordered by their preregistered timestamp, so "consecutive" means consecutive in
// experiment order, not alphabetical order.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RECORDS_DIR = "experiments/records";
const PORTFOLIO_PATH = "config/research-portfolio.json";

interface Portfolio {
  antiRepetitionRule: { maxConsecutiveExperimentsPerMechanism: number; forbiddenWithoutPreregisteredParameterSearch: string[] };
  informationValues: string[];
  scopes: string[];
  workstreams: { id: number; name: string }[];
}

export interface RecordFields {
  id: string;
  path: string;
  timestamp: string | null;
  workstream: string | null;
  informationValue: string | null;
  scope: string | null;
  mechanism: string | null;
  parameterSearchPreregistered: boolean;
  repeatJustification: string | null;
  decision: string | null;
}

/** Read one labelled field out of an experiment record's markdown bullets. */
function field(text: string, label: string): string | null {
  const match = new RegExp(`^-\\s*${label}\\s*:\\s*(.*)$`, "im").exec(text);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

export function readRecord(id: string, path: string): RecordFields {
  const text = readFileSync(path, "utf8");
  return {
    id,
    path,
    timestamp: field(text, "Timestamp"),
    workstream: field(text, "Workstream"),
    informationValue: field(text, "Expected information value"),
    scope: field(text, "Scope"),
    mechanism: field(text, "Mechanism being tested"),
    parameterSearchPreregistered: /^-\s*Parameter search preregistered\s*:\s*(yes|true)\b/im.test(text),
    repeatJustification: field(text, "Repeat justification"),
    decision: field(text, "Decision"),
  };
}

/**
 * Normalize a mechanism description so trivially reworded restatements of the same mechanism
 * collide. Deliberately aggressive: the guard should err toward flagging repetition.
 */
export function mechanismKey(mechanism: string): string {
  return mechanism
    .toLowerCase()
    .replace(/\b(the|a|an|of|to|for|in|on|by|with|and|or|is|are|be|its|their|this|that)\b/g, " ")
    .replace(/\b(tweak|tweaking|nudge|nudging|adjust|adjusting|tune|tuning|change|changing|increase|decrease|raise|lower|bump)\b/g, " ")
    .replace(/[0-9.]+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
}

const MICRO_TUNING_MECHANISM = /threshold|coefficient|weight|regex|keyword|lexicon entr|prompt variant|multiplier|constant|epsilon|tolerance/i;

export interface GuardFinding { record: string; rule: string; message: string }

export function auditRecords(records: RecordFields[], portfolio: Portfolio): GuardFinding[] {
  const findings: GuardFinding[] = [];
  const workstreamNames = new Set(portfolio.workstreams.map((entry) => entry.name.toLowerCase()));
  const workstreamIds = new Set(portfolio.workstreams.map((entry) => String(entry.id)));
  const ordered = [...records].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "") || a.id.localeCompare(b.id));

  for (const record of ordered) {
    // Rule 1: declaration.
    for (const [label, value] of [["Workstream", record.workstream], ["Expected information value", record.informationValue], ["Scope", record.scope], ["Mechanism being tested", record.mechanism]] as const) {
      if (!value) findings.push({ record: record.id, rule: "DECLARATION", message: `missing required preregistration field: ${label}` });
    }
    if (record.workstream) {
      const normalized = record.workstream.toLowerCase();
      const known = [...workstreamNames].some((name) => normalized.includes(name)) || [...workstreamIds].some((id) => new RegExp(`(^|\\D)${id}(\\D|$)`).test(normalized));
      if (!known) findings.push({ record: record.id, rule: "DECLARATION", message: `workstream "${record.workstream}" is not in ${PORTFOLIO_PATH}` });
    }
    if (record.informationValue && !portfolio.informationValues.includes(record.informationValue.toUpperCase())) {
      findings.push({ record: record.id, rule: "DECLARATION", message: `expected information value must be one of ${portfolio.informationValues.join(" / ")}` });
    }
    if (record.scope && !portfolio.scopes.includes(record.scope.toUpperCase())) {
      findings.push({ record: record.id, rule: "DECLARATION", message: `scope must be one of ${portfolio.scopes.join(" / ")}` });
    }
    // Rule 3: micro-tuning needs an explicit preregistered parameter search.
    if (record.mechanism && MICRO_TUNING_MECHANISM.test(record.mechanism) && !record.parameterSearchPreregistered) {
      findings.push({
        record: record.id,
        rule: "PARAMETER_SEARCH",
        message: `mechanism looks like parameter nudging ("${record.mechanism}") but "Parameter search preregistered" is not yes. Incremental hill climbing requires an explicit preregistered parameter-search experiment.`,
      });
    }
  }

  // Rule 2: anti-repetition over consecutive records.
  const limit = portfolio.antiRepetitionRule.maxConsecutiveExperimentsPerMechanism;
  let runKey: string | null = null;
  let runLength = 0;
  for (const record of ordered) {
    const key = record.mechanism ? mechanismKey(record.mechanism) : null;
    if (key && key === runKey) runLength += 1;
    else {
      runKey = key;
      runLength = 1;
    }
    if (runLength > limit && !record.repeatJustification) {
      findings.push({
        record: record.id,
        rule: "ANTI_REPETITION",
        message: `experiment ${runLength} in a row on substantially the same mechanism ("${record.mechanism}") with no "Repeat justification". Argue why this has greater information value than switching workstreams, or switch workstreams.`,
      });
    }
  }
  return findings;
}

export function guardReport() {
  const portfolio = JSON.parse(readFileSync(PORTFOLIO_PATH, "utf8")) as Portfolio;
  const records: RecordFields[] = existsSync(RECORDS_DIR)
    ? readdirSync(RECORDS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(RECORDS_DIR, entry.name, "record.md")))
        .map((entry) => readRecord(entry.name, join(RECORDS_DIR, entry.name, "record.md")))
    : [];
  const findings = auditRecords(records, portfolio);
  return {
    version: "experiment-guard.v1",
    recordsAudited: records.length,
    portfolioWorkstreams: portfolio.workstreams.length,
    maxConsecutiveExperimentsPerMechanism: portfolio.antiRepetitionRule.maxConsecutiveExperimentsPerMechanism,
    passed: findings.length === 0,
    findings,
    note: records.length === 0 ? "No experiment records yet; the guard becomes load-bearing once the autonomous loop starts recording experiments." : undefined,
  };
}

// Importable without side effects so tests can exercise the audit logic directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = guardReport();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.passed) process.exitCode = 1;
}
