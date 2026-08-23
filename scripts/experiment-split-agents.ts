// EXPERIMENT: does splitting person interpretation into an Experience Agent and a Direction
// Agent beat one shared CareerBlueprint call?
//
// HYPOTHESIS
//   Two dedicated agents each do their own job better than one prompt holding four extraction
//   goals at once, and keep Experience and Direction separated more reliably.
//
// FALSIFIABLE PREDICTION
//   On the target family, `split-full-context` beats `shared` on the direction channel by a
//   paired-bootstrap margin whose 95% interval excludes zero, WITHOUT raising
//   experience-into-direction contamination.
//
// FAILURE CONDITION (stated in advance)
//   If the interval spans zero the result is INCONCLUSIVE and the split architecture is not
//   adopted. If the margin is negative, the shared blueprint wins and that is the finding. No
//   post-hoc channel substitution, no dropping a variant, no prompt retuning to recover it.
//
// WHY THIS IS CHEAP, AND WHY THAT MATTERS
//   The split changes only the PERSON side. Job blueprints are keyed by content and the job
//   prompt, schema, model and effort are all unchanged, so every one of the 288 job
//   interpretations per family is a cache HIT. The shared baseline is also already cached. The
//   only new spend is person calls: 12 people x 2 agents x 2 variants.
//
//   `--dry-run` proves that claim before any money moves, by computing every cache key and
//   reporting how many are already present.
//
// WHAT IS HELD FIXED
//   Frozen inputs, hidden truth, family definitions, the downstream matcher, the scoring
//   functions and the statistical procedure. The matcher reads the SAME five role fields from
//   every architecture, so a difference is attributable to the interpretation and not to the
//   extra fields the Experience Agent records.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { InstrumentedRunner, cacheKeyFor, type ModelRequest } from "../src/agent/runtime";
import { checkArmReadiness, buildProvider, armCachePath, CANONICAL_EFFORT, defaultModelFor, type ProviderName } from "../src/agent/providerRegistry";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, worstCaseCostUsd } from "../src/agent/budget";
import {
  createAgentFieldMatchArchitecture,
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_SCHEMA,
  type CareerBlueprint,
  type StructuredWork,
} from "../src/agent/agentArchitecture";
import {
  DIRECTION_AGENT_PROMPT, DIRECTION_AGENT_SCHEMA,
  EXPERIENCE_AGENT_PROMPT, EXPERIENCE_AGENT_SCHEMA,
  SPLIT_AGENT_VERSION, agentEvidence, foldSplitOutputs,
  type DirectionAgentOutput, type EvidenceScope, type ExperienceAgentOutput,
} from "../src/agent/splitAgents";
import { channelIntegrityFor, divergenceContrast, summarizeIntegrity, type ChannelIntegrity } from "../src/agent/channelIntegrity";
import { buildFrameCorpus, allFrameJobs } from "../src/bench/frameCorpus";
import { evaluateArchitecture, pairedDifference, CHANNELS } from "../src/bench/frameEvaluation";
import { experienceLexicalArchitecture, oracleNormalizerArchitecture, type RankingArchitecture } from "../src/bench/architectures";
import { CONCEPTS_BY_ID, IDENTITY_ROLES, type RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const people = Number(arg("people", "12"));
const family = arg("family", "LEXICAL_TRAP") as RenderFamily;
const provider = arg("provider", "openai") as ProviderName;
const model = arg("model", defaultModelFor(provider));
const effort = arg("effort", CANONICAL_EFFORT);
const dryRun = process.argv.includes("--dry-run");
// Sized from `pnpm openai:calibrate`, not inherited. The split agents emit fewer entries each
// than the shared blueprint but carry extra provenance fields, so the person allowance is kept
// at the calibrated value rather than reduced on a guess.
const personMaxOutput = Number(arg("person-max-output", "1800"));
const jobMaxOutput = Number(arg("job-max-output", "700"));

const corpus = buildFrameCorpus({ people, split: "DEVELOPMENT", family });
const jobs = allFrameJobs(corpus);

// ---- providers, built exactly as the completed arms built them ---------------------------
// The job provider must be byte-identical in configuration or its cache keys change and 288
// paid interpretations per family become worthless.
const jobProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: jobMaxOutput,
  outputSchema: JOB_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "job_blueprint",
});
const sharedProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: personMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "career_blueprint",
});
const experienceProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: personMaxOutput,
  outputSchema: EXPERIENCE_AGENT_SCHEMA as unknown as Record<string, unknown>, schemaName: "experience_blueprint",
});
const directionProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: personMaxOutput,
  outputSchema: DIRECTION_AGENT_SCHEMA as unknown as Record<string, unknown>, schemaName: "direction_blueprint",
});

