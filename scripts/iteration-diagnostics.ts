import { createHash } from "node:crypto";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { diagnosePreference, selectEvaluationSplit, type EvaluationMode } from "../src/lab/iterationMetrics";

const modeArg = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "DEVELOPMENT";
if (!(["DEVELOPMENT", "VALIDATION", "LOCKED_CONFIRMATION"] as string[]).includes(modeArg)) throw new Error(`Unknown evaluation mode: ${modeArg}`);
const all = generateOnetSubjects(ONET_LAB_SEED);
const development = selectEvaluationSplit(all, "DEVELOPMENT");
const subjects = selectEvaluationSplit(all, modeArg as EvaluationMode, process.argv.includes("--confirm-locked"));
const report = { mode: modeArg, seed: ONET_LAB_SEED, ...diagnosePreference(subjects, development) };
const json = JSON.stringify(report, null, 2) + "\n";
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
