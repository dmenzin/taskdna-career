// Orchestration for the product-level benchmark suite.
//
// Produces one report covering: per-channel job ranking, joint Experience+Preference
// discovery, career-transition discovery, surprising cross-title/cross-industry discovery,
// candidate retrieval, recommendation policy modes, conventional baselines, result-set
// diversity, core-vs-incidental behaviour, and runtime.
//
// Every metric is graded against planted atom identity (src/bench/labels.ts), never against
// any output of the system under test.
import { allJobs, buildBenchCorpus, type BenchCorpus, type BenchSplit, type PlantedJob, type PlantedPerson } from "@/bench/corpus";
import type { RenderDifficulty } from "@/bench/render";
import { CANDIDATE_STRATEGIES, evaluateRetrieval, type CandidateReport } from "@/bench/candidates";
import {
  dislikedIntrusion,
  isJointRelevant,
  isRelevant,
  isSurprisingTransfer,
  isTransitionRelevant,
  labelPair,
  paretoFrontier,
  type PairLabel,
} from "@/bench/labels";
import { applyMode, diversityOf, MODE_SPECS, RECOMMENDATION_MODES, scoreSpaceDominanceViolations, type RecommendationMode } from "@/bench/policy";
import {
  BASELINES,
  pipelineCacheStats,
  rankByBaseline,
  rankByChannel,
  runPerson,
  type BaselineId,
  type PersonRun,
} from "@/bench/pipeline";
import {
  catastrophicCount,
  dominanceViolationRate,
  macroAverage,
  meanRankOf,
  ndcgAtK,
  pairwiseAccuracy,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  subsetPrecisionAtK,
  subsetRecallAtK,
  worstCase,
} from "@/bench/rankMetrics";

export const BENCH_RUN_VERSION = "bench-run.v1";
export type { BenchSplit, RenderDifficulty };
export const DEFAULT_K = 5;
/** Declared catastrophe threshold for per-person NDCG. Below this, a person is unhelped. */
export const CATASTROPHE_NDCG = 0.3;

export interface ChannelRankingReport {
  channel: "experience" | "preference" | "direction";
  k: number;
  ndcgAtK: number | null;
  recallAtK: number | null;
  precisionAtK: number | null;
  mrr: number | null;
  pairwiseAccuracy: number | null;
  worstPersonNdcg: number | null;
  catastrophicPeople: number;
  peopleEvaluated: number;
}

export interface BenchReport {
  version: string;
  split: BenchSplit;
  seed: number;
  k: number;
  difficulty: RenderDifficulty;
  corpus: { people: number; jobsPerPerson: number; atomPoolSize: number; paraphraseFamilies: string[] };
  /**
   * Whether this configuration has room to improve. A channel at NDCG 1.0 with worst-case 1.0
   * is SATURATED: it cannot detect a regression or an improvement, so it must not be used as
   * an optimization target. Use the `hard` difficulty tier instead.
   */
  headroom: { channel: string; ndcgAtK: number | null; saturated: boolean; note: string }[];
  paraphraseGap: { meanPersonJobTokenOverlap: number; identicalRenderings: number };

  channelRanking: ChannelRankingReport[];

  crossTitleTransferRecallAtK: number | null;
  crossIndustryTransferRecallAtK: number | null;
  sameTitleDifferentWorkFalsePositiveRateAtK: number | null;
  sameTitleDifferentWorkMeanRank: number | null;
  crossTitleTransferMeanRank: number | null;

  hardNearMissFalsePositiveRateAtK: number | null;
  hardNearMissMeanRank: number | null;

  jointRelevantRecallAtK: number | null;
  jointRelevantPrecisionAtK: number | null;
  paretoFrontierRecallAtK: number | null;
  /** LABEL-SPACE: order disagrees with planted truth on both channels. A quality metric. */
  dominanceViolationRate: number | null;
  /** SCORE-SPACE: Pareto ordering is internally inconsistent. Must be 0; an implementation check. */
  scoreSpaceDominanceViolations: number;

  transitionRecallAtK: number | null;
  transitionPrecisionAtK: number | null;
  transitionMeanRank: number | null;

  surprisingTransferRecallAtK: number | null;
  surprisingTransferPrecisionAtK: number | null;
  noveltyWithoutRelevanceRateAtK: number | null;

  dislikedIntrusionRateAtK: number | null;
  strongDislikeViolationRateAtK: number | null;
  likedTaskCoverageAtK: number | null;

