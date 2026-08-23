// Diagnostic: how much lexical signal does the GENERATOR leak between the person side and the
// job side for the same planted atom?
//
// WHY THIS MATTERS MORE THAN ANY RANKING NUMBER
// ---------------------------------------------
// Person evidence and job responsibilities for the same planted atom are both produced by
// paraphrasing THE SAME source O*NET statement (`renderPersonEvidence` and
// `renderJobResponsibility` in `src/bench/render.ts`, differing only in synonym offset, frame
// pool, and person-side compression). Two independently written real documents -- a resume
// bullet and a job posting -- describing the same underlying work share no common source
// sentence and therefore no guaranteed rare-word overlap.
//
// If same-atom pairs are lexically separable from different-atom pairs by a wide margin, then
// token overlap is a near-perfect atom-identity detector ON THIS CORPUS, any ranking metric
// built on it saturates for trivial methods, and gains measured here may not transfer to real
// people at all. That is a validity question about the whole benchmark, so it is measured
// directly rather than inferred.
//
// Reports the separation as an ROC AUC: the probability that a randomly chosen same-atom pair
// has higher token overlap than a randomly chosen different-atom pair. 0.5 is no signal, 1.0
// is perfect separation.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildBenchCorpus } from "../src/bench/corpus";
import { contentTokens, type RenderDifficulty } from "../src/bench/render";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const people = Number(arg("people", "12"));
const seedCount = Number(arg("seeds", "4"));
const difficulties = arg("difficulties", "verbatim,standard,hard").split(",") as RenderDifficulty[];
const seeds = Array.from({ length: seedCount }, (_, i) => 1000 + i * 7919);

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

const mean = (v: number[]) => (v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0);
const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : 0);

/** P(same-atom overlap > different-atom overlap), ties counted as half. Rank-based, O(n log n). */
function auc(positive: number[], negative: number[]): number {
  if (!positive.length || !negative.length) return 0.5;
  const all = [...positive.map((v) => ({ v, p: 1 })), ...negative.map((v) => ({ v, p: 0 }))].sort((a, b) => a.v - b.v);
  // Average ranks over ties.
  let i = 0;
  let rankSumPositive = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1]!.v === all[i]!.v) j += 1;
    const avgRank = (i + j) / 2 + 1;
    for (let t = i; t <= j; t += 1) if (all[t]!.p === 1) rankSumPositive += avgRank;
    i = j + 1;
  }
  const n1 = positive.length, n0 = negative.length;
  return (rankSumPositive - (n1 * (n1 + 1)) / 2) / (n1 * n0);
}

const out: Record<string, unknown> = {};

for (const difficulty of difficulties) {
  const same: number[] = [];
  const different: number[] = [];

  for (const seed of seeds) {
    const corpus = buildBenchCorpus({ seed, people, split: "DEVELOPMENT", difficulty });
    for (const person of corpus.people) {
      // Person-side experience statements, tagged with the atom that generated them.
      const personStatements = person.experienceEvidence.map((entry) => ({
        atomId: entry.rendered.atomId,
        tokens: contentTokens(entry.rendered.text),
      }));
      // Job-side responsibilities across this person's own pool, tagged the same way.
      const jobStatements = (corpus.jobsByPerson.get(person.personId) ?? []).flatMap((job) =>
        job.responsibilities.map((r) => ({ atomId: r.rendered.atomId, tokens: contentTokens(r.rendered.text) })),
      );

      for (const p of personStatements) {
        for (const j of jobStatements) {
          const value = jaccard(p.tokens, j.tokens);
          if (p.atomId === j.atomId) same.push(value);
          else different.push(value);
        }
      }
    }
  }

  same.sort((a, b) => a - b);
  different.sort((a, b) => a - b);
  const separation = auc(same, different);

  process.stdout.write(`\n=== ${difficulty.toUpperCase()} (${seeds.length} seeds x ${people} people) ===\n`);
  process.stdout.write(`  same-atom      n=${String(same.length).padEnd(7)} mean=${mean(same).toFixed(4)}  p10=${quantile(same, 0.10).toFixed(4)}  median=${quantile(same, 0.5).toFixed(4)}\n`);
  process.stdout.write(`  different-atom n=${String(different.length).padEnd(7)} mean=${mean(different).toFixed(4)}  p90=${quantile(different, 0.90).toFixed(4)}  p99=${quantile(different, 0.99).toFixed(4)}\n`);
  process.stdout.write(`  ROC AUC (same vs different by raw token overlap) = ${separation.toFixed(4)}\n`);
  process.stdout.write(`  interpretation: ${separation > 0.95 ? "token overlap alone is a near-perfect atom detector on this corpus" : separation > 0.85 ? "token overlap is a strong atom detector" : "token overlap is a weak atom detector"}\n`);

  out[difficulty] = {
    sameAtom: { n: same.length, mean: mean(same), p10: quantile(same, 0.1), median: quantile(same, 0.5) },
    differentAtom: { n: different.length, mean: mean(different), p90: quantile(different, 0.9), p99: quantile(different, 0.99) },
    rocAuc: separation,
  };
}

const json = JSON.stringify({ version: "generator-lexical-leak.v1", seeds: seeds.length, people, results: out }, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync("artifacts/product_readiness/generator_lexical_leak.json", json);
}
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
