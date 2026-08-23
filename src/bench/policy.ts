// Recommendation policy modes, with NO blended Overall score.
//
// The forbidden design is a silent scalar such as
// 0.4*Experience + 0.3*Preference + 0.2*Direction + 0.1*Qualification. Those weights would be
// invented, unfalsifiable, and would let a gain in one channel hide damage in another.
//
// Instead each MODE is an explicit product question with an explicit, weight-free selection
// rule. Every mode returns all four channel scores unchanged so nothing is hidden, and every
// mode is evaluated against the planted labels for the channels it claims to serve.
import type { ChannelScore } from "@/v3/types";
import type { PersonRun, ScoredCandidate } from "@/bench/pipeline";

export const POLICY_VERSION = "bench-policy.v1";

export const RECOMMENDATION_MODES = ["A_TRANSFERABLE_BACKGROUND", "B_BACKGROUND_AND_INTEREST", "C_CAREER_TRANSITION", "D_QUALIFICATION_AWARE"] as const;
export type RecommendationMode = (typeof RECOMMENDATION_MODES)[number];

export interface ModeSpec {
  mode: RecommendationMode;
  productQuestion: string;
  /** How the ordering is produced. Must be describable without numeric channel weights. */
  selectionRule: string;
  /** Channels whose planted labels this mode is graded against. */
  gradedChannels: ("experience" | "preference" | "direction")[];
  guardrails: string[];
  failureExample: string;
  dominanceBehavior: string;
}

export const MODE_SPECS: Record<RecommendationMode, ModeSpec> = {
  A_TRANSFERABLE_BACKGROUND: {
    mode: "A_TRANSFERABLE_BACKGROUND",
    productQuestion: "Which jobs contain work this person has actually performed, regardless of title?",
    selectionRule: "Order by Experience Fit descending. Preference, Direction, and Qualification are returned unchanged and never affect the order.",
    gradedChannels: ["experience"],
    guardrails: ["CROSS_TITLE_TRANSFER_RECALL@K must not fall", "SAME_TITLE_DIFFERENT_WORK precision@K must not rise", "Preference and Direction scores must be byte-identical to Mode C's for the same person"],
    failureExample: "A SAME_TITLE_DIFFERENT_WORK job outranking a CROSS_TITLE_TRANSFER job means title is leaking into Experience Fit.",
    dominanceBehavior: "Single-channel ordering, so experience/preference dominance is not applicable; dominance is reported for Mode B.",
  },
  B_BACKGROUND_AND_INTEREST: {
    mode: "B_BACKGROUND_AND_INTEREST",
    productQuestion: "Which jobs are strong on BOTH transferable background and independent work interest?",
    selectionRule:
      "Pareto rank on (Experience, Preference): all non-dominated candidates first, then the next front, and so on. Within a front, order by the MINIMUM of the two channel scores (maximin). Maximin is a weight-free ordering: it prefers the candidate whose weaker channel is strongest, and it cannot trade one channel away for the other the way a weighted sum can.",
    gradedChannels: ["experience", "preference"],
    guardrails: ["SCORE_SPACE dominance violations must stay at 0 (implementation check)", "LABEL_SPACE dominance violation rate is a quality metric and must not rise", "Experience NDCG@K and Preference NDCG@K must both be reported and neither may be sacrificed", "JOINT_RELEVANT_RECALL@K must not be reported without both single-channel NDCGs"],
    failureExample: "A job worse on both planted Experience and planted Preference outranking one better on both means the channel scores disagree with the planted truth, not that the ordering rule is broken.",
    dominanceBehavior:
      "Pareto fronts make SCORE-SPACE dominance violations structurally impossible, and that is asserted as an implementation check. LABEL-SPACE violations remain possible and are a genuine quality signal: they occur when the channel SCORES misrank relative to the planted labels. The two must never be conflated.",
  },
  C_CAREER_TRANSITION: {
    mode: "C_CAREER_TRANSITION",
    productQuestion: "Which jobs move this person toward work they want to do next and would enjoy, even without prior experience?",
    selectionRule: "Pareto rank on (Direction, Preference), maximin within a front. Experience is returned unchanged and never demotes a candidate: lacking experience is the point of a transition.",
    gradedChannels: ["direction", "preference"],
    guardrails: ["TRANSITION_RECALL@K must not fall", "Experience scores must be byte-identical to Mode A's for the same person", "must not become a resume-replication ranker: low-experience high-direction jobs must remain reachable"],
    failureExample: "If ranking here correlates with Experience Fit, Experience is leaking into Direction.",
    dominanceBehavior: "Pareto on (Direction, Preference); dominance violations reported on that pair.",
  },
  D_QUALIFICATION_AWARE: {
    mode: "D_QUALIFICATION_AWARE",
    productQuestion: "Of the jobs that fit the work, which can this person plausibly be hired into today?",
    selectionRule:
      "Take Mode B's order, then partition: candidates with no hard requirement gap first, stretch candidates (one or more hard gaps) after, each partition keeping Mode B's internal order. Qualification ANNOTATES and PARTITIONS; it never rewrites an Experience, Preference, or Direction score.",
    gradedChannels: ["experience", "preference"],
    guardrails: ["Experience/Preference/Direction scores must be byte-identical to Mode B's", "stretch roles must be retained, not dropped", "hard-gap partition must match the planted hardGaps label"],
    failureExample: "Silently dropping every stretch role turns a discovery product into a filter and hides opportunity.",
    dominanceBehavior: "Inherits Mode B's Pareto ordering within each partition.",
  },
};

