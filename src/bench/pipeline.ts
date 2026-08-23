// Runs the REAL production pipeline over the planted-truth corpus and produces rankings.
//
// The algorithm sees only rendered surface text. It never receives an atom id, a planted
// label, or any corpus metadata. What it does receive:
//
//   person: rendered experience / preference / aspiration statements, with a declared
//           evidence KIND (experience vs preference vs aspiration) and stance
//   job:    rendered responsibility text, title, industry, requirements
//
// SCOPE BOUNDARY, stated explicitly so the results are not over-claimed: evidence-CLASS
// classification (is this sentence experience, preference, or aspiration?) is held FIXED here
// and supplied from the planted kind. This benchmark measures canonical mapping recovery from
// paraphrased language plus channel scoring plus ranking. Evidence-class extraction from raw
// narrative is a different subsystem with its own evaluator
// (docs/METRIC_COVERAGE_MATRIX.md rows 1-4).
import { mapperCacheStats } from "@/v3/mapper";
import { buildV3Job } from "@/v3/job";
import { buildV3Person, type RawV3Evidence } from "@/v3/person";
import { scoreV3 } from "@/v3/fit";
import type { ChannelScore, V3Job, V3Person } from "@/v3/types";
import type { PlantedJob, PlantedPerson } from "@/bench/corpus";
import { contentTokens } from "@/bench/render";

export const BENCH_PIPELINE_VERSION = "bench-pipeline.v1";

export interface ScoredCandidate {
  jobId: string;
  experience: ChannelScore;
  preference: ChannelScore;
  qualification: ChannelScore;
  direction: ChannelScore;
  /** Responsibility ids whose mapping matched at least one piece of person evidence, per channel. */
  matchedResponsibilities: Record<"experience" | "preference" | "direction", string[]>;
}

export interface PersonRun {
  personId: string;
  person: V3Person;
  candidates: ScoredCandidate[];
}

/** Build the V3 person from rendered surface text plus the declared evidence kinds. */
export function buildPersonFromRenderedText(planted: PlantedPerson): V3Person {
  const raw: RawV3Evidence[] = [
    ...planted.experienceEvidence.map((entry, index) => {
      const performed = planted.performed[index]!;
      return {
        id: entry.id,
        kind: "experience" as const,
        text: entry.rendered.text,
        strength: performed.strength,
        ownership: performed.ownership,
        // Each rendered statement is its own observation stream; source-group dedup should not
        // collapse genuinely distinct statements.
        sourceGroup: entry.id,
      };
    }),
    ...planted.preferenceEvidence.map((entry) => ({ id: entry.id, kind: "preference" as const, text: entry.rendered.text, stance: entry.stance })),
    ...planted.aspirationEvidence.map((entry) => ({ id: entry.id, kind: "aspiration" as const, text: entry.rendered.text })),
    ...planted.qualifications.map((qualification, index) => ({
      id: `${planted.personId}-qual-${index + 1}`,
      kind: "qualification" as const,
      value: qualification.value,
      qualificationKind: qualification.kind,
    })),
    // Title/occupation context must create no person-side signal. Included deliberately so the
    // leakage guard is exercised on every benchmark run.
    { id: `${planted.personId}-occ`, kind: "occupation_context" as const, text: `${planted.homeTitle} in ${planted.homeIndustry}` },
  ];
  return buildV3Person(planted.personId, raw);
}

export function buildJobFromRenderedText(planted: PlantedJob): V3Job {
  return buildV3Job({
    id: planted.jobId,
    title: planted.title,
    responsibilities: planted.responsibilities.map((entry) => ({ id: entry.id, text: entry.rendered.text })),
    requirements: planted.requirements,
    context: { domain: planted.industry },
  });
}

/** Score one person against a set of jobs through the real four-channel pipeline. */
export function runPerson(planted: PlantedPerson, jobs: PlantedJob[]): PersonRun {
  const person = buildPersonFromRenderedText(planted);
  const candidates = jobs.map((plantedJob) => {
    const job = buildJobFromRenderedText(plantedJob);
    const fit = scoreV3(person, job);
    return {
      jobId: plantedJob.jobId,
      experience: fit.experience,
      preference: fit.preference,
      qualification: fit.qualification,
      direction: fit.direction,
      matchedResponsibilities: {
        experience: matchedResponsibilityIds(person.experience.map((entry) => entry.mapping), job),
        preference: matchedResponsibilityIds(person.preferences.map((entry) => entry.mapping), job),
        direction: matchedResponsibilityIds(person.aspirations.map((entry) => entry.mapping), job),
      },
    };
  });
  return { personId: planted.personId, person, candidates };
}

