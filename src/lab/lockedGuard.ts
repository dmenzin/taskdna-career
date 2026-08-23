// The LOCKED_CONFIRMATION refusal contract, in one place.
//
// WHY THIS FILE EXISTS
// --------------------
// `iteration-readiness` and `eval-checkpoint` both assert that LOCKED_CONFIRMATION stays
// guarded by spawning the diagnostics script and expecting it to refuse. Both originally
// asserted only `status !== 0 && !stdout`. That predicate is satisfied by ANY failure:
//
//   - `pnpm` missing from PATH             -> spawnSync returns status null, ENOENT, empty stdout -> "PASS"
//   - a syntax error in the target script  -> nonzero exit, empty stdout                          -> "PASS"
//   - the script renamed or deleted        -> nonzero exit, empty stdout                          -> "PASS"
//
// So the single most safety-critical gate in the research contract could not distinguish
// "the guard held" from "the command never ran". On this Windows checkout it was doing
// exactly that: `spawnSync("pnpm", ...)` without a shell cannot execute the `.CMD` shim,
// so the gate reported PASS while executing nothing at all.
//
// A guard assertion must therefore be POSITIVE: require the specific refusal, not merely
// the absence of success.

/**
 * Substring common to every LOCKED_CONFIRMATION refusal in the repository
 * (`src/lab/iterationMetrics.ts`, `scripts/bench-power.ts`, `scripts/bench-product.ts`,
 * `scripts/bench-subsystems.ts`). The gate requires this to appear on stderr, which is
 * what separates a genuine refusal from a tooling failure.
 */
export const LOCKED_CONFIRMATION_GUARD_SENTINEL = "LOCKED_CONFIRMATION is guarded.";

/** The full message thrown by `selectEvaluationSplit` when the unlock flag is absent. */
export const LOCKED_CONFIRMATION_GUARD_MESSAGE =
  `${LOCKED_CONFIRMATION_GUARD_SENTINEL} Re-run with --confirm-locked; never use it during ordinary iteration.`;

/** The subset of a `spawnSync` result the assertion needs. */
export interface GuardSpawnOutcome {
  status: number | null;
  stdout: string;
  stderr: string;
  /** `spawnSync().error`, present when the process could not be started at all. */
  error?: { code?: string; message?: string } | null;
}

export interface LockedGuardVerdict {
  pass: boolean;
  /** Machine-readable reason, so a failure says WHY rather than just "not guarded". */
  reason:
    | "REFUSED_AS_EXPECTED"
    | "SPAWN_FAILED"
    | "EXECUTED_WITHOUT_CONFIRMATION"
    | "PRODUCED_OUTPUT"
    | "FAILED_FOR_A_DIFFERENT_REASON";
  detail: string;
}

/**
 * Assert that a LOCKED_CONFIRMATION invocation refused for the RIGHT reason.
 *
 * Passes only when the process actually started, exited nonzero, wrote no report to stdout,
 * and emitted the guard sentinel on stderr. Every other outcome — including a missing
 * executable, a spawn error, or an unrelated crash — fails, because none of them is
 * evidence that the guard is working.
 */
export function assertLockedGuardRefusal(outcome: GuardSpawnOutcome): LockedGuardVerdict {
  if (outcome.error) {
    const code = outcome.error.code ?? "unknown";
    return {
      pass: false,
      reason: "SPAWN_FAILED",
      detail:
        `the guard probe could not be started (${code}): ${outcome.error.message ?? ""}`.trim() +
        " — this is a tooling failure, NOT evidence that LOCKED_CONFIRMATION is guarded",
    };
  }

  if (outcome.status === null) {
    return {
      pass: false,
      reason: "SPAWN_FAILED",
      detail:
        "the guard probe exited with a null status (killed by signal, or never executed) — " +
        "this is a tooling failure, NOT evidence that LOCKED_CONFIRMATION is guarded",
    };
  }

  if (outcome.status === 0) {
    return {
      pass: false,
      reason: "EXECUTED_WITHOUT_CONFIRMATION",
      detail: "LOCKED_CONFIRMATION exited 0 without --confirm-locked: the holdout was executed",
    };
  }

  if (outcome.stdout.trim().length > 0) {
    return {
      pass: false,
      reason: "PRODUCED_OUTPUT",
      detail: `LOCKED_CONFIRMATION wrote ${outcome.stdout.trim().length} bytes to stdout without --confirm-locked`,
    };
  }

  if (!outcome.stderr.includes(LOCKED_CONFIRMATION_GUARD_SENTINEL)) {
    return {
      pass: false,
      reason: "FAILED_FOR_A_DIFFERENT_REASON",
      detail:
        `the guard probe failed (exit ${outcome.status}) but stderr does not contain ` +
        `${JSON.stringify(LOCKED_CONFIRMATION_GUARD_SENTINEL)}, so the refusal cannot be attributed ` +
        `to the guard. stderr tail: ${outcome.stderr.trim().slice(-400) || "(empty)"}`,
    };
  }

  return {
    pass: true,
    reason: "REFUSED_AS_EXPECTED",
    detail: `refused with the guard sentinel (exit ${outcome.status}); LOCKED_CONFIRMATION not executed`,
  };
}
