// Structured Hireability: requirements × candidate evidence, not keyword overlap.
// Work Fit never erases a fatal/legal gap. A minor tool gap never destroys Hireability.
import type { Capability, JobPosting, UserProfile } from "@/domain/types";

export const HIREABILITY_VERSION = "hireability.v2";

export type RequirementType = "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE" | "UNKNOWN";
export type RequirementCategory =
  | "SKILL"
  | "DOMAIN"
  | "EXPERIENCE"
  | "SENIORITY"
  | "EDUCATION"
  | "LICENSE"
  | "CLEARANCE"
  | "TOOL"
  | "WORK_AUTHORIZATION"
  | "OTHER";
export type GapClass = "FATAL" | "CORE" | "SIGNIFICANT" | "MINOR" | "UNKNOWN";
export type MatchType =
  | "DIRECT_PROFESSIONAL"
  | "DIRECT_ACADEMIC"
  | "DIRECT_PROJECT"
  | "ADJACENT_TRANSFERABLE"
  | "INFERRED_WEAK"
  | "UNKNOWN"
  | "CONTRADICTED"
  | "HARD_MISSING";

export interface JobRequirement {
  description: string;
  requirementType: RequirementType;
  category: RequirementCategory;
  criticality: number;
  evidenceNeeded: string;
}

export interface CandidateEvidence {
  matchType: MatchType;
  level: number;
  recency: number;
  duration: number;
  provenance: string;
  confidence: number;
}

export interface RequirementEvidenceRow {
  requirement: JobRequirement;
  evidence: CandidateEvidence;
  gapClass: GapClass;
}

export interface RequirementEvidenceMatrix {
  rows: RequirementEvidenceRow[];
  coreCoverage: number;
  preferredCoverage: number;
  hardDisqualifiers: string[];
  professionalShare: number;
  academicOrProjectShare: number;
  adjacentShare: number;
  seniorityAlignment: number;
  recency: number;
  evidenceConfidence: number;
  recruiterLegibility: number;
  hireability: number;
  version: string;
  trace: string[];
}

const FATAL_PATTERN = /clinical credential|security clearance|work authorization|us citizen|bar admission|\bcpa\b|rn license|medical license|10\+ years|plc\b|high-voltage/i;
const TOOL_HARD_PATTERN = /\bc\+\+|ros\b|embedded systems|sysml|iso 13485/i;
const TOOL_SOFT_PATTERN = /python|typescript|javascript|sql|excel|matlab|react|figma|salesforce|tableau/i;
const SENIORITY_PATTERN = /principal|director|staff|senior|manager|lead|entry.?level|junior|associate/i;
const LICENSE_PATTERN = /license|licensure|certification|clearance|credential/i;
const EDUCATION_PATTERN = /ph\.?d|master'?s|bachelor|degree|doctorate/i;
const GENERIC_SKILL = /critical thinking|active listening|reading comprehension|speaking|writing|monitoring|active learning|judgment and decision|complex problem|time management|social perceptiveness|coordination|persuasion|negotiation|instructing|service orientation/i;

const ALIASES: Record<string, string[]> = {
  python: ["python", "scripting", "data analysis"],
  typescript: ["typescript", "javascript", "software"],
  excel: ["excel", "spreadsheet", "financial modeling"],
  accounting: ["accounting", "audit", "reconcile", "ledger"],
  audit: ["audit", "accounting", "controls"],
  statistics: ["statistics", "data analysis", "quantitative"],
  negotiation: ["negotiation", "sales", "closing"],
  communication: ["communication", "writing", "presentation"],
  "project management": ["project management", "scheduling", "coordination"],
  "root cause": ["root cause", "investigation", "troubleshooting"],
  investigation: ["investigation", "root cause", "incident"],
  documentation: ["documentation", "technical writing", "records"],
  "quality systems": ["quality systems", "qms", "validation", "capa"],
};

export function parseJobRequirements(job: JobPosting): JobRequirement[] {
  const required = job.requirements.map((description) => classifyRequirement(description, "REQUIRED"));
  const preferred = job.preferredRequirements.map((description) => classifyRequirement(description, "PREFERRED"));
  return [...required, ...preferred].filter((requirement) => !GENERIC_SKILL.test(requirement.description));
}