export interface ModeResult {
  mode: RecommendationMode;
  /** Ranked job ids. */
  ranked: string[];
  /** Per-job explanation of WHY it landed where it did. Traceability requirement. */
  reasons: { jobId: string; rank: number; paretoFront: number | null; tieBreak: string; hardGapPartition: "meets" | "stretch" | null }[];
}

/** All four channel scores for a candidate, untouched by any mode. */
export function channelScores(candidate: ScoredCandidate): Record<"experience" | "preference" | "direction" | "qualification", ChannelScore> {
  return { experience: candidate.experience, preference: candidate.preference, direction: candidate.direction, qualification: candidate.qualification };
}

const value = (score: ChannelScore) => (score.score === null ? -1 : score.score);

export function applyMode(mode: RecommendationMode, run: PersonRun, hardGapsByJob: Map<string, string[]>): ModeResult {
  switch (mode) {
    case "A_TRANSFERABLE_BACKGROUND":
      return singleChannel(mode, run, "experience");
    case "B_BACKGROUND_AND_INTEREST":
      return paretoMode(mode, run, "experience", "preference", null);
    case "C_CAREER_TRANSITION":
      return paretoMode(mode, run, "direction", "preference", null);
    case "D_QUALIFICATION_AWARE":
      return paretoMode(mode, run, "experience", "preference", hardGapsByJob);
  }
}

function singleChannel(mode: RecommendationMode, run: PersonRun, channel: "experience" | "preference" | "direction"): ModeResult {
  const ordered = [...run.candidates].sort((a, b) => value(b[channel]) - value(a[channel]) || a.jobId.localeCompare(b.jobId));
  return {
    mode,
    ranked: ordered.map((candidate) => candidate.jobId),
    reasons: ordered.map((candidate, index) => ({
      jobId: candidate.jobId,
      rank: index + 1,
      paretoFront: null,
      tieBreak: `${channel} score ${value(candidate[channel]).toFixed(4)}`,
      hardGapPartition: null,
    })),
  };
}

/**
 * Pareto-front ordering on two channels with a maximin tie-break inside each front, then an
 * optional hard-gap partition applied on top without changing any score.
 */
function paretoMode(
  mode: RecommendationMode,
  run: PersonRun,
  primary: "experience" | "preference" | "direction",
  secondary: "experience" | "preference" | "direction",
  hardGapsByJob: Map<string, string[]> | null,
): ModeResult {
  const remaining = [...run.candidates];
  const fronts: ScoredCandidate[][] = [];
  while (remaining.length) {
    const front = remaining.filter((candidate) => !remaining.some((other) =>
      other.jobId !== candidate.jobId &&
      value(other[primary]) >= value(candidate[primary]) && value(other[secondary]) >= value(candidate[secondary]) &&
      (value(other[primary]) > value(candidate[primary]) || value(other[secondary]) > value(candidate[secondary])),
    ));
    // A cyclic tie can never occur under numeric dominance, but guard against an empty front
    // so this loop can never spin.
    const chosen = front.length ? front : [...remaining];
    for (const candidate of chosen) remaining.splice(remaining.indexOf(candidate), 1);
    fronts.push(chosen.sort((a, b) => maximin(b, primary, secondary) - maximin(a, primary, secondary) || a.jobId.localeCompare(b.jobId)));
  }

  const flat = fronts.flatMap((front, frontIndex) => front.map((candidate) => ({ candidate, frontIndex })));
  const partitioned = hardGapsByJob
    ? [
        ...flat.filter((entry) => (hardGapsByJob.get(entry.candidate.jobId) ?? []).length === 0),
        ...flat.filter((entry) => (hardGapsByJob.get(entry.candidate.jobId) ?? []).length > 0),
      ]
    : flat;

  return {
    mode,
    ranked: partitioned.map((entry) => entry.candidate.jobId),
    reasons: partitioned.map((entry, index) => ({
      jobId: entry.candidate.jobId,
      rank: index + 1,
      paretoFront: entry.frontIndex + 1,
      tieBreak: `maximin(${primary}=${value(entry.candidate[primary]).toFixed(4)}, ${secondary}=${value(entry.candidate[secondary]).toFixed(4)}) = ${maximin(entry.candidate, primary, secondary).toFixed(4)}`,
      hardGapPartition: hardGapsByJob ? ((hardGapsByJob.get(entry.candidate.jobId) ?? []).length === 0 ? "meets" : "stretch") : null,
    })),
  };
}

