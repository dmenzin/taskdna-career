// Append-only experiment registry. The gate that forces a paid experiment through
// preregistration BEFORE it can spend.
//
// The older `experiments/records/*.md` + `pnpm experiment:new` path still exists for the V3
// preference-decoder loop. Agent-runtime experiments live here, because that markdown template
// could only describe one experiment at a time and the current arms were ending up as prose.
//
// IMMUTABILITY
// -------------
// Records are never rewritten to make a later result look cleaner. A superseded design gets a
// NEW record; the old one keeps its verdict and points at the replacement via `supersededBy`.
// `appendPreregistration` refuses a duplicate id. Historical backfilled records have
// `preregistrationCommit: null` on purpose — inventing a SHA after the fact is the dishonesty
// this file exists to prevent.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const EXPERIMENT_REGISTRY_PATH = "config/experiment-registry.json";

export const EXECUTABLE_EXPERIMENT_STATUSES = [
  "PREREGISTERED",
  "IN_PROGRESS",
  "SUPPORTED",
  "REJECTED",
  "INCONCLUSIVE",
  "SUPERSEDED",
] as const;

export interface FrozenConfig {
  [key: string]: unknown;
}

export interface ExperimentRecord {
  experimentId: string;
  backfilled?: boolean;
  question: string;
  hypothesis: string;
  status: string;
  dependencies: string[];
  family: string;
  split: string;
  frozenConfig: FrozenConfig;
  primaryMetrics: string[];
  successCriterion: string;
  failureCriterion: string;
  inconclusiveCriterion: string;
  estimatedCalls: number | null;
  estimatedCostUsd: number | null;
  actualCalls: number | null;
  actualCostUsd: number | null;
  preregistrationCommit: string | null;
  resultArtifact: string | null;
  result: string;
  caveat?: string;
  supersedes: string | null;
  supersededBy: string | null;
}

export interface ExperimentRegistry {
  version: string;
  purpose: string;
  immutabilityRule: string;
  backfillNote: string;
  records: ExperimentRecord[];
}

export class UnregisteredExperimentError extends Error {
  readonly experimentId: string;
  constructor(experimentId: string, known: string[]) {
    super(
      `experiment "${experimentId}" has no preregistration in ${EXPERIMENT_REGISTRY_PATH}. ` +
        `Add a record with status PREREGISTERED before any paid call (pnpm experiment:preregister). ` +
        `Known ids: ${known.length ? known.join(", ") : "(none)"}.`,
    );
    this.name = "UnregisteredExperimentError";
    this.experimentId = experimentId;
  }
}

export class DuplicateExperimentError extends Error {
  constructor(experimentId: string) {
    super(
      `experiment "${experimentId}" already exists in ${EXPERIMENT_REGISTRY_PATH}. ` +
        `Records are append-only; supersede with a new id rather than rewriting the old one.`,
    );
    this.name = "DuplicateExperimentError";
  }
}

export function loadExperimentRegistry(path = EXPERIMENT_REGISTRY_PATH): ExperimentRegistry {
  if (!existsSync(path)) {
    throw new Error(`${path} is missing; the research program cannot authorize spend without it.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ExperimentRegistry;
}

/**
 * A ledger id may be a prefix of a versioned registry id (and vice versa).
 *
 * `split-agents:openai:LEXICAL_TRAP:low` is what the script spends under;
 * the registry stores `:direction-v1` / `:direction-v2` so the two Direction
 * generations stay distinct. Either direction is a match.
 */
export function matchesExperimentId(registered: string, requested: string): boolean {
  return registered === requested
    || registered.startsWith(`${requested}:`)
    || requested.startsWith(`${registered}:`);
}

export function findExperimentRecords(
  experimentId: string,
  registry = loadExperimentRegistry(),
): ExperimentRecord[] {
  return registry.records.filter((record) => matchesExperimentId(record.experimentId, experimentId));
}

/**
 * Refuse to proceed unless `experimentId` is already in the registry.
 *
 * Called by every paid experiment script, including `--dry-run`. Discovering a missing
 * record on the dry run is the point: the operator adds the record, commits it, and only
 * then is spend authorized. A check that ran only after the first paid call would be a
 * post-hoc autopsy, which is the failure mode this module exists to close.
 */
export function assertPreregistered(experimentId: string): ExperimentRecord[] {
  if (!experimentId || experimentId === "unspecified") {
    throw new UnregisteredExperimentError(experimentId || "(missing)", []);
  }
  const registry = loadExperimentRegistry();
  const found = findExperimentRecords(experimentId, registry);
  if (!found.length) {
    throw new UnregisteredExperimentError(
      experimentId,
      registry.records.map((record) => record.experimentId),
    );
  }
  return found;
}

export interface NewExperimentDraft {
  experimentId: string;
  question: string;
  hypothesis: string;
  family: string;
  split?: string;
  frozenConfig?: FrozenConfig;
  primaryMetrics?: string[];
  successCriterion?: string;
  failureCriterion?: string;
  inconclusiveCriterion?: string;
  estimatedCalls?: number | null;
  estimatedCostUsd?: number | null;
  dependencies?: string[];
  preregistrationCommit?: string | null;
}

/** Append a PREREGISTERED stub. Refuses a duplicate id. Never rewrites an existing record. */
export function appendPreregistration(
  draft: NewExperimentDraft,
  path = EXPERIMENT_REGISTRY_PATH,
): ExperimentRecord {
  const registry = loadExperimentRegistry(path);
  if (registry.records.some((record) => record.experimentId === draft.experimentId)) {
    throw new DuplicateExperimentError(draft.experimentId);
  }
  if (!draft.experimentId || !draft.question || !draft.hypothesis || !draft.family) {
    throw new Error("preregistration requires experimentId, question, hypothesis, and family");
  }
  const record: ExperimentRecord = {
    experimentId: draft.experimentId,
    question: draft.question,
    hypothesis: draft.hypothesis,
    status: "PREREGISTERED",
    dependencies: draft.dependencies ?? [],
    family: draft.family,
    split: draft.split ?? "DEVELOPMENT",
    frozenConfig: draft.frozenConfig ?? {},
    primaryMetrics: draft.primaryMetrics ?? [],
    successCriterion: draft.successCriterion ?? "CI excludes zero and the mean difference is positive.",
    failureCriterion: draft.failureCriterion ?? "Mean difference negative with CI excluding zero.",
    inconclusiveCriterion: draft.inconclusiveCriterion ?? "CI spans zero.",
    estimatedCalls: draft.estimatedCalls ?? null,
    estimatedCostUsd: draft.estimatedCostUsd ?? null,
    actualCalls: null,
    actualCostUsd: null,
    preregistrationCommit: draft.preregistrationCommit ?? null,
    resultArtifact: null,
    result: "not yet executed",
    supersedes: null,
    supersededBy: null,
  };
  registry.records.push(record);
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
  return record;
}