  incidentalOnlyMeanRank: number | null;
  coreMatchMeanRank: number | null;
  incidentalOverRewardRate: number | null;

  qualification: { hardGapPrecision: number | null; hardGapRecall: number | null; feasibilityRankCorrelation: number | null; stretchRolesRetainedAtK: number | null };

  modes: { mode: RecommendationMode; productQuestion: string; selectionRule: string; ndcgByGradedChannel: Record<string, number | null>; dominanceViolationRate: number | null; diversity: ReturnType<typeof diversityOf> }[];

  baselines: { baseline: BaselineId; experienceNdcgAtK: number | null; crossTitleRecallAtK: number | null; crossIndustryRecallAtK: number | null; surprisingTransferRecallAtK: number | null; sameTitleDifferentWorkFalsePositiveRateAtK: number | null }[];
  lift: { metric: string; taskdna: number | null; bestBaseline: number | null; baselineId: string | null; absoluteLift: number | null }[];

  candidateRetrieval: CandidateReport[];

  runtimeMs: { corpusBuild: number; pipeline: number; metrics: number; total: number };
  cache: { hits: number; misses: number; evictions: number };
}

export interface RunOptions {
  split?: BenchSplit;
  seed?: number;
  people?: number;
  distractors?: number;
  k?: number;
  difficulty?: RenderDifficulty;
}

