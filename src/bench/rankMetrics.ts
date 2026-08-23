// Ranking metrics over planted-truth labels.
//
// Every function takes a RANKED LIST OF JOB IDS produced by the system under test and a
// LABEL LOOKUP produced by src/bench/labels.ts. The two never share a code path, so no metric
// here can be satisfied by agreeing with the scorer.
import type { Channel, GradedPair, Grade } from "@/bench/labels";
import { channelLabel, isRelevant } from "@/bench/labels";

export const RANK_METRIC_VERSION = "bench-rank-metrics.v1";

export interface RankedList {
  personId: string;
  /** Job ids in the order the system returned them. */
  jobIds: string[];
}

/**
 * Label lookup, typed to the shared `GradedPair` shape rather than to one corpus's label type,
 * so the atom substrate and the frame substrate use the SAME metric implementations. Two
 * copies of NDCG would eventually disagree, and the disagreement would look like a result.
 */
export type LabelLookup = (jobId: string) => GradedPair | undefined;

const gain = (grade: Grade) => 2 ** grade - 1;
const discount = (rank: number) => 1 / Math.log2(rank + 2);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * Normalized discounted cumulative gain at K, using graded planted relevance.
 * Returns null when the person has no relevant job at all on this channel, so
 * "nothing to find" is never averaged in as a zero.
 */
export function ndcgAtK(ranked: string[], labels: LabelLookup, channel: Channel, k: number): number | null {
  const grades = ranked.slice(0, k).map((jobId) => channelLabel(labels(jobId) ?? emptyLabel(jobId), channel).grade);
  const dcg = grades.reduce<number>((sum, grade, index) => sum + gain(grade) * discount(index), 0);
  const ideal = allGrades(ranked, labels, channel).sort((a, b) => b - a).slice(0, k);
  const idcg = ideal.reduce<number>((sum, grade, index) => sum + gain(grade) * discount(index), 0);
  if (!idcg) return null;
  return dcg / idcg;
}

export function recallAtK(ranked: string[], labels: LabelLookup, channel: Channel, k: number): number | null {
  const relevant = ranked.filter((jobId) => { const label = labels(jobId); return label ? isRelevant(label, channel) : false; });
  if (!relevant.length) return null;
  const found = ranked.slice(0, k).filter((jobId) => { const label = labels(jobId); return label ? isRelevant(label, channel) : false; });
  return found.length / relevant.length;
}

export function precisionAtK(ranked: string[], labels: LabelLookup, channel: Channel, k: number): number | null {
  const head = ranked.slice(0, k);
  if (!head.length) return null;
  return head.filter((jobId) => { const label = labels(jobId); return label ? isRelevant(label, channel) : false; }).length / head.length;
}

export function reciprocalRank(ranked: string[], labels: LabelLookup, channel: Channel): number | null {
  const index = ranked.findIndex((jobId) => { const label = labels(jobId); return label ? isRelevant(label, channel) : false; });
  if (index < 0) return null;
  return 1 / (index + 1);
}

/**
 * Fraction of comparable pairs the ranking orders correctly. Only pairs with DIFFERENT
 * planted grades are comparable, so ties never inflate the score.
 */
export function pairwiseAccuracy(ranked: string[], labels: LabelLookup, channel: Channel): number | null {
  let comparable = 0;
  let correct = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const a = channelLabel(labels(ranked[i]!) ?? emptyLabel(ranked[i]!), channel).grade;
      const b = channelLabel(labels(ranked[j]!) ?? emptyLabel(ranked[j]!), channel).grade;
      if (a === b) continue;
      comparable += 1;
      if (a > b) correct += 1;
    }
  }
  return comparable ? correct / comparable : null;
}

/** Recall@K restricted to jobs satisfying a planted predicate (cross-title, transition, ...). */
export function subsetRecallAtK<T extends GradedPair>(ranked: string[], labels: (jobId: string) => T | undefined, predicate: (label: T) => boolean, k: number): number | null {
  const targets = ranked.filter((jobId) => { const label = labels(jobId); return label ? predicate(label) : false; });
  if (!targets.length) return null;
  const found = ranked.slice(0, k).filter((jobId) => { const label = labels(jobId); return label ? predicate(label) : false; });
  return found.length / targets.length;
}

/** Precision@K restricted to a planted predicate. */
export function subsetPrecisionAtK<T extends GradedPair>(ranked: string[], labels: (jobId: string) => T | undefined, predicate: (label: T) => boolean, k: number): number | null {
  const head = ranked.slice(0, k);
  if (!head.length) return null;
  return head.filter((jobId) => { const label = labels(jobId); return label ? predicate(label) : false; }).length / head.length;
}

/** Mean rank position (1-based) of jobs satisfying a predicate. Lower is better. */
export function meanRankOf<T extends GradedPair>(ranked: string[], labels: (jobId: string) => T | undefined, predicate: (label: T) => boolean): number | null {
  const positions = ranked.map((jobId, index) => ({ jobId, index })).filter(({ jobId }) => { const label = labels(jobId); return label ? predicate(label) : false; }).map(({ index }) => index + 1);
  return positions.length ? mean(positions) : null;
}

/**
 * Rate at which a job that is worse on BOTH experience and preference outranks one that is
 * better on both. This is the joint-objective guardrail: a blended scalar can hide channel
 * damage, but a dominance violation cannot be hidden.
 */
export function dominanceViolationRate(ranked: string[], labels: LabelLookup): number | null {
  let comparable = 0;
  let violations = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const higher = labels(ranked[i]!);
      const lower = labels(ranked[j]!);
      if (!higher || !lower) continue;
      const lowerDominates = lower.experience.raw >= higher.experience.raw && lower.preference.raw >= higher.preference.raw
        && (lower.experience.raw > higher.experience.raw || lower.preference.raw > higher.preference.raw);
      const higherDominates = higher.experience.raw >= lower.experience.raw && higher.preference.raw >= lower.preference.raw
        && (higher.experience.raw > lower.experience.raw || higher.preference.raw > lower.preference.raw);
      if (!lowerDominates && !higherDominates) continue;
      comparable += 1;
      if (lowerDominates) violations += 1;
    }
  }
  return comparable ? violations / comparable : null;
}

/** Aggregate a per-person metric, ignoring people for whom the metric is undefined. */
export function macroAverage(values: (number | null)[]): number | null {
  const defined = values.filter((value): value is number => value !== null);
  return defined.length ? mean(defined) : null;
}

/** Worst per-person value, so a good mean cannot hide a catastrophic slice. */
export function worstCase(values: (number | null)[]): number | null {
  const defined = values.filter((value): value is number => value !== null);
  return defined.length ? Math.min(...defined) : null;
}

/** Count of people whose metric is below a declared catastrophe threshold. */
export function catastrophicCount(values: (number | null)[], threshold: number): number {
  return values.filter((value): value is number => value !== null && value < threshold).length;
}

function allGrades(ranked: string[], labels: LabelLookup, channel: Channel): Grade[] {
  return ranked.map((jobId) => channelLabel(labels(jobId) ?? emptyLabel(jobId), channel).grade);
}

function emptyLabel(jobId: string): GradedPair {
  const zero = { raw: 0, grade: 0 as Grade, matchedAtomIds: [] };
  return { jobId, experience: zero, preference: zero, direction: zero, crossTitle: false, crossIndustry: false };
}
