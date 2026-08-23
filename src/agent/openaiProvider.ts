// Real OpenAI provider behind the instrumented model boundary.
//
// This and `anthropicProvider.ts` are the only places in the repository that talk to a model.
// Everything above them sees `ModelProvider`, so an experiment cannot accidentally bypass
// telemetry, caching or the spend cap by reaching for an SDK directly.
//
// SECRETS
// -------
// The key is read from the environment by the SDK and is never read into a variable here, never
// logged, never written to an artifact, never placed in a cache key, and never included in a
// `ModelCallRecord`. `hasOpenAiCredentials()` establishes BOOLEAN PRESENCE only.
//
// WHY THE RESPONSES API
// ---------------------
// It is the endpoint that exposes `reasoning.effort` alongside schema-constrained output, and
// reasoning depth is an experimental variable here rather than an implementation detail. Chat
// Completions would force the reasoning setting to be inferred from the model name.
import OpenAI from "openai";
import type { ModelProvider, ModelRequest, ModelUsage, ProviderMetadata } from "@/agent/runtime";
import { hashJson } from "@/agent/runtime";
import { estimateCostUsd } from "@/agent/budget";

export const OPENAI_PROVIDER_VERSION = "openai-provider.v1";

/**
 * Default model.
 *
 * REPRODUCIBILITY LIMITATION, recorded deliberately. This is a MOVING ALIAS. The account exposes
 * no dated snapshot for this model — unlike `gpt-5.4-2026-03-05` or `gpt-5.5-2026-04-23`, there
 * is no `gpt-5.6-sol-YYYY-MM-DD` to pin — so a rerun months from now may be served different
 * weights under the same name. Every call therefore records BOTH this requested identifier and
 * the identifier the API reports having served (`ProviderMetadata.resolvedModel`); a divergence
 * between the two is the only warning a later reader will get.
 */
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-sol";

/** Reasoning depth. `none` and `minimal` are also accepted by the API for this family. */
export type OpenAiEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** A safety decline. Distinguished from a transport error so it can be counted, not just caught. */
export class OpenAiRefusalError extends Error {
  constructor(message: string, readonly category: string) {
    super(message);
    this.name = "OpenAiRefusalError";
  }
}

/**
 * The output allowance was exhausted before a complete answer arrived.
 *
 * Its own error type because on a reasoning model this is a CONFIGURATION fault, not a model
 * failure: reasoning tokens are drawn from the same `max_output_tokens` pool as the visible
 * answer, so a setting that reasons more than the allowance permits returns truncated or empty
 * JSON. Silently treating that as "the model found nothing" would corrupt an entire arm.
 */
export class OpenAiTruncationError extends Error {
  constructor(
    message: string,
    readonly reasoningTokens: number | null,
    readonly maxOutputTokens: number,
  ) {
    super(message);
    this.name = "OpenAiTruncationError";
  }
}

/**
 * The credential is valid but the account cannot pay for the call.
 *
 * Its own error type because it is neither a model failure nor a transient rate limit, and the
 * two standard responses to a 429 — retry, or record an abstention and continue — are both wrong
 * here. Retrying cannot succeed, and continuing would fill an arm with empty interpretations
 * that scored as genuine "the model understood nothing" results. An experiment must STOP.
 */
export class OpenAiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiQuotaError";
  }
}

/** True when an SDK error is an unpayable-account 429 rather than a transient rate limit. */
export function isQuotaError(error: unknown): boolean {
  const candidate = error as { status?: number; code?: string; error?: { code?: string } } | null;
  if (!candidate || candidate.status !== 429) return false;
  return (candidate.code ?? candidate.error?.code) === "insufficient_quota";
}

/**
 * Boolean presence of a credential. Never returns, prints or logs the value.
 *
 * The SDK also resolves `OPENAI_API_KEY` from a project/organization pair, so an unset variable
 * is not conclusive proof of no credential; this reports only what it can establish.
 */
export function hasOpenAiCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type ReachabilityVerdict =
  | { reachable: true; resolvedModel: string | null; detail: string }
  | { reachable: false; reason: "NO_CREDENTIAL" | "INSUFFICIENT_QUOTA" | "MODEL_UNAVAILABLE" | "TRANSPORT"; detail: string };

/**
 * Smallest possible check that the provider can actually serve a call.
 *
 * Worth its own function because credential PRESENCE and credential USABILITY are different
 * things, and the gap between them is exactly where an autonomous run wastes an hour: a script
 * that gates on presence alone starts a 300-call arm and dies on call one. The probe is a
 * handful of tokens and is not recorded as experiment spend.
 */
export async function probeOpenAiReachability(options: { model?: string; client?: OpenAI } = {}): Promise<ReachabilityVerdict> {
  if (!hasOpenAiCredentials()) {
    return { reachable: false, reason: "NO_CREDENTIAL", detail: "OPENAI_API_KEY is not set" };
  }
  const model = options.model ?? DEFAULT_OPENAI_MODEL;
  const client = options.client ?? new OpenAI();
  try {
    const response = await client.responses.create({ model, input: "ok", max_output_tokens: 16, reasoning: { effort: "none" } });
    return { reachable: true, resolvedModel: response.model ?? null, detail: `served by ${response.model ?? "unreported model"}` };
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        reachable: false,
        reason: "INSUFFICIENT_QUOTA",
        detail: "credential is valid but the account has no available quota or billing; no call can succeed",
      };
    }
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 400) {
      return { reachable: false, reason: "MODEL_UNAVAILABLE", detail: `${model} is not available to this account (status ${status})` };
    }
    return { reachable: false, reason: "TRANSPORT", detail: `status ${status ?? "unknown"}` };
  }
}

