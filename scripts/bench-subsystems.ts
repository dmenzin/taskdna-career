import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { runExtractionBenchmark, runRequirementBenchmark } from "../src/bench/extraction";
import { runMappingBenchmark } from "../src/bench/mapping";
import { traceFixture } from "../src/bench/trace";
import type { BenchSplit, RenderDifficulty } from "../src/bench/run";

const split = (process.argv.find((arg) => arg.startsWith("--split="))?.split("=")[1] ?? "DEVELOPMENT") as BenchSplit;
const difficulty = (process.argv.find((arg) => arg.startsWith("--difficulty="))?.split("=")[1] ?? "standard") as RenderDifficulty;
if (split === "LOCKED_CONFIRMATION" && !process.argv.includes("--confirm-locked")) {
  throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
}

const report = {
  version: "bench-subsystems.v1",
  split,
  difficulty,
  extraction: runExtractionBenchmark({ split, difficulty }),
  requirements: runRequirementBenchmark({ split }),
  mapping: runMappingBenchmark({ split, difficulty }),
  trace: traceFixture({ split, difficulty }),
};
const json = JSON.stringify(report, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync(`artifacts/product_readiness/subsystems_${split.toLowerCase()}_${difficulty}.json`, json);
}
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