function classifyRequirement(description: string, fallbackType: RequirementType): JobRequirement {
  if (FATAL_PATTERN.test(description)) {
    return { description, requirementType: "REQUIRED", category: LICENSE_PATTERN.test(description) ? "LICENSE" : /citizen|authorization/i.test(description) ? "WORK_AUTHORIZATION" : "OTHER", criticality: 1, evidenceNeeded: "documented credential or legal eligibility" };
  }
  if (TOOL_HARD_PATTERN.test(description)) {
    return { description, requirementType: "REQUIRED", category: "TOOL", criticality: 0.85, evidenceNeeded: "direct professional use of the tool" };
  }
  if (SENIORITY_PATTERN.test(description) || /years/i.test(description)) {
    return { description, requirementType: fallbackType, category: "SENIORITY", criticality: 0.55, evidenceNeeded: "demonstrated scope, not years alone" };
  }
  if (LICENSE_PATTERN.test(description)) {
    return { description, requirementType: fallbackType, category: "LICENSE", criticality: fallbackType === "REQUIRED" ? 0.9 : 0.4, evidenceNeeded: "license or certification evidence" };
  }
  if (EDUCATION_PATTERN.test(description)) {
    return { description, requirementType: fallbackType, category: "EDUCATION", criticality: 0.4, evidenceNeeded: "degree or equivalent demonstrated skill" };
  }
  if (TOOL_SOFT_PATTERN.test(description)) {
    return { description, requirementType: fallbackType, category: "TOOL", criticality: fallbackType === "REQUIRED" ? 0.45 : 0.2, evidenceNeeded: "tool use in professional or project context" };
  }
  return { description, requirementType: fallbackType, category: "SKILL", criticality: fallbackType === "REQUIRED" ? 0.55 : 0.25, evidenceNeeded: "demonstrated work using this skill" };
}

export function matchRequirement(requirement: JobRequirement, profile: UserProfile): CandidateEvidence {
  const career = profile.persona.careerText.toLowerCase();
  const haystack = [
    career,
    ...profile.capabilities.map((capability) => capability.name),
    ...profile.persona.capabilityKeywords,
    ...profile.evidence.flatMap((item) => item.demonstratedSkills),
  ].join(" ").toLowerCase();
  const needle = requirement.description.toLowerCase();
  const capability = profile.capabilities.find((item) => namesOverlap(item.name, requirement.description));
  const academic = new RegExp(`(coursework|hobby|interested|no professional|not yet).{0,40}${escapeNeedle(needle)}|${escapeNeedle(needle)}.{0,40}(coursework|hobby|no professional|not yet)`, "i").test(career)
    || capability?.evidenceLevel === "INTEREST_ONLY"
    || capability?.evidenceLevel === "DIRECT_ACADEMIC";
  const negated = needle.length > 2 && new RegExp(`\\b(no|not|without|lacking|lack of)\\b[\\s\\w]{0,24}${escapeNeedle(needle)}`, "i").test(career);
  if (!negated && (capability?.evidenceLevel === "DIRECT_PROFESSIONAL" || (haystack.includes(needle) && needle.length > 3 && !academic))) {
    return { matchType: "DIRECT_PROFESSIONAL", level: 7.5, recency: capability?.recency ?? 0.7, duration: 0.6, provenance: capability?.id ?? "career text", confidence: 0.78 };
  }
  if (academic && !negated && (haystack.includes(needle) || capability?.evidenceLevel === "DIRECT_ACADEMIC" || capability?.evidenceLevel === "INTEREST_ONLY")) {
    return { matchType: "DIRECT_ACADEMIC", level: 4.5, recency: 0.4, duration: 0.3, provenance: "academic/hobby language", confidence: 0.5 };
  }
  if (capability?.evidenceLevel === "DIRECT_PROJECT") {
    return { matchType: "DIRECT_PROJECT", level: 5.5, recency: capability.recency, duration: 0.4, provenance: capability.id, confidence: 0.58 };
  }
  if (adjacentMatch(requirement.description, profile) || capability?.evidenceLevel === "ADJACENT_TRANSFERABLE") {
    return { matchType: "ADJACENT_TRANSFERABLE", level: 4.2, recency: 0.5, duration: 0.4, provenance: "adjacent skill/alias", confidence: 0.48 };
  }
  if (requirement.category === "LICENSE" || requirement.category === "CLEARANCE" || requirement.category === "WORK_AUTHORIZATION" || FATAL_PATTERN.test(requirement.description) || TOOL_HARD_PATTERN.test(requirement.description)) {
    return { matchType: "HARD_MISSING", level: 0, recency: 0, duration: 0, provenance: "no matching evidence", confidence: 0.7 };
  }
  if (requirement.description.trim().length < 4) {
    return { matchType: "UNKNOWN", level: 3, recency: 0.3, duration: 0, provenance: "vague requirement", confidence: 0.2 };
  }
  return { matchType: "INFERRED_WEAK", level: 2.2, recency: 0.3, duration: 0.2, provenance: "no direct evidence", confidence: 0.28 };
}

