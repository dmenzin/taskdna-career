// Algorithm-independent relevance labels.
//
// EVERY label in this file is computed from PLANTED ATOM IDENTITY only. Nothing here reads a
// score, a mapping, a prediction, or any output of the system under test. That is what makes
// the ranking benchmarks non-circular: the grader and the algorithm share no code path.
//
// The forbidden alternative -- run the current scorer, call its output ground truth, then
// evaluate the current scorer against it -- is explicitly what this module exists to avoid.
import type { PlantedJob, PlantedPerson } from "@/bench/corpus";
import { atomIds } from "@/bench/workAtoms";

export const BENCH_LABEL_VERSION = "bench-labels.v1";

/**
 * Weight an incidental (non-core) responsibility match receives relative to a core one, in
 * the LABEL. Declared evaluation-design parameter: matching a peripheral duty is genuinely
 * weaker evidence of relevance than matching a central one, but it is not zero. This is a
 * label-definition choice, not a tunable model weight, and it must never be adjusted to move
 * a metric.
 */
export const INCIDENTAL_LABEL_WEIGHT = 0.25;

/** Graded relevance thresholds. Fixed so NDCG gains are stable across runs. */
export const GRADE_THRESHOLDS = { g3: 0.6, g2: 0.35, g1: 0.12 } as const;

export type Grade = 0 | 1 | 2 | 3;

export interface ChannelLabel {
  /** Continuous planted overlap in [0, 1] (preference is signed, see below). */
  raw: number;
  /** Quantized graded relevance for NDCG. */
  grade: Grade;
  /** Atom ids that produced the overlap. Provenance for inspection and traceability. */
  matchedAtomIds: string[];
}

export interface PairLabel {
  personId: string;
  jobId: string;
  archetype: PlantedJob["archetype"];
  experience: ChannelLabel;
  preference: ChannelLabel;
  direction: ChannelLabel;
  /** Fraction of the job's REQUIRED requirements the person holds. */
  qualificationFeasibility: number;
  /** Any required qualification the person does not hold. */
  hardGaps: string[];
  /** The job's title comes from a different stratum than the person's own. */
  crossTitle: boolean;
  /** The job's industry differs from the person's own. */
  crossIndustry: boolean;
}

/** Weighted planted coverage of a job's responsibilities by a set of the person's atoms. */
function coverage(job: PlantedJob, personAtomIds: Set<string>): { raw: number; matched: string[] } {
  const core = job.coreAtoms;
  const incidental = job.incidentalAtoms;
  const denominator = core.length + incidental.length * INCIDENTAL_LABEL_WEIGHT;
  if (!denominator) return { raw: 0, matched: [] };
  const matched: string[] = [];
  let numerator = 0;
  for (const atom of core) {
    if (personAtomIds.has(atom.atomId)) {
      numerator += 1;
      matched.push(atom.atomId);
    }
  }
  for (const atom of incidental) {
    if (personAtomIds.has(atom.atomId)) {
      numerator += INCIDENTAL_LABEL_WEIGHT;
      matched.push(atom.atomId);
    }
  }
  return { raw: numerator / denominator, matched };
}

export function gradeFor(raw: number): Grade {
  if (raw >= GRADE_THRESHOLDS.g3) return 3;
  if (raw >= GRADE_THRESHOLDS.g2) return 2;
  if (raw >= GRADE_THRESHOLDS.g1) return 1;
  return 0;
}

/**
 * Label one (person, job) pair on all four channels.
 *
 * Preference is SIGNED: liked coverage minus disliked coverage. A job full of work the person
 * explicitly dislikes must not be labelled preference-relevant just because it also contains
 * some liked work, and grade 0 is the floor -- negative preference is captured separately by
 * `dislikedIntrusion`.
 */