export function runBenchmark(options: RunOptions = {}): BenchReport {
  const k = options.k ?? DEFAULT_K;
  const started = Date.now();
  const corpus = buildBenchCorpus({ split: options.split, seed: options.seed, people: options.people, distractors: options.distractors, difficulty: options.difficulty });
  const corpusBuiltAt = Date.now();

  const runs: { planted: PlantedPerson; jobs: PlantedJob[]; run: PersonRun; labels: Map<string, PairLabel> }[] = corpus.people.map((planted) => {
    const jobs = corpus.jobsByPerson.get(planted.personId)!;
    return { planted, jobs, run: runPerson(planted, jobs), labels: new Map(jobs.map((job) => [job.jobId, labelPair(planted, job)])) };
  });
  const pipelineDoneAt = Date.now();

  const lookupFor = (entry: (typeof runs)[number]) => (jobId: string) => entry.labels.get(jobId);
  const perPerson = <T>(fn: (entry: (typeof runs)[number]) => T) => runs.map(fn);

  // ---- per-channel ranking ----
  const channelRanking: ChannelRankingReport[] = (["experience", "preference", "direction"] as const).map((channel) => {
    const ndcgs = perPerson((entry) => ndcgAtK(rankByChannel(entry.run, channel), lookupFor(entry), channel, k));
    return {
      channel,
      k,
      ndcgAtK: macroAverage(ndcgs),
      recallAtK: macroAverage(perPerson((entry) => recallAtK(rankByChannel(entry.run, channel), lookupFor(entry), channel, k))),
      precisionAtK: macroAverage(perPerson((entry) => precisionAtK(rankByChannel(entry.run, channel), lookupFor(entry), channel, k))),
      mrr: macroAverage(perPerson((entry) => reciprocalRank(rankByChannel(entry.run, channel), lookupFor(entry), channel))),
      pairwiseAccuracy: macroAverage(perPerson((entry) => pairwiseAccuracy(rankByChannel(entry.run, channel), lookupFor(entry), channel))),
      worstPersonNdcg: worstCase(ndcgs),
      catastrophicPeople: catastrophicCount(ndcgs, CATASTROPHE_NDCG),
      peopleEvaluated: ndcgs.filter((value) => value !== null).length,
    };
  });

  const experienceRank = (entry: (typeof runs)[number]) => rankByChannel(entry.run, "experience");

  // ---- transfer counterfactuals ----
  const crossTitleTransferRecallAtK = macroAverage(perPerson((entry) => subsetRecallAtK(experienceRank(entry), lookupFor(entry), (label) => label.crossTitle && isRelevant(label, "experience"), k)));
  const crossIndustryTransferRecallAtK = macroAverage(perPerson((entry) => subsetRecallAtK(experienceRank(entry), lookupFor(entry), (label) => label.crossIndustry && isRelevant(label, "experience"), k)));
  const sameTitleFalsePositive = macroAverage(perPerson((entry) => subsetPrecisionAtK(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "SAME_TITLE_DIFFERENT_WORK", k)));

  // ---- joint experience + preference ----
  const jointRanks = perPerson((entry) => applyMode("B_BACKGROUND_AND_INTEREST", entry.run, hardGapMap(entry.labels)).ranked);
  const jointRelevantRecallAtK = macroAverage(runs.map((entry, index) => subsetRecallAtK(jointRanks[index]!, lookupFor(entry), (label) => isJointRelevant(label), k)));
  const jointRelevantPrecisionAtK = macroAverage(runs.map((entry, index) => subsetPrecisionAtK(jointRanks[index]!, lookupFor(entry), (label) => isJointRelevant(label), k)));
  const paretoRecall = macroAverage(runs.map((entry, index) => {
    const frontier = new Set(paretoFrontier([...entry.labels.values()]).map((label) => label.jobId));
    return subsetRecallAtK(jointRanks[index]!, lookupFor(entry), (label) => frontier.has(label.jobId), k);
  }));
  const jointDominance = macroAverage(runs.map((entry, index) => dominanceViolationRate(jointRanks[index]!, lookupFor(entry))));
  const scoreSpaceViolations = runs.reduce((sum, entry, index) => {
    const byId = new Map(entry.run.candidates.map((candidate) => [candidate.jobId, candidate]));
    return sum + scoreSpaceDominanceViolations(jointRanks[index]!, byId, "experience", "preference");
  }, 0);

  // ---- career transition ----
  const transitionRanks = perPerson((entry) => applyMode("C_CAREER_TRANSITION", entry.run, hardGapMap(entry.labels)).ranked);
  const transitionRecallAtK = macroAverage(runs.map((entry, index) => subsetRecallAtK(transitionRanks[index]!, lookupFor(entry), isTransitionRelevant, k)));
  const transitionPrecisionAtK = macroAverage(runs.map((entry, index) => subsetPrecisionAtK(transitionRanks[index]!, lookupFor(entry), isTransitionRelevant, k)));
  const transitionMeanRank = macroAverage(runs.map((entry, index) => meanRankOf(transitionRanks[index]!, lookupFor(entry), isTransitionRelevant)));

  // ---- surprising transfer: relevance and surprise reported separately ----
  const surprisingRecall = macroAverage(perPerson((entry) => subsetRecallAtK(experienceRank(entry), lookupFor(entry), isSurprisingTransfer, k)));
  const surprisingPrecision = macroAverage(perPerson((entry) => subsetPrecisionAtK(experienceRank(entry), lookupFor(entry), isSurprisingTransfer, k)));
  // Novelty without relevance: cross-boundary jobs in the top K that are NOT experience-relevant.
  const noveltyWithoutRelevance = macroAverage(perPerson((entry) => subsetPrecisionAtK(experienceRank(entry), lookupFor(entry), (label) => (label.crossTitle || label.crossIndustry) && !isRelevant(label, "experience"), k)));

  // ---- preference intrusion ----
  const preferenceRank = (entry: (typeof runs)[number]) => rankByChannel(entry.run, "preference");
  const dislikedIntrusionRate = macroAverage(perPerson((entry) => {
    const head = preferenceRank(entry).slice(0, k);
    if (!head.length) return null;
    return mean(head.map((jobId) => dislikedIntrusion(entry.planted, entry.jobs.find((job) => job.jobId === jobId)!)));
  }));
  const strongDislikeViolation = macroAverage(perPerson((entry) => subsetPrecisionAtK(preferenceRank(entry), lookupFor(entry), (label) => label.archetype === "EXPERIENCE_WITH_DISLIKED_WORK", k)));
  const likedCoverage = macroAverage(perPerson((entry) => {
    const head = preferenceRank(entry).slice(0, k);
    const covered = new Set(head.flatMap((jobId) => entry.labels.get(jobId)!.preference.matchedAtomIds));
    return entry.planted.liked.length ? covered.size / entry.planted.liked.length : null;
  }));

  // ---- core vs incidental ----
  const incidentalOnlyMeanRank = macroAverage(perPerson((entry) => meanRankOf(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "INCIDENTAL_ONLY_MATCH")));
  const coreMatchMeanRank = macroAverage(perPerson((entry) => meanRankOf(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "OBVIOUS_EXPERIENCE_MATCH" || label.archetype === "CROSS_TITLE_TRANSFER")));
  const incidentalOverReward = macroAverage(perPerson((entry) => {
    const ranked = experienceRank(entry);
    const incidental = ranked.findIndex((jobId) => entry.labels.get(jobId)!.archetype === "INCIDENTAL_ONLY_MATCH");
    const core = ranked.findIndex((jobId) => entry.labels.get(jobId)!.archetype === "OBVIOUS_EXPERIENCE_MATCH");
    if (incidental < 0 || core < 0) return null;
    return incidental < core ? 1 : 0;
  }));

  // ---- qualification ----
  const qualification = evaluateQualification(runs, k);

  // ---- policy modes ----
  const modes = RECOMMENDATION_MODES.map((mode) => {
    const spec = MODE_SPECS[mode];
    const ranked = perPerson((entry) => applyMode(mode, entry.run, hardGapMap(entry.labels)).ranked);
    const ndcgByGradedChannel: Record<string, number | null> = {};
    for (const channel of spec.gradedChannels) {
      ndcgByGradedChannel[channel] = macroAverage(runs.map((entry, index) => ndcgAtK(ranked[index]!, lookupFor(entry), channel, k)));
    }
    const facets = new Map(runs.flatMap((entry) => entry.jobs.map((job) => [job.jobId, { title: job.title, industry: job.industry, atomKey: job.coreAtoms.map((atom) => atom.atomId).sort().join("|") }] as const)));
    const primary = spec.gradedChannels[0]!;
    const diversity = diversityOf(ranked[0] ?? [], k, facets, (jobId) => {
      const label = runs[0]?.labels.get(jobId);
      return label ? isRelevant(label, primary) : null;
    });
    return {
      mode,
      productQuestion: spec.productQuestion,
      selectionRule: spec.selectionRule,
      ndcgByGradedChannel,
      dominanceViolationRate: mode === "B_BACKGROUND_AND_INTEREST" || mode === "D_QUALIFICATION_AWARE"
        ? macroAverage(runs.map((entry, index) => dominanceViolationRate(ranked[index]!, lookupFor(entry))))
        : null,
      diversity,
    };
  });

  // ---- conventional baselines ----
  const baselines = BASELINES.map((baseline) => {
    const ranked = perPerson((entry) => rankByBaseline(baseline, entry.planted, entry.jobs));
    return {
      baseline,
      experienceNdcgAtK: macroAverage(runs.map((entry, index) => ndcgAtK(ranked[index]!, lookupFor(entry), "experience", k))),
      crossTitleRecallAtK: macroAverage(runs.map((entry, index) => subsetRecallAtK(ranked[index]!, lookupFor(entry), (label) => label.crossTitle && isRelevant(label, "experience"), k))),
      crossIndustryRecallAtK: macroAverage(runs.map((entry, index) => subsetRecallAtK(ranked[index]!, lookupFor(entry), (label) => label.crossIndustry && isRelevant(label, "experience"), k))),
      surprisingTransferRecallAtK: macroAverage(runs.map((entry, index) => subsetRecallAtK(ranked[index]!, lookupFor(entry), isSurprisingTransfer, k))),
      sameTitleDifferentWorkFalsePositiveRateAtK: macroAverage(runs.map((entry, index) => subsetPrecisionAtK(ranked[index]!, lookupFor(entry), (label) => label.archetype === "SAME_TITLE_DIFFERENT_WORK", k))),
    };
  });

  const experienceNdcg = channelRanking.find((row) => row.channel === "experience")!.ndcgAtK;
  const lift = [
    liftRow("EXPERIENCE_NDCG@K", experienceNdcg, baselines.map((row) => [row.baseline, row.experienceNdcgAtK] as const)),
    liftRow("CROSS_TITLE_TRANSFER_RECALL@K", crossTitleTransferRecallAtK, baselines.map((row) => [row.baseline, row.crossTitleRecallAtK] as const)),
    liftRow("CROSS_INDUSTRY_TRANSFER_RECALL@K", crossIndustryTransferRecallAtK, baselines.map((row) => [row.baseline, row.crossIndustryRecallAtK] as const)),
    liftRow("SURPRISING_TRANSFER_RECALL@K", surprisingRecall, baselines.map((row) => [row.baseline, row.surprisingTransferRecallAtK] as const)),
  ];

  // ---- candidate retrieval over the WHOLE split pool, not just each person's own jobs ----
  const pool = allJobs(corpus);
  const candidateRetrieval = CANDIDATE_STRATEGIES.map((strategy) => {
    const reports = corpus.people.map((planted) => evaluateRetrieval(strategy, planted, pool, k * 4));
    return aggregateCandidateReports(strategy.id, strategy.version, k * 4, reports);
  });

  const metricsDoneAt = Date.now();
  const jobsPerPerson = runs[0]?.jobs.length ?? 0;

  return {
    version: BENCH_RUN_VERSION,
    split: corpus.split,
    seed: corpus.seed,
    k,
    difficulty: corpus.difficulty,
    headroom: channelRanking.map((row) => ({
      channel: row.channel,
      ndcgAtK: row.ndcgAtK,
      saturated: row.ndcgAtK !== null && row.ndcgAtK >= 0.999 && row.worstPersonNdcg !== null && row.worstPersonNdcg >= 0.999,
      note: row.ndcgAtK !== null && row.ndcgAtK >= 0.999 && row.worstPersonNdcg !== null && row.worstPersonNdcg >= 0.999
        ? "SATURATED at this difficulty: cannot detect improvement or regression. Do not optimize against it; use --difficulty=hard."
        : "has headroom",
    })),
    corpus: { people: corpus.people.length, jobsPerPerson, atomPoolSize: corpus.atomPoolSize, paraphraseFamilies: corpus.paraphraseFamilies },
    paraphraseGap: measureParaphraseGap(corpus),
    channelRanking,
    crossTitleTransferRecallAtK,
    crossIndustryTransferRecallAtK,
    sameTitleDifferentWorkFalsePositiveRateAtK: sameTitleFalsePositive,
    sameTitleDifferentWorkMeanRank: macroAverage(perPerson((entry) => meanRankOf(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "SAME_TITLE_DIFFERENT_WORK"))),
    crossTitleTransferMeanRank: macroAverage(perPerson((entry) => meanRankOf(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "CROSS_TITLE_TRANSFER"))),
    hardNearMissFalsePositiveRateAtK: macroAverage(perPerson((entry) => subsetPrecisionAtK(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "HARD_NEAR_MISS", k))),
    hardNearMissMeanRank: macroAverage(perPerson((entry) => meanRankOf(experienceRank(entry), lookupFor(entry), (label) => label.archetype === "HARD_NEAR_MISS"))),
    jointRelevantRecallAtK, jointRelevantPrecisionAtK, paretoFrontierRecallAtK: paretoRecall, dominanceViolationRate: jointDominance,
    scoreSpaceDominanceViolations: scoreSpaceViolations,
    transitionRecallAtK, transitionPrecisionAtK, transitionMeanRank,
    surprisingTransferRecallAtK: surprisingRecall, surprisingTransferPrecisionAtK: surprisingPrecision, noveltyWithoutRelevanceRateAtK: noveltyWithoutRelevance,
    dislikedIntrusionRateAtK: dislikedIntrusionRate, strongDislikeViolationRateAtK: strongDislikeViolation, likedTaskCoverageAtK: likedCoverage,
    incidentalOnlyMeanRank, coreMatchMeanRank, incidentalOverRewardRate: incidentalOverReward,
    qualification,
    modes,
    baselines,
    lift,
    candidateRetrieval,
    runtimeMs: { corpusBuild: corpusBuiltAt - started, pipeline: pipelineDoneAt - corpusBuiltAt, metrics: metricsDoneAt - pipelineDoneAt, total: metricsDoneAt - started },
    cache: pipelineCacheStats(),
  };
}

