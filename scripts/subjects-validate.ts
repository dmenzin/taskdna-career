import { evaluateSubject, evaluateTwins } from "../src/lab/evaluate";
import { generateTwins, generateVirtualSubjects } from "../src/lab/generate";

const subjects = generateVirtualSubjects();
const evals = subjects.map(evaluateSubject);
const twins = evaluateTwins(generateTwins(subjects));
const propertyPass = evals.flatMap((item) => item.propertyResults);
const passRate = propertyPass.filter((item) => item.pass).length / propertyPass.length;
console.log(JSON.stringify({
  subjects: subjects.length,
  propertyPassRate: passRate,
  twinPassRate: twins.filter((item) => item.pass).length / twins.length,
  meanMae: evals.reduce((sum, item) => sum + item.taskDnaMae, 0) / evals.length,
}, null, 2));
if (passRate < 0.65) process.exit(1);
