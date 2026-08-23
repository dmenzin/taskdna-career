import { createHash } from "node:crypto";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { eligibilitySensitivityTable } from "../src/lab/eligibilitySensitivity";
import { selectEvaluationSplit } from "../src/lab/iterationMetrics";

const subjects = selectEvaluationSplit(generateOnetSubjects(ONET_LAB_SEED), "DEVELOPMENT");
const report = { version: "eligibility-sensitivity.v1", seed: ONET_LAB_SEED, mode: "DEVELOPMENT", ...eligibilitySensitivityTable(subjects) };
const json = JSON.stringify(report, null, 2) + "\n";
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