// ---------------------------------------------------------------------------

function hardGapMap(labels: Map<string, PairLabel>): Map<string, string[]> {
  return new Map([...labels.entries()].map(([jobId, label]) => [jobId, label.hardGaps]));
}

function evaluateQualification(runs: { planted: PlantedPerson; jobs: PlantedJob[]; run: PersonRun; labels: Map<string, PairLabel> }[], k: number) {
  // Predicted hard gap: the qualification channel reports it in its diagnostics.
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const correlations: number[] = [];
  const stretchRetained: number[] = [];
  for (const entry of runs) {
    const ranks: { feasibility: number; score: number }[] = [];
    for (const candidate of entry.run.candidates) {
      const label = entry.labels.get(candidate.jobId)!;
      const diagnostic = candidate.qualification.diagnostics.find((text) => text.startsWith("hardGaps="));
      const predictedGaps = diagnostic ? Number(diagnostic.split("=")[1]) : 0;
      const actualGaps = label.hardGaps.length;
      truePositives += Math.min(predictedGaps, actualGaps);
      falsePositives += Math.max(0, predictedGaps - actualGaps);
      falseNegatives += Math.max(0, actualGaps - predictedGaps);
      if (candidate.qualification.score !== null) ranks.push({ feasibility: label.qualificationFeasibility, score: candidate.qualification.score });
    }
    if (ranks.length > 1) correlations.push(pearson(ranks.map((row) => row.score), ranks.map((row) => row.feasibility)));
    const modeD = applyMode("D_QUALIFICATION_AWARE", entry.run, hardGapMap(entry.labels)).ranked;
    const stretch = modeD.filter((jobId) => entry.labels.get(jobId)!.hardGaps.length > 0);
    stretchRetained.push(stretch.length ? 1 : 0);
  }
  return {
    hardGapPrecision: truePositives + falsePositives ? truePositives / (truePositives + falsePositives) : null,
    hardGapRecall: truePositives + falseNegatives ? truePositives / (truePositives + falseNegatives) : null,
    feasibilityRankCorrelation: correlations.length ? mean(correlations) : null,
    stretchRolesRetainedAtK: stretchRetained.length ? mean(stretchRetained) : null,
  };
}

