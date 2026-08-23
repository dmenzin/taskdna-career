import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const id = process.argv[2];
if (!id || !/^[a-z0-9][a-z0-9-]+$/.test(id)) throw new Error("Usage: pnpm experiment:new <lowercase-id>");
const dir = `experiments/records/${id}`; mkdirSync(dir, {recursive:false});
const template = readFileSync("experiments/templates/EXPERIMENT.md", "utf8")
 .replace("{{EXPERIMENT_ID}}", id)
 .replace("- Timestamp:", `- Timestamp: ${new Date().toISOString()}`)
 .replace("- Starting commit:", `- Starting commit: ${execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()}`);
writeFileSync(`${dir}/record.md`, template); console.log(`${dir}/record.md`);
