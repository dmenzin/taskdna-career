import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit();
console.log(JSON.stringify({ passed: result.passed, outDir: result.outDir, scorecard: result.latest.scorecard.grades }, null, 2));
if (!result.passed) process.exit(1);
