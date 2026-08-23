export type CoefficientGovernanceStatus =
  | "STRUCTURAL"
  | "PROVISIONAL_BASELINE"
  | "EMPIRICALLY_JUSTIFIED"
  | "UNJUSTIFIED"
  | "EXPERIMENTAL_DISABLED";

export interface V3CoefficientRecord {
  id: string;
  name: string;
  value: string | number | boolean | null;
  source: string;
  status: CoefficientGovernanceStatus;
  requiredToRun: boolean;
  experimentCandidate: boolean;
  notes: string;
}

/**
 * Active V3 behavioral coefficients. None are calibrated human-validity weights.
 * Status is governance, not a claim that the number is correct.
 */
export const V3_COEFFICIENT_INVENTORY: V3CoefficientRecord[] = [
  {
    id: "v3.mapper.topK",
    name: "mapper Top-K",
    value: 5,
    source: "src/v3/mapper.ts MAPPER_CONFIG.topK",
    status: "STRUCTURAL",
    requiredToRun: true,
    experimentCandidate: false,
    notes: "Retrieval width. Changing it changes candidate identity, not a fit weight.",
  },
  {
    id: "v3.mapper.taskThreshold",
    name: "exact Task similarity threshold",
    value: 0.46,
    source: "src/v3/mapper.ts MAPPER_CONFIG.taskThreshold",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Needed for a deterministic Task / DWA / abstain rule. Not a calibrated accuracy threshold.",
  },
  {
    id: "v3.mapper.dwaThreshold",
    name: "DWA fallback similarity threshold",
    value: 0.25,
    source: "src/v3/mapper.ts MAPPER_CONFIG.dwaThreshold",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional retrieval cutoff. Tests must not treat fixture agreement as human mapping validity.",
  },
  {
    id: "v3.mapper.taskMargin",
    name: "exact Task margin over next candidate",
    value: 0.06,
    source: "src/v3/mapper.ts MAPPER_CONFIG.taskMargin",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Collision guard. Not estimated from independent annotations.",
  },
  {
    id: "v3.mapper.contextWeight",
    name: "context overlap weight",
    value: 0.08,
    source: "src/v3/mapper.ts MAPPER_CONFIG.contextWeight",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Bounded additive context term. Not a calibrated context model.",
  },
  {
    id: "v3.mapper.tokenizer",
    name: "lexical tokenizer identity",
    value: "lowercase-alphanumeric-stopwords.v1",
    source: "src/v3/mapper.ts MAPPER_CONFIG.tokenizer",
    status: "STRUCTURAL",
    requiredToRun: true,
    experimentCandidate: false,
    notes: "Deterministic token identity. Cache key includes this string.",
  },
  {
    id: "v3.mapper.dwaDiagnosticCap",
    name: "DWA diagnostic confidence cap",
    value: 0.6,
    source: "src/v3/mapper.ts diagnosticConfidence",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: false,
    notes: "DIAGNOSTIC_ONLY. Must not multiply fit.",
  },
  {
    id: "v3.mapper.reranker",
    name: "contextual reranker",
    value: null,
    source: "src/v3/mapper.ts CandidateReranker",
    status: "EXPERIMENTAL_DISABLED",
    requiredToRun: false,
    experimentCandidate: true,
    notes: "Interface exists; no default reranker is enabled.",
  },
  {
    id: "v3.fit.taskExactCredit",
    name: "exact Task match credit",
    value: 1,
    source: "src/v3/fit.ts match()",
    status: "STRUCTURAL",
    requiredToRun: true,
    experimentCandidate: false,
    notes: "Identity match on a Task ID is full credit by definition.",
  },
  {
    id: "v3.fit.dwaPartialCredit",
    name: "DWA partial credit",
    value: 0.6,
    source: "src/v3/fit.ts match()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Declared semantic fallback, not empirically justified and not a calibrated weight.",
  },
  {
    id: "v3.fit.preferenceContributionTransform",
    name: "preference contribution transform",
    value: "clamp(0.5 + sum(contributions) / (2 * n))",
    source: "src/v3/fit.ts preferenceFit()",
    status: "STRUCTURAL",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Maps signed LIKE/DISLIKE contributions onto [0,1]. Structural scoring algebra, not a human-validated utility.",
  },
  {
    id: "v3.fit.experienceDepth.deep",
    name: "experience depth weight: deep",
    value: 1,
    source: "src/v3/fit.ts strength()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated depth model.",
  },
  {
    id: "v3.fit.experienceDepth.demonstrated",
    name: "experience depth weight: demonstrated",
    value: 0.75,
    source: "src/v3/fit.ts strength()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated depth model.",
  },
  {
    id: "v3.fit.experienceDepth.weak",
    name: "experience depth weight: weak",
    value: 0.4,
    source: "src/v3/fit.ts strength()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated depth model.",
  },
  {
    id: "v3.fit.ownership.led",
    name: "ownership weight: led",
    value: 1,
    source: "src/v3/fit.ts ownership()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated ownership model.",
  },
  {
    id: "v3.fit.ownership.performed",
    name: "ownership weight: performed",
    value: 0.85,
    source: "src/v3/fit.ts ownership()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated ownership model.",
  },
  {
    id: "v3.fit.ownership.assisted",
    name: "ownership weight: assisted",
    value: 0.55,
    source: "src/v3/fit.ts ownership()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Provisional ordinal encoding. Not a calibrated ownership model.",
  },
  {
    id: "v3.fit.ownership.unknown",
    name: "ownership weight: unknown",
    value: 0.65,
    source: "src/v3/fit.ts ownership()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Placeholder between assisted and performed. Not justified by data.",
  },
  {
    id: "v3.fit.preferredRequirementWeight",
    name: "preferred requirement weight",
    value: 0.25,
    source: "src/v3/fit.ts qualificationFit()",
    status: "PROVISIONAL_BASELINE",
    requiredToRun: true,
    experimentCandidate: true,
    notes: "Declared reduced weight for non-required requirements. Not a calibrated hiring model.",
  },
  {
    id: "v3.fit.overallScore",
    name: "Overall V3 score",
    value: null,
    source: "src/v3/fit.ts scoreV3()",
    status: "EXPERIMENTAL_DISABLED",
    requiredToRun: false,
    experimentCandidate: false,
    notes: "Deliberately absent. Do not introduce or optimize an Overall V3 score.",
  },
];

export const V3_GOVERNANCE_STATUSES: CoefficientGovernanceStatus[] = [
  "STRUCTURAL",
  "PROVISIONAL_BASELINE",
  "EMPIRICALLY_JUSTIFIED",
  "UNJUSTIFIED",
  "EXPERIMENTAL_DISABLED",
];

export function coefficientGovernanceComplete(records: V3CoefficientRecord[] = V3_COEFFICIENT_INVENTORY) {
  return records.length > 0
    && records.every((record) => V3_GOVERNANCE_STATUSES.includes(record.status) && record.id && record.source && record.notes)
    && !records.some((record) => record.status === "EMPIRICALLY_JUSTIFIED")
    && !records.some((record) => /\bis a calibrated\b/i.test(record.notes));
}
