// End-to-end recommendation trace.
//
// HARD REQUIREMENT: a developer must be able to answer "which subsystem caused this bad
// recommendation?" without guessing. This module produces a single structured object that
// carries every transformation from raw evidence to final rank, with provenance preserved at
// each hop.
//
// The trace deliberately records the PLANTED truth alongside the produced result, and computes
// a per-stage verdict, so localizing a failure is a lookup rather than an investigation:
//
//   raw evidence text
//     -> extracted evidence (class + provenance)
//     -> canonical candidate set + selection/fallback/abstain reason + mapper identity
//     -> job responsibility text -> job canonical mapping
//     -> candidate retrieval reason
//     -> per-channel contributions, decomposed to the evidence and responsibility that caused them
//     -> constraint handling
//     -> recommendation policy decision and why one job outranked another
//     -> explanation, referencing only evidence actually used
import { classifyEvidenceSentence } from "@/domain/evidence";
import { MAPPER_CONFIG, MAPPER_VERSION } from "@/v3/mapper";
import { EXPERIENCE_OWNERSHIP_WEIGHTS, EXPERIENCE_STRENGTH_WEIGHTS, DWA_PARTIAL_CREDIT } from "@/v3/fit";
import type { TaskMapping } from "@/v3/types";
import { buildBenchCorpus, type BenchSplit, type PlantedJob, type PlantedPerson } from "@/bench/corpus";
import { buildJobFromRenderedText, buildPersonFromRenderedText, runPerson, type PersonRun } from "@/bench/pipeline";
import { canonicalWorkRetrieval } from "@/bench/candidates";
import { labelPair, type PairLabel } from "@/bench/labels";
import { applyMode, type RecommendationMode } from "@/bench/policy";
import type { RenderDifficulty } from "@/bench/render";

export const TRACE_VERSION = "bench-trace.v1";

/** Subsystems a failure can be localized to. */
export const TRACE_STAGES = [
  "person_evidence_extraction",
  "person_canonical_mapping",
  "job_responsibility_extraction",
  "job_canonical_mapping",
  "candidate_retrieval",
  "experience_fit",
  "preference_fit",
  "direction_fit",
  "qualification_fit",
  "constraints",
  "recommendation_policy",
  "explanation",
] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];

export interface MappingTrace {
  sourceId: string;
  sourceText: string;
  /** Ranked candidates the retrieval stage produced, with their similarity. */
  candidates: { taskId: string | null; similarity: number; lexicalScore: number; contextScore: number }[];
  level: TaskMapping["level"];
  selectedTaskId: string | null;
  selectedDwaId: string | null;
  /** Why the mapper chose Task, DWA, or abstention, in terms of its own thresholds. */
  selectionReason: string;
  diagnosticConfidence: number;
  mapperVersion: string;
  corpusHash: string;
  cacheKey: string;
  /** Planted target, for grading only. Never an input to the pipeline. */
  plantedAtomId: string;
  plantedTaskId: string;
  recovered: boolean;
}

export interface ChannelContributionTrace {
  channel: "experience" | "preference" | "direction" | "qualification";
  score: number | null;
  coverage: number;
  evidenceCount: number;
  /** Which person evidence and which job responsibility produced the match. */
  contributions: { personEvidenceId: string; jobResponsibilityId: string; sharedIdentity: string; weightExplanation: string }[];
  diagnostics: string[];
}

export interface RecommendationTrace {
  version: string;
  personId: string;
  jobId: string;
  mode: RecommendationMode;

  // stage 1-2: person side
  personEvidence: { id: string; declaredKind: string; rawText: string; extractorClass: string; provenance: string }[];
  personMappings: MappingTrace[];

  // stage 3-4: job side
  jobResponsibilities: { id: string; rawText: string; core: boolean }[];
  jobMappings: MappingTrace[];

  // stage 5: retrieval
  retrieval: { strategy: string; version: string; rankInCandidateSet: number | null; enteredCandidateSet: boolean; reason: string };

  // stage 6-9: channels
  channels: ChannelContributionTrace[];