function maximin(candidate: ScoredCandidate, primary: "experience" | "preference" | "direction", secondary: "experience" | "preference" | "direction") {
  return Math.min(value(candidate[primary]), value(candidate[secondary]));
}

/**
 * SCORE-SPACE dominance check: does the produced order ever place a candidate below another
 * that it dominates on the two channels the mode ranks by? Pareto ordering makes this
 * structurally impossible, so a non-zero result is an implementation bug, not a quality
 * signal. Distinct from the LABEL-SPACE dominance rate in rankMetrics.ts, which compares the
 * order against planted truth and is a genuine quality metric.
 */
export function scoreSpaceDominanceViolations(
  ranked: string[],
  candidatesById: Map<string, ScoredCandidate>,
  primary: "experience" | "preference" | "direction",
  secondary: "experience" | "preference" | "direction",
): number {
  let violations = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const higher = candidatesById.get(ranked[i]!);
      const lower = candidatesById.get(ranked[j]!);
      if (!higher || !lower) continue;
      const lowerDominates =
        value(lower[primary]) >= value(higher[primary]) && value(lower[secondary]) >= value(higher[secondary]) &&
        (value(lower[primary]) > value(higher[primary]) || value(lower[secondary]) > value(higher[secondary]));
      if (lowerDominates) violations += 1;
    }
  }
  return violations;
}

/**
 * Result-set redundancy. A useful recommendation set is not ten semantic duplicates, but
 * diversity must never be bought with irrelevant jobs -- so this is reported alongside
 * relevance, never optimized alone.
 */
export interface DiversityReport {
  k: number;
  exactDuplicateRate: number;
  nearDuplicateRate: number;
  titleDiversity: number;
  industryDiversity: number;
  canonicalWorkDiversity: number;
  /** Share of the top-K that is planted-relevant on the mode's primary channel. */
  relevantShare: number | null;
}

export function diversityOf(
  rankedJobIds: string[],
  k: number,
  jobFacets: Map<string, { title: string; industry: string; atomKey: string }>,
  relevant: (jobId: string) => boolean | null,
): DiversityReport {
  const head = rankedJobIds.slice(0, k);
  const facets = head.map((jobId) => jobFacets.get(jobId)).filter((facet): facet is { title: string; industry: string; atomKey: string } => Boolean(facet));
  const distinct = (values: string[]) => (values.length ? new Set(values).size / values.length : 0);
  const atomKeys = facets.map((facet) => facet.atomKey);
  const exactDuplicates = atomKeys.length - new Set(atomKeys).size;
  // Near-duplicate: two jobs whose planted core work overlaps by more than half.
  let nearDuplicates = 0;
  for (let i = 0; i < atomKeys.length; i += 1) {
    for (let j = i + 1; j < atomKeys.length; j += 1) {
      const left = new Set(atomKeys[i]!.split("|"));
      const right = new Set(atomKeys[j]!.split("|"));
      let shared = 0;
      for (const atom of left) if (right.has(atom)) shared += 1;
      if (shared / Math.max(1, Math.min(left.size, right.size)) > 0.5) nearDuplicates += 1;
    }
  }
  const pairs = (atomKeys.length * (atomKeys.length - 1)) / 2;
  const relevantFlags = head.map(relevant).filter((flag): flag is boolean => flag !== null);
  return {
    k,
    exactDuplicateRate: atomKeys.length ? exactDuplicates / atomKeys.length : 0,
    nearDuplicateRate: pairs ? nearDuplicates / pairs : 0,
    titleDiversity: distinct(facets.map((facet) => facet.title)),
    industryDiversity: distinct(facets.map((facet) => facet.industry)),
    canonicalWorkDiversity: distinct(atomKeys),
    relevantShare: relevantFlags.length ? relevantFlags.filter(Boolean).length / relevantFlags.length : null,
  };
}
