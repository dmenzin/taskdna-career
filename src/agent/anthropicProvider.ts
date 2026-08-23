// Real Anthropic provider behind the instrumented model boundary.
//
// This is the only place in the repository that talks to a model. Everything above it sees
// `ModelProvider`, so an experiment cannot accidentally bypass telemetry, caching or the spend
// cap by reaching for the SDK directly.
//
// SECRETS
// -------
// The key is read from the environment by the SDK and is never read into a variable here,
// never logged, never written to an artifact, never placed in a cache key, and never included
// in a `ModelCallRecord`. `hasAnthropicCredentials()` establishes BOOLEAN PRESENCE only.
import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ModelRequest, ModelUsage } from "@/agent/runtime";
import { estimateCostUsd } from "@/agent/budget";

export const ANTHROPIC_PROVIDER_VERSION = "anthropic-provider.v1";

/** Default model. Overridable so model tier can be an explicit experimental arm. */
export const DEFAULT_MODEL = "claude-opus-5";

/** A safety decline. Distinguished from a transport error so it can be counted, not just caught. */
export class ModelRefusalError extends Error {
  constructor(message: string, readonly category: string) {
    super(message);
    this.name = "ModelRefusalError";
  }
}

/**
 * Boolean presence of a credential. Never returns, prints or logs the value.
 *
 * An unset `ANTHROPIC_API_KEY` does not by itself prove there are no credentials — the SDK also
 * resolves `ANTHROPIC_AUTH_TOKEN` and an `ant auth login` profile — so this reports what it can
 * actually establish rather than overclaiming.
 */
export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface AnthropicProviderOptions {
  model?: string;
  /**
   * Thinking depth and token spend. `low` is the default because the interpretation tasks here
   * are extraction rather than open-ended reasoning, and effort is the honest cost lever —
   * unlike disabling thinking, which on this model can leak `<thinking>` tags into the visible
   * response and produce longer output than leaving it on.
   */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Hard ceiling on output tokens. Also bounds the worst-case cost used for budget reservation. */
  maxOutputTokens?: number;
  /** JSON Schema constraining the response. Removes brittle prose parsing. */
  outputSchema?: Record<string, unknown>;
  /**
   * Re-run a safety-declined request on a fallback model, server-side, in the same call.
   *
   * On by default. Benign career evidence DOES trip these classifiers: interpreting ordinary
   * healthcare work in this corpus produced a `bio`-category refusal that aborted a 300-call
   * experiment 34 calls in. A refusal is a normal 200 response, not an exception, so without
   * this an experiment silently depends on none of its inputs looking sensitive.
   */
  refusalFallback?: boolean;
  client?: Anthropic;
}

/**
 * Create a provider.
 *
 * NOTE ON DECODING PARAMETERS. `ModelRequest.decoding` carries `temperature`, `topP` and
 * `seed` for older model families. Current Anthropic models REMOVED those parameters and
 * return a 400 if they are sent, so they are deliberately NOT forwarded. They remain on the
 * record for provenance — what the experiment asked for is worth knowing even when the
 * provider cannot honour it.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions = {}): ModelProvider {
  const model = options.model ?? DEFAULT_MODEL;
  const effort = options.effort ?? "low";
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const client = options.client ?? new Anthropic();
  const refusalFallback = options.refusalFallback ?? true;

  return {
    name: "anthropic",
    model,
    async complete(request: ModelRequest): Promise<{ text: string; usage: ModelUsage }> {
      const body: Record<string, unknown> = {
        model,
        max_tokens: Math.min(maxOutputTokens, request.decoding.maxOutputTokens || maxOutputTokens),
        messages: [{ role: "user", content: request.prompt.render(request.input) }],
        output_config: options.outputSchema
          ? { effort, format: { type: "json_schema", schema: options.outputSchema } }
          : { effort },
      };

      // `fallbacks: "default"` routes by refusal category rather than pinning a model, so this
      // does not acquire a migration debt when the recommended fallback changes.
      const response = refusalFallback
        ? await client.beta.messages.create({
            ...body,
            fallbacks: "default",
            betas: ["server-side-fallback-2026-07-01"],
          } as never)
        : await client.messages.create(body as never);

      // A refusal is a normal 200 with an empty or partial content array. Reading content[0]
      // unconditionally would throw here, so the stop reason is checked first.
      // Check the stop reason BEFORE reading content: on a refusal the content array is empty
      // or partial, so indexing it would throw a confusing error instead of a clear one.
      if (response.stop_reason === "refusal") {
        const category = String((response as { stop_details?: { category?: string } }).stop_details?.category ?? "unknown");
        throw new ModelRefusalError(`model declined the request (category ${category})`, category);
      }

      const text = response.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("");

      const inputTokens = response.usage?.input_tokens ?? null;
      const outputTokens = response.usage?.output_tokens ?? null;
      const cacheReadTokens = response.usage?.cache_read_input_tokens ?? null;
      const cacheWriteTokens = response.usage?.cache_creation_input_tokens ?? null;
      // The API reports tokens but not price, so cost is DERIVED from configured pricing and
      // labelled as an estimate. Never invented, never silently reported as zero.
      const { costUsd } = estimateCostUsd(model, { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });

      return {
        text,
        usage: { inputTokens, outputTokens, costUsd, costIsEstimate: true },
      };
    },
  };
}

/**
 * Worst-case cost of a call, for budget reservation BEFORE it is made.
 *
 * Reserving on actual cost would enforce nothing — by then the money is spent — so the
 * reservation assumes the full output allowance is used.
 */
export function worstCaseCostUsd(model: string, promptText: string, maxOutputTokens: number): number {
  // ~4 characters per token is a coarse but deliberately CONSERVATIVE input estimate; it
  // overstates for prose, and overstating is the safe direction for a spend cap.
  const approximateInputTokens = Math.ceil(promptText.length / 3);
  return estimateCostUsd(model, { inputTokens: approximateInputTokens, outputTokens: maxOutputTokens }).costUsd;
}