function gapFor(requirement: JobRequirement, evidence: CandidateEvidence): GapClass {
  if (evidence.matchType === "HARD_MISSING" && (requirement.category === "LICENSE" || requirement.category === "CLEARANCE" || requirement.category === "WORK_AUTHORIZATION" || FATAL_PATTERN.test(requirement.description))) {
    return "FATAL";
  }
  if (evidence.matchType === "HARD_MISSING" && TOOL_HARD_PATTERN.test(requirement.description)) return "CORE";
  if (evidence.matchType === "DIRECT_PROFESSIONAL" || evidence.matchType === "DIRECT_PROJECT") return requirement.requirementType === "PREFERRED" ? "MINOR" : "UNKNOWN";
  if (evidence.matchType === "DIRECT_ACADEMIC" || evidence.matchType === "ADJACENT_TRANSFERABLE") return requirement.requirementType === "REQUIRED" ? "SIGNIFICANT" : "MINOR";
  if (requirement.requirementType === "REQUIRED" && requirement.criticality >= 0.7) return "CORE";
  if (requirement.requirementType === "REQUIRED") return "SIGNIFICANT";
  if (requirement.requirementType === "PREFERRED") return "MINOR";
  return "UNKNOWN";
}

export function buildRequirementMatrix(profile: UserProfile, job: JobPosting): RequirementEvidenceMatrix {
  const requirements = parseJobRequirements(job);
  const rows = requirements.map((requirement) => {
    const evidence = matchRequirement(requirement, profile);
    return { requirement, evidence, gapClass: gapFor(requirement, evidence) };
  });
  const required = rows.filter((row) => row.requirement.requirementType === "REQUIRED");
  const preferred = rows.filter((row) => row.requirement.requirementType === "PREFERRED");
  const covered = (slice: RequirementEvidenceRow[]) => {
    if (!slice.length) return 0.55;
    const hits = slice.filter((row) => ["DIRECT_PROFESSIONAL", "DIRECT_ACADEMIC", "DIRECT_PROJECT", "ADJACENT_TRANSFERABLE"].includes(row.evidence.matchType));
    const professional = hits.filter((row) => row.evidence.matchType === "DIRECT_PROFESSIONAL").length;
    return clamp((professional * 1 + (hits.length - professional) * 0.55) / slice.length, 0, 1);
  };
  const coreCoverage = covered(required);
  const preferredCoverage = covered(preferred);
  const hardDisqualifiers = rows.filter((row) => row.gapClass === "FATAL").map((row) => row.requirement.description);
  const professionalShare = share(rows, "DIRECT_PROFESSIONAL");
  const academicOrProjectShare = share(rows, "DIRECT_ACADEMIC") + share(rows, "DIRECT_PROJECT");
  const adjacentShare = share(rows, "ADJACENT_TRANSFERABLE");
  const seniorityAlignment = seniorityAlignmentFor(profile, job);
  const recency = average(profile.capabilities.map((capability) => capability.recency)) || 0.45;
  const evidenceConfidence = average(rows.map((row) => row.evidence.confidence)) || 0.35;
  const recruiterLegibility = average(profile.capabilities.map((capability) => capability.recruiterLegibility)) || 0.4;
  const coreGapPenalty = rows.filter((row) => row.gapClass === "CORE").length * 1.15;
  const significantPenalty = rows.filter((row) => row.gapClass === "SIGNIFICANT").length * 0.45;
  const fatalPenalty = hardDisqualifiers.length * 3.2;
  const minorPenalty = rows.filter((row) => row.gapClass === "MINOR" && row.requirement.category === "TOOL").length * 0.12;
  const hireability = clamp(
    1.8 +
      coreCoverage * 5.4 +
      preferredCoverage * 0.8 +
      professionalShare * 1.1 +
      adjacentShare * 0.35 +
      seniorityAlignment * 0.6 +
      recruiterLegibility * 0.5 +
      (coreCoverage >= 0.7 && professionalShare >= 0.5 ? 0.9 : 0) -
      fatalPenalty -
      coreGapPenalty -
      significantPenalty -
      minorPenalty,
    1,
    10,
  );
  return {
    rows,
    coreCoverage,
    preferredCoverage,
    hardDisqualifiers,
    professionalShare,
    academicOrProjectShare,
    adjacentShare,
    seniorityAlignment,
    recency,
    evidenceConfidence,
    recruiterLegibility,
    hireability,
    version: HIREABILITY_VERSION,
    trace: [
      `Hireability ${hireability.toFixed(1)} from ${rows.length} structured requirements (${HIREABILITY_VERSION}).`,
      `Core coverage ${(coreCoverage * 100).toFixed(0)}%, preferred ${(preferredCoverage * 100).toFixed(0)}%, professional share ${(professionalShare * 100).toFixed(0)}%.`,
      `Gaps: fatal ${hardDisqualifiers.length}, core ${rows.filter((row) => row.gapClass === "CORE").length}, significant ${rows.filter((row) => row.gapClass === "SIGNIFICANT").length}.`,
      `Seniority alignment ${seniorityAlignment.toFixed(2)}; recruiter legibility ${recruiterLegibility.toFixed(2)}.`,
      hardDisqualifiers.length ? `Hard disqualifiers: ${hardDisqualifiers.join("; ")}` : "No fatal/legal disqualifiers.",
    ],
  };
}