const sharedInput = (personId: string) => {
  const person = corpus.people.find((p) => p.personId === personId)!;
  return {
    experience: person.experienceEvidence.map((e) => e.text).join("\n"),
    liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
    disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
    desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
  };
};

const jobRequest = (job: { jobId: string; responsibilities: { text: string }[] }): ModelRequest => ({
  prompt: JOB_BLUEPRINT_PROMPT,
  input: { responsibilities: job.responsibilities.map((r) => r.text).join("\n") },
  decoding: { temperature: 0, maxOutputTokens: jobMaxOutput },
});
const sharedRequest = (personId: string): ModelRequest => ({
  prompt: PERSON_BLUEPRINT_PROMPT, input: sharedInput(personId),
  decoding: { temperature: 0, maxOutputTokens: personMaxOutput },
});
const splitRequest = (personId: string, scope: EvidenceScope, which: "experience" | "direction"): ModelRequest => {
  const person = corpus.people.find((p) => p.personId === personId)!;
  const evidence = agentEvidence(person, scope);
  return {
    prompt: which === "experience" ? EXPERIENCE_AGENT_PROMPT : DIRECTION_AGENT_PROMPT,
    input: { evidence: which === "experience" ? evidence.experience : evidence.direction },
    decoding: { temperature: 0, maxOutputTokens: personMaxOutput },
  };
};

const VARIANTS: { id: string; scope: EvidenceScope }[] = [
  { id: "split-full-context", scope: "full-context" },
  { id: "split-isolated", scope: "isolated" },
];

// ---- cache census: what is already paid for, before anything is spent --------------------
const loadCache = (path: string): Record<string, { text: string }> =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, { text: string }>) : {};

const jobCachePath = armCachePath({ provider, model, effort, family, kind: "job" });
const sharedCachePath = armCachePath({ provider, model, effort, family, kind: "person" });
const jobCache = loadCache(jobCachePath);
const sharedCache = loadCache(sharedCachePath);

const jobHits = jobs.filter((job) => jobCache[cacheKeyFor(jobProvider, jobRequest(job))]).length;
const sharedHits = corpus.people.filter((p) => sharedCache[cacheKeyFor(sharedProvider, sharedRequest(p.personId))]).length;

const splitCachePath = (variant: string, which: "experience" | "direction") =>
  `artifacts/agent_runtime/${provider}/cache-${variant}-${which}-${family.toLowerCase()}-${model.replace(/[^a-z0-9.-]/gi, "_")}-${effort}.json`;

let splitMisses = 0;
for (const variant of VARIANTS) {
  for (const which of ["experience", "direction"] as const) {
    const cache = loadCache(splitCachePath(variant.id, which));
    const runnerProvider = which === "experience" ? experienceProvider : directionProvider;
    for (const person of corpus.people) {
      if (!cache[cacheKeyFor(runnerProvider, splitRequest(person.personId, variant.scope, which))]) splitMisses += 1;
    }
  }
}

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
const perPersonWorstCase = corpus.people.map((p) =>
  worstCaseCostUsd(model, EXPERIENCE_AGENT_PROMPT.render({ evidence: agentEvidence(p, "full-context").experience }), personMaxOutput),
);
const projectedCost = (perPersonWorstCase.reduce((a, b) => a + b, 0) / Math.max(1, corpus.people.length)) * splitMisses;

