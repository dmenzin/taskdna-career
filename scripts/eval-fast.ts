// FAST loop: seconds to a couple of minutes. Run after every code edit.
//
// Runs only what is directly relevant to the subsystem being changed: its tests, its
// DEVELOPMENT evaluator, its anti-Goodhart checks, and its known-answer fixtures. It
// deliberately does NOT run a Next.js build, the full test suite, or VALIDATION.
//
//   pnpm eval:fast                      # infer subsystems from `git diff --name-only`
//   pnpm eval:fast -- preference        # one named subsystem
//   pnpm eval:fast -- mapper channels   # several
//   pnpm eval:fast -- --list            # show the subsystem map
import { spawnSync } from "node:child_process";

interface Subsystem {
  id: string;
  description: string;
  /** Path fragments that map a changed file to this subsystem. */
  pathPatterns: RegExp[];
  steps: { label: string; command: string; args: string[] }[];
}

export const FAST_SUBSYSTEMS: Subsystem[] = [
  {
    id: "generator",
    description: "Synthetic observation generator: semantic polarity, positional bias, phrase catalogs.",
    pathPatterns: [/src\/lab\/(generate|onetLab|preferencePhrases|preferenceSemantics|generatorMonotonicity|generatorBias)\.ts/],
    steps: [
      { label: "generator semantics tests", command: "pnpm", args: ["exec", "vitest", "run", "tests/generator-semantics.test.ts"] },
      { label: "semantic polarity + monotonicity gate", command: "pnpm", args: ["exec", "tsx", "scripts/generator-monotonicity.ts"] },
      { label: "positional bias gate", command: "pnpm", args: ["exec", "tsx", "scripts/generator-bias.ts"] },
    ],
  },
  {
    id: "preference",
    description: "Preference evidence extraction, representation, and the primary DEVELOPMENT metric.",
    pathPatterns: [/src\/domain\/(evidence|workStructure|engine)\.ts/, /src\/lab\/(evidenceAvailability|iterationMetrics|evaluate|preferenceTarget)\.ts/, /src\/config\/model\.ts/],
    steps: [
      { label: "availability + observability tests", command: "pnpm", args: ["exec", "vitest", "run", "tests/available-evidence.test.ts", "tests/evidence-observability.test.ts", "tests/iteration-metrics.test.ts"] },
      { label: "DEVELOPMENT preference metrics", command: "pnpm", args: ["exec", "tsx", "scripts/iteration-diagnostics.ts", "--mode=DEVELOPMENT"] },
      { label: "metric red team", command: "pnpm", args: ["exec", "vitest", "run", "tests/preference-metric-red-team.test.ts"] },
    ],
  },
  {
    id: "mapper",
    description: "Task/DWA candidate retrieval, reranking, abstention, canonical index.",
    pathPatterns: [/src\/v3\/(mapper|canonical|job|person)\.ts/, /src\/onet\//],
    steps: [
      { label: "mapper known answers", command: "pnpm", args: ["exec", "vitest", "run", "tests/v3/bridge.test.ts"] },
      { label: "cache identity + hybrid contract", command: "pnpm", args: ["exec", "vitest", "run", "tests/hybrid-readiness.test.ts"] },
    ],
  },
  {
    id: "channels",
    description: "The four parallel fit channels and their isolation.",
    pathPatterns: [/src\/v3\/(fit|strategy|coefficientGovernance|types)\.ts/],
    steps: [
      { label: "channel isolation", command: "pnpm", args: ["exec", "vitest", "run", "tests/four-channel-parallel.test.ts", "tests/v3/coefficientGovernance.test.ts"] },
    ],
  },
  {
    id: "ranking",
    description: "Job ranking: experience/preference/direction, joint discovery, transfer, policy modes.",
    pathPatterns: [/src\/bench\/(labels|rankMetrics|policy|pipeline|run)\.ts/, /src\/v3\/fit\.ts/],
    steps: [
      { label: "ranking known answers", command: "pnpm", args: ["exec", "vitest", "run", "tests/bench-ranking.test.ts"] },
      { label: "planted-truth validity", command: "pnpm", args: ["exec", "vitest", "run", "tests/bench-planted-truth.test.ts"] },
    ],
  },
  {
    id: "retrieval",
    description: "Candidate job retrieval recall, cross-title and cross-industry coverage.",
    pathPatterns: [/src\/bench\/candidates\.ts/],
    steps: [
      { label: "candidate retrieval benchmark", command: "pnpm", args: ["exec", "tsx", "scripts/bench-product.ts", "--people=8", "--difficulty=hard", "--no-write"] },
    ],
  },
  {
    id: "corpus",
    description: "Planted-truth benchmark corpus: atoms, renderers, archetypes.",
    pathPatterns: [/src\/bench\/(workAtoms|render|corpus)\.ts/],
    steps: [
      { label: "planted-truth validity", command: "pnpm", args: ["exec", "vitest", "run", "tests/bench-planted-truth.test.ts"] },
      { label: "ranking known answers", command: "pnpm", args: ["exec", "vitest", "run", "tests/bench-ranking.test.ts"] },
    ],
  },
  {
    id: "extraction",
    description: "Evidence-class extraction and person/job Task-DWA mapping accuracy.",
    pathPatterns: [/src\/bench\/(extraction|mapping)\.ts/, /src\/domain\/evidence\.ts/],
    steps: [
      { label: "negation and polarity regressions", command: "pnpm", args: ["exec", "vitest", "run", "tests/evidence-negation.test.ts"] },
      { label: "extraction and mapping benchmark", command: "pnpm", args: ["exec", "tsx", "scripts/bench-subsystems.ts", "--difficulty=hard", "--no-write"] },
    ],
  },
  {
    id: "trace",
    description: "End-to-end recommendation traceability.",
    pathPatterns: [/src\/bench\/trace\.ts/],
    steps: [
      { label: "traceability", command: "pnpm", args: ["exec", "vitest", "run", "tests/bench-traceability.test.ts"] },
    ],
  },
  {
    id: "contracts",
    description: "Metric contracts: every optimizable subsystem has a runnable evaluator.",
    pathPatterns: [/config\/metric-contracts\.json/, /scripts\/audit-metric-contracts\.ts/],
    steps: [
      { label: "metric contract audit", command: "pnpm", args: ["exec", "vitest", "run", "tests/metric-contracts.test.ts"] },
    ],
  },
  {
    id: "network",
    description: "Relationship graph, next-best-action, opportunity graph.",
    pathPatterns: [/src\/domain\/(networkEngine|networkTypes)\.ts/, /src\/config\/network\.ts/],
    steps: [
      { label: "network tests", command: "pnpm", args: ["exec", "vitest", "run", "tests/network-engine.test.ts", "tests/network-logic.test.ts"] },
    ],
  },
  {
    id: "hireability",
    description: "Requirement-evidence matching and hireability.",
    pathPatterns: [/src\/domain\/hireability\.ts/],
    steps: [{ label: "hireability tests", command: "pnpm", args: ["exec", "vitest", "run", "tests/hireability.test.ts"] }],
  },
];

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const subsystem of FAST_SUBSYSTEMS) console.log(`${subsystem.id.padEnd(14)} ${subsystem.description}`);
  process.exit(0);
}

