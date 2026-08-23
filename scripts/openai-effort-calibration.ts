// Calibrate the OpenAI reasoning setting against the REAL prompts, before spending an arm on it.
//
// WHY THIS EXISTS
// ---------------
// On the Responses API, reasoning tokens are drawn from the same `max_output_tokens` pool as the
// visible answer. The Anthropic arm ran with allowances of 1200 (person) and 600 (job) tokens,
// sized for the answer alone. Reusing those numbers at a deeper reasoning setting does not
// produce a deeper answer — it produces a TRUNCATED one, which parses to an empty blueprint and
// would be scored as "the model understood nothing".
//
// So the allowance and the reasoning setting cannot be chosen independently, and neither can be
// chosen from documentation. This measures both against the actual person and job prompts, on
// one person and one job, and reports what each setting would cost across a full 300-call arm.
//
// WHAT THIS DOES NOT PROVE
// ------------------------
// Anything about agent QUALITY. It measures tokens, truncation, latency and cost. Choosing a
// setting because it scored better here would be tuning against a sample of one.
import { mkdirSync, writeFileSync } from "node:fs";
import { InstrumentedRunner, providerCacheDir, type ModelRequest } from "../src/agent/runtime";
import {
  createOpenAiProvider,
  probeOpenAiReachability,
  DEFAULT_OPENAI_MODEL,
  OpenAiTruncationError,
  type OpenAiEffort,
} from "../src/agent/openaiProvider";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, estimateCostUsd, worstCaseCostUsd } from "../src/agent/budget";
import {
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_SCHEMA,
  AGENT_ARCHITECTURE_VERSION,
} from "../src/agent/agentArchitecture";
import { buildFrameCorpus, allFrameJobs } from "../src/bench/frameCorpus";
import type { RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const family = arg("family", "SEMANTIC_BRIDGE") as RenderFamily;
const efforts = arg("efforts", "low,medium,high").split(",") as OpenAiEffort[];
// Deliberately generous, so a setting FAILS on quality of reasoning rather than on a ceiling we
// chose. The measured consumption below is what sizes the real arm.
const probeAllowance = Number(arg("allowance", "8000"));

// Gate on USABILITY, not on credential presence. A key that cannot pay would otherwise take the
// run all the way into the loop before failing, one call at a time.
const reachability = await probeOpenAiReachability();
if (!reachability.reachable) {
  process.stderr.write(
    `\ncannot calibrate: ${reachability.reason} — ${reachability.detail}\n` +
      `run \`pnpm openai:preflight\` for the full precondition report. Nothing was spent.\n`,
  );
  process.exit(1);
}

// Read the frozen corpus, so calibration runs on the same observed text the arm will use.
const corpus = buildFrameCorpus({ people: 12, split: "DEVELOPMENT", family });
const person = corpus.people[0]!;
const job = allFrameJobs(corpus)[0]!;

const personInput = {
  experience: person.experienceEvidence.map((e) => e.text).join("\n"),
  liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
  disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
  desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
};
const jobInput = { responsibilities: job.responsibilities.map((r) => r.text).join("\n") };

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
process.stdout.write(`\nOPENAI REASONING CALIBRATION\n`);
process.stdout.write(`model=${DEFAULT_OPENAI_MODEL} (requested alias)  family=${family}  probe allowance=${probeAllowance}\n`);
process.stdout.write(`budget before: $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);
process.stdout.write(`probe calls: ${efforts.length * 2} (one person + one job per effort)\n\n`);

interface Row {
  effort: OpenAiEffort;
  kind: "person" | "job";
  resolvedModel: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  answerTokens: number | null;
  truncated: boolean;
  parsed: boolean;
  latencyMs: number;
  costUsd: number | null;
}

const rows: Row[] = [];

for (const effort of efforts) {
  for (const kind of ["person", "job"] as const) {
    const isPerson = kind === "person";
    const provider = createOpenAiProvider({
      effort,
      maxOutputTokens: probeAllowance,
      outputSchema: (isPerson ? PERSON_BLUEPRINT_SCHEMA : JOB_BLUEPRINT_SCHEMA) as unknown as Record<string, unknown>,
      schemaName: isPerson ? "career_blueprint" : "job_blueprint",
      schemaVersion: AGENT_ARCHITECTURE_VERSION,
    });
    const runner = new InstrumentedRunner(provider, {
      budget: ledger,
      experimentId: `openai-effort-calibration:${family}`,
      projectedCostUsd: (r: ModelRequest) => worstCaseCostUsd(DEFAULT_OPENAI_MODEL, r.prompt.render(r.input), probeAllowance),
      cachePath: `${providerCacheDir("openai")}/cache-calibration-${family.toLowerCase()}-${effort}-${kind}.json`,
    });

    const request: ModelRequest = {
      prompt: isPerson ? PERSON_BLUEPRINT_PROMPT : JOB_BLUEPRINT_PROMPT,
      input: isPerson ? personInput : jobInput,
      decoding: { temperature: 0, maxOutputTokens: probeAllowance },
    };

    let truncated = false;
    let parsed = false;
    let record: Awaited<ReturnType<InstrumentedRunner["run"]>>["record"] | null = null;
    try {
      const outcome = await runner.run(request);
      record = outcome.record;
      try {
        JSON.parse(outcome.text);
        parsed = true;
      } catch { parsed = false; }
    } catch (error) {
      if (error instanceof OpenAiTruncationError) truncated = true;
      else throw error;
    }

    const usage = record?.usage;
    const reasoning = usage?.reasoningTokens ?? null;
    const output = usage?.outputTokens ?? null;
    rows.push({
      effort, kind,
      resolvedModel: record?.providerMetadata?.resolvedModel ?? null,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: output,
      reasoningTokens: reasoning,
      answerTokens: output !== null && reasoning !== null ? output - reasoning : null,
      truncated: truncated || Boolean(record?.providerMetadata?.truncated),
      parsed,
      latencyMs: record?.latencyMs ?? 0,
      costUsd: usage?.costUsd ?? null,
    });

    const last = rows[rows.length - 1]!;
    process.stdout.write(
      `  ${effort.padEnd(7)} ${kind.padEnd(7)} ` +
      `in=${String(last.inputTokens ?? "-").padStart(6)} out=${String(last.outputTokens ?? "-").padStart(6)} ` +
      `reasoning=${String(last.reasoningTokens ?? "-").padStart(6)} answer=${String(last.answerTokens ?? "-").padStart(5)} ` +
      `${last.truncated ? "TRUNCATED" : last.parsed ? "parsed" : "UNPARSEABLE"} ${(last.latencyMs / 1000).toFixed(1)}s\n`,
    );
  }
}

// ---- what each setting would cost across a full arm ---------------------------------------
// A DEVELOPMENT arm at 12 people is 12 person calls + 288 job calls. Projected from measured
// per-call consumption, so the number reflects this model's actual reasoning appetite rather
// than an allowance someone guessed.
const ARM_PEOPLE = 12;
const ARM_JOBS = 288;
process.stdout.write(`\nprojected full-arm cost (${ARM_PEOPLE} person + ${ARM_JOBS} job calls), from MEASURED consumption:\n`);

interface Projection { effort: OpenAiEffort; armCostUsd: number | null; suggestedPersonAllowance: number | null; suggestedJobAllowance: number | null; anyTruncated: boolean }
const projections: Projection[] = [];
for (const effort of efforts) {
  const personRow = rows.find((r) => r.effort === effort && r.kind === "person");
  const jobRow = rows.find((r) => r.effort === effort && r.kind === "job");
  const anyTruncated = Boolean(personRow?.truncated || jobRow?.truncated);
  if (!personRow || !jobRow || personRow.costUsd === null || jobRow.costUsd === null) {
    projections.push({ effort, armCostUsd: null, suggestedPersonAllowance: null, suggestedJobAllowance: null, anyTruncated });
    process.stdout.write(`  ${effort.padEnd(7)} unmeasurable (truncated or errored)\n`);
    continue;
  }
  const armCostUsd = personRow.costUsd * ARM_PEOPLE + jobRow.costUsd * ARM_JOBS;
  // 2x measured consumption, floored at the Anthropic-arm allowance. Headroom matters more than
  // a tight reservation here: an allowance that truncates destroys the call, whereas an
  // allowance that is never reached costs nothing extra in ACTUAL spend.
  const headroom = (row: Row, floor: number) => Math.max(floor, Math.ceil(((row.outputTokens ?? floor) * 2) / 100) * 100);
  projections.push({
    effort,
    armCostUsd,
    suggestedPersonAllowance: headroom(personRow, 1200),
    suggestedJobAllowance: headroom(jobRow, 600),
    anyTruncated,
  });
  const worstCase =
    worstCaseCostUsd(DEFAULT_OPENAI_MODEL, PERSON_BLUEPRINT_PROMPT.render(personInput), headroom(personRow, 1200)) * ARM_PEOPLE +
    worstCaseCostUsd(DEFAULT_OPENAI_MODEL, JOB_BLUEPRINT_PROMPT.render(jobInput), headroom(jobRow, 600)) * ARM_JOBS;
  process.stdout.write(
    `  ${effort.padEnd(7)} expected $${armCostUsd.toFixed(2)}  ` +
    `worst-case reservation $${worstCase.toFixed(2)}  ` +
    `allowances person=${headroom(personRow, 1200)} job=${headroom(jobRow, 600)}` +
    `${anyTruncated ? "  (TRUNCATED AT PROBE ALLOWANCE)" : ""}\n`,
  );
}

// Reference point: what the Anthropic arm's own recorded token counts would cost on this model,
// so the two arms' spend is comparable rather than merely both under the cap.
const ANTHROPIC_ARM_TOKENS = { inputTokens: 224253, outputTokens: 77468 };
const anthropicTokensOnOpenAiPricing = estimateCostUsd(DEFAULT_OPENAI_MODEL, ANTHROPIC_ARM_TOKENS).costUsd;
process.stdout.write(
  `\nreference: the Claude arm's recorded ${ANTHROPIC_ARM_TOKENS.inputTokens} in / ${ANTHROPIC_ARM_TOKENS.outputTokens} out\n` +
  `           would cost $${anthropicTokensOnOpenAiPricing.toFixed(2)} at this model's configured pricing\n`,
);
process.stdout.write(`\nbudget after: $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);

mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/agent_experiments/openai-effort-calibration-${family.toLowerCase()}.json`;
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      experiment: "openai-effort-calibration",
      purpose: "size the output allowance and choose a reasoning setting; NOT a quality measurement",
      family,
      requestedModel: DEFAULT_OPENAI_MODEL,
      resolvedModels: [...new Set(rows.map((r) => r.resolvedModel).filter(Boolean))],
      probeAllowance,
      promptVersions: { person: PERSON_BLUEPRINT_PROMPT.version, job: JOB_BLUEPRINT_PROMPT.version },
      schemaVersion: AGENT_ARCHITECTURE_VERSION,
      rows,
      projections,
      anthropicArmTokensAtOpenAiPricing: { ...ANTHROPIC_ARM_TOKENS, costUsd: anthropicTokensOnOpenAiPricing },
      sampleSize: { people: 1, jobs: 1, note: "one of each; sufficient for sizing, never for a quality claim" },
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`\nwrote ${outputPath}\n`);
