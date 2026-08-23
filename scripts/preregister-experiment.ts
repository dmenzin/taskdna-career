// Append a PREREGISTERED record to config/experiment-registry.json.
//
// Paid experiment scripts call assertPreregistered() before they can spend. This is the
// command that creates the record they will look up. It refuses a duplicate id — records
// are append-only — and regenerates docs/AGENTIC_RESEARCH_PROGRAM.md so the projection
// cannot drift from the data.
//
// Usage:
//   pnpm experiment:preregister --id=person-blueprint-v2:openai:LEXICAL_TRAP:low \
//     --question="..." --hypothesis="..." --family=LEXICAL_TRAP \
//     --calls=12 --cost=0.45
import { spawnSync } from "node:child_process";
import { appendPreregistration } from "../src/agent/experimentRegistry";

const arg = (name: string): string | undefined =>
  process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const id = arg("id");
const question = arg("question");
const hypothesis = arg("hypothesis");
const family = arg("family");
if (!id || !question || !hypothesis || !family) {
  process.stderr.write(
    "Usage: pnpm experiment:preregister --id=<id> --question=<q> --hypothesis=<h> --family=<family> [--calls=N] [--cost=USD]\n",
  );
  process.exit(2);
}

const commit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const record = appendPreregistration({
  experimentId: id,
  question,
  hypothesis,
  family,
  estimatedCalls: arg("calls") ? Number(arg("calls")) : null,
  estimatedCostUsd: arg("cost") ? Number(arg("cost")) : null,
  preregistrationCommit: commit.status === 0 ? commit.stdout.trim() : null,
});

const rendered = spawnSync("pnpm", ["exec", "tsx", "scripts/research-program.ts"], {
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" },
});
if (rendered.status !== 0) {
  process.stderr.write(rendered.stderr || rendered.stdout);
  process.exit(rendered.status ?? 1);
}

process.stdout.write(
  `preregistered ${record.experimentId} (status=${record.status}, commit=${record.preregistrationCommit ?? "unknown"})\n`,
);
