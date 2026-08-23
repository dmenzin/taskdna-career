import { createHash } from "node:crypto";
import { assessGeneratorMonotonicity, assessSemanticPolarity, eligibleMonotonicityPass, semanticPolarityPass } from "../src/lab/generatorMonotonicity";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, PREFERENCE_DIMENSION_DECISIONS } from "../src/lab/preferenceTarget";
import { PREFERENCE_SEMANTICS_VERSION } from "../src/lab/preferenceSemantics";

const subjects = generateOnetSubjects(ONET_LAB_SEED);
const results = assessGeneratorMonotonicity(subjects);
const polarity = assessSemanticPolarity(subjects);
const report = {
  version: "generator-monotonicity.v2-semantic",
  semanticsVersion: PREFERENCE_SEMANTICS_VERSION,
  seed: ONET_LAB_SEED,
  autonomousDimensions: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1,
  // Semantic polarity is the hard gate: every generated statement's MEANING
  // (behaviour side x stance) must agree with the side of the hidden truth.
  semanticPolarityPass: semanticPolarityPass(polarity),
  eligiblePass: eligibleMonotonicityPass(results),
  semanticPolarity: polarity,
  decisions: PREFERENCE_DIMENSION_DECISIONS,
  results,
};
const json = JSON.stringify(report, null, 2) + "\n";
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
if (!report.eligiblePass || !report.semanticPolarityPass) process.exitCode = 1;
