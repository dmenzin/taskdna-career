import { spawnSync } from "node:child_process";

const seed = process.argv.find((arg) => arg.startsWith("--seed=")) ?? "--seed=20260822";
const result = spawnSync("pnpm", ["exec", "tsx", "scripts/subjects-generate.ts", seed], { stdio: "inherit" });
process.exit(result.status ?? 1);
