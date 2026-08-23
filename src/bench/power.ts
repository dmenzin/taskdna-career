// Statistical power analysis for the product ranking benchmark.
//
// WHY THIS EXISTS
// ---------------
// `OPTIMIZATION_TARGET_CONFIG.minimumPeople` is 12, justified in `src/bench/run.ts` by the
// observation that "the numbers stop moving" between 12 and 16 people. That justification does
// not hold: `buildBenchCorpus` derives person `i` from `hashSeed(\`bench-person:${seed}:${split}:${i}\`)`,
// which is independent of `peopleCount`. A 12-person and a 16-person corpus at the same seed
// therefore SHARE their first 12 people. Comparing them measures the 4 added people, not the
// stability of the estimate, so it cannot detect sampling noise by construction.
//
// The right question is: across INDEPENDENT corpora, how much does each headline metric move,
// and is the TaskDNA-versus-baseline gap distinguishable from zero?
//
// This module answers that with paired per-person measurements. Pairing matters: TaskDNA and
// each baseline rank the SAME person over the SAME job pool, so the per-person difference
// removes person difficulty as a variance source and is far more sensitive than comparing two
// independently-averaged aggregates.
//
// Nothing here changes any label, threshold, or scoring rule. It re-uses the production
// ranking path (`runPerson` / `rankByChannel`) and the algorithm-independent labels
// (`labelPair`) exactly as `src/bench/run.ts` does.
import { buildBenchCorpus, type BenchSplit, type PlantedJob, type PlantedPerson } from "@/bench/corpus";
import type { RenderDifficulty } from "@/bench/render";
import { labelPair, type Channel, type PairLabel } from "@/bench/labels";
import { BASELINES, rankByBaseline, rankByChannel, runPerson, type BaselineId } from "@/bench/pipeline";
import { ndcgAtK } from "@/bench/rankMetrics";

export const BENCH_POWER_VERSION = "bench-power.v1";

/** Systems compared. "taskdna" is the production four-channel pipeline. */
export type SystemId = "taskdna" | BaselineId;
export const SYSTEMS: SystemId[] = ["taskdna", ...BASELINES];

export interface PersonMeasurement {
  seed: number;
  personId: string;
  /** NDCG@k per system, or null when the person has no relevant job on this channel. */
  ndcg: Record<SystemId, number | null>;
}

/** All channels for one person, derived from a single expensive `runPerson` call. */
export type MultiChannelMeasurement = Record<Channel, PersonMeasurement>;

/**
 * Measure one corpus across every requested channel.
 *
 * Replicates `src/bench/run.ts`: each person is ranked over their OWN job pool, and a null
 * NDCG (no relevant job to find) is preserved rather than coerced to zero.
 *
 * The four-channel pipeline runs ONCE per person and every channel is derived from that single
 * result, because `runPerson` (canonical mapping of all evidence and all responsibilities) is
 * the dominant cost and is channel-independent.
 */