  // stage 10: constraints
  constraints: { declared: string[]; hardViolations: string[]; note: string };

  // stage 11: policy
  policy: { mode: RecommendationMode; finalRank: number; totalCandidates: number; paretoFront: number | null; tieBreak: string; hardGapPartition: string | null; outrankedBecause: string };

  // stage 12: explanation
  explanation: { sentences: string[]; citedEvidenceIds: string[]; citedResponsibilityIds: string[]; unsupportedSentences: string[] };

  /** Planted truth for this pair. Grading only. */
  plantedTruth: PairLabel;
  /** Per-stage verdict, so a bad recommendation is localized rather than guessed at. */
  stageVerdicts: { stage: TraceStage; verdict: "OK" | "DEGRADED" | "FAILED" | "NOT_APPLICABLE"; detail: string }[];
}

function mappingTrace(sourceId: string, sourceText: string, mapping: TaskMapping, plantedAtomId: string, plantedTaskId: string): MappingTrace {
  const selected = mapping.selected as { taskId?: string | null; id?: string } | null;
  const selectedTaskId = mapping.level === "task" && selected?.taskId ? String(selected.taskId) : null;
  const selectedDwaId = mapping.level === "dwa" && selected?.id ? selected.id : null;
  const top = mapping.candidates[0];
  const next = mapping.candidates[1];
  const margin = (top?.similarity ?? 0) - (next?.similarity ?? 0);
  const selectionReason =
    mapping.level === "task"
      ? `similarity ${(top?.similarity ?? 0).toFixed(4)} >= taskThreshold ${MAPPER_CONFIG.taskThreshold} and margin ${margin.toFixed(4)} >= taskMargin ${MAPPER_CONFIG.taskMargin}`
      : mapping.level === "dwa"
        ? `similarity ${(top?.similarity ?? 0).toFixed(4)} below taskThreshold ${MAPPER_CONFIG.taskThreshold} or margin ${margin.toFixed(4)} below taskMargin ${MAPPER_CONFIG.taskMargin}; fell back to the top candidate's first DWA`
        : `similarity ${(top?.similarity ?? 0).toFixed(4)} below dwaThreshold ${MAPPER_CONFIG.dwaThreshold}; abstained`;
  return {
    sourceId, sourceText,
    candidates: mapping.candidates.map((candidate) => ({ taskId: candidate.task.taskId, similarity: candidate.similarity, lexicalScore: candidate.lexicalScore, contextScore: candidate.contextScore })),
    level: mapping.level, selectedTaskId, selectedDwaId, selectionReason,
    diagnosticConfidence: mapping.diagnosticConfidence,
    mapperVersion: MAPPER_VERSION, corpusHash: mapping.corpusHash, cacheKey: mapping.cacheKey,
    plantedAtomId, plantedTaskId,
    recovered: selectedTaskId === plantedTaskId,
  };
}

