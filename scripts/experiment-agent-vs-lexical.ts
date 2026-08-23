// EXPERIMENT: does model-normalised work representation bridge the vocabulary gap?
//
// HYPOTHESIS
//   Interpreting person evidence and job responsibilities into structured, plainly-worded work
//   content lets the same matching function that fails on raw text succeed, because the two
//   vocabularies are normalised onto common ground.
//
// FALSIFIABLE PREDICTION
//   On SEMANTIC_BRIDGE, `agent-blueprint` beats `experience-lexical` on experience NDCG@10 by
//   a paired-bootstrap margin whose 95% interval excludes zero.
//
// FAILURE CONDITION (stated in advance)
//   If the interval spans zero, the result is INCONCLUSIVE and reported as such. If the mean
//   difference is negative, agent-first LOSES on this corpus and that is the finding. No
//   post-hoc metric substitution, no dropping of a family, no re-tuning of the prompt to
//   recover the result.
//
// CONTROLLED ABLATION
//   `agent-blueprint` uses the SAME scorer as `experience-lexical`. Only the represented text
//   differs, so a difference is attributable to the representation.
//
// COST DISCIPLINE
//   Interpretation is per person and per job, never per pair, and every call is cached by
//   content. `--dry-run` prints the projected call count and spend without contacting the
//   provider.
//
// PROVIDER IS AN EXPERIMENTAL VARIABLE, NOT A COMPILE-TIME FACT
//   `--provider` selects the arm. Everything else — frozen inputs, hidden truth, prompts, schema,
//   matcher, scorer, statistics — is identical across arms, so the provider is the only thing
//   that differs. Arms write to separate caches and separate artifacts and are NEVER merged: a
//   missing measurement on one arm is a gap, never something to fill from the other.
import { mkdirSync, writeFileSync } from "node:fs";
import { InstrumentedRunner } from "../src/agent/runtime";
import { ModelRefusalError } from "../src/agent/anthropicProvider";
import { OpenAiQuotaError, OpenAiTruncationError } from "../src/agent/openaiProvider";
import {
  armCachePath,
  buildProvider,
  CANONICAL_EFFORT,
  checkArmReadiness,
  defaultModelFor,
  PROVIDER_NAMES,
  type ProviderName,
} from "../src/agent/providerRegistry";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, worstCaseCostUsd } from "../src/agent/budget";
import {
  createAgentArchitecture,
  createAgentFieldMatchArchitecture,
  interpretCorpus,
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_SCHEMA,
  AGENT_ARCHITECTURE_VERSION,
} from "../src/agent/agentArchitecture";
import { buildFrameCorpus, allFrameJobs } from "../src/bench/frameCorpus";
import { evaluateArchitecture, pairedDifference, CHANNELS } from "../src/bench/frameEvaluation";
import {
  charNgramArchitecture,
  experienceLexicalArchitecture,
  onetCanonicalArchitecture,
  oracleArchitecture,
  oracleNormalizerArchitecture,
  randomArchitecture,
  resumeLexicalArchitecture,
  titleOnlyArchitecture,
  constantScoreArchitecture,
  type RankingArchitecture,
} from "../src/bench/architectures";
import { CONCEPTS_BY_ID, IDENTITY_ROLES, type RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const people = Number(arg("people", "12"));
const family = arg("family", "SEMANTIC_BRIDGE") as RenderFamily;
const dryRun = process.argv.includes("--dry-run");
const provider = arg("provider", "openai") as ProviderName;
if (!PROVIDER_NAMES.includes(provider)) {
  process.stderr.write(`unknown --provider=${provider}; expected one of ${PROVIDER_NAMES.join(", ")}\n`);
  process.exit(1);
}
const model = arg("model", defaultModelFor(provider));
// Defaults to the setting the completed Anthropic arm used. Overriding it makes this a
// reasoning-depth arm rather than the canonical cross-provider comparison, and the artifact
// records the setting so the two can never be confused.
const effort = arg("effort", CANONICAL_EFFORT);
// Output allowances are sized to the task, not left at a generic default. The reservation is
// worst-case, so an oversized ceiling reserves budget that will never be spent and can block a
// legitimate experiment: at 2048 tokens/call this run reserved $16.0 to spend roughly $2.
const personMaxOutput = Number(arg("person-max-output", "1200"));
const jobMaxOutput = Number(arg("job-max-output", "600"));

const corpus = buildFrameCorpus({ people, split: "DEVELOPMENT", family });
const jobs = allFrameJobs(corpus);

// ---- projected cost, before anything is spent -------------------------------------------
const personProjection = corpus.people.map((person) =>
  worstCaseCostUsd(
    model,
    PERSON_BLUEPRINT_PROMPT.render({
      experience: person.experienceEvidence.map((e) => e.text).join("\n"),
      liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
      disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
      desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
    }),
    personMaxOutput,
  ),
);
const jobProjection = jobs.map((job) =>
  worstCaseCostUsd(model, JOB_BLUEPRINT_PROMPT.render({ responsibilities: job.responsibilities.map((r) => r.text).join("\n") }), jobMaxOutput),
);
const projectedCalls = corpus.people.length + jobs.length;
const projectedCost = [...personProjection, ...jobProjection].reduce((a, b) => a + b, 0);

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
const remaining = ledger.remainingUsd();
const shareOfRemaining = remaining > 0 ? projectedCost / remaining : Infinity;

process.stdout.write(`\nEXPERIMENT: agent-blueprint vs experience-lexical\n`);
process.stdout.write(`provider=${provider}  model=${model}  effort=${effort}\n`);
process.stdout.write(`family=${family}  people=${people}  jobs=${jobs.length}\n\n`);
if (effort !== CANONICAL_EFFORT) {
  process.stdout.write(
    `  NOTE: effort=${effort} differs from the canonical ${CANONICAL_EFFORT}. This is a\n` +
    `  reasoning-depth arm, NOT the canonical cross-provider comparison, because it varies\n` +
    `  reasoning depth as well as provider. Report it as its own arm.\n\n`,
  );
}
process.stdout.write(`projected calls   : ${projectedCalls}  (${corpus.people.length} person + ${jobs.length} job; never person x job)\n`);
process.stdout.write(`projected WORST-CASE spend: $${projectedCost.toFixed(3)}\n`);
process.stdout.write(`budget remaining  : $${remaining.toFixed(3)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.remainingCalls()} of ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);
process.stdout.write(`share of remaining: ${(shareOfRemaining * 100).toFixed(1)}%\n`);

if (ledger.requiresInformationValueReview(projectedCost)) {
  // Amendment B: a batch above 20% of remaining budget needs an explicit information-value
  // statement and the smallest useful paired sample, not a rubber stamp.
  process.stdout.write(
    `\n  ABOVE THE 20% REVIEW THRESHOLD.\n` +
    `  Information value: this is the run's central question — whether ANY architecture can\n` +
    `  bridge disjoint vocabulary, where every deterministic system currently sits at the\n` +
    `  constant-score control. The design is already the smallest useful one: a PAIRED\n` +
    `  comparison on a single family, at the smallest person count that resolves the effect.\n` +
    `  Reduce --people before raising the budget.\n`,
  );
}
if (projectedCalls > ledger.remainingCalls()) {
  process.stderr.write(`\nprojected ${projectedCalls} calls exceeds the ${ledger.remainingCalls()} remaining; reduce --people\n`);
  process.exit(1);
}
if (dryRun) {
  process.stdout.write(`\n--dry-run: nothing was sent to the provider.\n`);
  process.exit(0);
}

