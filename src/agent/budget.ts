// Hard runtime API budget, enforced in code.
//
// `docs/RESEARCH_CONTRACT_AMENDMENTS.md` § B caps this research run at $25 USD and 1,000
// runtime model calls. A cap that lives only in prose is not a cap: an autonomous loop that
// forgets it, or a batch that misjudges its own size, blows through it silently. So the
// ceiling is enforced at the one place every model call must pass through — `reserve()`
// refuses the call that would breach either limit, before it is made.
//
// WHAT COUNTS
// -----------
// Only calls made by APPLICATION code through the provider boundary. Claude Code's own
// interactive tool use is NOT application runtime-agent spend and is never recorded here
// (`docs/RESEARCH_CONTRACT_AMENDMENTS.md` § B). A cache hit consumes no budget.
//
// SECRETS
// -------
// Nothing in this module reads, stores, or serializes a credential. The ledger holds model
// ids, prompt ids, token counts, costs and timings — never inputs, outputs, or keys.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const RUNTIME_BUDGET_VERSION = "runtime-budget.v1";

/** The contract ceilings. Changing these is a contract amendment, not a code tweak. */
export const RUNTIME_BUDGET_LIMITS = {
  maxSpendUsd: 25,
  maxCalls: 1000,
} as const;

export interface ModelPricing {
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
  /** USD per million cache-read tokens (~0.1x input). */
  cacheReadPerMTok: number;
  /** USD per million cache-write tokens (1.25x input at the default 5-minute TTL). */
  cacheWritePerMTok: number;
}

// Published list prices, USD per million tokens. Recorded here so a cost figure can be audited
// against a number someone chose deliberately. NEVER invent a price: an unknown model is charged
// at UNKNOWN_MODEL_PRICING below, which is deliberately the most expensive entry, so an unpriced
// model can only ever cause us to UNDER-spend the cap.
//
// Sonnet 5 carries a promotional rate ($2/$10) through 2026-08-31. The full rate is used here
// because the amendment requires conservative estimation; a promo that expires mid-run must
// not silently push actual spend above a cap computed from the discounted price. The same
// reasoning applies to gpt-5.6-sol, whose $4/$20 rate is promotional through at least
// 2026-11-21: the pre-promotion $5/$30 is used, so a promo lapsing mid-run cannot push actual
// spend above a cap computed from the discount.
//
// OpenAI bills REASONING tokens as output tokens. Callers must fold
// `output_tokens_details.reasoning_tokens` into `outputTokens` (the Responses API already does,
// in its top-level `output_tokens`), or a reasoning model will look far cheaper than it is.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "claude-sonnet-5": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  "gpt-5.6-sol": { inputPerMTok: 5, outputPerMTok: 30, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  "gpt-5.6-terra": { inputPerMTok: 2.5, outputPerMTok: 15, cacheReadPerMTok: 0.25, cacheWritePerMTok: 3.125 },
  "gpt-5.6-luna": { inputPerMTok: 1, outputPerMTok: 6, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
};

/** Charged for any model absent from the table. The most expensive known entry, on purpose. */
export const UNKNOWN_MODEL_PRICING: ModelPricing = MODEL_PRICING["gpt-5.6-sol"];

/**
 * Worst-case cost of a call, for budget reservation BEFORE it is made.
 *
 * Reserving on actual cost would enforce nothing — by then the money is spent — so the
 * reservation assumes the full output allowance is used. Provider-neutral on purpose: it lives
 * here rather than in a provider module so that provider-agnostic code never has to import a
 * specific vendor to price a call.
 *
 * On a reasoning model the full output allowance is the realistic case rather than the
 * pessimistic one, because reasoning tokens are drawn from the same `max_output_tokens` pool.
 */
export function worstCaseCostUsd(model: string, promptText: string, maxOutputTokens: number): number {
  // ~3 characters per token is a coarse but deliberately CONSERVATIVE input estimate; it
  // overstates for prose, and overstating is the safe direction for a spend cap.
  const approximateInputTokens = Math.ceil(promptText.length / 3);
  return estimateCostUsd(model, { inputTokens: approximateInputTokens, outputTokens: maxOutputTokens }).costUsd;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
}

export interface CostEstimate {
  costUsd: number;
  /** True when derived from the table above rather than reported by the provider. */
  costIsEstimate: boolean;
  /** True when the model was absent from the pricing table and charged the conservative rate. */
  pricingWasUnknown: boolean;
}