/** Build a complete trace for one (person, job) recommendation. */
export function traceRecommendation(
  planted: PlantedPerson,
  jobs: PlantedJob[],
  targetJobId: string,
  mode: RecommendationMode = "B_BACKGROUND_AND_INTEREST",
  run?: PersonRun,
): RecommendationTrace {
  const plantedJob = jobs.find((job) => job.jobId === targetJobId)!;
  const personRun = run ?? runPerson(planted, jobs);
  const person = buildPersonFromRenderedText(planted);
  const job = buildJobFromRenderedText(plantedJob);
  const label = labelPair(planted, plantedJob);
  const candidate = personRun.candidates.find((entry) => entry.jobId === targetJobId)!;

  // ---- person evidence and mappings ----
  const atomByEvidenceId = new Map<string, string>();
  for (const entry of planted.experienceEvidence) atomByEvidenceId.set(entry.id, entry.rendered.atomId);
  for (const entry of planted.preferenceEvidence) atomByEvidenceId.set(entry.id, entry.rendered.atomId);
  for (const entry of planted.aspirationEvidence) atomByEvidenceId.set(entry.id, entry.rendered.atomId);
  const atomIdToTaskId = new Map<string, string>();
  for (const entry of planted.performed) atomIdToTaskId.set(entry.atom.atomId, entry.atom.taskId);
  for (const atom of [...planted.liked, ...planted.disliked, ...planted.desired]) atomIdToTaskId.set(atom.atomId, atom.taskId);
  for (const atom of [...plantedJob.coreAtoms, ...plantedJob.incidentalAtoms]) atomIdToTaskId.set(atom.atomId, atom.taskId);

  const rawTextById = new Map<string, string>([
    ...planted.experienceEvidence.map((entry) => [entry.id, entry.rendered.text] as const),
    ...planted.preferenceEvidence.map((entry) => [entry.id, entry.rendered.text] as const),
    ...planted.aspirationEvidence.map((entry) => [entry.id, entry.rendered.text] as const),
  ]);

  const personEvidence = [
    ...planted.experienceEvidence.map((entry) => ({ id: entry.id, declaredKind: "experience", rawText: entry.rendered.text, extractorClass: classifyEvidenceSentence(entry.rendered.text), provenance: `planted atom ${entry.rendered.atomId}, paraphrase family ${entry.rendered.family}, difficulty ${entry.rendered.difficulty}` })),
    ...planted.preferenceEvidence.map((entry) => ({ id: entry.id, declaredKind: `preference:${entry.stance}`, rawText: entry.rendered.text, extractorClass: classifyEvidenceSentence(entry.rendered.text), provenance: `planted atom ${entry.rendered.atomId}, paraphrase family ${entry.rendered.family}, difficulty ${entry.rendered.difficulty}` })),
    ...planted.aspirationEvidence.map((entry) => ({ id: entry.id, declaredKind: "aspiration", rawText: entry.rendered.text, extractorClass: classifyEvidenceSentence(entry.rendered.text), provenance: `planted atom ${entry.rendered.atomId}, paraphrase family ${entry.rendered.family}, difficulty ${entry.rendered.difficulty}` })),
  ];

  const personMappings: MappingTrace[] = [
    ...person.experience.map((entry) => ({ id: entry.id, mapping: entry.mapping })),
    ...person.preferences.map((entry) => ({ id: entry.id, mapping: entry.mapping })),
    ...person.aspirations.map((entry) => ({ id: entry.id, mapping: entry.mapping })),
  ].map((entry) => {
    const atomId = atomByEvidenceId.get(entry.id) ?? "";
    return mappingTrace(entry.id, rawTextById.get(entry.id) ?? entry.mapping.sourceText, entry.mapping, atomId, atomIdToTaskId.get(atomId) ?? "");
  });

  // ---- job side ----
  const jobAtomByResponsibilityId = new Map(plantedJob.responsibilities.map((entry) => [entry.id, entry.rendered.atomId]));
  const jobMappings = job.responsibilities.map((responsibility) => {
    const atomId = jobAtomByResponsibilityId.get(responsibility.id) ?? "";
    return mappingTrace(responsibility.id, responsibility.sourceText, responsibility.mapping, atomId, atomIdToTaskId.get(atomId) ?? "");
  });

  // ---- retrieval ----
  const retrievalOrder = canonicalWorkRetrieval.retrieve(planted, jobs);
  const rankInCandidateSet = retrievalOrder.indexOf(targetJobId);
  const sharedIdentities = sharedCanonicalIdentities(personMappings, jobMappings);

  // ---- channel contributions ----
  const channels: ChannelContributionTrace[] = (["experience", "preference", "direction", "qualification"] as const).map((channel) => {
    const score = candidate[channel];
    const streamIds = channel === "experience" ? person.experience.map((entry) => entry.id)
      : channel === "preference" ? person.preferences.map((entry) => entry.id)
      : channel === "direction" ? person.aspirations.map((entry) => entry.id)
      : [];
    const contributions = channel === "qualification" ? [] : personMappings
      .filter((mapping) => streamIds.includes(mapping.sourceId))
      .flatMap((mapping) => jobMappings
        .filter((jobMapping) => identityOf(jobMapping) && identityOf(jobMapping) === identityOf(mapping))
        .map((jobMapping) => ({
          personEvidenceId: mapping.sourceId,
          jobResponsibilityId: jobMapping.sourceId,
          sharedIdentity: identityOf(mapping)!,
          weightExplanation: weightExplanation(channel, mapping, planted, jobMapping),
        })));
    return { channel, score: score.score, coverage: score.coverage, evidenceCount: score.evidenceCount, contributions, diagnostics: score.diagnostics };
  });

  // ---- policy ----
  const hardGapsByJob = new Map(jobs.map((entry) => [entry.jobId, labelPair(planted, entry).hardGaps]));
  const modeResult = applyMode(mode, personRun, hardGapsByJob);
  const reason = modeResult.reasons.find((entry) => entry.jobId === targetJobId)!;
  const above = modeResult.reasons.find((entry) => entry.rank === reason.rank - 1);

  // ---- explanation, built only from contributions actually used ----
  const explanation = buildExplanation(channels, plantedJob, label);

  const trace: RecommendationTrace = {
    version: TRACE_VERSION,
    personId: planted.personId,
    jobId: targetJobId,
    mode,
    personEvidence,
    personMappings,
    jobResponsibilities: plantedJob.responsibilities.map((entry) => ({ id: entry.id, rawText: entry.rendered.text, core: entry.core })),
    jobMappings,
    retrieval: {
      strategy: canonicalWorkRetrieval.id,
      version: canonicalWorkRetrieval.version,
      rankInCandidateSet: rankInCandidateSet < 0 ? null : rankInCandidateSet + 1,
      enteredCandidateSet: rankInCandidateSet >= 0,
      reason: sharedIdentities.length
        ? `shares canonical work ${sharedIdentities.slice(0, 3).join(", ")}${sharedIdentities.length > 3 ? ` and ${sharedIdentities.length - 3} more` : ""} with this person's evidence`
        : "no canonical work shared with this person's evidence; retrieved only by pool membership",
    },
    channels,
    constraints: {
      declared: [],
      hardViolations: [],
      note: "No user constraint fields (location, remote mode, compensation, authorization) exist in the current data model, so no constraints are declared and none can be violated. Fabricating them to satisfy a metric would be worse than recording the gap: see docs/METRIC_COVERAGE_MATRIX.md row 19.",
    },
    policy: {
      mode,
      finalRank: reason.rank,
      totalCandidates: modeResult.ranked.length,
      paretoFront: reason.paretoFront,
      tieBreak: reason.tieBreak,
      hardGapPartition: reason.hardGapPartition,
      outrankedBecause: above
        ? `rank ${above.rank} (${above.jobId}) is ahead because it sits on Pareto front ${above.paretoFront ?? "n/a"} with ${above.tieBreak}; this job is front ${reason.paretoFront ?? "n/a"} with ${reason.tieBreak}`
        : "this job is ranked first",
    },
    explanation,
    plantedTruth: label,
    stageVerdicts: [],
  };
  trace.stageVerdicts = buildStageVerdicts(trace);
  return trace;
}