const named = args.filter((arg) => !arg.startsWith("--"));
const selected = named.length ? FAST_SUBSYSTEMS.filter((subsystem) => named.includes(subsystem.id)) : inferFromDiff();
if (named.length && selected.length !== named.length) {
  const unknown = named.filter((name) => !FAST_SUBSYSTEMS.some((subsystem) => subsystem.id === name));
  console.error(`Unknown subsystem(s): ${unknown.join(", ")}. Run \`pnpm eval:fast -- --list\`.`);
  process.exit(2);
}
if (!selected.length) {
  console.log("No subsystem matched the current diff. Name one explicitly, e.g. `pnpm eval:fast -- preference`.");
  process.exit(0);
}

const started = Date.now();
const results: { subsystem: string; label: string; pass: boolean; ms: number; tail: string }[] = [];
for (const subsystem of selected) {
  for (const step of subsystem.steps) {
    const stepStarted = Date.now();
    const run = spawnSync(step.command, step.args, { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    const pass = run.status === 0;
    results.push({ subsystem: subsystem.id, label: step.label, pass, ms: Date.now() - stepStarted, tail: pass ? "" : `${run.stdout ?? ""}${run.stderr ?? ""}`.slice(-1200) });
    console.log(`${pass ? "PASS" : "FAIL"}  ${subsystem.id}/${step.label}  ${Date.now() - stepStarted} ms`);
    if (!pass) console.log(results[results.length - 1]!.tail);
  }
}
const passed = results.every((result) => result.pass);
console.log(`\nFAST tier: ${results.filter((r) => r.pass).length}/${results.length} steps passed in ${Date.now() - started} ms (subsystems: ${selected.map((s) => s.id).join(", ")})`);
process.exit(passed ? 0 : 1);

function inferFromDiff(): Subsystem[] {
  const diff = spawnSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" });
  const changed = (diff.stdout ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!changed.length) return [];
  return FAST_SUBSYSTEMS.filter((subsystem) => changed.some((file) => subsystem.pathPatterns.some((pattern) => pattern.test(file))));
}