// Gate on USABILITY rather than credential presence. The OpenAI arm's blocking condition is a
// valid key on an account that cannot pay, which a presence check cannot see — and finding that
// out on call 1 of 300 wastes an arm.
const readiness = await checkArmReadiness(provider);
if (!readiness.ready) {
  process.stderr.write(`\ncannot run the ${provider} arm: ${readiness.reason} — ${readiness.detail}\n`);
  process.stderr.write(`nothing was spent. run \`pnpm openai:preflight\` for the full report.\n`);
  process.exit(1);
}

// ---- interpret --------------------------------------------------------------------------
const personProvider = buildProvider({
  provider, model, effort: effort as never,
  maxOutputTokens: personMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>,
  schemaName: "career_blueprint",
});
// The person and job schemas differ, so the job phase gets its own provider instance. Sharing
// one would force the job response into the person shape and silently produce empty work.
const jobProvider = buildProvider({
  provider, model, effort: effort as never,
  maxOutputTokens: jobMaxOutput,
  outputSchema: JOB_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>,
  schemaName: "job_blueprint",
});

const projectedFor = (limit: number) => (r: { prompt: { render: (i: Record<string, unknown>) => string }; input: Record<string, unknown> }) =>
  worstCaseCostUsd(model, r.prompt.render(r.input), limit);

