// LOCKED_CONFIRMATION is the one split the research contract says must never be executed
// during optimization. Two gates assert that (`scripts/iteration-readiness.ts`,
// `scripts/eval-checkpoint.ts`), and both originally asserted only:
//
//     locked.status !== 0 && !locked.stdout
//
// which is satisfied by any failure whatsoever. On Windows `spawnSync("pnpm", ...)` without a
// shell returns `status: null, error: ENOENT`, so both gates reported PASS while running
// nothing. A gate that cannot fail is not a gate.
//
// These tests pin the corrected contract: the refusal must be POSITIVELY identified, and
// every tooling failure must fail the gate.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  LOCKED_CONFIRMATION_GUARD_MESSAGE,
  LOCKED_CONFIRMATION_GUARD_SENTINEL,
  assertLockedGuardRefusal,
} from "@/lab/lockedGuard";
import { selectEvaluationSplit } from "@/lab/iterationMetrics";

const refusal = { status: 1, stdout: "", stderr: `Error: ${LOCKED_CONFIRMATION_GUARD_MESSAGE}\n`, error: null };

describe("LOCKED_CONFIRMATION guard assertion", () => {
  it("passes only on the specific guard refusal", () => {
    const verdict = assertLockedGuardRefusal(refusal);
    expect(verdict.pass).toBe(true);
    expect(verdict.reason).toBe("REFUSED_AS_EXPECTED");
  });

  // The regression that motivated this file: a missing executable must not look like a guard.
  it("FAILS when the process could never start (missing pnpm / ENOENT)", () => {
    const verdict = assertLockedGuardRefusal({
      status: null,
      stdout: "",
      stderr: "",
      error: { code: "ENOENT", message: "spawnSync pnpm ENOENT" },
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toBe("SPAWN_FAILED");
  });

  it("FAILS on a null status with no error object (killed / never executed)", () => {
    expect(assertLockedGuardRefusal({ status: null, stdout: "", stderr: "", error: null })).toMatchObject({
      pass: false,
      reason: "SPAWN_FAILED",
    });
  });

  it("FAILS when the script fails for an unrelated reason (syntax error, renamed file)", () => {
    const verdict = assertLockedGuardRefusal({
      status: 1,
      stdout: "",
      stderr: "SyntaxError: Unexpected token '}'\n    at compileSourceTextModule\n",
      error: null,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toBe("FAILED_FOR_A_DIFFERENT_REASON");
  });

  it("FAILS loudly when the holdout actually executed", () => {
    expect(
      assertLockedGuardRefusal({ status: 0, stdout: '{"mode":"LOCKED_CONFIRMATION"}', stderr: "", error: null }),
    ).toMatchObject({ pass: false, reason: "EXECUTED_WITHOUT_CONFIRMATION" });
  });

  it("FAILS when a report reached stdout even alongside a nonzero exit", () => {
    expect(
      assertLockedGuardRefusal({ ...refusal, status: 1, stdout: '{"mode":"LOCKED_CONFIRMATION"}' }),
    ).toMatchObject({ pass: false, reason: "PRODUCED_OUTPUT" });
  });
});

describe("the guarded code path actually emits the sentinel", () => {
  // Keeps the assertion honest: if someone reworded the throw, the string the gates grep for
  // would drift and the gate would silently start failing (or, worse, be "fixed" by loosening).
  it("selectEvaluationSplit throws the sentinel without the unlock flag", () => {
    expect(() => selectEvaluationSplit([], "LOCKED_CONFIRMATION")).toThrow(LOCKED_CONFIRMATION_GUARD_SENTINEL);
  });

  it("does not throw for DEVELOPMENT or VALIDATION", () => {
    expect(() => selectEvaluationSplit([], "DEVELOPMENT")).not.toThrow();
    expect(() => selectEvaluationSplit([], "VALIDATION")).not.toThrow();
  });

  // End-to-end: spawn the real script the gates spawn, and confirm the composed verdict is a
  // genuine refusal rather than an accidental one.
  it("the real diagnostics script refuses and the gate recognises it", () => {
    const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/iteration-diagnostics.ts", "--mode=LOCKED_CONFIRMATION"], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    const verdict = assertLockedGuardRefusal({
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: result.error ?? null,
    });
    expect(verdict.reason).toBe("REFUSED_AS_EXPECTED");
    expect(verdict.pass).toBe(true);
  }, 120_000);
});
