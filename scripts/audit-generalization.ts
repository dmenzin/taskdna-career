import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit({ modes: ["generalization"] });
const summary = JSON.parse(readFileSync(join(result.outDir, "generalization.json"), "utf8"));
console.log(JSON.stringify(summary, null, 2));
if (summary.leakageCount > 0 || summary.propertyPassRate < 0.65) process.exit(1);