function seniorityAlignmentFor(profile: UserProfile, job: JobPosting) {
  const text = profile.persona.careerText.toLowerCase();
  const years = Number((text.match(/(\d+)\s+years?/) ?? [])[1] ?? 0);
  const demonstratedLead = /led |managed |owned |directed |principal |staff /.test(text);
  const jobRank = { Associate: 1, Mid: 2, Senior: 3, Staff: 4, Manager: 5 }[job.seniority];
  const userRank = demonstratedLead ? 3 : years >= 10 ? 3 : years >= 5 ? 2 : 1;
  const delta = Math.abs(jobRank - userRank);
  return clamp(1 - delta * 0.22, 0.15, 1);
}

function adjacentMatch(requirement: string, profile: UserProfile) {
  const haystack = [profile.persona.careerText, ...profile.persona.capabilityKeywords, ...profile.capabilities.map((capability) => capability.name)].join(" ").toLowerCase();
  const key = Object.keys(ALIASES).find((alias) => requirement.toLowerCase().includes(alias));
  if (!key) return false;
  return ALIASES[key]!.some((alias) => haystack.includes(alias));
}

function escapeNeedle(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namesOverlap(a: string, b: string) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left.length > 2 && right.length > 2 && (left.includes(right) || right.includes(left));
}

function share(rows: RequirementEvidenceRow[], matchType: MatchType) {
  return rows.length ? rows.filter((row) => row.evidence.matchType === matchType).length / rows.length : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function capabilityNames(profile: UserProfile): string[] {
  return Array.from(new Set([...profile.capabilities.map((capability: Capability) => capability.name), ...profile.persona.capabilityKeywords]));
}