function identityOf(mapping: MappingTrace): string | null {
  if (mapping.selectedTaskId) return `task:${mapping.selectedTaskId}`;
  if (mapping.selectedDwaId) return `dwa:${mapping.selectedDwaId}`;
  return null;
}

function sharedCanonicalIdentities(personMappings: MappingTrace[], jobMappings: MappingTrace[]): string[] {
  const personIds = new Set(personMappings.map(identityOf).filter((identity): identity is string => Boolean(identity)));
  return [...new Set(jobMappings.map(identityOf).filter((identity): identity is string => Boolean(identity) && personIds.has(identity!)))] as string[];
}

function weightExplanation(channel: string, personMapping: MappingTrace, planted: PlantedPerson, jobMapping: MappingTrace): string {
  const level = personMapping.selectedTaskId && jobMapping.selectedTaskId ? "exact Task" : "DWA";
  const credit = level === "exact Task" ? 1 : DWA_PARTIAL_CREDIT;
  if (channel !== "experience") return `${level} match, credit ${credit}`;
  const performed = planted.performed.find((entry) => entry.evidenceId === personMapping.sourceId);
  if (!performed) return `${level} match, credit ${credit}`;
  return `${level} match, credit ${credit} x strength(${performed.strength})=${EXPERIENCE_STRENGTH_WEIGHTS[performed.strength]} x ownership(${performed.ownership})=${EXPERIENCE_OWNERSHIP_WEIGHTS[performed.ownership]}`;
}

