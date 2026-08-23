// Diagnostic leave-one-field-out analysis of the frozen field-aware matcher.
//
// WHY THIS FILE EXISTS
// --------------------
// Field-aware matching is the strongest clean result in the program (+0.148 over token-bag on
// identical interpretations). Before spending on P-01 we want to know which of the five role
// fields carry independent signal. That is a DETERMINISTIC question over already-paid caches.
//
// THIS MUST NOT RETUNE THE MATCHER. `createAgentFieldMatchArchitecture` stays on all five
// fields. The functions here exist so a diagnostic can drop a field without touching the
// production path. P-01 continues to use the frozen five-field matcher.
import { contentTokens } from "@/bench/render";
import {
  createAgentFieldMatchArchitecture,
  type CareerBlueprint,
  type StructuredWork,
} from "@/agent/agentArchitecture";
import { evaluateArchitecture, CHANNELS, type ArchitectureResult } from "@/bench/frameEvaluation";
import type { FrameBenchCorpus } from "@/bench/frameCorpus";

export const FIELD_ABLATION_VERSION = "field-ablation.v1";

export const ROLE_FIELDS = ["action", "object", "purpose", "method", "domain"] as const;
export type RoleField = (typeof ROLE_FIELDS)[number];

function fieldSimilarity(a: StructuredWork, b: StructuredWork, fields: readonly RoleField[]): number {
  if (!fields.length) return 0;
  let total = 0;
  for (const field of fields) {
    const left = contentTokens(a[field] ?? "");
    const right = contentTokens(b[field] ?? "");
    if (!left.size || !right.size) continue;
    let shared = 0;
    for (const token of left) if (right.has(token)) shared += 1;
    total += shared / new Set([...left, ...right]).size;
  }
  return total / fields.length;
}

function coverageScore(
  personWorks: StructuredWork[],
  jobWorks: StructuredWork[],
  fields: readonly RoleField[],
): number {
  if (!personWorks.length || !jobWorks.length) return 0;
  let total = 0;
  for (const jobWork of jobWorks) {
    let best = 0;
    for (const personWork of personWorks) best = Math.max(best, fieldSimilarity(personWork, jobWork, fields));
    total += best;
  }
  return total / jobWorks.length;
}

/** A field-aware matcher over an explicit field subset. Diagnostic only. */
export function createFieldSubsetArchitecture(
  blueprints: Map<string, CareerBlueprint>,
  jobWork: Map<string, StructuredWork[]>,
  fields: readonly RoleField[],
  id: string,
) {
  return {
    id,
    version: FIELD_ABLATION_VERSION,
    description: `Diagnostic field-aware matcher using ${fields.join(",") || "no fields"}.`,
    prepare: (person: { personId: string }) => blueprints.get(person.personId),
    score: (blueprint: CareerBlueprint | undefined, job: { jobId: string }, channel: "experience" | "preference" | "direction") => {
      if (!blueprint) return 0;
      const works = jobWork.get(job.jobId) ?? [];
      if (channel === "experience") return coverageScore(blueprint.experience, works, fields);
      if (channel === "direction") return coverageScore(blueprint.desired, works, fields);
      return coverageScore(blueprint.liked, works, fields) - coverageScore(blueprint.disliked, works, fields);
    },
  };
}

export interface FieldAblationRow {
  dropped: RoleField | null;
  fields: RoleField[];
  experience: number | null;
  preference: number | null;
  direction: number | null;
  experienceDeltaVsFull: number | null;
}

export interface FieldAblationReport {
  version: string;
  family: string;
  people: number;
  note: string;
  full: FieldAblationRow;
  leaveOneOut: FieldAblationRow[];
  /** Fields whose removal did not move experience NDCG@10 (within 0.001). Diagnostic, not a retune. */
  redundantOnExperience: RoleField[];
  channels: typeof CHANNELS;
}

const ndcg = (result: ArchitectureResult) => result.meanNdcg10;

export function runFieldAblation(
  corpus: FrameBenchCorpus,
  blueprints: Map<string, CareerBlueprint>,
  jobWork: Map<string, StructuredWork[]>,
): FieldAblationReport {
  const score = (fields: readonly RoleField[], id: string): FieldAblationRow => {
    const architecture = createFieldSubsetArchitecture(blueprints, jobWork, fields, id);
    const byChannel = Object.fromEntries(
      CHANNELS.map((channel) => [channel, ndcg(evaluateArchitecture(architecture, corpus, channel, 10))]),
    ) as Record<(typeof CHANNELS)[number], number | null>;
    return {
      dropped: fields.length === ROLE_FIELDS.length ? null : ROLE_FIELDS.find((field) => !fields.includes(field)) ?? null,
      fields: [...fields],
      experience: byChannel.experience,
      preference: byChannel.preference,
      direction: byChannel.direction,
      experienceDeltaVsFull: null,
    };
  };

  const full = score(ROLE_FIELDS, "field-match-full");
  const leaveOneOut = ROLE_FIELDS.map((dropped) => {
    const row = score(ROLE_FIELDS.filter((field) => field !== dropped), `field-match-minus-${dropped}`);
    return {
      ...row,
      dropped,
      experienceDeltaVsFull:
        full.experience !== null && row.experience !== null ? row.experience - full.experience : null,
    };
  });

  return {
    version: FIELD_ABLATION_VERSION,
    family: corpus.family,
    people: corpus.people.length,
    note:
      "Diagnostic only. The production agent-field-match baseline is unchanged. " +
      "P-01 must continue to use all five fields. A small or zero leave-one-out delta is a " +
      "research observation, not a licence to drop a field.",
    full,
    leaveOneOut,
    redundantOnExperience: leaveOneOut
      .filter((row) => row.experienceDeltaVsFull !== null && Math.abs(row.experienceDeltaVsFull) < 0.001)
      .map((row) => row.dropped!)
      .filter(Boolean),
    channels: CHANNELS,
  };
}

/** Guard: the five-field diagnostic must score identically to the production matcher. */
export function productionMatcherAgrees(
  corpus: FrameBenchCorpus,
  blueprints: Map<string, CareerBlueprint>,
  jobWork: Map<string, StructuredWork[]>,
): boolean {
  const production = createAgentFieldMatchArchitecture(blueprints, jobWork);
  const diagnostic = createFieldSubsetArchitecture(blueprints, jobWork, ROLE_FIELDS, "diagnostic-full");
  for (const channel of CHANNELS) {
    const a = evaluateArchitecture(production, corpus, channel, 10);
    const b = evaluateArchitecture(diagnostic, corpus, channel, 10);
    if (a.meanNdcg10 !== b.meanNdcg10) return false;
  }
  return true;
}
