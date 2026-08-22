import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit({ modes: ["unseen"] });
console.log(JSON.stringify(result.latest.unseen, null, 2));
if (result.latest.unseen.passRate < 0.6) process.exit(1);
