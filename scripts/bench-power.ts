// Statistical power analysis for the product ranking benchmark.
//
// Answers three questions the benchmark has never answered:
//   1. How much does the published aggregate move across INDEPENDENT corpora at the declared
//      optimization target (hard, 12 people)?
//   2. Is the TaskDNA-versus-baseline gap distinguishable from zero under a paired bootstrap?
//   3. How many people would be required to resolve a gap of a given size?
//
// Never touches LOCKED_CONFIRMATION.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { BASELINES } from "../src/bench/pipeline";
import type { Channel } from "../src/bench/labels";
import type { BenchSplit } from "../src/bench/corpus";
import type { RenderDifficulty } from "../src/bench/render";
import { BENCH_POWER_VERSION, pairedBootstrap, replicateAcrossSeeds, requiredPeopleFor } from "../src/bench/power";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const split = arg("split", "DEVELOPMENT") as BenchSplit;
if (split === "LOCKED_CONFIRMATION" && !process.argv.includes("--confirm-locked")) {
  throw new Error("LOCKED_CONFIRMATION is guarded. Never use it during ordinary iteration.");
}
const difficulty = arg("difficulty", "hard") as RenderDifficulty;
const people = Number(arg("people", "12"));
const seedCount = Number(arg("seeds", "24"));
const k = Number(arg("k", "5"));
const channels = arg("channels", "experience,preference,direction").split(",") as Channel[];
const targetHalfWidth = Number(arg("target-half-width", "0.02"));

// Independent seeds. Distinct atom pools AND distinct people, unlike the nested
// same-seed/different-count comparison that produced the current minimumPeople=12 claim.
const seeds = Array.from({ length: seedCount }, (_, i) => 1000 + i * 7919);

const started = Date.now();
const replicated = replicateAcrossSeeds({ seeds, people, split, difficulty, channels, k });
const byChannel = channels.map((channel) => {
  const { replication, measurements } = replicated[channel];
  const comparisons = BASELINES.map((baseline) => pairedBootstrap(measurements, "taskdna", baseline));
  const sizing = Object.fromEntries(
    BASELINES.map((baseline) => [baseline, requiredPeopleFor(measurements, "taskdna", baseline, targetHalfWidth)]),
  );
  return { channel, replication, comparisons, sizing, personsMeasured: measurements.length };
});

const report = {
  version: BENCH_POWER_VERSION,
  split,
  difficulty,
  peoplePerSeed: people,
  seeds: seeds.length,
  k,
  targetHalfWidth,
  totalPersonsPerChannel: seeds.length * people,
  byChannel,
  totalRuntimeMs: Date.now() - started,
};

const json = JSON.stringify(report, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync(`artifacts/product_readiness/power_${split.toLowerCase()}_${difficulty}_n${people}.json`, json);
}

// Human-readable summary.
for (const entry of byChannel) {
  process.stdout.write(`\n=== ${entry.channel.toUpperCase()} (${difficulty}, ${people} people x ${seeds.length} seeds = ${entry.personsMeasured} persons) ===\n`);
  const spread = entry.replication.spread;
  process.stdout.write(`per-seed published aggregate (what runBenchmark reports at n=${people}):\n`);
  for (const [system, s] of Object.entries(spread)) {
    process.stdout.write(`  ${system.padEnd(20)} mean=${s.mean.toFixed(4)}  sd=${s.stdev.toFixed(4)}  range=[${s.min.toFixed(3)}, ${s.max.toFixed(3)}]\n`);
  }
  for (const [name, diff] of Object.entries(entry.replication.perSeedDifference)) {
    process.stdout.write(`  ${name.padEnd(28)} mean=${diff.mean >= 0 ? "+" : ""}${diff.mean.toFixed(4)}  sd=${diff.stdev.toFixed(4)}  signFlipsAcrossSeeds=${diff.signFlips}\n`);
  }
  process.stdout.write(`paired bootstrap over all ${entry.personsMeasured} persons:\n`);
  for (const c of entry.comparisons) {
    const verdict = c.significant ? (c.meanDifference > 0 ? "TASKDNA WINS" : "BASELINE WINS") : "INDISTINGUISHABLE";
    process.stdout.write(
      `  taskdna vs ${c.reference.padEnd(18)} d=${c.meanDifference >= 0 ? "+" : ""}${c.meanDifference.toFixed(4)}` +
      `  CI95=[${c.ci95.low >= 0 ? "+" : ""}${c.ci95.low.toFixed(4)}, ${c.ci95.high >= 0 ? "+" : ""}${c.ci95.high.toFixed(4)}]` +
      `  n=${c.pairedN}  discordant=${c.discordantPairs}  ${verdict}\n`,
    );
  }
  for (const [baseline, s] of Object.entries(entry.sizing)) {
    const sizing = s as ReturnType<typeof requiredPeopleFor>;
    process.stdout.write(
      `  sizing vs ${baseline.padEnd(18)} perPersonSD=${sizing.perPersonStdev.toFixed(4)}` +
      `  halfWidth@12=${(sizing.halfWidthAt[12] ?? 0).toFixed(4)}` +
      `  halfWidth@384=${(sizing.halfWidthAt[384] ?? 0).toFixed(4)}` +
      `  peopleFor+-${targetHalfWidth}=${sizing.minimumPeople}\n`,
    );
  }
}
process.stdout.write(`\ntotal runtime ${report.totalRuntimeMs} ms\n`);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
