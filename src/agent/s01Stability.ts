// Preregistered S-01 stability formulas.
//
// These definitions are committed before any paid S-01 generation. Changing a formula
// after seeing results would be a post-hoc metric, which is the failure this module exists
// to prevent. The paid runner is not authorized in this session; the formulas can still be
// unit-tested on synthetic rankings and blueprints.

export const S01_EXPERIMENT_ID = "stochastic-stability:openai:LEXICAL_TRAP:low:amended";
export const S01_SUPERSEDED_EXPERIMENT_ID = "stochastic-stability:openai:LEXICAL_TRAP:low";

export const S01_DESIGN = {
  people: 12,
  trials: 4,
  family: "LEXICAL_TRAP",
  split: "DEVELOPMENT",
  topK: 10,
  recommendationChurnK: 10,
  estimatedCalls: 48,
  estimatedCostUsd: 3.73,
  v1IsFrozenHistoricalRealization: true,
  signCountsAreDescriptiveOnly: true,
  nonInferiorityMargins: null,
  nonInferiorityStatus: "UNRESOLVED",
} as const;

export const S01_VERDICT_DIMENSIONS = [
  "REPRESENTATION_STABILITY",
  "RANKING_STABILITY",
  "PROVENANCE_STABILITY",
  "ARCHITECTURE_DECISION_STABILITY",
] as const;

export type S01VerdictDimension = (typeof S01_VERDICT_DIMENSIONS)[number];
export type S01DimensionVerdict = "SUPPORTED" | "CONCERN" | "INCONCLUSIVE";

export const ROLE_FIELDS = ["action", "object", "purpose", "method", "domain"] as const;
export type RoleField = (typeof ROLE_FIELDS)[number];

export interface RoleWork {
  action: string;
  object: string;
  purpose: string;
  method: string;
  domain: string;
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
};

const sampleSd = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const avg = mean(values)!;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

export function summaryStats(values: number[]): {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  sd: number | null;
} {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    range: values.length ? Math.max(...values) - Math.min(...values) : null,
    sd: sampleSd(values),
  };
}

/**
 * Recommendation churn, preregistered before results:
 *   1 - |TopK_A ∩ TopK_B| / K
 *
 * K is the declared list length, not |A ∪ B| and not min(|A|,|B|). A shorter
 * list therefore increases churn, which is the product-relevant reading: the
 * user was shown a different set.
 */
export function recommendationChurn(rankedA: string[], rankedB: string[], k = S01_DESIGN.recommendationChurnK): number {
  const headA = new Set(rankedA.slice(0, k));
  const headB = new Set(rankedB.slice(0, k));
  let overlap = 0;
  for (const jobId of headA) if (headB.has(jobId)) overlap += 1;
  return 1 - overlap / k;
}

export function topKOverlap(rankedA: string[], rankedB: string[], k: number): number {
  const headA = new Set(rankedA.slice(0, k));
  const headB = new Set(rankedB.slice(0, k));
  let overlap = 0;
  for (const jobId of headA) if (headB.has(jobId)) overlap += 1;
  return overlap / k;
}

export function top1Agreement(rankedA: string[], rankedB: string[]): number {
  if (!rankedA.length || !rankedB.length) return 0;
  return rankedA[0] === rankedB[0] ? 1 : 0;
}

/** Spearman rank correlation over the union of both lists. Missing ranks are |list|+1. */
export function spearmanRankCorrelation(rankedA: string[], rankedB: string[]): number | null {
  const union = [...new Set([...rankedA, ...rankedB])];
  if (union.length < 2) return null;
  const rankOf = (list: string[], jobId: string) => {
    const index = list.indexOf(jobId);
    return index >= 0 ? index + 1 : list.length + 1;
  };
  const ranksA = union.map((jobId) => rankOf(rankedA, jobId));
  const ranksB = union.map((jobId) => rankOf(rankedB, jobId));
  return pearson(ranksA, ranksB);
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = mean(xs)!;
  const meanY = mean(ys)!;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (!denX || !denY) return null;
  return num / Math.sqrt(denX * denY);
}

export function pairwiseJaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size && !setB.size) return 1;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection += 1;
  return intersection / (setA.size + setB.size - intersection);
}

export function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function workIdentity(work: RoleWork): string {
  return ROLE_FIELDS.map((field) => normalizeRole(work[field])).join("|");
}

export function fieldAgreement(worksA: RoleWork[], worksB: RoleWork[], field: RoleField): number {
  const bagA = worksA.map((work) => normalizeRole(work[field])).sort();
  const bagB = worksB.map((work) => normalizeRole(work[field])).sort();
  return pairwiseJaccard(bagA, bagB);
}

export function allPairwise<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) pairs.push([items[i]!, items[j]!]);
  }
  return pairs;
}

/**
 * Architecture-decision flip vs the written P-01 Case A conclusion.
 *
 * Uses P-01's own published rules, not a newly invented NDCG margin:
 * - contamination > 0.05 would have failed P-01
 * - experience paired CI excluding zero downward would have been Case C
 *
 * Direction CI excluding zero downward would have changed the Direction story
 * (the P-01 caveat), not the primary Case A verdict. Reported separately.
 */
export function architectureDecisionFlip(input: {
  contaminationMax: number;
  experienceCiExcludesZeroDownward: boolean;
  directionCiExcludesZeroDownward: boolean;
}): {
  primaryCaseAWouldStand: boolean;
  directionStoryWouldChange: boolean;
} {
  return {
    primaryCaseAWouldStand: input.contaminationMax <= 0.05 && !input.experienceCiExcludesZeroDownward,
    directionStoryWouldChange: input.directionCiExcludesZeroDownward,
  };
}

export const S01_FOUR_TRIAL_JUSTIFICATION = {
  retain: true,
  whyFourNotThree:
    "Four trials are an economical first repeated-measures screen: they yield 6 pairwise comparisons per person and a four-point distribution (min, two interior, max), which three trials cannot show. The fourth trial costs one additional generation per person, not a new architecture.",
  whyNotTwo:
    "Two trials can only produce a range. They cannot tell an outlier from a typical spread.",
  whyNotFivePlus:
    "A fifth trial is linear cost for diminishing distributional information on an n=12 DEVELOPMENT screen. Person-sample power stays n=12 regardless (POW-01).",
  whatFourCanEstablish:
    "Whether v2 generation variance is small, moderate, or large enough that a single draw can change representation identity, recommendation identity, provenance cleanliness, or the written P-01 Case A conclusion — relative to one frozen historical v1 realization.",
  whatFourCannotEstablish: [
    "Conventional statistical power or a precise variance estimate",
    "Equivalence or non-inferiority of v2 vs v1 (margins remain unresolved; person n stays 12)",
    "Symmetric stochastic uncertainty of both architectures (v1 is one frozen realization)",
    "Prompt/format robustness (that is S-02)",
    "Model/alias drift (that is S-03)",
    "Population generalization beyond these 12 DEVELOPMENT people",
  ],
  rejectedJustification:
    "Four trials are NOT justified because they permit a 3-to-1 sign majority. Sign counts may be reported descriptively and must not be the decision rule.",
} as const;
