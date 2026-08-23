// Experiment `soft-canonical-identity`: is canonical work identity better represented as the
// retained candidate SET than as a single selected Task or DWA?
//
// See `experiments/records/soft-canonical-identity/record.md`. Evaluates the experimental
// strategies in `src/bench/softCandidates.ts` against the production `canonical-work` control
// and the lexical/title references, over the same planted-truth labels, with every guardrail
// the preregistration named.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { allJobs, buildBenchCorpus } from "../src/bench/corpus";
import type { RenderDifficulty } from "../src/bench/render";
import { CANDIDATE_STRATEGIES, evaluateRetrieval, type CandidateRetrievalStrategy } from "../src/bench/candidates";
import { SOFT_CANDIDATE_STRATEGIES } from "../src/bench/softCandidates";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const people = Number(arg("people", "12"));
const seedCount = Number(arg("seeds", "6"));
const k = Number(arg("k", "5"));
const difficulties = arg("difficulties", "standard,hard").split(",") as RenderDifficulty[];
const seeds = Array.from({ length: seedCount }, (_, i) => 1000 + i * 7919);

const strategies: CandidateRetrievalStrategy[] = [...CANDIDATE_STRATEGIES, ...SOFT_CANDIDATE_STRATEGIES];

/** Deterministic RNG so the reported intervals are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** Paired bootstrap over persons on any per-person metric. */
function paired(a: (number | null)[], b: (number | null)[]) {
  const diffs: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i], y = b[i];
    if (x !== null && x !== undefined && y !== null && y !== undefined) diffs.push(x - y);
  }
  if (!diffs.length) return { n: 0, d: 0, low: 0, high: 0, significant: false };
  const rng = mulberry32(0xc0ffee);
  const boots: number[] = [];
  for (let s = 0; s < 4000; s += 1) {
    let sum = 0;
    for (let i = 0; i < diffs.length; i += 1) sum += diffs[Math.floor(rng() * diffs.length)]!;
    boots.push(sum / diffs.length);
  }
  boots.sort((x, y) => x - y);
  const low = boots[Math.floor(0.025 * boots.length)]!;
  const high = boots[Math.floor(0.975 * boots.length)]!;
  return { n: diffs.length, d: mean(diffs), low, high, significant: (low > 0 && high > 0) || (low < 0 && high < 0) };
}

type Metric = "candidateRecallAtK" | "crossTitleRecallAtK" | "crossIndustryRecallAtK" | "surprisingTransferRecallAtK"
  | "preferenceRecallAtK" | "directionRecallAtK" | "noveltyConditionedRelevance" | "titleConcentration" | "stratumConcentration";
const METRICS: Metric[] = ["candidateRecallAtK", "crossTitleRecallAtK", "crossIndustryRecallAtK", "surprisingTransferRecallAtK",
  "preferenceRecallAtK", "directionRecallAtK", "noveltyConditionedRelevance", "titleConcentration", "stratumConcentration"];

const out: Record<string, unknown> = {};

for (const difficulty of difficulties) {
  // per strategy -> per metric -> per person
  const collected = new Map<string, Record<Metric, (number | null)[]>>();
  for (const s of strategies) collected.set(s.id, Object.fromEntries(METRICS.map((m) => [m, [] as (number | null)[]])) as Record<Metric, (number | null)[]>);

  for (const seed of seeds) {
    const corpus = buildBenchCorpus({ seed, people, split: "DEVELOPMENT", difficulty });
    const pool = allJobs(corpus);
    for (const person of corpus.people) {
      for (const strategy of strategies) {
        const report = evaluateRetrieval(strategy, person, pool, k);
        const bucket = collected.get(strategy.id)!;
        for (const m of METRICS) bucket[m].push(report[m] as number | null);
      }
    }
  }

  process.stdout.write(`\n=== CANDIDATE RETRIEVAL @${k}, difficulty=${difficulty}, ${seeds.length} seeds x ${people} people ===\n`);
  process.stdout.write(`${"strategy".padEnd(26)}${"recall@5".padEnd(11)}${"xTitle".padEnd(9)}${"xIndustry".padEnd(11)}${"surprising".padEnd(12)}${"pref".padEnd(8)}${"dir".padEnd(8)}${"novRel".padEnd(9)}titleConc\n`);
  for (const s of strategies) {
    const b = collected.get(s.id)!;
    const f = (m: Metric) => mean(b[m].filter((x): x is number => x !== null && x !== undefined));
    process.stdout.write(
      s.id.padEnd(26) +
      f("candidateRecallAtK").toFixed(3).padEnd(11) +
      f("crossTitleRecallAtK").toFixed(3).padEnd(9) +
      f("crossIndustryRecallAtK").toFixed(3).padEnd(11) +
      f("surprisingTransferRecallAtK").toFixed(3).padEnd(12) +
      f("preferenceRecallAtK").toFixed(3).padEnd(8) +
      f("directionRecallAtK").toFixed(3).padEnd(8) +
      f("noveltyConditionedRelevance").toFixed(3).padEnd(9) +
      f("titleConcentration").toFixed(3) + "\n",
    );
  }

  // Primary metric plus guardrails, each paired against the production control.
  const control = collected.get("canonical-work")!;
  process.stdout.write(`\npaired vs canonical-work (control):\n`);
  for (const s of SOFT_CANDIDATE_STRATEGIES) {
    const b = collected.get(s.id)!;
    const parts = (["candidateRecallAtK", "crossTitleRecallAtK", "surprisingTransferRecallAtK", "noveltyConditionedRelevance"] as Metric[]).map((m) => {
      const r = paired(b[m], control[m]);
      return `${m.replace("AtK", "")}=${r.d >= 0 ? "+" : ""}${r.d.toFixed(3)}[${r.low >= 0 ? "+" : ""}${r.low.toFixed(3)},${r.high >= 0 ? "+" : ""}${r.high.toFixed(3)}]${r.significant ? "*" : ""}`;
    });
    process.stdout.write(`  ${s.id.padEnd(26)} ${parts.join("  ")}\n`);
  }
  // Also compare the best soft strategy against the lexical reference it must beat.
  const lexical = collected.get("lexical-overlap")!;
  process.stdout.write(`paired vs lexical-overlap:\n`);
  for (const s of SOFT_CANDIDATE_STRATEGIES) {
    const r = paired(collected.get(s.id)!.candidateRecallAtK, lexical.candidateRecallAtK);
    process.stdout.write(`  ${s.id.padEnd(26)} recall d=${r.d >= 0 ? "+" : ""}${r.d.toFixed(3)} [${r.low >= 0 ? "+" : ""}${r.low.toFixed(3)},${r.high >= 0 ? "+" : ""}${r.high.toFixed(3)}]${r.significant ? " *" : ""}\n`);
  }

  out[difficulty] = Object.fromEntries(
    strategies.map((s) => {
      const b = collected.get(s.id)!;
      return [s.id, Object.fromEntries(METRICS.map((m) => [m, mean(b[m].filter((x): x is number => x !== null && x !== undefined))]))];
    }),
  );
}

const json = JSON.stringify({ version: "soft-canonical.v1", seeds: seeds.length, people, k, results: out }, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync("artifacts/product_readiness/soft_canonical.json", json);
}
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
