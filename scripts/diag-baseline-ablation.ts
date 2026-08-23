// Diagnostic: WHERE does the resume-lexical baseline's `hard`-tier advantage come from?
//
// The headline product claim is that TaskDNA does not clearly beat resume-lexical matching on
// experience ranking and loses badly on candidate retrieval at `hard`. Two structural
// differences, neither of them "canonical matching is bad", could produce that:
//
//   AGGREGATION  The lexical baseline scores the WHOLE narrative as one token bag. Canonical
//                retrieval maps each statement INDIVIDUALLY and needs it to resolve to a Task
//                or DWA. At `hard`, paraphrase() drops every qualifying clause and then 35% of
//                the remaining content words, so an individual bullet can fall below the
//                threshold where it identifies anything -- while the UNION of ten such bullets
//                still shares plenty of tokens with the job text.
//
//   EXTRA FIELDS The narrative additionally contains homeTitle, homeIndustry and a "Skills:"
//                line. TaskDNA's leakage guard deliberately refuses title/occupation signal
//                (buildPersonFromRenderedText feeds it as occupation_context, which must create
//                no person-side signal). The baseline is therefore allowed to use information
//                the system under test is forbidden to use.
//
// This ablates the narrative to separate the two. Nothing here changes the system under test.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildBenchCorpus, type PlantedJob, type PlantedPerson } from "../src/bench/corpus";
import type { RenderDifficulty } from "../src/bench/render";
import { contentTokens } from "../src/bench/render";
import { labelPair, type Channel, type PairLabel } from "../src/bench/labels";
import { rankByChannel, runPerson } from "../src/bench/pipeline";
import { ndcgAtK } from "../src/bench/rankMetrics";
import { pairedBootstrap, type PersonMeasurement, type SystemId } from "../src/bench/power";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const people = Number(arg("people", "12"));
const seedCount = Number(arg("seeds", "12"));
const k = Number(arg("k", "5"));
const difficulties = arg("difficulties", "standard,hard").split(",") as RenderDifficulty[];
const seeds = Array.from({ length: seedCount }, (_, i) => 1000 + i * 7919);

/** Narrative variants. `full` is exactly what src/bench/corpus.ts builds today. */
const VARIANTS = {
  full: (p: PlantedPerson) => [
    `${p.homeTitle} working in ${p.homeIndustry}.`,
    ...p.experienceEvidence.map((e) => e.rendered.text),
    ...p.preferenceEvidence.map((e) => e.rendered.text),
    ...p.aspirationEvidence.map((e) => e.rendered.text),
    `Skills: ${p.qualifications.map((q) => q.value).join(", ")}.`,
  ].join(" "),
  // Removes the title/industry sentence only.
  noTitle: (p: PlantedPerson) => [
    ...p.experienceEvidence.map((e) => e.rendered.text),
    ...p.preferenceEvidence.map((e) => e.rendered.text),
    ...p.aspirationEvidence.map((e) => e.rendered.text),
    `Skills: ${p.qualifications.map((q) => q.value).join(", ")}.`,
  ].join(" "),
  // Only the evidence statements: the same information the canonical path is given.
  evidenceOnly: (p: PlantedPerson) => [
    ...p.experienceEvidence.map((e) => e.rendered.text),
    ...p.preferenceEvidence.map((e) => e.rendered.text),
    ...p.aspirationEvidence.map((e) => e.rendered.text),
  ].join(" "),
  // Experience statements alone, the closest match to what the experience channel may use.
  experienceOnly: (p: PlantedPerson) => p.experienceEvidence.map((e) => e.rendered.text).join(" "),
} as const;
type VariantId = keyof typeof VARIANTS;

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

function rankLexical(text: string, jobs: PlantedJob[]): string[] {
  const q = contentTokens(text);
  return [...jobs]
    .map((job) => ({ job, score: jaccard(q, contentTokens(job.descriptionText)) }))
    .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
    .map((e) => e.job.jobId);
}

const channel: Channel = "experience";
const results: Record<string, unknown> = {};

for (const difficulty of difficulties) {
  const measurements: PersonMeasurement[] = [];
  for (const seed of seeds) {
    const corpus = buildBenchCorpus({ seed, people, split: "DEVELOPMENT", difficulty });
    for (const planted of corpus.people) {
      const jobs = corpus.jobsByPerson.get(planted.personId)!;
      const labels = new Map<string, PairLabel>(jobs.map((j) => [j.jobId, labelPair(planted, j)]));
      const lookup = (id: string) => labels.get(id);
      const run = runPerson(planted, jobs);
      const ndcg: Record<string, number | null> = {
        taskdna: ndcgAtK(rankByChannel(run, channel), lookup, channel, k),
      };
      for (const [variant, build] of Object.entries(VARIANTS)) {
        ndcg[`lexical-${variant}`] = ndcgAtK(rankLexical(build(planted), jobs), lookup, channel, k);
      }
      measurements.push({ seed, personId: planted.personId, ndcg: ndcg as PersonMeasurement["ndcg"] });
    }
  }

  process.stdout.write(`\n=== EXPERIENCE NDCG@${k}, difficulty=${difficulty}, ${measurements.length} persons (${seeds.length} seeds x ${people}) ===\n`);
  const comparisons = (Object.keys(VARIANTS) as VariantId[]).map((variant) => {
    const c = pairedBootstrap(measurements, "taskdna" as SystemId, `lexical-${variant}` as SystemId);
    const verdict = c.significant ? (c.meanDifference > 0 ? "TASKDNA WINS" : "BASELINE WINS") : "indistinguishable";
    process.stdout.write(
      `  taskdna=${c.meanSystem.toFixed(4)}  lexical-${variant.padEnd(15)}=${c.meanReference.toFixed(4)}` +
      `  d=${c.meanDifference >= 0 ? "+" : ""}${c.meanDifference.toFixed(4)}` +
      `  CI95=[${c.ci95.low >= 0 ? "+" : ""}${c.ci95.low.toFixed(4)}, ${c.ci95.high >= 0 ? "+" : ""}${c.ci95.high.toFixed(4)}]  ${verdict}\n`,
    );
    return { variant, ...c };
  });
  results[difficulty] = { persons: measurements.length, comparisons };
}

const json = JSON.stringify({ version: "baseline-ablation.v1", seeds: seeds.length, people, k, results }, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync("artifacts/product_readiness/baseline_ablation.json", json);
}
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