export interface OpenAiProviderOptions {
  model?: string;
  /**
   * Reasoning depth.
   *
   * NOT defaulted to a high setting. The comparable Anthropic arm ran at `low`, and the first
   * cross-provider comparison has to vary the provider ALONE — varying reasoning depth at the
   * same time would make every difference it reports uninterpretable. Reasoning depth is a
   * separate experimental arm, and `docs/PROVIDER_HANDOFF_STATE.md` §7 records why.
   */
  effort?: OpenAiEffort;
  /** Hard ceiling on output tokens, INCLUDING reasoning tokens. Bounds worst-case cost. */
  maxOutputTokens?: number;
  /** JSON Schema constraining the response. Removes brittle prose parsing. */
  outputSchema?: Record<string, unknown>;
  /** Name for the schema, required by the Responses API structured-output format. */
  schemaName?: string;
  /** Stable version label for the schema, recorded on every call. */
  schemaVersion?: string;
  client?: OpenAI;
}

/**
 * Create a provider.
 *
 * NOTE ON DECODING PARAMETERS. `ModelRequest.decoding` carries `temperature`, `topP` and `seed`
 * for older model families. Reasoning models in this family do not accept `temperature` or
 * `top_p`, so they are deliberately NOT forwarded — the same treatment the Anthropic provider
 * gives them, and for the same reason. They remain on the record for provenance: what the
 * experiment asked for is worth knowing even when the provider cannot honour it.
 */
export function createOpenAiProvider(options: OpenAiProviderOptions = {}): ModelProvider {
  const model = options.model ?? DEFAULT_OPENAI_MODEL;
  const effort: OpenAiEffort = options.effort ?? "low";
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const client = options.client ?? new OpenAI();
  const schemaName = options.schemaName ?? "structured_output";
  const schemaVersion = options.outputSchema ? (options.schemaVersion ?? "unversioned") : null;
  const schemaHash = options.outputSchema ? hashJson(options.outputSchema) : null;

  return {
    name: "openai",
    model,
    schemaVersion,
    schemaHash,
    // Effort and the output allowance change the response, and neither appears in
    // `ModelRequest`. Declaring them here puts both in the cache key, so a rerun at a different
    // reasoning depth cannot be served results produced at the old one.
    cacheIdentity: { effort, maxOutputTokens, providerVersion: OPENAI_PROVIDER_VERSION },
    async complete(request: ModelRequest): Promise<{ text: string; usage: ModelUsage; metadata: ProviderMetadata }> {
      let response;
      try {
        response = await client.responses.create({
          model,
          input: request.prompt.render(request.input),
          reasoning: { effort },
          max_output_tokens: Math.min(maxOutputTokens, request.decoding.maxOutputTokens || maxOutputTokens),
          ...(options.outputSchema
            ? { text: { format: { type: "json_schema" as const, name: schemaName, schema: options.outputSchema, strict: true } } }
            : {}),
        });
      } catch (error) {
        // Re-typed before it reaches a caller's error handler, because the generic tolerate-and-
        // continue hook would otherwise convert an unpayable account into 300 empty blueprints.
        if (isQuotaError(error)) {
          throw new OpenAiQuotaError(
            "OpenAI account has no available quota; the credential is valid but no call can succeed. " +
              "Add billing or supply a funded key before running an experiment.",
          );
        }
        throw error;
      }

      const inputTokens = response.usage?.input_tokens ?? null;
      const outputTokens = response.usage?.output_tokens ?? null;
      const reasoningTokens = response.usage?.output_tokens_details?.reasoning_tokens ?? null;
      const cachedInputTokens = response.usage?.input_tokens_details?.cached_tokens ?? null;
      // `output_tokens` already includes reasoning tokens, so charging both would double-bill.
      // Cached input is billed at a tenth of fresh input; it is subtracted from the fresh count
      // and re-added at the cache-read rate rather than being ignored.
      const { costUsd } = estimateCostUsd(model, {
        inputTokens: inputTokens === null ? null : Math.max(0, inputTokens - (cachedInputTokens ?? 0)),
        outputTokens,
        cacheReadTokens: cachedInputTokens,
      });

      const metadata: ProviderMetadata = {
        providerVersion: OPENAI_PROVIDER_VERSION,
        resolvedModel: response.model ?? null,
        reasoning: effort,
        truncated: response.status === "incomplete",
      };

      // A refusal is a normal 200 with a refusal content part, not an exception. Check for it
      // before reading text, or a decline becomes an empty successful interpretation.
      for (const item of response.output ?? []) {
        if (item.type !== "message") continue;
        for (const part of item.content ?? []) {
          if (part.type === "refusal") {
            throw new OpenAiRefusalError(`model declined the request: ${part.refusal}`, "refusal");
          }
        }
      }

      if (response.status === "incomplete") {
        const reason = response.incomplete_details?.reason ?? "unknown";
        throw new OpenAiTruncationError(
          `response truncated (${reason}) at max_output_tokens=${maxOutputTokens} with ` +
            `${reasoningTokens ?? "unknown"} reasoning tokens; raise the allowance or lower the effort`,
          reasoningTokens,
          maxOutputTokens,
        );
      }

      return {
        text: response.output_text ?? "",
        usage: { inputTokens, outputTokens, costUsd, costIsEstimate: true, reasoningTokens, cachedInputTokens },
        metadata,
      };
    },
  };
}
