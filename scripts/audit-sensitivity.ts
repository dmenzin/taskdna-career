import { runLogicAudit } from "../src/lab/audit";

const result = runLogicAudit({ modes: ["sensitivity"] });
console.log(JSON.stringify(result.latest.sensitivity, null, 2));
