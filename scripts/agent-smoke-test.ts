// Runtime plumbing smoke test.
//
// Proves the boundary works end to end with the SMALLEST possible spend: provider reachable,
// structured output parses, telemetry recorded, cache actually prevents a second call, budget
// enforced, secrets absent from every artifact, failures handled.
//
// WHAT THIS DOES NOT PROVE
// ------------------------
// Anything about agent QUALITY. A successful smoke test proves plumbing. Rescue rate,
// hallucination rate and prompt performance require the scored experiments that follow, and no
// number from this script may be reported as an architecture result.
import { InstrumentedRunner, type ModelRequest } from "../src/agent/runtime";
import { createAnthropicProvider, hasAnthropicCredentials, worstCaseCostUsd, DEFAULT_MODEL } from "../src/agent/anthropicProvider";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS } from "../src/agent/budget";

const checks: { name: string; pass: boolean; detail: string }[] = [];
const add = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"}  ${name}\n        ${detail}\n`);
};

process.stdout.write("\nRUNTIME SMOKE TEST\n\n");

add("credentials present", hasAnthropicCredentials(), "boolean presence only; value never read, logged or persisted");
if (!hasAnthropicCredentials()) {
  process.stderr.write("no credentials; cannot run the smoke test\n");
  process.exit(1);
}

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
process.stdout.write(
  `  budget before: $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd} · ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n\n`,
);

// A deliberately tiny structured task. The point is to exercise the path, not to learn anything.
const schema = {
  type: "object",
  properties: {
    action: { type: "string", description: "the verb describing what was done" },
    object: { type: "string", description: "what the action was performed on" },
    domain: { type: "string", description: "the setting or industry" },
  },
  required: ["action", "object", "domain"],
  additionalProperties: false,
} as const;

const smokePrompt = {
  id: "smoke-extract-work",
  version: "v1",
  hypothesis: "Plumbing check only. Never used for a scored result.",
  render: (input: Record<string, unknown>) =>
    `Extract the action, object and domain from this sentence. Reply with JSON only.\n\n${String(input.sentence ?? "")}`,
};

const maxOutputTokens = 256;
const provider = createAnthropicProvider({ outputSchema: schema as unknown as Record<string, unknown>, maxOutputTokens, effort: "low" });
const runner = new InstrumentedRunner(provider, {
  budget: ledger,
  experimentId: "smoke-test",
  projectedCostUsd: (request) => worstCaseCostUsd(DEFAULT_MODEL, request.prompt.render(request.input), maxOutputTokens),
});

const request: ModelRequest = {
  prompt: smokePrompt,
  input: { sentence: "I tracked down near misses in a hospital setting to stop them happening again." },
  decoding: { temperature: 0, maxOutputTokens },
};

try {
  const first = await runner.run(request);
  add("provider reachable", first.record.outputText.length > 0, `${first.record.model} responded in ${first.record.latencyMs} ms`);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(first.text);
  } catch {
    parsed = null;
  }
  const shaped = Boolean(parsed && typeof parsed === "object" && "action" in (parsed as object) && "object" in (parsed as object));
  add("structured output parses and matches the schema", shaped, shaped ? JSON.stringify(parsed) : `unparseable: ${first.text.slice(0, 120)}`);

  const usage = first.record.usage;
  add("token usage recorded", usage.inputTokens !== null && usage.outputTokens !== null,
    `in=${usage.inputTokens} out=${usage.outputTokens}`);
  add("cost captured and labelled as an estimate", usage.costUsd !== null && usage.costIsEstimate,
    `$${(usage.costUsd ?? 0).toFixed(6)} (derived from configured pricing, not provider-reported)`);

  // Second identical call must be served from cache, spending nothing.
  const callsBefore = ledger.calls;
  const second = await runner.run(request);
  add("cache prevents a second provider call", second.record.cacheHit && ledger.calls === callsBefore,
    `cacheHit=${second.record.cacheHit}, ledger calls unchanged at ${ledger.calls}`);
  add("cached call is charged nothing", (second.record.usage.costUsd ?? -1) === 0, `$${(second.record.usage.costUsd ?? 0).toFixed(6)}`);

  // A different input must MISS: a cache that returns the first answer for every question
  // would silently make every downstream result identical and meaningless.
  const other = await runner.run({ ...request, input: { sentence: "I reconciled the monthly accounts in a bank." } });
  add("different input misses the cache", !other.record.cacheHit, `cacheHit=${other.record.cacheHit}`);

  const telemetry = runner.telemetry();
  add("telemetry aggregates calls, cache and latency", telemetry.calls === 3 && telemetry.cacheHits === 1,
    `calls=${telemetry.calls} hits=${telemetry.cacheHits} p50=${telemetry.p50LatencyMs}ms p95=${telemetry.p95LatencyMs}ms cost=$${telemetry.costUsd.toFixed(6)}`);

  // Secret hygiene: no record or ledger entry may contain anything key-shaped.
  const serialized = JSON.stringify({ records: runner.records, ledger: ledger.snapshot() });
  add("no credential appears in any record or artifact", !/sk-ant-|api[_-]?key/i.test(serialized),
    "scanned every ModelCallRecord and the persisted ledger");

  // Budget enforcement must REFUSE, not merely report.
  const tinyLedger = new RuntimeBudgetLedger("artifacts/agent_runtime/smoke-refusal-probe.json", { maxSpendUsd: 0.000001, maxCalls: 5 });
  let refused = false;
  try {
    tinyLedger.reserve(1);
  } catch {
    refused = true;
  }
  add("budget refuses a call that would breach the cap", refused, "reserve() threw rather than returning a warning");
} catch (error) {
  add("provider call completed without error", false, String(error).slice(0, 300));
}

process.stdout.write(
  `\n  budget after:  $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd} · ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`,
);
const passed = checks.every((check) => check.pass);
process.stdout.write(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed\n`);
process.stdout.write("\nNOTE: this proves runtime plumbing only. It says nothing about agent quality.\n");
if (!passed) process.exit(1);
