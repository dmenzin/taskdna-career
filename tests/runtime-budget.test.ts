// The $25 / 1,000-call ceiling in docs/RESEARCH_CONTRACT_AMENDMENTS.md § B is only real if
// code refuses the call that would breach it. These tests pin that: the ledger must REFUSE,
// not merely report, and it must survive a process restart.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MODEL_PRICING,
  RUNTIME_BUDGET_LIMITS,
  RuntimeBudgetExceededError,
  RuntimeBudgetLedger,
  UNKNOWN_MODEL_PRICING,
  estimateCostUsd,
} from "@/agent/budget";

let dir: string;
let ledgerPath: string;
const entry = (costUsd: number, cacheHit = false) => ({
  experimentId: "test",
  model: "claude-haiku-4-5",
  promptId: "p",
  promptVersion: "v1",
  inputTokens: 100,
  outputTokens: 100,
  costUsd,
  costIsEstimate: true,
  cacheHit,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "taskdna-budget-"));
  ledgerPath = join(dir, "nested", "ledger.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("contract ceilings", () => {
  it("are the values the amendment declares", () => {
    expect(RUNTIME_BUDGET_LIMITS.maxSpendUsd).toBe(25);
    expect(RUNTIME_BUDGET_LIMITS.maxCalls).toBe(1000);
  });
});

describe("cost estimation", () => {
  it("computes from token counts and configured pricing", () => {
    // 1M input + 1M output on Haiku 4.5 = $1 + $5
    const { costUsd, costIsEstimate } = estimateCostUsd("claude-haiku-4-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(costUsd).toBeCloseTo(6, 6);
    expect(costIsEstimate).toBe(true);
  });

  // Never invent pricing: an unknown model is charged the most expensive known rate, so a
  // missing price can only cause under-spend, never a silent overrun.
  it("charges an unknown model conservatively and flags it", () => {
    const unknown = estimateCostUsd("some-future-model", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(unknown.pricingWasUnknown).toBe(true);
    expect(unknown.costUsd).toBeCloseTo(UNKNOWN_MODEL_PRICING.inputPerMTok, 6);
    const cheapest = Math.min(...Object.values(MODEL_PRICING).map((p) => p.inputPerMTok));
    expect(UNKNOWN_MODEL_PRICING.inputPerMTok).toBeGreaterThan(cheapest);
  });

  it("never reports a negative or NaN cost for absent token counts", () => {
    const { costUsd } = estimateCostUsd("claude-haiku-4-5", { inputTokens: null, outputTokens: null });
    expect(costUsd).toBe(0);
  });
});

describe("the ledger refuses rather than reports", () => {
  it("throws on the call that would breach the spend cap", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 1, maxCalls: 100 });
    ledger.record(entry(0.9));
    expect(() => ledger.reserve(0.05)).not.toThrow();
    expect(() => ledger.reserve(0.2)).toThrowError(RuntimeBudgetExceededError);
    try {
      ledger.reserve(0.2);
    } catch (error) {
      expect((error as RuntimeBudgetExceededError).reason).toBe("SPEND_CAP");
    }
  });

  it("throws on the call that would breach the call cap", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 100, maxCalls: 2 });
    ledger.record(entry(0.01));
    ledger.record(entry(0.01));
    expect(() => ledger.reserve(0.01)).toThrowError(/call cap reached/);
  });

  it("charges nothing for a cache hit — neither spend nor a call", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 1, maxCalls: 1 });
    ledger.record(entry(5, true));
    expect(ledger.spentUsd).toBe(0);
    expect(ledger.calls).toBe(0);
    expect(() => ledger.reserve(0.5)).not.toThrow();
  });
});

describe("the cap survives a restart", () => {
  // An 8-hour autonomous run will restart processes. A ledger that resets on restart is not
  // a cap — it is a per-process suggestion.
  it("reloads spend and call counts from disk", () => {
    const first = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 1, maxCalls: 10 });
    first.record(entry(0.95));

    const reloaded = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 1, maxCalls: 10 });
    expect(reloaded.spentUsd).toBeCloseTo(0.95, 6);
    expect(reloaded.calls).toBe(1);
    expect(() => reloaded.reserve(0.5)).toThrowError(RuntimeBudgetExceededError);
  });

  it("creates the artifact directory it writes into", () => {
    expect(() => new RuntimeBudgetLedger(ledgerPath).record(entry(0.01))).not.toThrow();
  });
});

describe("large-batch review trigger", () => {
  it("flags a batch consuming more than 20% of remaining budget", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath, { maxSpendUsd: 10, maxCalls: 100 });
    expect(ledger.requiresInformationValueReview(1.9)).toBe(false);
    expect(ledger.requiresInformationValueReview(2.5)).toBe(true);
  });
});

describe("secret hygiene", () => {
  // The ledger is committed as an artifact. It must never be able to carry a credential.
  // An allowlist, not a denylist: a new field can only reach the persisted ledger by being
  // added here deliberately, so a future edit cannot quietly start recording prompt text.
  it("persists exactly the allowed metadata fields and nothing else", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath);
    ledger.record(entry(0.01));
    const allowed = new Set([
      "experimentId",
      "model",
      "promptId",
      "promptVersion",
      "inputTokens",
      "outputTokens",
      "costUsd",
      "costIsEstimate",
      "cacheHit",
    ]);
    for (const recorded of ledger.snapshot().entries) {
      expect(new Set(Object.keys(recorded))).toEqual(allowed);
    }
  });

  it("carries no credential-shaped value", () => {
    const ledger = new RuntimeBudgetLedger(ledgerPath);
    ledger.record(entry(0.01));
    // Anthropic keys are `sk-ant-...`; assert no such token can appear in the artifact.
    expect(JSON.stringify(ledger.snapshot())).not.toMatch(/sk-ant-|api[_-]?key|authorization/i);
  });
});
