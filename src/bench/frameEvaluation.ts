// Evaluate candidate architectures on the frame corpus.
//
// Every architecture sees identical frozen inputs and is scored by identical metrics. Results
// are reported PER FAMILY and PER CHANNEL and never averaged across either: a single number
// spanning NATURAL and SEMANTIC_BRIDGE would hide the only thing worth knowing, which is how
// much of a system's performance survives when the wording stops giving the answer away.
//
// Differences are reported with a PAIRED BOOTSTRAP over persons. The previous benchmark
// declared a 12-person sample adequate because "the numbers stop moving there", which cannot
// detect sampling noise; the interval reported here can, and a difference whose interval spans
// zero is reported as unresolved rather than as a win.
import { mulberry32 } from "@/lab/rng";
import { ndcgAtK, precisionAtK, recallAtK, subsetRecallAtK } from "@/bench/rankMetrics";
import { isSurprisingTransfer, isTransitionRelevant, type Channel } from "@/bench/labels";
import { labelFramePair, type FramePairLabel } from "@/bench/frameLabels";
import { buildFrameCorpus, type BenchSplit, type FrameBenchCorpus } from "@/bench/frameCorpus";
import { rankJobs, type RankingArchitecture } from "@/bench/architectures";
import type { RenderFamily } from "@/bench/semanticFrame";

export const FRAME_EVALUATION_VERSION = "frame-evaluation.v1";

export const CHANNELS: Channel[] = ["experience", "preference", "direction"];

export interface PersonScore {
  personId: string;
  ndcg10: number | null;
  recall10: number | null;
  precision10: number | null;
  /** Recall of jobs that are relevant only across a title or industry boundary. */
  surprisingRecall10: number | null;
  /** Recall of career-transition targets: wanted and liked, but not yet performed. */
  transitionRecall10: number | null;
}

export interface ArchitectureResult {
  architectureId: string;
  family: RenderFamily;
  channel: Channel;
  perPerson: PersonScore[];
  meanNdcg10: number | null;
  meanRecall10: number | null;
  meanSurprisingRecall10: number | null;
  meanTransitionRecall10: number | null;
}

const mean = (values: (number | null)[]): number | null => {
  const defined = values.filter((value): value is number => value !== null);
  return defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : null;
};

/** Score one architecture on one family and channel. */
export function evaluateArchitecture<P>(
  architecture: RankingArchitecture<P>,
  corpus: FrameBenchCorpus,
  channel: Channel,
  k = 10,
): ArchitectureResult {
  const perPerson: PersonScore[] = [];
  for (const person of corpus.people) {
    const jobs = corpus.jobsByPerson.get(person.personId) ?? [];
    const labels = new Map<string, FramePairLabel>(jobs.map((job) => [job.jobId, labelFramePair(person, job)]));
    const lookup = (jobId: string) => labels.get(jobId);
    const ranked = rankJobs(architecture, person, jobs, channel);
    perPerson.push({
      personId: person.personId,
      ndcg10: ndcgAtK(ranked, lookup, channel, k),
      recall10: recallAtK(ranked, lookup, channel, k),
      precision10: precisionAtK(ranked, lookup, channel, k),
      surprisingRecall10: subsetRecallAtK(ranked, lookup, isSurprisingTransfer, k),
      transitionRecall10: subsetRecallAtK(ranked, lookup, isTransitionRelevant, k),
    });
  }
  return {
    architectureId: architecture.id,
    family: corpus.family,
    channel,
    perPerson,
    meanNdcg10: mean(perPerson.map((p) => p.ndcg10)),
    meanRecall10: mean(perPerson.map((p) => p.recall10)),
    meanSurprisingRecall10: mean(perPerson.map((p) => p.surprisingRecall10)),
    meanTransitionRecall10: mean(perPerson.map((p) => p.transitionRecall10)),
  };
}