process.stdout.write(`\nEXPERIMENT: split agents vs shared CareerBlueprint (${SPLIT_AGENT_VERSION})\n`);
process.stdout.write(`provider=${provider}  model=${model}  effort=${effort}\n`);
process.stdout.write(`family=${family}  people=${people}  jobs=${jobs.length}  matcher=agent-field-match (held fixed)\n\n`);
process.stdout.write(`ALREADY PAID FOR (cache hits, cost $0):\n`);
process.stdout.write(`  job blueprints    : ${jobHits}/${jobs.length}${jobHits === jobs.length ? "  (all reusable)" : "  <-- MISSES WOULD COST MONEY"}\n`);
process.stdout.write(`  shared baseline   : ${sharedHits}/${corpus.people.length}${sharedHits === corpus.people.length ? "  (all reusable)" : "  <-- MISSES WOULD COST MONEY"}\n`);
process.stdout.write(`\nNEW CALLS REQUIRED:\n`);
process.stdout.write(`  split agents      : ${splitMisses}  (${corpus.people.length} people x 2 agents x ${VARIANTS.length} variants)\n`);
process.stdout.write(`  projected WORST-CASE spend: $${projectedCost.toFixed(3)}\n`);
process.stdout.write(`  budget remaining  : $${ledger.remainingUsd().toFixed(3)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.remainingCalls()} of ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);
process.stdout.write(`  share of remaining: ${((projectedCost / Math.max(1e-9, ledger.remainingUsd())) * 100).toFixed(1)}%\n`);

if (jobHits < jobs.length || sharedHits < corpus.people.length) {
  process.stdout.write(
    `\n  WARNING: the reusable caches are NOT fully present. Running now would re-bill work that\n` +
    `  has already been paid for. Check that provider, model, effort, prompt version, schema and\n` +
    `  max-output-tokens all match the completed arm before spending.\n`,
  );
}

// Does the corpus even contain the divergence this experiment wants to reason about? Asked
// BEFORE spending, because a uniform corpus makes some questions unanswerable at any sample size.
const cases = divergenceContrast(corpus.people);
process.stdout.write(`\nEXPERIENCE/DIRECTION DIVERGENCE in this corpus (from PLANTED truth, not from output):\n`);
process.stdout.write(`  desired-vs-performed role overlap, histogram 0..5 : ${cases.desiredOverlapHistogram.join(" / ")}\n`);
process.stdout.write(`  disliked-vs-performed role overlap, histogram 0..5: ${cases.dislikedOverlapHistogram.join(" / ")}\n`);
if (cases.limitation) {
  process.stdout.write(`\n  BENCHMARK LIMITATION: ${cases.limitation}.\n`);
  process.stdout.write(
    `  Retrieval, recall and CONTAMINATION remain measurable and are the point of this screen.\n` +
    `  A claim of the form "the split architecture handles divergent people better" is NOT\n` +
    `  testable on this corpus at any sample size, and must not be made from this run.\n`,
  );
}

if (dryRun) {
  process.stdout.write(`\n--dry-run: nothing was sent to the provider.\n`);
  process.exit(0);
}

const readiness = await checkArmReadiness(provider);
if (!readiness.ready) {
  process.stderr.write(`\ncannot run the ${provider} arm: ${readiness.reason} — ${readiness.detail}\nnothing was spent.\n`);
  process.exit(1);
}

// ---- interpret ---------------------------------------------------------------------------
const experimentId = `split-agents:${provider}:${family}:${effort}`;
const projectedFor = (r: { prompt: { render: (i: Record<string, unknown>) => string }; input: Record<string, unknown> }) =>
  worstCaseCostUsd(model, r.prompt.render(r.input), personMaxOutput);

const jobRunner = new InstrumentedRunner(jobProvider, { experimentId, cachePath: jobCachePath, budget: ledger, projectedCostUsd: projectedFor });
const jobWork = new Map<string, StructuredWork[]>();
for (const job of jobs) {
  const { text } = await jobRunner.run(jobRequest(job));
  try {
    jobWork.set(job.jobId, (JSON.parse(text) as { responsibilities?: StructuredWork[] }).responsibilities ?? []);
  } catch { jobWork.set(job.jobId, []); }
}

const sharedRunner = new InstrumentedRunner(sharedProvider, { experimentId, cachePath: sharedCachePath, budget: ledger, projectedCostUsd: projectedFor });
const blueprintsByArchitecture = new Map<string, Map<string, CareerBlueprint>>();
const sharedBlueprints = new Map<string, CareerBlueprint>();
for (const person of corpus.people) {
  const { text } = await sharedRunner.run(sharedRequest(person.personId));
  let parsed: Partial<CareerBlueprint> = {};
  try { parsed = JSON.parse(text) as Partial<CareerBlueprint>; } catch { /* empty interpretation, visible in counts */ }
  sharedBlueprints.set(person.personId, {
    personId: person.personId,
    experience: parsed.experience ?? [], liked: parsed.liked ?? [],
    disliked: parsed.disliked ?? [], desired: parsed.desired ?? [],
  });
}
blueprintsByArchitecture.set("shared", sharedBlueprints);

process.stdout.write(`\ninterpreting split agents...\n`);
for (const variant of VARIANTS) {
  const experienceRunner = new InstrumentedRunner(experienceProvider, {
    experimentId, cachePath: splitCachePath(variant.id, "experience"), budget: ledger, projectedCostUsd: projectedFor,
  });
  const directionRunner = new InstrumentedRunner(directionProvider, {
    experimentId, cachePath: splitCachePath(variant.id, "direction"), budget: ledger, projectedCostUsd: projectedFor,
  });
  const built = new Map<string, CareerBlueprint>();
  let done = 0;
  for (const person of corpus.people) {
    const experienceText = (await experienceRunner.run(splitRequest(person.personId, variant.scope, "experience"))).text;
    const directionText = (await directionRunner.run(splitRequest(person.personId, variant.scope, "direction"))).text;
    let experienceOut: ExperienceAgentOutput | null = null;
    let directionOut: DirectionAgentOutput | null = null;
    try { experienceOut = JSON.parse(experienceText) as ExperienceAgentOutput; } catch { /* counted as empty */ }
    try { directionOut = JSON.parse(directionText) as DirectionAgentOutput; } catch { /* counted as empty */ }
    built.set(person.personId, foldSplitOutputs(person.personId, experienceOut, directionOut));
    done += 1;
    if (done % 4 === 0 || done === corpus.people.length) process.stdout.write(`  ${variant.id} ${done}/${corpus.people.length}\n`);
  }
  blueprintsByArchitecture.set(variant.id, built);
}

// ---- evaluate: same matcher for every architecture ---------------------------------------
const normalizerControl = oracleNormalizerArchitecture(
  (id) => CONCEPTS_BY_ID.get(id)?.neutralForms ?? [], IDENTITY_ROLES,
) as unknown as RankingArchitecture<never>;

const architectures = [...blueprintsByArchitecture.entries()].map(([id, blueprints]) =>
  createAgentFieldMatchArchitecture(blueprints, jobWork, id) as unknown as RankingArchitecture<never>,
);

process.stdout.write(`\n================ ${family} (n=${people}), matcher held at agent-field-match ================\n`);
process.stdout.write(`${"architecture".padEnd(22)}${CHANNELS.map((c) => c.padStart(14)).join("")}\n`);
const results = new Map<string, ReturnType<typeof evaluateArchitecture>>();
for (const architecture of [experienceLexicalArchitecture as unknown as RankingArchitecture<never>, ...architectures, normalizerControl]) {
  const cells: string[] = [];
  for (const channel of CHANNELS) {
    const result = evaluateArchitecture(architecture, corpus, channel, 10);
    results.set(`${architecture.id}:${channel}`, result);
    cells.push((result.meanNdcg10 ?? NaN).toFixed(3).padStart(14));
  }
  process.stdout.write(`${architecture.id.padEnd(22)}${cells.join("")}\n`);
}

const comparisons: unknown[] = [];
for (const variant of VARIANTS) {
  process.stdout.write(`\npaired ${variant.id} vs shared (95% bootstrap CI over persons):\n`);
  for (const channel of CHANNELS) {
    const diff = pairedDifference(results.get(`${variant.id}:${channel}`)!, results.get(`shared:${channel}`)!);
    const verdict = diff.significant ? (diff.meanDifference > 0 ? "BETTER" : "WORSE") : "INCONCLUSIVE";
    process.stdout.write(
      `  ${channel.padEnd(12)} Δ=${diff.meanDifference >= 0 ? "+" : ""}${diff.meanDifference.toFixed(3)}` +
      `  CI [${diff.ci95.low.toFixed(3)}, ${diff.ci95.high.toFixed(3)}]  n=${diff.pairedN}  ${verdict}\n`,
    );
    comparisons.push({ ...diff });
  }
}

// ---- channel integrity: the question retrieval cannot answer ----------------------------
process.stdout.write(`\nCHANNEL INTEGRITY (strict 5-of-5 role match; every rate is a LOWER BOUND)\n`);
process.stdout.write(`${"architecture".padEnd(22)}${"dir->exp".padStart(10)}${"exp->dir".padStart(10)}${"dis->lik".padStart(10)}${"perf rec".padStart(10)}${"des rec".padStart(9)}${"empty exp".padStart(11)}${"empty des".padStart(11)}\n`);
const integrity: Record<string, ReturnType<typeof summarizeIntegrity>> = {};
const integrityRows: Record<string, ChannelIntegrity[]> = {};
for (const [id, blueprints] of blueprintsByArchitecture) {
  const rows = corpus.people.map((person) => channelIntegrityFor(person, blueprints.get(person.personId)!));
  const summary = summarizeIntegrity(rows);
  integrity[id] = summary;
  integrityRows[id] = rows;
  process.stdout.write(
    `${id.padEnd(22)}${summary.directionIntoExperienceRate.toFixed(3).padStart(10)}${summary.experienceIntoDirectionRate.toFixed(3).padStart(10)}` +
    `${summary.dislikedIntoLikedRate.toFixed(3).padStart(10)}${summary.performedRecall.toFixed(3).padStart(10)}${summary.desiredRecall.toFixed(3).padStart(9)}` +
    `${String(summary.emptyExperienceChannels).padStart(11)}${String(summary.emptyDesiredChannels).padStart(11)}\n`,
  );
}

const telemetry = {
  job: jobRunner.telemetry(), shared: sharedRunner.telemetry(),
};
process.stdout.write(`\ncost:\n`);
process.stdout.write(`  reused from cache : ${telemetry.job.cacheHits + telemetry.shared.cacheHits} calls at $0\n`);
process.stdout.write(`  budget now        : $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}, ${ledger.calls} / ${RUNTIME_BUDGET_LIMITS.maxCalls} calls\n`);

mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/agent_experiments/split-agents-${provider}-${family.toLowerCase()}-n${people}.json`;
writeFileSync(outputPath, JSON.stringify({
  experiment: "split-agents", experimentId, family, people, provider, requestedModel: model, reasoning: effort,
  splitAgentVersion: SPLIT_AGENT_VERSION,
  matcher: "agent-field-match",
  promptVersions: {
    shared: PERSON_BLUEPRINT_PROMPT.version, job: JOB_BLUEPRINT_PROMPT.version,
    experienceAgent: EXPERIENCE_AGENT_PROMPT.version, directionAgent: DIRECTION_AGENT_PROMPT.version,
  },
  scores: [...results.entries()].map(([key, value]) => ({ key, ndcg10: value.meanNdcg10, recall10: value.meanRecall10, surprising: value.meanSurprisingRecall10 })),
  comparisons, integrity, integrityRows, divergenceCases: cases, telemetry,
  budgetAfter: { spentUsd: ledger.spentUsd, calls: ledger.calls },
}, null, 2) + "\n");
process.stdout.write(`\nwrote ${outputPath}\n`);
