// Algorithm-independent relevance labels over SEMANTIC FRAMES.
//
// EVERY label here is computed from PLANTED FRAME IDENTITY only. Nothing in this file reads a
// score, a mapping, a prediction, or any output of the system under test. That is what makes
// the ranking benchmarks non-circular: the grader and the algorithm share no code path.
//
// The forbidden alternative — run the current scorer, call its output ground truth, then
// evaluate the current scorer against it — is exactly what this module exists to avoid.
//
// RELATIONSHIP TO `labels.ts`
// ---------------------------
// The GRADING POLICY (thresholds, what counts as relevant / a transition / a surprising
// transfer / dominated) is imported, not re-implemented. Only the identity computation differs
// between substrates, and only that is written here. Duplicating the policy would let the two
// corpora silently disagree about what a grade 2 means.
import {
  GRADE_THRESHOLDS,
  INCIDENTAL_LABEL_WEIGHT,
  gradeFor,
  type ChannelLabel,
  type GradedPair,
} from "@/bench/labels";
import type { FrameWork, PlantedFrameJob, PlantedFramePerson, FrameJobArchetype } from "@/bench/frameCorpus";

export const FRAME_LABEL_VERSION = "frame-labels.v1";
export { GRADE_THRESHOLDS, INCIDENTAL_LABEL_WEIGHT, gradeFor };

export interface FramePairLabel extends GradedPair {
  personId: string;
  archetype: FrameJobArchetype;
  /** Fraction of the job's REQUIRED requirements the person holds. */
  qualificationFeasibility: number;
  /** Any required qualification the person does not hold. */
  hardGaps: string[];
}

const identities = (work: readonly FrameWork[]): Set<string> => new Set(work.map((entry) => entry.identity));

/**
 * Weighted planted coverage of a job's responsibilities by a set of the person's work.
 *
 * Incidental responsibilities count for less than core ones but not zero: matching a
 * peripheral duty is genuinely weaker evidence of relevance. That weight is a label-definition
 * choice shared with the atom substrate and must never be adjusted to move a metric.
 */
function coverage(job: PlantedFrameJob, personIdentities: Set<string>): { raw: number; matched: string[] } {
  const denominator = job.coreWork.length + job.incidentalWork.length * INCIDENTAL_LABEL_WEIGHT;
  if (!denominator) return { raw: 0, matched: [] };
  const matched: string[] = [];
  let numerator = 0;
  for (const work of job.coreWork) {
    if (personIdentities.has(work.identity)) {
      numerator += 1;
      matched.push(work.identity);
    }
  }
  for (const work of job.incidentalWork) {
    if (personIdentities.has(work.identity)) {
      numerator += INCIDENTAL_LABEL_WEIGHT;
      matched.push(work.identity);
    }
  }
  return { raw: numerator / denominator, matched };
}

const channel = (result: { raw: number; matched: string[] }): ChannelLabel => ({
  raw: result.raw,
  grade: gradeFor(result.raw),
  matchedAtomIds: result.matched,
});

/**
 * Label one (person, job) pair on all four channels.
 *
 * Preference is SIGNED: liked coverage minus disliked coverage. A job full of work the person
 * explicitly dislikes must not be labelled preference-relevant just because it also contains
 * some liked work. Grade 0 is the floor — negative preference is reported separately by
 * `dislikedIntrusion`, never folded into the preference grade.
 */
export function labelFramePair(person: PlantedFramePerson, job: PlantedFrameJob): FramePairLabel {
  const performed = identities(person.performed.map((entry) => entry.work));
  const experience = coverage(job, performed);
  const liked = coverage(job, identities(person.liked));
  const disliked = coverage(job, identities(person.disliked));
  const direction = coverage(job, identities(person.desired));

  const required = job.requirements.filter((requirement) => requirement.required);
  const heldValues = new Set(person.qualifications.map((qualification) => qualification.value.toLowerCase()));
  const hardGaps = required
    .filter((requirement) => !heldValues.has(requirement.value.toLowerCase()))
    .map((requirement) => requirement.value);

  return {
    personId: person.personId,
    jobId: job.jobId,
    archetype: job.archetype,
    experience: channel(experience),
    preference: channel({ raw: Math.max(0, liked.raw - disliked.raw), matched: liked.matched }),
    direction: channel(direction),
    qualificationFeasibility: required.length ? (required.length - hardGaps.length) / required.length : 1,
    hardGaps,
    // Title FAMILY, not the literal title string: two different titles from the same family
    // are not a cross-title transfer, and treating them as one would inflate the surprise
    // metrics with jobs that are not actually across a boundary.
    crossTitle: job.titleFamily !== person.homeTitleFamily,
    crossIndustry: job.industry !== person.homeIndustry,
  };
}

/** Planted share of a job's core+incidental work that is explicitly disliked. */
export function dislikedIntrusion(person: PlantedFramePerson, job: PlantedFrameJob): number {
  return coverage(job, identities(person.disliked)).raw;
}

/** Planted share of a job's work the person has never performed. The transition signal. */
export function novelWorkShare(person: PlantedFramePerson, job: PlantedFrameJob): number {
  const performed = identities(person.performed.map((entry) => entry.work));
  const all = [...job.coreWork, ...job.incidentalWork];
  if (!all.length) return 0;
  return all.filter((work) => !performed.has(work.identity)).length / all.length;
}

/** Every labelled pair for one person against their whole job pool. */
export function labelAllFor(person: PlantedFramePerson, jobs: PlantedFrameJob[]): FramePairLabel[] {
  return jobs.map((job) => labelFramePair(person, job));
}