export function measureCorpus(options: {
  seed: number;
  people: number;
  split: BenchSplit;
  difficulty: RenderDifficulty;
  channels: Channel[];
  k: number;
}): Record<Channel, PersonMeasurement[]> {
  const { seed, people, split, difficulty, channels, k } = options;
  const corpus = buildBenchCorpus({ seed, people, split, difficulty });
  const out = Object.fromEntries(channels.map((c) => [c, [] as PersonMeasurement[]])) as Record<Channel, PersonMeasurement[]>;

  for (const planted of corpus.people as PlantedPerson[]) {
    const jobs: PlantedJob[] = corpus.jobsByPerson.get(planted.personId)!;
    const labels = new Map<string, PairLabel>(jobs.map((job) => [job.jobId, labelPair(planted, job)]));
    const lookup = (jobId: string) => labels.get(jobId);
    const run = runPerson(planted, jobs);
    // Baseline rankings are channel-independent; compute each once and reuse across channels.
    const baselineRanks = Object.fromEntries(
      BASELINES.map((baseline) => [baseline, rankByBaseline(baseline, planted, jobs)]),
    ) as Record<BaselineId, string[]>;

    for (const channel of channels) {
      const ndcg = {} as Record<SystemId, number | null>;
      ndcg.taskdna = ndcgAtK(rankByChannel(run, channel), lookup, channel, k);
      for (const baseline of BASELINES) ndcg[baseline] = ndcgAtK(baselineRanks[baseline], lookup, channel, k);
      out[channel].push({ seed, personId: planted.personId, ndcg });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Paired uncertainty
// ---------------------------------------------------------------------------

/** Deterministic RNG so every reported interval is reproducible from the seed alone. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export interface PairedComparison {
  system: SystemId;
  reference: SystemId;
  /** Persons where BOTH systems produced a defined NDCG. Only these are comparable. */
  pairedN: number;
  meanSystem: number;
  meanReference: number;
  meanDifference: number;
  /** Bootstrap percentile CI over the paired per-person differences. */
  ci95: { low: number; high: number };
  /** Share of bootstrap resamples where the difference favours `system`. */
  probabilitySystemBetter: number;
  /** True when the 95% CI excludes zero. */
  significant: boolean;
  /** Persons where the two systems produced different NDCG at all. */
  discordantPairs: number;
}

/**
 * Paired bootstrap over persons. Resamples PERSONS (the independent unit), not job pairs, so
 * the interval reflects the sampling process the benchmark actually performs.
 */
export function pairedBootstrap(
  measurements: PersonMeasurement[],
  system: SystemId,
  reference: SystemId,
  options: { resamples?: number; seed?: number } = {},
): PairedComparison {
  const resamples = options.resamples ?? 5000;
  const rng = mulberry32(options.seed ?? 0xc0ffee);

  const pairs = measurements
    .map((row) => ({ a: row.ndcg[system], b: row.ndcg[reference] }))
    .filter((row): row is { a: number; b: number } => row.a !== null && row.b !== null);

  const diffs = pairs.map((row) => row.a - row.b);
  if (!diffs.length) {
    return {
      system, reference, pairedN: 0, meanSystem: 0, meanReference: 0, meanDifference: 0,
      ci95: { low: 0, high: 0 }, probabilitySystemBetter: 0, significant: false, discordantPairs: 0,
    };
  }

  const boots: number[] = [];
  for (let b = 0; b < resamples; b += 1) {
    let sum = 0;
    for (let i = 0; i < diffs.length; i += 1) sum += diffs[Math.floor(rng() * diffs.length)]!;
    boots.push(sum / diffs.length);
  }
  boots.sort((x, y) => x - y);
  const low = boots[Math.floor(0.025 * boots.length)]!;
  const high = boots[Math.floor(0.975 * boots.length)]!;

  return {
    system,
    reference,
    pairedN: pairs.length,
    meanSystem: mean(pairs.map((row) => row.a)),
    meanReference: mean(pairs.map((row) => row.b)),
    meanDifference: mean(diffs),
    ci95: { low, high },
    probabilitySystemBetter: boots.filter((value) => value > 0).length / boots.length,
    significant: (low > 0 && high > 0) || (low < 0 && high < 0),
    discordantPairs: diffs.filter((value) => Math.abs(value) > 1e-12).length,
  };
}

// ---------------------------------------------------------------------------
// Seed-level replication
// ---------------------------------------------------------------------------

export interface SeedReplication {
  channel: Channel;
  peoplePerSeed: number;
  seeds: number[];
  /** Per-seed macro-mean NDCG, exactly the statistic `runBenchmark` publishes. */
  perSeedMean: Record<SystemId, number[]>;
  /** Spread of that published statistic across independent corpora. */
  spread: Record<SystemId, { mean: number; stdev: number; min: number; max: number }>;
  /** Per-seed (taskdna - reference) macro difference, and how often the sign flips. */
  perSeedDifference: Record<string, { values: number[]; mean: number; stdev: number; signFlips: boolean }>;
}

/**
 * Run the SAME configuration across independent seeds and report how much the published
 * aggregate moves. This is the number the n=12 justification needed and never produced.
 */
export function replicateAcrossSeeds(options: {
  seeds: number[];
  people: number;
  split: BenchSplit;
  difficulty: RenderDifficulty;
  channels: Channel[];
  k: number;
}): Record<Channel, { replication: SeedReplication; measurements: PersonMeasurement[] }> {
  const all = Object.fromEntries(options.channels.map((c) => [c, [] as PersonMeasurement[]])) as Record<Channel, PersonMeasurement[]>;
  const perSeedMean = Object.fromEntries(
    options.channels.map((c) => [c, Object.fromEntries(SYSTEMS.map((s) => [s, [] as number[]])) as Record<SystemId, number[]>]),
  ) as Record<Channel, Record<SystemId, number[]>>;

  for (const seed of options.seeds) {
    const byChannel = measureCorpus({ ...options, seed });
    for (const channel of options.channels) {
      const rows = byChannel[channel];
      all[channel].push(...rows);
      for (const system of SYSTEMS) {
        const defined = rows.map((row) => row.ndcg[system]).filter((v): v is number => v !== null);
        perSeedMean[channel][system].push(defined.length ? mean(defined) : Number.NaN);
      }
    }
  }

  return Object.fromEntries(
    options.channels.map((channel) => {
      const spread = Object.fromEntries(
        SYSTEMS.map((system) => {
          const values = perSeedMean[channel][system].filter((v) => Number.isFinite(v));
          return [system, { mean: mean(values), stdev: stdev(values), min: Math.min(...values), max: Math.max(...values) }];
        }),
      ) as SeedReplication["spread"];

      const perSeedDifference: SeedReplication["perSeedDifference"] = {};
      for (const reference of BASELINES) {
        const values = perSeedMean[channel].taskdna
          .map((value, index) => value - perSeedMean[channel][reference][index]!)
          .filter((v) => Number.isFinite(v));
        perSeedDifference[`taskdna-vs-${reference}`] = {
          values,
          mean: mean(values),
          stdev: stdev(values),
          signFlips: values.some((v) => v > 0) && values.some((v) => v < 0),
        };
      }

      return [channel, {
        replication: { channel, peoplePerSeed: options.people, seeds: options.seeds, perSeedMean: perSeedMean[channel], spread, perSeedDifference },
        measurements: all[channel],
      }];
    }),
  ) as Record<Channel, { replication: SeedReplication; measurements: PersonMeasurement[] }>;
}

/**
 * Half-width of the 95% paired CI at a given person count, estimated from the observed
 * per-person difference spread. This is what "how many people does this benchmark need"
 * actually requires, and it is what determines whether a reported gap means anything.
 */
export function requiredPeopleFor(measurements: PersonMeasurement[], system: SystemId, reference: SystemId, targetHalfWidth: number): {
  perPersonStdev: number;
  halfWidthAt: Record<number, number>;
  minimumPeople: number | null;
} {
  const diffs = measurements
    .map((row) => ({ a: row.ndcg[system], b: row.ndcg[reference] }))
    .filter((row): row is { a: number; b: number } => row.a !== null && row.b !== null)
    .map((row) => row.a - row.b);

  const sd = stdev(diffs);
  const halfWidth = (n: number) => (1.96 * sd) / Math.sqrt(n);
  const sizes = [12, 24, 48, 96, 192, 384, 768];
  const halfWidthAt = Object.fromEntries(sizes.map((n) => [n, halfWidth(n)]));
  const minimumPeople = sd === 0 ? 1 : Math.ceil(((1.96 * sd) / targetHalfWidth) ** 2);
  return { perPersonStdev: sd, halfWidthAt, minimumPeople };
}