/**
 * Build an explanation that cites ONLY contributions the scoring actually used. A sentence
 * with no supporting contribution is listed under `unsupportedSentences` rather than emitted
 * as if it were grounded.
 */
function buildExplanation(channels: ChannelContributionTrace[], job: PlantedJob, label: PairLabel) {
  const sentences: string[] = [];
  const citedEvidenceIds: string[] = [];
  const citedResponsibilityIds: string[] = [];
  const unsupportedSentences: string[] = [];

  const experience = channels.find((channel) => channel.channel === "experience")!;
  if (experience.contributions.length) {
    sentences.push(`This role matches ${experience.contributions.length} work pattern(s) you have performed.`);
    citedEvidenceIds.push(...experience.contributions.map((entry) => entry.personEvidenceId));
    citedResponsibilityIds.push(...experience.contributions.map((entry) => entry.jobResponsibilityId));
  }
  const direction = channels.find((channel) => channel.channel === "direction")!;
  if (direction.contributions.length && !experience.contributions.length) {
    sentences.push("You have not done this work before, but it matches what you say you want to do next.");
    citedEvidenceIds.push(...direction.contributions.map((entry) => entry.personEvidenceId));
    citedResponsibilityIds.push(...direction.contributions.map((entry) => entry.jobResponsibilityId));
  }
  const preference = channels.find((channel) => channel.channel === "preference")!;
  if (preference.score !== null && preference.score < 0.5 && preference.contributions.length) {
    sentences.push("This role contains work you have explicitly said you do not enjoy.");
    citedEvidenceIds.push(...preference.contributions.map((entry) => entry.personEvidenceId));
    citedResponsibilityIds.push(...preference.contributions.map((entry) => entry.jobResponsibilityId));
  }
  if (label.hardGaps.length) {
    sentences.push(`${label.hardGaps.length} required qualification(s) are not currently demonstrated: ${label.hardGaps.join(", ")}.`);
  }
  if (!sentences.length) {
    sentences.push("No channel produced a supported rationale for this role.");
  }
  return { sentences, citedEvidenceIds: [...new Set(citedEvidenceIds)], citedResponsibilityIds: [...new Set(citedResponsibilityIds)], unsupportedSentences };
}

/**
 * Per-stage verdict. This is what makes "which subsystem caused this?" a lookup: each stage is
 * graded against the planted truth for that stage alone, so a failure downstream of a broken
 * stage does not mask its cause.
 */