/** Which job responsibilities any of these person mappings resolved to the same canonical work. */
function matchedResponsibilityIds(mappings: { selected: unknown; level: string; candidates: { task: { dwas: { id: string }[]; taskId: string | null } }[] }[], job: V3Job): string[] {
  const personIdentities = new Set(mappings.flatMap((mapping) => identitiesOf(mapping)));
  return job.responsibilities.filter((responsibility) => identitiesOf(responsibility.mapping).some((identity) => personIdentities.has(identity))).map((responsibility) => responsibility.id);
}

function identitiesOf(mapping: { selected: unknown; level: string }): string[] {
  const selected = mapping.selected as { taskId?: string | null; id?: string } | null;
  if (!selected) return [];
  if (mapping.level === "task" && selected.taskId) return [`task:${selected.taskId}`];
  if (mapping.level === "dwa" && selected.id) return [`dwa:${selected.id}`];
  return [];
}

// ---------------------------------------------------------------------------
// Ranking policies over the scored candidates
// ---------------------------------------------------------------------------

export type ScoreChannel = "experience" | "preference" | "direction" | "qualification";

/**
 * Rank by one channel. A null channel score means "no evidence for this channel", which is
 * ordered LAST rather than treated as zero, so absence of evidence is never scored as a
 * negative signal.
 */
export function rankByChannel(run: PersonRun, channel: ScoreChannel): string[] {
  return [...run.candidates]
    .sort((a, b) => scoreOrNull(b, channel) - scoreOrNull(a, channel) || a.jobId.localeCompare(b.jobId))
    .map((candidate) => candidate.jobId);
}

function scoreOrNull(candidate: ScoredCandidate, channel: ScoreChannel): number {
  const value = candidate[channel].score;
  return value === null ? -1 : value;
}

/** Mapper cache statistics for the performance report. */
export function pipelineCacheStats() {
  return { ...mapperCacheStats };
}

// ---------------------------------------------------------------------------
// Conventional reference baselines
// ---------------------------------------------------------------------------

export const BASELINES = ["title-only", "resume-lexical", "resume-lexical-experience", "occupation-stratum"] as const;
export type BaselineId = (typeof BASELINES)[number];

/**
 * Deliberately simple reference baselines. The point is not to build a strong competitor; it
 * is to answer "does task-based matching find relevant work that conventional title/resume
 * similarity misses?" with a number instead of an assertion.
 */
export function rankByBaseline(baseline: BaselineId, planted: PlantedPerson, jobs: PlantedJob[]): string[] {
  const score = (job: PlantedJob): number => {
    switch (baseline) {
      case "title-only":
        return jaccard(contentTokens(planted.homeTitle), contentTokens(job.title));
      case "resume-lexical":
        return jaccard(contentTokens(planted.narrative), contentTokens(job.descriptionText));
      case "resume-lexical-experience":
        // The STRONGEST simple reference, and the one that must be beaten.
        //
        // `resume-lexical` scores the whole narrative, which mixes experience with preference,
        // aspiration, title and skills text. On the experience channel that extra text is pure
        // dilution: restricting the query to the person's experience statements alone raises
        // experience NDCG@5 from 0.920 to 0.994 at `hard` (`pnpm diag:baseline-ablation`),
        // beating the full four-channel pipeline. A baseline must never be left weak because
        // the system under test loses to the strong version of it.
        return jaccard(
          contentTokens(planted.experienceEvidence.map((entry) => entry.rendered.text).join(" ")),
          contentTokens(job.descriptionText),
        );
      case "occupation-stratum":
        // Same-stratum title plus same industry: the crudest conventional filter.
        return (job.titleStratum === planted.homeStratum ? 1 : 0) + (job.industry === planted.homeIndustry ? 0.5 : 0);
    }
  };
  return [...jobs].sort((a, b) => score(b) - score(a) || a.jobId.localeCompare(b.jobId)).map((job) => job.jobId);
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}
