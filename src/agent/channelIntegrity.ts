// Does the architecture keep Experience and Direction apart?
//
// The ranking benchmark cannot answer this. A blueprint that quietly imports a person's history
// into their ambitions can still rank well, because in a synthetic corpus history and ambition
// often point at neighbouring work. The product failure it causes is not a ranking failure — it
// is recommending someone back into the job they are trying to escape, which is the one mistake
// a career tool does not get a second chance at.
//
// So contamination is measured directly against planted truth, per direction, as a rate.
//
// WHY THE MATCHER IS STRICT
// ------------------------
// A work counts as matching a planted frame only when ALL FIVE identity roles are mentioned. The
// existing person-understanding analysis learned this the hard way: at 3-of-5 it reported 9
// channel leaks across 12 people and every one was a false positive, because the corpus's
// plausibility constraints make unrelated frames share a domain and purpose routinely. A crude
// detector announcing a failure that is not there is worse than no detector, and it would be a
// particularly bad way to choose an architecture.
//
// The cost of strictness is the opposite error: contamination whose wording the concept lexicon
// does not contain is missed. Every rate here is therefore a LOWER BOUND on contamination, and
// must never be reported as "the architecture does not contaminate".
import type { CareerBlueprint, StructuredWork } from "@/agent/agentArchitecture";
import type { PlantedFramePerson } from "@/bench/frameCorpus";
import { CONCEPTS_BY_ID, IDENTITY_ROLES } from "@/bench/semanticFrame";

export const CHANNEL_INTEGRITY_VERSION = "channel-integrity.v1";

const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? []);

/**
 * The meaningful words of a concept id, WITHOUT its type prefix.
 *
 * Concept ids are `type.name` — `act.audit`, `obj.ledger`, `dom.healthcare`. The existing
 * person-understanding helper splits the whole id, which puts `act`, `obj`, `pur`, `met` and
 * `dom` into the matchable vocabulary. Those prefixes are shared by every concept of a type, so
 * any text containing the token "act" matches EVERY action concept. In a fixture built from
 * concept ids this fires constantly; in real model prose it fires rarely, which is why it has
 * gone unnoticed. Either way it is a false-positive generator in a contamination detector, and a
 * contamination detector that cries wolf is how an architecture gets chosen for the wrong reason.
 */
function conceptWordsFor(conceptId: string): Set<string> {
  const concept = CONCEPTS_BY_ID.get(conceptId);
  if (!concept) return new Set();
  const withoutTypePrefix = conceptId.slice(conceptId.indexOf(".") + 1);
  return new Set<string>([
    ...withoutTypePrefix.split(/[.\-_]/).flatMap((part) => [...words(part)]),
    ...concept.neutralForms.flatMap((form) => [...words(form)]),
  ]);
}

/**
 * Do the interpreted fields mention this planted concept in any recognisable form?
 *
 * Exported so there is exactly ONE implementation of concept mention in the repository. The
 * duplicate that used to live in `scripts/analyze-blueprints.ts` carried the type-prefix defect
 * described above, and two copies of a matcher is how one of them quietly stops matching what the
 * other does.
 *
 * Deliberately generous, and its limits are stated: matching is word overlap against the
 * concept's own surface forms, so it cannot credit a correct interpretation that uses a word the
 * lexicon does not contain. Recovery figures computed with it are LOWER BOUNDS, never accuracy.
 */
export function mentionsConcept(work: StructuredWork, conceptId: string): boolean {
  const interpreted = words([work.action, work.object, work.purpose, work.method, work.domain].join(" "));
  for (const word of conceptWordsFor(conceptId)) if (interpreted.has(word)) return true;
  return false;
}

const mentions = mentionsConcept;

type Frame = Record<string, string>;

/** Strict identity match: every one of the five roles must be recognisable in the work. */
function matchesFrame(work: StructuredWork, frame: Frame): boolean {
  return IDENTITY_ROLES.every((role) => mentions(work, frame[role]!));
}

const matchesAny = (work: StructuredWork, frames: Frame[]): boolean => frames.some((frame) => matchesFrame(work, frame));

export interface ChannelIntegrity {
  personId: string;
  /**
   * Interpreted EXPERIENCE entries that match planted DESIRED work and no planted PERFORMED
   * work. The architecture treated an ambition as a history.
   */
  directionIntoExperience: number;
  /**
   * Interpreted DESIRED entries that match planted PERFORMED work and no planted DESIRED work.
   * The architecture assumed that having done something means wanting more of it. This is the
   * contamination the product cares about most.
   */
  experienceIntoDirection: number;
  /** Interpreted LIKED entries matching planted DISLIKED work. Sign inversion, not just a leak. */
  dislikedIntoLiked: number;
  /** Denominators, so a rate is never computed from an architecture's own silence. */
  experienceEntries: number;
  desiredEntries: number;
  likedEntries: number;
  /** Planted volumes, for recall context. */
  plantedPerformed: number;
  plantedDesired: number;
  /** Strict recall: planted frames with at least one matching interpreted entry. LOWER BOUND. */
  performedRecovered: number;
  desiredRecovered: number;
}