// A refusal is recorded as an ABSTENTION and the run continues. Losing 300 calls of work to
// one declined job would be worse science than an honest empty interpretation, but the
// abstention is counted and reported — never quietly treated as a successful empty result.
//
// A QUOTA failure is deliberately NOT tolerated: it cannot be fixed by continuing, and
// continuing would fill the arm with empty blueprints that score as genuine incomprehension.
// Truncation is likewise fatal, because it means the allowance is too small for the reasoning
// setting — a configuration fault that would silently corrupt every remaining call.
const tolerateRefusal = (error: unknown) => {
  if (error instanceof OpenAiQuotaError || error instanceof OpenAiTruncationError) return null;
  if (!(error instanceof ModelRefusalError)) return null;
  return { text: "{}", usage: { inputTokens: null, outputTokens: null, costUsd: 0, costIsEstimate: true } };
};
const experimentId = `agent-vs-lexical:${provider}:${family}:${effort}`;
const personRunner = new InstrumentedRunner(personProvider, {
  budget: ledger, experimentId,
  projectedCostUsd: projectedFor(personMaxOutput), onError: tolerateRefusal,
  cachePath: armCachePath({ provider, model, effort, family, kind: "person" }),
});
const jobRunner = new InstrumentedRunner(jobProvider, {
  budget: ledger, experimentId,
  projectedCostUsd: projectedFor(jobMaxOutput), onError: tolerateRefusal,
  cachePath: armCachePath({ provider, model, effort, family, kind: "job" }),
});

const started = Date.now();
process.stdout.write(`\ninterpreting...\n`);
const { blueprints } = await interpretCorpus(personRunner, corpus.people, new Map(), {
  maxOutputTokens: personMaxOutput,
  onProgress: (done, total) => { if (done % 4 === 0 || done === total) process.stdout.write(`  person ${done}/${total}\n`); },
});
const { jobWork } = await interpretCorpus(jobRunner, [], corpus.jobsByPerson, {
  maxOutputTokens: jobMaxOutput,
  onProgress: (done, total) => { if (done % 40 === 0 || done === total) process.stdout.write(`  job ${done}/${total}\n`); },
});
const elapsedMs = Date.now() - started;

// ---- evaluate ---------------------------------------------------------------------------
let onet: RankingArchitecture<never> | null = null;
try {
  const { mapWork } = await import("../src/v3/mapper");
  onet = onetCanonicalArchitecture(mapWork as never) as unknown as RankingArchitecture<never>;
} catch { /* competitor unavailable; reported as absent rather than silently skipped */ }

// CONTROL, not a competitor: perfect normalisation through the corpus's own neutral register.
// If the agent lands near this, normalisation is the whole game and the headline is partly an
// artifact of how the lexicon was authored. If this is well below 1.000, token matching — not
// the representation — is the binding constraint.
const normalizerControl = oracleNormalizerArchitecture(
  (id) => CONCEPTS_BY_ID.get(id)?.neutralForms ?? [],
  IDENTITY_ROLES,
) as unknown as RankingArchitecture<never>;
const agent = createAgentArchitecture(blueprints, jobWork) as unknown as RankingArchitecture<never>;
// Same interpretations, field-by-field matching. Included because the oracle-normalizer control
// showed the matcher was the binding constraint, and this costs no additional model calls.
const agentField = createAgentFieldMatchArchitecture(blueprints, jobWork) as unknown as RankingArchitecture<never>;
const candidates = [
  randomArchitecture, constantScoreArchitecture, titleOnlyArchitecture,
  charNgramArchitecture, resumeLexicalArchitecture, experienceLexicalArchitecture,
  ...(onet ? [onet] : []), agent, agentField,
] as unknown as RankingArchitecture<never>[];

process.stdout.write(`\n================ ${family} (n=${people}) ================\n`);
process.stdout.write(`${"architecture".padEnd(22)}${CHANNELS.map((c) => c.padStart(14)).join("")}\n`);
const results = new Map<string, ReturnType<typeof evaluateArchitecture>>();
for (const architecture of [...candidates, normalizerControl, oracleArchitecture as unknown as RankingArchitecture<never>]) {
  const cells: string[] = [];
  for (const channel of CHANNELS) {
    const result = evaluateArchitecture(architecture, corpus, channel, 10);
    results.set(`${architecture.id}:${channel}`, result);
    cells.push((result.meanNdcg10 ?? NaN).toFixed(3).padStart(14));
  }
  process.stdout.write(`${architecture.id.padEnd(22)}${cells.join("")}\n`);
}

