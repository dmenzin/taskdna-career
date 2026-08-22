import { generateVirtualSubjects } from "../src/lab/generate";
import { evaluateZeroOrigin } from "../src/lab/evaluate";

const cases = evaluateZeroOrigin(generateVirtualSubjects());
const passRate = cases.filter((item) => item.pass).length / cases.length;
console.log(JSON.stringify({ passRate, cases }, null, 2));
if (passRate < 0.95) process.exit(1);
