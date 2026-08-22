import { writeFileSync, mkdirSync } from "node:fs";
import { inventoryParameters } from "../src/lab/parameters";

const parameters = inventoryParameters();
mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync("artifacts/logic_audit/parameters.json", JSON.stringify(parameters, null, 2));
console.log(JSON.stringify({ count: parameters.count, version: parameters.version }, null, 2));