function aggregateCandidateReports(strategy: string, version: string, k: number, reports: CandidateReport[]): CandidateReport {
  const avg = (pick: (report: CandidateReport) => number | null) => macroAverage(reports.map(pick));
  const avgNumber = (pick: (report: CandidateReport) => number) => mean(reports.map(pick));
  return {
    strategy, version, k,
    candidateRecallAtK: avg((report) => report.candidateRecallAtK),
    relevantJobMissRate: avg((report) => report.relevantJobMissRate),
    crossTitleRecallAtK: avg((report) => report.crossTitleRecallAtK),
    crossIndustryRecallAtK: avg((report) => report.crossIndustryRecallAtK),
    surprisingTransferRecallAtK: avg((report) => report.surprisingTransferRecallAtK),
    preferenceRecallAtK: avg((report) => report.preferenceRecallAtK),
    directionRecallAtK: avg((report) => report.directionRecallAtK),
    titleDiversity: avgNumber((report) => report.titleDiversity),
    stratumDiversity: avgNumber((report) => report.stratumDiversity),
    industryDiversity: avgNumber((report) => report.industryDiversity),
    titleConcentration: avgNumber((report) => report.titleConcentration),
    stratumConcentration: avgNumber((report) => report.stratumConcentration),
    industryConcentration: avgNumber((report) => report.industryConcentration),
    noveltyConditionedRelevance: avg((report) => report.noveltyConditionedRelevance),
  };
}

