import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { runBenchmark, type BenchSplit, type RenderDifficulty } from "../src/bench/run";

const splitArg = (process.argv.find((arg) => arg.startsWith("--split="))?.split("=")[1] ?? "DEVELOPMENT") as BenchSplit;
if (!["DEVELOPMENT", "VALIDATION", "LOCKED_CONFIRMATION"].includes(splitArg)) throw new Error(`Unknown split: ${splitArg}`);
if (splitArg === "LOCKED_CONFIRMATION" && !process.argv.includes("--confirm-locked")) {
  throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
}
const people = Number(process.argv.find((arg) => arg.startsWith("--people="))?.split("=")[1] ?? 24);
const k = Number(process.argv.find((arg) => arg.startsWith("--k="))?.split("=")[1] ?? 5);
const difficulty = (process.argv.find((arg) => arg.startsWith("--difficulty="))?.split("=")[1] ?? "standard") as RenderDifficulty;
if (!["verbatim", "standard", "hard"].includes(difficulty)) throw new Error(`Unknown difficulty: ${difficulty}`);

const report = runBenchmark({ split: splitArg, people, k, difficulty });
const json = JSON.stringify(report, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync(`artifacts/product_readiness/bench_${splitArg.toLowerCase()}_${difficulty}.json`, json);
}
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
