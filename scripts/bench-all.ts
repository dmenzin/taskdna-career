// Full product benchmark suite across splits and difficulty tiers.
//
// Reports the DEVELOPMENT-to-VALIDATION generalization gap on WITHHELD paraphrase families,
// and the verbatim/standard/hard difficulty ladder that isolates how much of the pipeline's
// performance depends on surface wording. Never touches LOCKED_CONFIRMATION.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { runExtractionBenchmark } from "../src/bench/extraction";
import { runMappingBenchmark } from "../src/bench/mapping";
import { OPTIMIZATION_TARGET_CONFIG, runBenchmark, type BenchSplit, type RenderDifficulty } from "../src/bench/run";

const people = Number(process.argv.find((arg) => arg.startsWith("--people="))?.split("=")[1] ?? OPTIMIZATION_TARGET_CONFIG.minimumPeople);
const started = Date.now();

const difficulties: RenderDifficulty[] = ["verbatim", "standard", "hard"];
const splits: BenchSplit[] = ["DEVELOPMENT", "VALIDATION"];

const ladder = difficulties.map((difficulty) => {
  const report = runBenchmark({ split: "DEVELOPMENT", difficulty, people });
  return {
    difficulty,
    paraphraseOverlap: report.paraphraseGap.meanPersonJobTokenOverlap,
    channelNdcg: Object.fromEntries(report.channelRanking.map((row) => [row.channel, row.ndcgAtK])),
    saturatedChannels: report.headroom.filter((row) => row.saturated).map((row) => row.channel),
    crossTitleRecall: report.crossTitleTransferRecallAtK,
    candidateRecall: Object.fromEntries(report.candidateRetrieval.map((row) => [row.strategy, row.candidateRecallAtK])),
  };
});

const bySplit = splits.map((split) => {
  const product = runBenchmark({ split, difficulty: OPTIMIZATION_TARGET_CONFIG.difficulty, people });
  return {
    split,
    paraphraseFamilies: product.corpus.paraphraseFamilies,
    channelNdcg: Object.fromEntries(product.channelRanking.map((row) => [row.channel, row.ndcgAtK])),
    crossTitleTransferRecallAtK: product.crossTitleTransferRecallAtK,
    jointRelevantRecallAtK: product.jointRelevantRecallAtK,
    transitionRecallAtK: product.transitionRecallAtK,
    surprisingTransferRecallAtK: product.surprisingTransferRecallAtK,
    extraction: pickExtraction(runExtractionBenchmark({ split, difficulty: OPTIMIZATION_TARGET_CONFIG.difficulty, people })),
    mapping: Object.fromEntries(runMappingBenchmark({ split, difficulty: OPTIMIZATION_TARGET_CONFIG.difficulty, people }).streams.map((stream) => [stream.stream, stream.exactTop1Accuracy])),
  };
});

const development = bySplit.find((entry) => entry.split === "DEVELOPMENT")!;
const validation = bySplit.find((entry) => entry.split === "VALIDATION")!;
const gap = (pick: (entry: typeof development) => number | null) => {
  const a = pick(development);
  const b = pick(validation);
  return a === null || b === null ? null : a - b;
};

const report = {
  version: "bench-all.v1",
  people,
  optimizationTarget: OPTIMIZATION_TARGET_CONFIG,
  lockedConfirmationExecuted: false,
  difficultyLadder: ladder,
  bySplit,
  generalizationGap: {
    note: "DEVELOPMENT uses the plain and clausal paraphrase families; VALIDATION uses nominalized and colloquial, which DEVELOPMENT never sees. A positive gap means development-only gains.",
    experienceNdcg: gap((entry) => entry.channelNdcg.experience ?? null),
    preferenceNdcg: gap((entry) => entry.channelNdcg.preference ?? null),
    directionNdcg: gap((entry) => entry.channelNdcg.direction ?? null),
    crossTitleTransferRecall: gap((entry) => entry.crossTitleTransferRecallAtK),
    jointRelevantRecall: gap((entry) => entry.jointRelevantRecallAtK),
    extractionMacroF1: gap((entry) => entry.extraction.macroF1),
    personExperienceMappingTop1: gap((entry) => entry.mapping.person_experience ?? null),
  },
  totalRuntimeMs: 0,
};
report.totalRuntimeMs = Date.now() - started;

const json = JSON.stringify(report, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync("artifacts/product_readiness/bench_all.json", json);
}
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);

function pickExtraction(extraction: ReturnType<typeof runExtractionBenchmark>) {
  return {
    overallAccuracy: extraction.overallAccuracy,
    macroF1: extraction.macroF1,
    contamination: extraction.contamination,
  };
}
