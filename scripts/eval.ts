import { runEvaluation } from "../src/domain/engine";

const evaluation = runEvaluation();

console.log(JSON.stringify(evaluation, null, 2));

if (!evaluation.passed) {
  console.error("Recommendation evaluation failed.");
  process.exit(1);
}
