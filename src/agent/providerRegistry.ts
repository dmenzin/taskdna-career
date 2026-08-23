// One place that turns a provider NAME into a configured provider.
//
// WHY A REGISTRY
// --------------
// The experiment script used to import `createAnthropicProvider` directly, which made the arm's
// provider a compile-time fact rather than an experimental variable. With two arms that is no
// longer tenable: the same script must be able to run either provider over identical inputs,
// because "provider" is the only thing the first cross-provider comparison is allowed to vary.
//
// This module also owns the two rules that keep the arms separable:
//   1. cache paths are namespaced per provider AND per behaviour-changing setting, and
//   2. the effort/reasoning setting defaults to the value the ANTHROPIC arm used, so a
//      cross-provider comparison does not silently vary reasoning depth as well.
import type { ModelProvider } from "@/agent/runtime";
import { providerCacheDir } from "@/agent/runtime";
import { createAnthropicProvider, hasAnthropicCredentials } from "@/agent/anthropicProvider";
import { DEFAULT_MODEL as ANTHROPIC_DEFAULT_MODEL } from "@/agent/anthropicProvider";
import {
  createOpenAiProvider,
  hasOpenAiCredentials,
  probeOpenAiReachability,
  DEFAULT_OPENAI_MODEL,
  type OpenAiEffort,
} from "@/agent/openaiProvider";
import { AGENT_ARCHITECTURE_VERSION } from "@/agent/agentArchitecture";

export type ProviderName = "anthropic" | "openai";

export const PROVIDER_NAMES: ProviderName[] = ["anthropic", "openai"];

/**
 * The reasoning/effort setting the canonical cross-provider arm uses.
 *
 * `low` because that is what the completed Anthropic SEMANTIC_BRIDGE arm ran at. Raising it for
 * the OpenAI arm would vary provider AND reasoning depth at once, and every difference the
 * comparison reported would then be unattributable to either. Reasoning depth is a separate
 * preregistered arm; see `docs/PROVIDER_HANDOFF_STATE.md` §7.
 */
export const CANONICAL_EFFORT = "low" as const;

export function defaultModelFor(provider: ProviderName): string {
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : ANTHROPIC_DEFAULT_MODEL;
}

export interface ProviderBuildOptions {
  provider: ProviderName;
  model?: string;
  effort?: OpenAiEffort;
  maxOutputTokens: number;
  outputSchema: Record<string, unknown>;
  schemaName: string;
}

export function buildProvider(options: ProviderBuildOptions): ModelProvider {
  const { provider, model, maxOutputTokens, outputSchema, schemaName } = options;
  const effort = options.effort ?? CANONICAL_EFFORT;
  if (provider === "openai") {
    return createOpenAiProvider({
      model: model ?? DEFAULT_OPENAI_MODEL,
      effort,
      maxOutputTokens,
      outputSchema,
      schemaName,
      schemaVersion: AGENT_ARCHITECTURE_VERSION,
    });
  }
  return createAnthropicProvider({
    model: model ?? ANTHROPIC_DEFAULT_MODEL,
    // The Anthropic provider accepts the same vocabulary for its own effort control.
    effort: effort === "none" || effort === "minimal" ? "low" : effort,
    maxOutputTokens,
    outputSchema,
  });
}

/**
 * Cache path for one arm's interpretations.
 *
 * The provider, model, effort and prompt-role all appear in the PATH, not merely inside the
 * cache key. The key already makes cross-provider contamination impossible; putting the same
 * facts in the filename makes a mistake visible in a directory listing, which is what a human
 * auditing the run will actually look at.
 */
export function armCachePath(args: {
  provider: ProviderName;
  model: string;
  effort: string;
  family: string;
  kind: "person" | "job";
}): string {
  const model = args.model.replace(/[^a-z0-9.-]/gi, "_");
  return `${providerCacheDir(args.provider)}/cache-${args.kind}-${args.family.toLowerCase()}-${model}-${args.effort}.json`;
}

/**
 * Cache path for one split-agent arm. ONE implementation, used by both the experiment and the
 * audit, because two copies of a path builder is how an audit quietly stops reading the file the
 * experiment writes — which is exactly what happened when they diverged.
 *
 * The AGENT PROMPT VERSION is in the path. The cache key already separates generations, so this is
 * not what prevents a wrong hit; it is what stops a v2 run from overwriting the v1 interpretations
 * that diagnosed the v1 defect, and what makes the separation visible in a directory listing.
 */
export function splitAgentCachePath(args: {
  provider: ProviderName;
  model: string;
  effort: string;
  family: string;
  variant: string;
  agent: "experience" | "direction";
  promptVersion: string;
  maxOutputTokens: number;
}): string {
  const model = args.model.replace(/[^a-z0-9.-]/gi, "_");
  return `${providerCacheDir(args.provider)}/cache-${args.variant}-${args.agent}-${args.promptVersion}-` +
    `${args.family.toLowerCase()}-${model}-${args.effort}-${args.maxOutputTokens}.json`;
}

export type ArmReadiness =
  | { ready: true; detail: string }
  | { ready: false; reason: string; detail: string };

/**
 * Can this provider actually serve an arm right now?
 *
 * Checks usability rather than credential presence: the OpenAI arm's blocking condition is a
 * valid key on an account that cannot pay, which presence checks cannot see.
 */
export async function checkArmReadiness(provider: ProviderName): Promise<ArmReadiness> {
  if (provider === "anthropic") {
    return hasAnthropicCredentials()
      ? { ready: true, detail: "Anthropic credential present" }
      : {
          ready: false,
          reason: "NO_CREDENTIAL",
          detail: "Anthropic access is revoked; this arm is frozen and its caches no longer exist",
        };
  }
  if (!hasOpenAiCredentials()) {
    return { ready: false, reason: "NO_CREDENTIAL", detail: "OPENAI_API_KEY is not set" };
  }
  const verdict = await probeOpenAiReachability();
  return verdict.reachable
    ? { ready: true, detail: verdict.detail }
    : { ready: false, reason: verdict.reason, detail: verdict.detail };
}