// Both agent arms are compared, and the field-match arm is also compared against the token-bag
// arm. The latter is the matcher-only ablation: same interpretations, no extra model calls, so a
// difference isolates the matcher from the representation. It is written to the artifact this
// time — a previous run measured it and never persisted it, which cost the claim its evidence.
const comparisons: unknown[] = [];
const report = (system: string, reference: string) => {
  process.stdout.write(`\npaired ${system} vs ${reference} (95% bootstrap CI over persons):\n`);
  for (const channel of CHANNELS) {
    const diff = pairedDifference(results.get(`${system}:${channel}`)!, results.get(`${reference}:${channel}`)!);
    const verdict = diff.significant ? (diff.meanDifference > 0 ? "BETTER" : "WORSE") : "INCONCLUSIVE";
    process.stdout.write(
      `  ${channel.padEnd(12)} Δ=${diff.meanDifference >= 0 ? "+" : ""}${diff.meanDifference.toFixed(3)}` +
      `  CI [${diff.ci95.low.toFixed(3)}, ${diff.ci95.high.toFixed(3)}]  n=${diff.pairedN}  resolves ±${diff.resolvableDifference.toFixed(3)}  ${verdict}\n`,
    );
    comparisons.push({ ...diff });
  }
};
report("agent-blueprint", "experience-lexical");
report("agent-field-match", "experience-lexical");
report("agent-field-match", "agent-blueprint");

const telemetry = { person: personRunner.telemetry(), job: jobRunner.telemetry() };
const refusals = personRunner.errors.length + jobRunner.errors.length;
const totalCost = telemetry.person.costUsd + telemetry.job.costUsd;
process.stdout.write(`\ncost and latency:\n`);
process.stdout.write(`  person interpretation (onboarding): ${telemetry.person.calls} calls, $${telemetry.person.costUsd.toFixed(4)}, p50 ${telemetry.person.p50LatencyMs}ms\n`);
process.stdout.write(`  job interpretation (corpus, amortised): ${telemetry.job.calls} calls, $${telemetry.job.costUsd.toFixed(4)}, p50 ${telemetry.job.p50LatencyMs}ms\n`);
process.stdout.write(`  total $${totalCost.toFixed(4)} in ${(elapsedMs / 1000).toFixed(0)}s\n`);
process.stdout.write(`  cost per person blueprint: $${(telemetry.person.costUsd / Math.max(1, corpus.people.length)).toFixed(4)}\n`);
process.stdout.write(`  budget now: $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);

// The provider is in the FILENAME. Arms must never overwrite each other: the Claude
// SEMANTIC_BRIDGE artifact is the only surviving evidence from that arm, and losing it to a
// same-named OpenAI run would destroy the comparison this whole migration exists to preserve.
mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/agent_experiments/agent-vs-lexical-${provider}-${family.toLowerCase()}-n${people}.json`;
const allRecords = [...personRunner.records, ...jobRunner.records];
writeFileSync(
  outputPath,
  JSON.stringify({
    experiment: "agent-vs-lexical", experimentId, family, people,
    provider,
    requestedModel: model,
    // The requested identifier may be a moving alias; these are what the API actually served.
    resolvedModels: [...new Set(allRecords.map((r) => r.providerMetadata?.resolvedModel).filter(Boolean))],
    reasoning: effort,
    canonicalCrossProviderArm: effort === CANONICAL_EFFORT,
    promptVersions: { person: PERSON_BLUEPRINT_PROMPT.version, job: JOB_BLUEPRINT_PROMPT.version },
    promptHashes: {
      person: allRecords.find((r) => r.promptId === PERSON_BLUEPRINT_PROMPT.id)?.promptHash ?? null,
      job: allRecords.find((r) => r.promptId === JOB_BLUEPRINT_PROMPT.id)?.promptHash ?? null,
    },
    schemaVersion: AGENT_ARCHITECTURE_VERSION,
    schemaHashes: { person: personProvider.schemaHash ?? null, job: jobProvider.schemaHash ?? null },
    maxOutputTokens: { person: personMaxOutput, job: jobMaxOutput },
    scores: [...results.entries()].map(([key, value]) => ({ key, ndcg10: value.meanNdcg10, recall10: value.meanRecall10, surprising: value.meanSurprisingRecall10, transition: value.meanTransitionRecall10 })),
    comparisons, telemetry, totalCostUsd: totalCost, elapsedMs,
    budgetAfter: { spentUsd: ledger.spentUsd, calls: ledger.calls, limits: RUNTIME_BUDGET_LIMITS },
    refusals: { count: refusals, samples: [...personRunner.errors, ...jobRunner.errors].slice(0, 5) },
  }, null, 2) + "\n",
);
process.stdout.write(`\nwrote ${outputPath}\n`);