/**
 * Contamination and recovery for one person.
 *
 * An empty channel produces zero contamination, which is why the denominators are returned
 * alongside. An architecture that abstains everywhere would otherwise look perfectly clean — the
 * same denominator-shrinking path `AGENTS.md` calls out for the preference metric.
 */
export function channelIntegrityFor(person: PlantedFramePerson, blueprint: CareerBlueprint): ChannelIntegrity {
  const performedFrames = person.performed.map((entry) => entry.work.frame as unknown as Frame);
  const desiredFrames = person.desired.map((work) => work.frame as unknown as Frame);
  const dislikedFrames = person.disliked.map((work) => work.frame as unknown as Frame);

  const experience = blueprint.experience ?? [];
  const desired = blueprint.desired ?? [];
  const liked = blueprint.liked ?? [];

  return {
    personId: person.personId,
    directionIntoExperience: experience.filter((w) => matchesAny(w, desiredFrames) && !matchesAny(w, performedFrames)).length,
    experienceIntoDirection: desired.filter((w) => matchesAny(w, performedFrames) && !matchesAny(w, desiredFrames)).length,
    dislikedIntoLiked: liked.filter((w) => matchesAny(w, dislikedFrames)).length,
    experienceEntries: experience.length,
    desiredEntries: desired.length,
    likedEntries: liked.length,
    plantedPerformed: performedFrames.length,
    plantedDesired: desiredFrames.length,
    performedRecovered: performedFrames.filter((frame) => experience.some((w) => matchesFrame(w, frame))).length,
    desiredRecovered: desiredFrames.filter((frame) => desired.some((w) => matchesFrame(w, frame))).length,
  };
}

/**
 * Channel volume against planted volume.
 *
 * ADDED AFTER the first split-agent screen, which exposed a blind spot in the strict detector
 * above. `split-full-context` emitted 10.4 experience entries against 6 planted — a 73% inflation
 * built from work the person liked or wanted rather than performed — and the 5-of-5 contamination
 * rate registered 0.008, essentially nothing. Identity-collision and volume-inflation are
 * different failures, and a detector that only sees the first will clear an architecture that is
 * badly wrong in the second.
 *
 * No verdict in that screen rests on this measure: the KEEP/REVERT decision came from the
 * preregistered paired bootstrap on NDCG. It is here so the NEXT screen cannot miss the same way.
 */
export interface ChannelVolume {
  interpreted: number;
  planted: number;
  /** interpreted / planted. 1.0 is exact; above 1 is inflation, below 1 is omission. */
  ratio: number;
}

export function channelVolumes(person: PlantedFramePerson, blueprint: CareerBlueprint): Record<string, ChannelVolume> {
  const pair = (interpreted: number, planted: number): ChannelVolume => ({
    interpreted, planted, ratio: planted > 0 ? interpreted / planted : 0,
  });
  return {
    experience: pair((blueprint.experience ?? []).length, person.performed.length),
    liked: pair((blueprint.liked ?? []).length, person.liked.length),
    disliked: pair((blueprint.disliked ?? []).length, person.disliked.length),
    desired: pair((blueprint.desired ?? []).length, person.desired.length),
  };
}

export interface IntegritySummary {
  people: number;
  /** Contaminated entries as a share of entries in the RECEIVING channel. */
  directionIntoExperienceRate: number;
  experienceIntoDirectionRate: number;
  dislikedIntoLikedRate: number;
  /** Strict recall against planted truth. LOWER BOUND, never an accuracy figure. */
  performedRecall: number;
  desiredRecall: number;
  /** Mean entries emitted per person, so abstention is visible next to every rate. */
  meanExperienceEntries: number;
  meanDesiredEntries: number;
  /** People whose channel was empty. An empty channel cannot contaminate, and must be seen. */
  emptyExperienceChannels: number;
  emptyDesiredChannels: number;
}