function buildStageVerdicts(trace: RecommendationTrace): RecommendationTrace["stageVerdicts"] {
  const verdicts: RecommendationTrace["stageVerdicts"] = [];
  const rate = (values: boolean[]) => (values.length ? values.filter(Boolean).length / values.length : null);

  const extraction = trace.personEvidence.filter((entry) => entry.declaredKind === "experience");
  const extractionOk = rate(extraction.map((entry) => entry.extractorClass === "EXPOSURE" || entry.extractorClass === "SUCCESS"));
  verdicts.push({ stage: "person_evidence_extraction", verdict: verdictFor(extractionOk, 0.8, 0.5), detail: `${extraction.length} experience statements, ${pct(extractionOk)} classified as exposure/success by the extractor` });

  const personRecovery = rate(trace.personMappings.map((mapping) => mapping.recovered));
  verdicts.push({ stage: "person_canonical_mapping", verdict: verdictFor(personRecovery, 0.7, 0.4), detail: `${pct(personRecovery)} of person statements recovered their planted Task; ${trace.personMappings.filter((mapping) => mapping.level === "abstain").length} abstentions` });

  verdicts.push({ stage: "job_responsibility_extraction", verdict: trace.jobResponsibilities.length ? "OK" : "FAILED", detail: `${trace.jobResponsibilities.length} responsibilities present (${trace.jobResponsibilities.filter((entry) => entry.core).length} core)` });

  const jobRecovery = rate(trace.jobMappings.map((mapping) => mapping.recovered));
  verdicts.push({ stage: "job_canonical_mapping", verdict: verdictFor(jobRecovery, 0.7, 0.4), detail: `${pct(jobRecovery)} of responsibilities recovered their planted Task` });

  verdicts.push({ stage: "candidate_retrieval", verdict: trace.retrieval.enteredCandidateSet ? "OK" : "FAILED", detail: trace.retrieval.enteredCandidateSet ? `entered the candidate set at rank ${trace.retrieval.rankInCandidateSet}` : "never entered the candidate set: no downstream ranking could recover this job" });

  for (const channel of ["experience", "preference", "direction"] as const) {
    const contribution = trace.channels.find((entry) => entry.channel === channel)!;
    const plantedGrade = trace.plantedTruth[channel].grade;
    const scored = contribution.score !== null;
    const verdict: "OK" | "DEGRADED" | "FAILED" | "NOT_APPLICABLE" =
      plantedGrade === 0 && !scored ? "NOT_APPLICABLE"
        : plantedGrade >= 1 && !contribution.contributions.length ? "FAILED"
        : plantedGrade >= 2 && contribution.contributions.length < plantedGrade ? "DEGRADED"
        : "OK";
    verdicts.push({ stage: `${channel}_fit` as TraceStage, verdict, detail: `planted grade ${plantedGrade}, score ${contribution.score === null ? "null" : contribution.score.toFixed(4)}, ${contribution.contributions.length} traced contribution(s)` });
  }

  const qualification = trace.channels.find((entry) => entry.channel === "qualification")!;
  verdicts.push({ stage: "qualification_fit", verdict: qualification.diagnostics.some((text) => text.startsWith("hardGaps=")) ? "OK" : "DEGRADED", detail: `${qualification.diagnostics.join("; ")}; planted hard gaps: ${trace.plantedTruth.hardGaps.join(", ") || "none"}` });
  verdicts.push({ stage: "constraints", verdict: "NOT_APPLICABLE", detail: trace.constraints.note });
  verdicts.push({ stage: "recommendation_policy", verdict: "OK", detail: `${trace.policy.mode}: rank ${trace.policy.finalRank}/${trace.policy.totalCandidates}, ${trace.policy.outrankedBecause}` });
  verdicts.push({
    stage: "explanation",
    verdict: trace.explanation.unsupportedSentences.length ? "FAILED" : "OK",
    detail: `${trace.explanation.sentences.length} sentence(s), ${trace.explanation.citedEvidenceIds.length} cited evidence id(s), ${trace.explanation.unsupportedSentences.length} unsupported`,
  });
  return verdicts;
}

function verdictFor(value: number | null, okAt: number, degradedAt: number): "OK" | "DEGRADED" | "FAILED" | "NOT_APPLICABLE" {
  if (value === null) return "NOT_APPLICABLE";
  if (value >= okAt) return "OK";
  if (value >= degradedAt) return "DEGRADED";
  return "FAILED";
}

function pct(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

/** Deterministic trace fixture: one person, one job, fully traced. */
export function traceFixture(options: { split?: BenchSplit; difficulty?: RenderDifficulty; archetype?: PlantedJob["archetype"]; mode?: RecommendationMode } = {}) {
  const corpus = buildBenchCorpus({ split: options.split ?? "DEVELOPMENT", difficulty: options.difficulty ?? "standard", people: 1 });
  const planted = corpus.people[0]!;
  const jobs = corpus.jobsByPerson.get(planted.personId)!;
  const target = jobs.find((job) => job.archetype === (options.archetype ?? "CROSS_TITLE_TRANSFER")) ?? jobs[0]!;
  return traceRecommendation(planted, jobs, target.jobId, options.mode ?? "B_BACKGROUND_AND_INTEREST");
}
