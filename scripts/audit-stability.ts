import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit({ modes: ["stability"] });
console.log(JSON.stringify(result.latest.stability, null, 2));
if (!result.latest.stability.stable) process.exit(1);