export function summarizeIntegrity(rows: ChannelIntegrity[]): IntegritySummary {
  const sum = (pick: (row: ChannelIntegrity) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const rate = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 0);
  return {
    people: rows.length,
    directionIntoExperienceRate: rate(sum((r) => r.directionIntoExperience), sum((r) => r.experienceEntries)),
    experienceIntoDirectionRate: rate(sum((r) => r.experienceIntoDirection), sum((r) => r.desiredEntries)),
    dislikedIntoLikedRate: rate(sum((r) => r.dislikedIntoLiked), sum((r) => r.likedEntries)),
    performedRecall: rate(sum((r) => r.performedRecovered), sum((r) => r.plantedPerformed)),
    desiredRecall: rate(sum((r) => r.desiredRecovered), sum((r) => r.plantedDesired)),
    meanExperienceEntries: rate(sum((r) => r.experienceEntries), rows.length),
    meanDesiredEntries: rate(sum((r) => r.desiredEntries), rows.length),
    emptyExperienceChannels: rows.filter((r) => r.experienceEntries === 0).length,
    emptyDesiredChannels: rows.filter((r) => r.desiredEntries === 0).length,
  };
}

/**
 * How far a person's stated direction diverges from their history, measured rather than bucketed.
 *
 * The product cases worth naming are "deep history in work they explicitly reject" and "ambition
 * with no history behind it". Both were originally written as boolean predicates, which reported
 * ZERO people in this corpus and was useless — not because the architecture is fine, but because
 * a threshold nobody had measured against happened to fall outside the corpus's range.
 *
 * So this reports the DISTRIBUTION, and `divergenceContrast` says plainly whether the corpus
 * contains enough spread to test a divergence hypothesis at all. Selection is from PLANTED truth,
 * never from an architecture's output.
 */
export interface PersonDivergence {
  personId: string;
  performedCount: number;
  desiredCount: number;
  dislikedCount: number;
  /**
   * Identity roles (0-5) shared between the person's closest desired work and their history.
   * 5 means their ambition IS their history; 0 means it is unrelated work.
   */
  desiredToPerformedOverlap: number;
  /** Same, for disliked work. 5 means they explicitly reject work they actually performed. */
  dislikedToPerformedOverlap: number;
}

const maxOverlap = (from: Frame[], against: Frame[]): number => {
  if (!from.length || !against.length) return -1;
  let best = 0;
  for (const frame of from) {
    for (const other of against) {
      best = Math.max(best, IDENTITY_ROLES.filter((role) => other[role] === frame[role]).length);
    }
  }
  return best;
};

export function personDivergence(person: PlantedFramePerson): PersonDivergence {
  const performed = person.performed.map((entry) => entry.work.frame as unknown as Frame);
  return {
    personId: person.personId,
    performedCount: performed.length,
    desiredCount: person.desired.length,
    dislikedCount: person.disliked.length,
    desiredToPerformedOverlap: maxOverlap(person.desired.map((w) => w.frame as unknown as Frame), performed),
    dislikedToPerformedOverlap: maxOverlap(person.disliked.map((w) => w.frame as unknown as Frame), performed),
  };
}

export interface DivergenceContrast {
  rows: PersonDivergence[];
  /** Histogram of `desiredToPerformedOverlap`, indexed 0..5. */
  desiredOverlapHistogram: number[];
  dislikedOverlapHistogram: number[];
  /**
   * True only when the corpus spans at least three distinct desired-overlap values. Below that
   * there is no contrast group, so no claim of the form "the architecture handles divergent
   * people better" is testable, however the numbers come out.
   */
  supportsDivergenceHypothesis: boolean;
  /** Why, in words, for the report. */
  limitation: string | null;
}

export function divergenceContrast(people: PlantedFramePerson[]): DivergenceContrast {
  const rows = people.map(personDivergence);
  const histogram = (pick: (row: PersonDivergence) => number) => {
    const bins = [0, 0, 0, 0, 0, 0];
    for (const row of rows) {
      const value = pick(row);
      if (value >= 0 && value <= 5) bins[value] += 1;
    }
    return bins;
  };
  const desiredOverlapHistogram = histogram((row) => row.desiredToPerformedOverlap);
  const dislikedOverlapHistogram = histogram((row) => row.dislikedToPerformedOverlap);
  const distinctDesired = desiredOverlapHistogram.filter((count) => count > 0).length;
  const distinctDisliked = dislikedOverlapHistogram.filter((count) => count > 0).length;

  const notes: string[] = [];
  if (distinctDesired < 3) {
    notes.push(
      `desired-to-performed overlap takes only ${distinctDesired} distinct value(s) ` +
        `(histogram ${desiredOverlapHistogram.join("/")}), so there is no low-experience/high-direction group`,
    );
  }
  if (distinctDisliked < 2) {
    notes.push(
      `disliked-to-performed overlap is constant at ${dislikedOverlapHistogram.findIndex((c) => c > 0)} ` +
        `for every person, so "rejects work they performed" is the whole corpus rather than a testable subgroup`,
    );
  }
  return {
    rows,
    desiredOverlapHistogram,
    dislikedOverlapHistogram,
    supportsDivergenceHypothesis: distinctDesired >= 3,
    limitation: notes.length ? notes.join("; ") : null,
  };
}
