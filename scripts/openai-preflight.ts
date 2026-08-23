// Can the OpenAI arm actually run? Answer before an experiment, not during one.
//
// Credential PRESENCE and credential USABILITY are different things, and the gap between them is
// where an autonomous run wastes an arm: a script that gates on presence alone starts 300 calls
// and dies on the first one. This reports a verdict for each precondition separately, so a
// blocker names itself instead of arriving as a stack trace 8 hours later.
//
// The reachability probe is a handful of tokens and is deliberately NOT recorded as experiment
// spend — it produces no interpretation and no scored result.
import { writeFileSync, mkdirSync } from "node:fs";
import {
  DEFAULT_OPENAI_MODEL,
  hasOpenAiCredentials,
  probeOpenAiReachability,
  OPENAI_PROVIDER_VERSION,
} from "../src/agent/openaiProvider";
import { hasAnthropicCredentials } from "../src/agent/anthropicProvider";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, MODEL_PRICING } from "../src/agent/budget";

const checks: { name: string; pass: boolean; detail: string }[] = [];
const add = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"}  ${name}\n        ${detail}\n`);
};

process.stdout.write(`\nOPENAI ARM PREFLIGHT (${OPENAI_PROVIDER_VERSION})\n\n`);

add(
  "OpenAI credential present",
  hasOpenAiCredentials(),
  "boolean presence only; the value is never read, logged or persisted",
);

add(
  "model pricing configured",
  DEFAULT_OPENAI_MODEL in MODEL_PRICING,
  `${DEFAULT_OPENAI_MODEL} priced from the table rather than the conservative unknown-model rate`,
);

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
// Only the DOLLAR ceiling can fail this check. Call count is observability: a run that has made
// 1,200 cheap calls is not in trouble, and a run that has spent $24.90 is, regardless of count.
add(
  "runtime budget available",
  ledger.remainingUsd() > 0,
  `$${ledger.remainingUsd().toFixed(2)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd} remaining (HARD cap); ` +
    `${ledger.calls} calls made against a ${RUNTIME_BUDGET_LIMITS.callObservabilityThreshold}-call ` +
    `observability threshold${ledger.pastCallThreshold() ? " — THRESHOLD CROSSED, re-read the architecture" : ""}`,
);

// Recorded rather than asserted. The Anthropic arm being unreachable is the premise of this
// migration, not a failure — but it must be VISIBLE, so nobody later mistakes a frozen arm for a
// running one.
add(
  "Anthropic arm state understood",
  true,
  hasAnthropicCredentials()
    ? "Anthropic credential present; the Claude arm could resume independently from zero cache"
    : "Anthropic credential absent; the Claude arm is frozen and its caches are gone (docs/PROVIDER_HANDOFF_STATE.md)",
);

const verdict = await probeOpenAiReachability();
if (verdict.reachable) {
  add("provider reachable", true, verdict.detail);
  add(
    "requested model identifier resolves",
    true,
    verdict.resolvedModel === DEFAULT_OPENAI_MODEL
      ? `requested and served identifiers match (${DEFAULT_OPENAI_MODEL}); still a moving alias, so this is not a pin`
      : `requested ${DEFAULT_OPENAI_MODEL}, served ${verdict.resolvedModel ?? "unreported"} — recorded on every call`,
  );
} else {
  add("provider reachable", false, `${verdict.reason}: ${verdict.detail}`);
}

const passed = checks.every((check) => check.pass);
mkdirSync("artifacts/agent_experiments", { recursive: true });
writeFileSync(
  "artifacts/agent_experiments/openai-preflight.json",
  JSON.stringify(
    {
      preflight: "openai-arm",
      providerVersion: OPENAI_PROVIDER_VERSION,
      requestedModel: DEFAULT_OPENAI_MODEL,
      resolvedModel: verdict.reachable ? verdict.resolvedModel : null,
      blocker: verdict.reachable ? null : verdict.reason,
      checks,
      passed,
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

process.stdout.write(`\n${passed ? "PREFLIGHT PASSED — the OpenAI arm can run" : "PREFLIGHT FAILED — the OpenAI arm cannot run"}\n`);
if (!verdict.reachable && verdict.reason === "INSUFFICIENT_QUOTA") {
  process.stdout.write(
    "\nBLOCKER: the OpenAI credential is valid but the account cannot pay for a call.\n" +
      "Every model returns 429 insufficient_quota, so this is account-level, not model-level.\n" +
      "No experiment can produce evidence until billing is added or a funded key is supplied.\n" +
      "Nothing was spent, and no cache or ledger entry was written.\n",
  );
}
process.stdout.write("\nwrote artifacts/agent_experiments/openai-preflight.json\n");
process.exit(passed ? 0 : 1);