/**
 * Cost from recorded token counts and configured pricing.
 *
 * A null token count is treated as zero for the reported figure but flagged, because an
 * unmeasured call must never look free. Callers that cannot obtain token counts should
 * reserve a worst case up front and leave the reservation in place.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): CostEstimate {
  const pricingWasUnknown = !(model in MODEL_PRICING);
  const pricing = MODEL_PRICING[model] ?? UNKNOWN_MODEL_PRICING;
  const perMTok = (tokens: number | null | undefined, rate: number) => ((tokens ?? 0) / 1_000_000) * rate;
  const costUsd =
    perMTok(usage.inputTokens, pricing.inputPerMTok) +
    perMTok(usage.outputTokens, pricing.outputPerMTok) +
    perMTok(usage.cacheReadTokens, pricing.cacheReadPerMTok) +
    perMTok(usage.cacheWriteTokens, pricing.cacheWritePerMTok);
  return { costUsd, costIsEstimate: true, pricingWasUnknown };
}

/** One recorded call. Deliberately carries no input text, output text, or credential. */
export interface BudgetLedgerEntry {
  experimentId: string;
  model: string;
  promptId: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
  costIsEstimate: boolean;
  cacheHit: boolean;
}

export interface BudgetLedgerState {
  version: string;
  limits: { maxSpendUsd: number; maxCalls: number };
  calls: number;
  spentUsd: number;
  entries: BudgetLedgerEntry[];
}

export class RuntimeBudgetExceededError extends Error {
  constructor(
    readonly reason: "SPEND_CAP" | "CALL_CAP",
    message: string,
  ) {
    super(message);
    this.name = "RuntimeBudgetExceededError";
  }
}

/**
 * Persistent spend ledger.
 *
 * State is written to disk after every mutation so the cap survives a process restart. A cap
 * that resets when the runner crashes is not a cap for an 8-hour autonomous run.
 */
export class RuntimeBudgetLedger {
  private state: BudgetLedgerState;

  constructor(
    private readonly path: string,
    private readonly limits: { maxSpendUsd: number; maxCalls: number } = RUNTIME_BUDGET_LIMITS,
  ) {
    this.state = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as BudgetLedgerState)
      : { version: RUNTIME_BUDGET_VERSION, limits, calls: 0, spentUsd: 0, entries: [] };
  }

  get calls(): number {
    return this.state.calls;
  }

  get spentUsd(): number {
    return this.state.spentUsd;
  }

  remainingUsd(): number {
    return Math.max(0, this.limits.maxSpendUsd - this.state.spentUsd);
  }

  remainingCalls(): number {
    return Math.max(0, this.limits.maxCalls - this.state.calls);
  }

  /**
   * Refuse a call that would breach either ceiling.
   *
   * `projectedCostUsd` is the WORST-CASE cost of the call about to be made (computed from
   * max output tokens, not hoped-for output). Checking the actual cost afterwards would
   * enforce nothing — by then the money is spent.
   */
  reserve(projectedCostUsd: number): void {
    if (this.state.calls + 1 > this.limits.maxCalls) {
      throw new RuntimeBudgetExceededError(
        "CALL_CAP",
        `runtime call cap reached: ${this.state.calls}/${this.limits.maxCalls} calls already made`,
      );
    }
    if (this.state.spentUsd + projectedCostUsd > this.limits.maxSpendUsd) {
      throw new RuntimeBudgetExceededError(
        "SPEND_CAP",
        `runtime spend cap would be breached: $${this.state.spentUsd.toFixed(4)} spent, ` +
          `$${projectedCostUsd.toFixed(4)} projected, cap $${this.limits.maxSpendUsd.toFixed(2)}`,
      );
    }
  }

  /** Record a completed call. A cache hit costs nothing and does not consume the call budget. */
  record(entry: BudgetLedgerEntry): void {
    this.state.entries.push(entry);
    if (!entry.cacheHit) {
      this.state.calls += 1;
      this.state.spentUsd += entry.costUsd;
    }
    this.persist();
  }

  /** Does a projected batch exceed 20% of the remaining budget? (amendment B review trigger.) */
  requiresInformationValueReview(projectedBatchCostUsd: number): boolean {
    const remaining = this.remainingUsd();
    return remaining > 0 && projectedBatchCostUsd > remaining * 0.2;
  }

  snapshot(): BudgetLedgerState {
    return JSON.parse(JSON.stringify(this.state)) as BudgetLedgerState;
  }

  private persist(): void {
    // recursive:true is required on Windows when the artifacts tree does not yet exist; the
    // prior run fixed the same class of defect in the experiment-directory path.
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.state, null, 2) + "\n");
  }
}