/**
 * Quantify how far apart the person-side and job-side renderings of the SAME atom actually
 * are. If this approached 1.0 the benchmark would be measuring string equality.
 */
function measureParaphraseGap(corpus: BenchCorpus) {
  const overlaps: number[] = [];
  let identical = 0;
  for (const person of corpus.people) {
    const personTextByAtom = new Map(person.experienceEvidence.map((entry) => [entry.rendered.atomId, entry.rendered.text]));
    for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
      for (const responsibility of job.responsibilities) {
        const personText = personTextByAtom.get(responsibility.rendered.atomId);
        if (!personText) continue;
        if (personText === responsibility.rendered.text) identical += 1;
        overlaps.push(tokenJaccard(personText, responsibility.rendered.text));
      }
    }
  }
  return { meanPersonJobTokenOverlap: overlaps.length ? mean(overlaps) : 0, identicalRenderings: identical };
}

function liftRow(metric: string, taskdna: number | null, baselineValues: readonly (readonly [string, number | null])[]) {
  const defined = baselineValues.filter((entry): entry is readonly [string, number] => entry[1] !== null);
  if (!defined.length) return { metric, taskdna, bestBaseline: null, baselineId: null, absoluteLift: null };
  const best = defined.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { metric, taskdna, bestBaseline: best[1], baselineId: best[0], absoluteLift: taskdna === null ? null : taskdna - best[1] };
}

function tokenJaccard(a: string, b: string) {
  const left = new Set((a.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2));
  const right = new Set((b.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

function pearson(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  const den = Math.sqrt(x.reduce((sum, value) => sum + (value - mx) ** 2, 0) * y.reduce((sum, value) => sum + (value - my) ** 2, 0));
  return den ? x.reduce((sum, value, index) => sum + (value - mx) * (y[index]! - my), 0) / den : 0;
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
