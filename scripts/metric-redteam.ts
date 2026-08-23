import { createHash } from "node:crypto";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { evaluateMetricAttacks } from "../src/lab/metricAdversary";
import { preferenceMetricRecords, selectEvaluationSplit } from "../src/lab/iterationMetrics";

const subjects = selectEvaluationSplit(generateOnetSubjects(ONET_LAB_SEED), "DEVELOPMENT");
const attacks = evaluateMetricAttacks(preferenceMetricRecords(subjects, subjects));
const report = {
  version: "metric-redteam.v1",
  seed: ONET_LAB_SEED,
  mode: "DEVELOPMENT",
  allAttacksResistedOrExposed: attacks.every((attack) => attack.resistedByPrimary || attack.exposedByGuardrail),
  attacks: attacks.map((attack) => ({
    id: attack.id,
    name: attack.name,
    resistedByPrimary: attack.resistedByPrimary,
    exposedByGuardrail: attack.exposedByGuardrail,
    detail: attack.detail,
    before: {
      availableEvidencePreferenceMacroMae: attack.before.availableEvidencePreferenceMacroMae,
      availableToRecognizedRecall: attack.before.availableToRecognizedRecall,
      availableEvidenceCoverage: attack.before.availableEvidenceCoverage,
      availableEligibleCount: attack.before.availableEligibleCount,
    },
    after: {
      availableEvidencePreferenceMacroMae: attack.after.availableEvidencePreferenceMacroMae,
      availableToRecognizedRecall: attack.after.availableToRecognizedRecall,
      availableEvidenceCoverage: attack.after.availableEvidenceCoverage,
      availableEligibleCount: attack.after.availableEligibleCount,
    },
  })),
};
const json = JSON.stringify(report, null, 2) + "\n";
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
if (!report.allAttacksResistedOrExposed) process.exitCode = 1;