export interface PairedDifference {
  system: string;
  reference: string;
  family: RenderFamily;
  channel: Channel;
  /** Persons where BOTH systems produced a defined score. Only these are comparable. */
  pairedN: number;
  meanSystem: number;
  meanReference: number;
  meanDifference: number;
  ci95: { low: number; high: number };
  /** True when the 95% interval excludes zero. */
  significant: boolean;
  /**
   * The smallest difference this comparison could have resolved, i.e. half the interval width.
   * Reporting it stops "X beats Y by 0.02" being claimed on a design that cannot see 0.02.
   */
  resolvableDifference: number;
}

/**
 * Paired bootstrap over PERSONS — the independent sampling unit.
 *
 * Pairing matters: both systems rank the same person over the same job pool, so the
 * per-person difference removes person difficulty as a variance source. Resampling jobs
 * instead would treat correlated pairs as independent and produce intervals that are too
 * narrow.
 */
export function pairedDifference(
  system: ArchitectureResult,
  reference: ArchitectureResult,
  options: { resamples?: number; seed?: number; metric?: keyof PersonScore } = {},
): PairedDifference {
  const resamples = options.resamples ?? 5000;
  const metric = (options.metric ?? "ndcg10") as "ndcg10";
  const rng = mulberry32(options.seed ?? 0xc0ffee);

  const referenceById = new Map(reference.perPerson.map((row) => [row.personId, row]));
  const pairs = system.perPerson
    .map((row) => ({ a: row[metric], b: referenceById.get(row.personId)?.[metric] ?? null }))
    .filter((row): row is { a: number; b: number } => row.a !== null && row.b !== null);

  if (!pairs.length) {
    return {
      system: system.architectureId, reference: reference.architectureId,
      family: system.family, channel: system.channel,
      pairedN: 0, meanSystem: 0, meanReference: 0, meanDifference: 0,
      ci95: { low: 0, high: 0 }, significant: false, resolvableDifference: Infinity,
    };
  }

  const differences = pairs.map((row) => row.a - row.b);
  const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const resampled: number[] = [];
  for (let index = 0; index < resamples; index += 1) {
    let total = 0;
    for (let draw = 0; draw < differences.length; draw += 1) {
      total += differences[Math.floor(rng() * differences.length)]!;
    }
    resampled.push(total / differences.length);
  }
  resampled.sort((a, b) => a - b);
  const low = resampled[Math.floor(resamples * 0.025)]!;
  const high = resampled[Math.floor(resamples * 0.975)]!;

  return {
    system: system.architectureId,
    reference: reference.architectureId,
    family: system.family,
    channel: system.channel,
    pairedN: pairs.length,
    meanSystem: average(pairs.map((row) => row.a)),
    meanReference: average(pairs.map((row) => row.b)),
    meanDifference: average(differences),
    ci95: { low, high },
    significant: low > 0 || high < 0,
    resolvableDifference: (high - low) / 2,
  };
}

export interface CompetitionOptions {
  people?: number;
  split?: BenchSplit;
  families?: RenderFamily[];
  channels?: Channel[];
  k?: number;
  seed?: number;
}

/**
 * Run every architecture across every family and channel.
 *
 * Corpora are built ONCE per family and shared by all architectures, so every system sees
 * byte-identical inputs. Rebuilding per architecture would let RNG drift turn into an
 * apparent quality difference.
 */
export function runCompetition(
  architectures: RankingArchitecture<never>[],
  options: CompetitionOptions = {},
): { results: ArchitectureResult[]; corpora: Map<RenderFamily, FrameBenchCorpus> } {
  const families = options.families ?? (["NATURAL", "SEMANTIC_BRIDGE", "LEXICAL_TRAP"] as RenderFamily[]);
  const channels = options.channels ?? CHANNELS;
  const corpora = new Map<RenderFamily, FrameBenchCorpus>();
  const results: ArchitectureResult[] = [];

  for (const family of families) {
    const corpus = buildFrameCorpus({
      people: options.people ?? 48,
      split: options.split ?? "DEVELOPMENT",
      family,
      seed: options.seed,
    });
    corpora.set(family, corpus);
    for (const architecture of architectures) {
      for (const channel of channels) {
        results.push(evaluateArchitecture(architecture, corpus, channel, options.k ?? 10));
      }
    }
  }
  return { results, corpora };
}
