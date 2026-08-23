// Instrumented model-execution boundary and versioned prompt registry.
//
// STATUS: **no provider implementation exists and none ran in this research run.** The Claude
// Code host holds the only credential and a child process cannot reuse it
// (`docs/AUTONOMOUS_RESEARCH_STATE.md`). `EchoProvider` below is a deterministic stub for unit
// tests ONLY. Any number produced with it measures the harness, not a model, and must never be
// reported as agent quality, rescue rate, hallucination rate, or prompt performance.
//
// WHY THE BOUNDARY LOOKS LIKE THIS
// --------------------------------
// A model call is only admissible evidence if the exact inputs, prompt version, decoding
// parameters, output, tokens, latency and cost were recorded. An assistant reading a fixture
// and reporting an impression is not a product measurement. Every field on `ModelCallRecord`
// exists so a result can be reproduced or invalidated later.
import { createHash } from "node:crypto";

export const AGENT_RUNTIME_VERSION = "agent-runtime.v1";

export interface DecodingParams {
  temperature: number;
  maxOutputTokens: number;
  topP?: number;
  seed?: number | null;
}

/** A versioned prompt. The version participates in every cache key. */
export interface PromptSpec {
  id: string;
  version: string;
  /** What this prompt is for, and what would falsify its usefulness. */
  hypothesis: string;
  render(input: Record<string, unknown>): string;
}

export interface ModelRequest {
  prompt: PromptSpec;
  input: Record<string, unknown>;
  decoding: DecodingParams;
}

export interface ModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  /** Provider-reported cost. Null when the provider does not report it; never invented. */
  costUsd: number | null;
  /** True when `costUsd` was derived from configured pricing rather than reported. */
  costIsEstimate: boolean;
}

/** Everything needed to reproduce or invalidate one model call. */
export interface ModelCallRecord {
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  decoding: DecodingParams;
  inputHash: string;
  cacheKey: string;
  cacheHit: boolean;
  latencyMs: number;
  usage: ModelUsage;
  outputText: string;
  timestamp: string;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  complete(request: ModelRequest): Promise<{ text: string; usage: ModelUsage }>;
}

/**
 * Cache key over every behaviour-changing input.
 *
 * Source text, prompt id AND version, decoding parameters, provider and model all participate.
 * Changing any of them produces a different key, so a cached result can never outlive the
 * configuration that produced it. Trading a stale scientific result for speed is the failure
 * this exists to prevent.
 */
