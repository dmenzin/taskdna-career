// CHECKPOINT tier: run roughly every 45-90 minutes, or after a subsystem milestone.
//
// Broader than FAST and cheaper than FULL. Runs the whole unit suite, the DEVELOPMENT
// dashboard, the preregistered-validation and channel-isolation gates, mapper/scorer
// regression, and reproducibility checks. It does NOT run `pnpm build` (no Next.js
// compilation) and does NOT touch LOCKED_CONFIRMATION.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { assertLockedGuardRefusal } from "../src/lab/lockedGuard";

// On win32 pnpm/npx/npm resolve to .cmd shims, which spawnSync cannot execute without a
// shell: every delegated step returned ENOENT with a null status. `scripts/iteration-readiness.ts`
// already carried this fix; this file did not, so the entire CHECKPOINT tier was failing to
// execute on Windows while its LOCKED gate still reported PASS. The shell is used ONLY for
// those shims.
const NEEDS_SHELL = new Set(["pnpm", "npx", "npm"]);
const run = (command: string, args: string[]) =>
  spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32" && NEEDS_SHELL.has(command),
  });

interface Step { label: string; pass: boolean; ms: number; detail: string }
const steps: Step[] = [];

function step(label: string, command: string, args: string[], describe?: (stdout: string) => string) {
  const started = Date.now();
  const result = run(command, args);
  const pass = result.status === 0;
  steps.push({
    label,
    pass,
    ms: Date.now() - started,
    detail: pass ? (describe?.(result.stdout ?? "") ?? "pass") : `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(-1200),
  });
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ${Date.now() - started} ms`);
  return result;
}

const started = Date.now();

// Broader tests: the whole unit suite, which is fast enough for this tier.
step("unit tests", "pnpm", ["test"]);
step("typecheck", "pnpm", ["typecheck"]);

// Generator validity gates.
step("generator semantic polarity + monotonicity", "pnpm", ["exec", "tsx", "scripts/generator-monotonicity.ts"], (stdout) => {
  const report = safeParse(stdout);
  return `semanticPolarityPass=${report?.semanticPolarityPass} eligiblePass=${report?.eligiblePass}`;
});
step("generator positional bias", "pnpm", ["exec", "tsx", "scripts/generator-bias.ts"], (stdout) => {
  const report = safeParse(stdout);
  return `samplerPass=${report?.samplerPass} corpusPass=${report?.corpusPass}`;
});

// DEVELOPMENT dashboard.
const development = step("DEVELOPMENT preference dashboard", "pnpm", ["exec", "tsx", "scripts/iteration-diagnostics.ts", "--mode=DEVELOPMENT"], (stdout) => {
  const report = safeParse(stdout);
  return `primary=${report?.AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1} recall=${report?.AVAILABLE_TO_RECOGNIZED_RECALL} warnings=${JSON.stringify(report?.warnings)}`;
});

// Reproducibility: the same command twice must produce byte-identical output.
{
  const label = "DEVELOPMENT metrics reproducible";
  const startedAt = Date.now();
  const second = run("pnpm", ["exec", "tsx", "scripts/iteration-diagnostics.ts", "--mode=DEVELOPMENT"]);
  const identical = second.status === 0 && second.stdout === development.stdout;
  steps.push({ label, pass: identical, ms: Date.now() - startedAt, detail: identical ? `sha256=${createHash("sha256").update(development.stdout ?? "").digest("hex").slice(0, 16)}` : "two runs produced different output" });
  console.log(`${identical ? "PASS" : "FAIL"}  ${label}  ${Date.now() - startedAt} ms`);
}

// Preregistered validation: only ever confirms a DEVELOPMENT result, never guides iteration.
step("VALIDATION preference dashboard (confirmation only)", "pnpm", ["exec", "tsx", "scripts/iteration-diagnostics.ts", "--mode=VALIDATION"], (stdout) => {
  const report = safeParse(stdout);
  return `primary=${report?.AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1}`;
});

// Channel isolation and mapper/scorer regression.
step("four-channel isolation", "pnpm", ["exec", "vitest", "run", "tests/four-channel-parallel.test.ts"]);
step("mapper/scorer regression", "pnpm", ["exec", "vitest", "run", "tests/v3/bridge.test.ts", "tests/v3/coefficientGovernance.test.ts", "tests/hybrid-readiness.test.ts"]);

// Metric red team.
step("preference metric red team", "pnpm", ["exec", "tsx", "scripts/preference-metric-red-team.ts"]);

// Product-level contracts and benchmarks.
step("metric contract audit", "pnpm", ["exec", "tsx", "scripts/audit-metric-contracts.ts"], (stdout) => {
  const report = safeParse(stdout);
  return `${report?.contracts} contracts, ${report?.runnable} runnable, ${report?.notRunnable} explicitly excluded`;
});
step("product ranking benchmark (hard tier)", "pnpm", ["exec", "tsx", "scripts/bench-product.ts", "--difficulty=hard", "--people=12", "--no-write"], (stdout) => {
  const report = safeParse(stdout) as { channelRanking?: { channel: string; ndcgAtK: number | null }[] } | null;
  return (report?.channelRanking ?? []).map((row) => `${row.channel}=${row.ndcgAtK?.toFixed(4)}`).join(" ");
});
step("subsystem benchmarks and trace fixture", "pnpm", ["exec", "tsx", "scripts/bench-subsystems.ts", "--difficulty=hard", "--no-write"], (stdout) => {
  const report = safeParse(stdout) as { extraction?: { macroF1: number | null }; trace?: { stageVerdicts?: { verdict: string }[] } } | null;
  const failed = (report?.trace?.stageVerdicts ?? []).filter((verdict) => verdict.verdict === "FAILED").length;
  return `extraction macroF1=${report?.extraction?.macroF1?.toFixed(4)}, trace failed stages=${failed}`;
});

// Product-level red team.
step("product red team", "pnpm", ["exec", "tsx", "scripts/product-red-team.ts", "--no-write"], (stdout) => {
  const report = safeParse(stdout) as { summary?: { pass: number; limitation: number; fail: number } } | null;
  return `${report?.summary?.pass} pass, ${report?.summary?.limitation} limitation, ${report?.summary?.fail} fail`;
});

// LOCKED_CONFIRMATION must stay guarded.
{
  const label = "LOCKED_CONFIRMATION stays guarded";
  const startedAt = Date.now();
  const locked = run("pnpm", ["exec", "tsx", "scripts/iteration-diagnostics.ts", "--mode=LOCKED_CONFIRMATION"]);
  // Require the specific refusal. The previous `status !== 0 && !stdout` predicate was
  // satisfied by a missing executable, a spawn error or a crash, none of which show the
  // holdout is protected.
  const verdict = assertLockedGuardRefusal({
    status: locked.status,
    stdout: locked.stdout ?? "",
    stderr: locked.stderr ?? "",
    error: locked.error ?? null,
  });
  steps.push({ label, pass: verdict.pass, ms: Date.now() - startedAt, detail: `${verdict.reason}: ${verdict.detail}` });
  console.log(`${verdict.pass ? "PASS" : "FAIL"}  ${label}  ${Date.now() - startedAt} ms`);
}

const totalMs = Date.now() - started;
const passed = steps.every((entry) => entry.pass);
const report = { tier: "CHECKPOINT", version: "eval-checkpoint.v1", totalMs, passed, steps };
mkdirSync("artifacts/iteration_readiness", { recursive: true });
writeFileSync("artifacts/iteration_readiness/checkpoint_latest.json", JSON.stringify(report, null, 2) + "\n");
console.log(`\nCHECKPOINT tier: ${steps.filter((s) => s.pass).length}/${steps.length} steps passed in ${totalMs} ms`);
process.exit(passed ? 0 : 1);

function safeParse(stdout: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}
