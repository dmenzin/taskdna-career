// T-01: deterministic provenance-threshold sensitivity over a completed P-01 artifact.
// Zero model calls. Does not pick a friendlier threshold.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sweepProvenanceThresholds } from "../src/agent/provenanceSensitivity";
import type { CareerBlueprintV2 } from "../src/agent/agentArchitecture";
import { buildFrameCorpus } from "../src/bench/frameCorpus";

const source = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]
  ?? "artifacts/eval/person-blueprint-v2-openai-LEXICAL_TRAP-low.json";

if (!existsSync(source)) {
  process.stderr.write(`T-01 needs the P-01 artifact at ${source}. Run P-01 first. Nothing was spent.\n`);
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(source, "utf8")) as {
  people: number;
  family: "NATURAL" | "SEMANTIC_BRIDGE" | "LEXICAL_TRAP";
  blueprintsV2: Record<string, CareerBlueprintV2>;
};
const corpus = buildFrameCorpus({ people: artifact.people, split: "DEVELOPMENT", family: artifact.family });
const blueprints = new Map(Object.entries(artifact.blueprintsV2));
const sensitivity = sweepProvenanceThresholds(corpus.people, blueprints);

const outputPath = "artifacts/eval/p01-threshold-sensitivity.json";
writeFileSync(outputPath, JSON.stringify({
  experiment: "T-01",
  source,
  defaultKeeps: sensitivity.defaultKeeps,
  conclusionFlips: sensitivity.conclusionFlips,
  cells: sensitivity.cells,
}, null, 2) + "\n");

process.stdout.write(`T-01  cells=${sensitivity.cells.length}  conclusionFlips=${sensitivity.conclusionFlips}\n`);
process.stdout.write(`default KEEP set: ${JSON.stringify(sensitivity.defaultKeeps)}\n`);
process.stdout.write(`wrote ${outputPath}\n`);
process.stdout.write(`Thresholds were not selected post-hoc. P-01 KEEP/REJECT stays on 0.6 / 0.1.\n`);