export function cacheKeyFor(provider: ModelProvider, request: ModelRequest): string {
  const stable = JSON.stringify({
    provider: provider.name,
    model: provider.model,
    promptId: request.prompt.id,
    promptVersion: request.prompt.version,
    decoding: request.decoding,
    input: sortDeep(request.input),
  });
  return createHash("sha256").update(stable).digest("hex");
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

/**
 * Runs model calls, caches by content, and records telemetry for every call.
 *
 * Cost scales with DISTINCT evidence, never with people times jobs: a person's evidence and a
 * job's responsibilities are interpreted once and the cached result is reused across every
 * pairing. A person-by-job model loop is the architecture this class exists to make impossible.
 */
export class InstrumentedRunner {
  private readonly cache = new Map<string, { text: string; usage: ModelUsage }>();
  readonly records: ModelCallRecord[] = [];

  constructor(private readonly provider: ModelProvider) {}

  async run(request: ModelRequest): Promise<{ text: string; record: ModelCallRecord }> {
    const cacheKey = cacheKeyFor(this.provider, request);
    const inputHash = createHash("sha256").update(JSON.stringify(sortDeep(request.input))).digest("hex");
    const started = Date.now();

    const cached = this.cache.get(cacheKey);
    const result = cached ?? (await this.provider.complete(request));
    if (!cached) this.cache.set(cacheKey, result);

    const record: ModelCallRecord = {
      provider: this.provider.name,
      model: this.provider.model,
      promptId: request.prompt.id,
      promptVersion: request.prompt.version,
      decoding: request.decoding,
      inputHash,
      cacheKey,
      cacheHit: Boolean(cached),
      latencyMs: Date.now() - started,
      usage: cached ? { ...result.usage, costUsd: 0, costIsEstimate: result.usage.costIsEstimate } : result.usage,
      outputText: result.text,
      timestamp: new Date().toISOString(),
    };
    this.records.push(record);
    return { text: result.text, record };
  }

  /** Cost and latency broken out by product phase, for the Pareto frontier. */
  telemetry() {
    const calls = this.records.length;
    const hits = this.records.filter((r) => r.cacheHit).length;
    const latencies = this.records.map((r) => r.latencyMs).sort((a, b) => a - b);
    const at = (q: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))]! : 0);
    const sum = (pick: (r: ModelCallRecord) => number | null) => this.records.reduce((t, r) => t + (pick(r) ?? 0), 0);
    return {
      calls,
      cacheHits: hits,
      cacheMisses: calls - hits,
      inputTokens: sum((r) => r.usage.inputTokens),
      outputTokens: sum((r) => r.usage.outputTokens),
      costUsd: sum((r) => r.usage.costUsd),
      anyCostEstimated: this.records.some((r) => r.usage.costIsEstimate),
      p50LatencyMs: at(0.5),
      p95LatencyMs: at(0.95),
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt registry
// ---------------------------------------------------------------------------

/**
 * Prompts are research objects: each carries a version and the hypothesis it is meant to test,
 * so a prompt change is a recorded experiment rather than an untracked edit.
 *
 * None of these has been executed against a model.
 */
export const PROMPTS: Record<string, PromptSpec> = {
  "discover-work-content.v1": {
    id: "discover-work-content",
    version: "v1",
    hypothesis:
      "Reading raw person evidence directly, without a canonical ontology deciding first what concepts are visible, recovers work CONTEXT (purpose, method, domain, workflow) that token matching against O*NET statements cannot represent at all.",
    render: (input) =>
      [
        "You are reading one person's own description of their work.",
        "Extract each distinct piece of work as structured content.",
        "",
        "Rules:",
        "- Use ONLY what the text supports. Do not add work that is not described.",
        "- Separate what they HAVE DONE from what they LIKE, DISLIKE, or WANT NEXT. Never merge these.",
        "- If the text is ambiguous, emit an abstention instead of guessing.",
        "- Record purpose, method, domain and workflow, not just the verb and its object.",
        "",
        "Evidence:",
        String(input.evidenceText ?? ""),
      ].join("\n"),
  },
  "transfer-hypotheses.v1": {
    id: "transfer-hypotheses",
    version: "v1",
    hypothesis:
      "Given structured work content, a model proposes cross-boundary destinations that share a transferable workflow, and labels each by how far it reaches, at a supported-to-unsupported ratio better than lexical nearest-neighbour retrieval.",
    render: (input) =>
      [
        "Given this person's structured work patterns, propose job families whose UNDERLYING WORK transfers.",
        "",
        "For each, state the shared workflow that makes it transfer. A destination without a stated",
        "shared workflow is not a hypothesis, it is a guess: omit it.",
        "",
        "Label each: OBVIOUS, ADJACENT, SURPRISING_BUT_SUPPORTED, or SPECULATIVE.",
        "Novelty on its own is failure. Only propose work the evidence actually reaches.",
        "",
        "Work patterns:",
        JSON.stringify(input.workContent ?? [], null, 2),
      ].join("\n"),
  },
};

/**
 * Deterministic stub so the harness can be unit-tested with no credential.
 *
 * TEST ONLY. It echoes a hash of its input. It has no language ability whatsoever, and any
 * metric computed over its output measures plumbing, not intelligence.
 */
export class EchoProvider implements ModelProvider {
  readonly name = "echo-stub";
  readonly model = "echo-stub-v1";
  async complete(request: ModelRequest): Promise<{ text: string; usage: ModelUsage }> {
    const rendered = request.prompt.render(request.input);
    return {
      text: `STUB:${createHash("sha256").update(rendered).digest("hex").slice(0, 16)}`,
      usage: { inputTokens: null, outputTokens: null, costUsd: null, costIsEstimate: false },
    };
  }
}