export function labelPair(person: PlantedPerson, job: PlantedJob): PairLabel {
  const performedIds = atomIds(person.performed.map((entry) => entry.atom));
  const likedIds = atomIds(person.liked);
  const dislikedIds = atomIds(person.disliked);
  const desiredIds = atomIds(person.desired);

  const experience = coverage(job, performedIds);
  const liked = coverage(job, likedIds);
  const disliked = coverage(job, dislikedIds);
  const direction = coverage(job, desiredIds);
  const preferenceRaw = Math.max(0, liked.raw - disliked.raw);

  const required = job.requirements.filter((requirement) => requirement.required);
  const heldValues = new Set(person.qualifications.map((qualification) => qualification.value.toLowerCase()));
  const hardGaps = required.filter((requirement) => !heldValues.has(requirement.value.toLowerCase())).map((requirement) => requirement.value);

  return {
    personId: person.personId,
    jobId: job.jobId,
    archetype: job.archetype,
    experience: { raw: experience.raw, grade: gradeFor(experience.raw), matchedAtomIds: experience.matched },
    preference: { raw: preferenceRaw, grade: gradeFor(preferenceRaw), matchedAtomIds: liked.matched },
    direction: { raw: direction.raw, grade: gradeFor(direction.raw), matchedAtomIds: direction.matched },
    qualificationFeasibility: required.length ? (required.length - hardGaps.length) / required.length : 1,
    hardGaps,
    crossTitle: job.titleStratum !== person.homeStratum,
    crossIndustry: job.industry !== person.homeIndustry,
  };
}

/** Planted share of a job's core+incidental work that is explicitly disliked. */
export function dislikedIntrusion(person: PlantedPerson, job: PlantedJob): number {
  return coverage(job, atomIds(person.disliked)).raw;
}

/** Planted share of a job's work the person has never performed. The transition signal. */
export function novelWorkShare(person: PlantedPerson, job: PlantedJob): number {
  const performedIds = atomIds(person.performed.map((entry) => entry.atom));
  const all = [...job.coreAtoms, ...job.incidentalAtoms];
  if (!all.length) return 0;
  return all.filter((atom) => !performedIds.has(atom.atomId)).length / all.length;
}

export type Channel = "experience" | "preference" | "direction";

export function channelLabel(label: PairLabel, channel: Channel): ChannelLabel {
  return label[channel];
}

/** A pair is channel-relevant when its planted grade is at least 1. */
export function isRelevant(label: PairLabel, channel: Channel): boolean {
  return channelLabel(label, channel).grade >= 1;
}

/**
 * Jobs that are independently good on BOTH experience and preference. The joint objective
 * intersects two independent labels; it never blends them into one number.
 */
export function isJointRelevant(label: PairLabel, minimumGrade: Grade = 2): boolean {
  return label.experience.grade >= minimumGrade && label.preference.grade >= minimumGrade;
}

/**
 * A career-transition target: the person has NOT substantially done this work, but wants it
 * and likes it. Deliberately requires low experience, so a resume-replication ranker cannot
 * score well here.
 */
export function isTransitionRelevant(label: PairLabel): boolean {
  return label.experience.grade <= 1 && label.direction.grade >= 2 && label.preference.grade >= 1;
}

/**
 * A surprising-transfer target: genuinely relevant on experience, but reachable only across a
 * title or industry boundary. Surprise WITHOUT relevance is excluded by construction -- the
 * experience grade requirement is what makes this a relevance metric rather than a novelty
 * metric.
 */
export function isSurprisingTransfer(label: PairLabel): boolean {
  return label.experience.grade >= 2 && (label.crossTitle || label.crossIndustry);
}

/** Does `a` dominate `b` on both experience and preference (strictly better on one)? */
export function dominates(a: PairLabel, b: PairLabel): boolean {
  const betterOrEqual = a.experience.raw >= b.experience.raw && a.preference.raw >= b.preference.raw;
  const strictlyBetter = a.experience.raw > b.experience.raw || a.preference.raw > b.preference.raw;
  return betterOrEqual && strictlyBetter;
}

/** Non-dominated experience/preference frontier among a person's labelled jobs. */
export function paretoFrontier(labels: PairLabel[]): PairLabel[] {
  return labels.filter((candidate) => !labels.some((other) => other.jobId !== candidate.jobId && dominates(other, candidate)));
}
