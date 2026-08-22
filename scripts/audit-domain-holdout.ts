import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit({ modes: ["domain-holdout"] });
console.log(JSON.stringify(result.latest.domainHoldout, null, 2));
const holdout = JSON.parse(readFileSync(join(result.outDir, "generalization.json"), "utf8"));
if (holdout.holdoutPassRate < 0.6) process.exit(1);
