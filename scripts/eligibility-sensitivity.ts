import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { assessGeneratorMonotonicity } from "../src/lab/generatorMonotonicity";
import { computeEligibilitySensitivity, dimensionsThatFlip, DEFAULT_SENSITIVITY_FLOORS, ELIGIBILITY_SENSITIVITY_VERSION } from "../src/lab/eligibilitySensitivity";
import { ELIGIBILITY_COVERAGE_FLOOR_POLICY } from "../src/lab/preferenceTarget";

const subjects = generateOnetSubjects(ONET_LAB_SEED);
const results = assessGeneratorMonotonicity(subjects);
const rows = computeEligibilitySensitivity(results, DEFAULT_SENSITIVITY_FLOORS);
const flips = dimensionsThatFlip(rows, DEFAULT_SENSITIVITY_FLOORS);

const report = {
  version: ELIGIBILITY_SENSITIVITY_VERSION,
  seed: ONET_LAB_SEED,
  currentPolicyFloor: ELIGIBILITY_COVERAGE_FLOOR_POLICY,
  floors: DEFAULT_SENSITIVITY_FLOORS,
  governance: "Diagnostic only. This script must never change AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 or ELIGIBILITY_COVERAGE_FLOOR_POLICY; it only reports what the floor value implies.",
  rows,
  dimensionsThatFlipSolelyDueToThreshold: flips,
};
const json = JSON.stringify(report, null, 2) + "\n";
mkdirSync("artifacts/iteration_readiness", { recursive: true });
writeFileSync("artifacts/iteration_readiness/eligibility_coverage_sensitivity.json", json);
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
