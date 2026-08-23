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
import { checkArmReadiness, buildProvider, armCachePath, splitAgentCachePath, CANONICAL_EFFORT, defaultModelFor, type ProviderName } from "../src/agent/providerRegistry";
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
  SPLIT_AGENT_VERSION, SPLIT_PRODUCED_CHANNELS, agentEvidence, foldSplitOutputs,
  type DirectionAgentOutput, type EvidenceScope, type ExperienceAgentOutput,
} from "../src/agent/splitAgents";
import { channelIntegrityFor, divergenceContrast, summarizeIntegrity, type ChannelIntegrity } from "../src/agent/channelIntegrity";
import {
  agentLatencyProfile, callSamples, criticalPath, latencyQualityTrade,
  LATENCY_VERSION, STABLE_PERCENTILE_MINIMUM, type CallLatencySample, type CriticalPath,
} from "../src/agent/latency";
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
/**
 * The split agents get their OWN allowance, and a larger one. Measured, not guessed.
 *
 * A first attempt at 1800 — the shared blueprint's allowance — truncated on person 9 with 982
 * reasoning tokens spent. Across the 16 calls that did complete, the Experience Agent's output
 * ran 829/1361/1619 (min/median/max) against the shared blueprint's 886 total, because it emits
 * ownership, depth and evidence per work item on top of the five role fields. Reasoning alone
 * varied 261 to 982, nearly fourfold.
 *
 * So 2x the observed maximum, matching the rule `pnpm openai:calibrate` uses.
 *
 * This is a CEILING, not a budget the model tries to fill: a call that needs 1400 tokens costs
 * the same under either number, and only the worst-case RESERVATION rises. Raising it is not
 * prompt retuning and cannot flatter the split arms on quality — it is what makes them
 * measurable at all. The comparable condition across arms is "neither arm truncates", not
 * "both arms were handed the same integer". The shared baseline keeps 1800 deliberately, because
 * its allowance participates in the cache key and changing it would discard 12 paid calls.
 */
const splitMaxOutput = Number(arg("split-max-output", "3600"));

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
  provider, model, effort: effort as never, maxOutputTokens: splitMaxOutput,
  outputSchema: EXPERIENCE_AGENT_SCHEMA as unknown as Record<string, unknown>, schemaName: "experience_blueprint",
});
const directionProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: splitMaxOutput,
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
  subjectId: personId,
});
const splitRequest = (personId: string, scope: EvidenceScope, which: "experience" | "direction"): ModelRequest => {
  const person = corpus.people.find((p) => p.personId === personId)!;
  const evidence = agentEvidence(person, scope);
  return {
    prompt: which === "experience" ? EXPERIENCE_AGENT_PROMPT : DIRECTION_AGENT_PROMPT,
    input: { evidence: which === "experience" ? evidence.experience : evidence.direction },
    decoding: { temperature: 0, maxOutputTokens: splitMaxOutput },
    subjectId: personId,
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

const splitCachePath = (variant: string, agent: "experience" | "direction") =>
  splitAgentCachePath({
    provider, model, effort, family, variant, agent,
    promptVersion: agent === "experience" ? EXPERIENCE_AGENT_PROMPT.version : DIRECTION_AGENT_PROMPT.version,
    maxOutputTokens: splitMaxOutput,
  });

// Broken out per agent, because the whole cost argument for this screen is that the Experience
// interpretations are UNCHANGED and must therefore be hits. Asserting that is not enough; a
// configuration drift would silently re-bill 24 calls, so the dry run checks it.
const splitCensus: { agent: string; variant: string; hits: number; misses: number }[] = [];
let splitMisses = 0;
for (const variant of VARIANTS) {
  for (const which of ["experience", "direction"] as const) {
    const cache = loadCache(splitCachePath(variant.id, which));
    const runnerProvider = which === "experience" ? experienceProvider : directionProvider;
    let hits = 0;
    let misses = 0;
    for (const person of corpus.people) {
      if (cache[cacheKeyFor(runnerProvider, splitRequest(person.personId, variant.scope, which))]) hits += 1;
      else misses += 1;
    }
    splitCensus.push({ agent: which, variant: variant.id, hits, misses });
    splitMisses += misses;
  }
}

const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");
const perPersonWorstCase = corpus.people.map((p) =>
  worstCaseCostUsd(model, EXPERIENCE_AGENT_PROMPT.render({ evidence: agentEvidence(p, "full-context").experience }), splitMaxOutput),
);
const projectedCost = (perPersonWorstCase.reduce((a, b) => a + b, 0) / Math.max(1, corpus.people.length)) * splitMisses;

process.stdout.write(`\nEXPERIMENT: split agents vs shared CareerBlueprint (${SPLIT_AGENT_VERSION})\n`);
process.stdout.write(`provider=${provider}  model=${model}  effort=${effort}\n`);
process.stdout.write(`family=${family}  people=${people}  jobs=${jobs.length}  matcher=agent-field-match (held fixed)\n\n`);
process.stdout.write(`ALREADY PAID FOR (cache hits, cost $0):\n`);
process.stdout.write(`  job blueprints    : ${jobHits}/${jobs.length}${jobHits === jobs.length ? "  (all reusable)" : "  <-- MISSES WOULD COST MONEY"}\n`);
process.stdout.write(`  shared baseline   : ${sharedHits}/${corpus.people.length}${sharedHits === corpus.people.length ? "  (all reusable)" : "  <-- MISSES WOULD COST MONEY"}\n`);
for (const row of splitCensus) {
  process.stdout.write(
    `  ${(row.variant + " / " + row.agent).padEnd(38)}: ${row.hits}/${corpus.people.length}` +
    `${row.hits === corpus.people.length ? "  (all reusable)" : row.hits === 0 ? "  (none cached)" : "  <-- PARTIAL: investigate drift"}\n`,
  );
}
process.stdout.write(`\nNEW CALLS REQUIRED:\n`);
process.stdout.write(`  split agents      : ${splitMisses}\n`);
const experienceMisses = splitCensus.filter((r) => r.agent === "experience").reduce((t, r) => t + r.misses, 0);
if (experienceMisses > 0) {
  process.stdout.write(
    `\n  STOP CONDITION: ${experienceMisses} Experience calls are cache MISSES. The Experience Agent\n` +
    `  prompt, schema, evidence and model configuration are unchanged in this revision, so every\n` +
    `  one should be a hit. A miss means configuration drift -- diagnose before paying again.\n`,
  );
}
process.stdout.write(`  projected WORST-CASE spend: $${projectedCost.toFixed(3)}\n`);
process.stdout.write(`\nBUDGET (dollar ceiling is the HARD control; calls are observability only):\n`);
process.stdout.write(`  cumulative spend  : $${ledger.spentUsd.toFixed(4)}\n`);
process.stdout.write(`  remaining         : $${ledger.remainingUsd().toFixed(3)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}\n`);
process.stdout.write(`  after this run    : $${(ledger.remainingUsd() - projectedCost).toFixed(3)} remaining, worst case\n`);
process.stdout.write(`  share of remaining: ${((projectedCost / Math.max(1e-9, ledger.remainingUsd())) * 100).toFixed(1)}%\n`);
process.stdout.write(`  calls made        : ${ledger.calls} (threshold ${RUNTIME_BUDGET_LIMITS.callObservabilityThreshold}${ledger.pastCallThreshold() ? ", CROSSED" : ""})\n`);
process.stdout.write(`\nCONFIGURATION under test:\n`);
process.stdout.write(`  prompts           : shared=${PERSON_BLUEPRINT_PROMPT.version} job=${JOB_BLUEPRINT_PROMPT.version} experience-agent=${EXPERIENCE_AGENT_PROMPT.version} direction-agent=${DIRECTION_AGENT_PROMPT.version}\n`);
process.stdout.write(`  schema version    : ${SPLIT_AGENT_VERSION} (matcher reads the same five role fields from every arm)\n`);
process.stdout.write(`  output allowance  : shared ${personMaxOutput}, split agents ${splitMaxOutput}, job ${jobMaxOutput}
                      (ceilings, include reasoning tokens; split needs more because it emits
                       ownership/depth/evidence per work item -- see the note in the script)\n`);
process.stdout.write(`\nUSER-FACING LATENCY (${LATENCY_VERSION}):\n`);
process.stdout.write(`  AFFECTED. The split arms make 2 person calls where shared makes 1, so the\n`);
process.stdout.write(`  critical path changes. Job interpretation is precomputed and is NOT user wait.\n`);
process.stdout.write(`  Fresh-call distributions come from the ${splitMisses} new calls; with 12 samples per\n`);
process.stdout.write(`  agent, p90/p95 are order statistics (stable needs >=${STABLE_PERCENTILE_MINIMUM}) and are labelled so.\n`);
process.stdout.write(`  The shared baseline is fully cached, so its fresh latency is reused from the\n`);
process.stdout.write(`  completed arm's recorded telemetry rather than re-measured.\n`);

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
  worstCaseCostUsd(model, r.prompt.render(r.input), splitMaxOutput);

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
// Kept so per-call latency can be reported per agent type, and so the raw rows survive into the
// artifact for a Pareto frontier later rather than being summarised away now.
const splitRecords: Awaited<ReturnType<InstrumentedRunner["run"]>>["record"][] = [];
const splitTelemetry: Record<string, ReturnType<InstrumentedRunner["telemetry"]>> = {};
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
    // Issued one at a time on purpose: a concurrent pair would contend and distort each
    // measurement, and clean per-call timing is what the parallel critical-path estimate needs.
    const experience = await experienceRunner.run(splitRequest(person.personId, variant.scope, "experience"));
    const direction = await directionRunner.run(splitRequest(person.personId, variant.scope, "direction"));
    let experienceOut: ExperienceAgentOutput | null = null;
    let directionOut: DirectionAgentOutput | null = null;
    try { experienceOut = JSON.parse(experience.text) as ExperienceAgentOutput; } catch { /* counted as empty */ }
    try { directionOut = JSON.parse(direction.text) as DirectionAgentOutput; } catch { /* counted as empty */ }
    built.set(person.personId, foldSplitOutputs(person.personId, experienceOut, directionOut));
    done += 1;
    if (done % 4 === 0 || done === corpus.people.length) process.stdout.write(`  ${variant.id} ${done}/${corpus.people.length}\n`);
  }
  blueprintsByArchitecture.set(variant.id, built);
  splitRecords.push(...experienceRunner.records, ...directionRunner.records);
  splitTelemetry[`${variant.id}:experience`] = experienceRunner.telemetry();
  splitTelemetry[`${variant.id}:direction`] = directionRunner.telemetry();
}

// ---- evaluate: same matcher for every architecture ---------------------------------------
const normalizerControl = oracleNormalizerArchitecture(
  (id) => CONCEPTS_BY_ID.get(id)?.neutralForms ?? [], IDENTITY_ROLES,
) as unknown as RankingArchitecture<never>;

const architectures = [...blueprintsByArchitecture.entries()].map(([id, blueprints]) =>
  createAgentFieldMatchArchitecture(blueprints, jobWork, id) as unknown as RankingArchitecture<never>,
);

// Deterministic local work on the user's critical path: assemble the blueprint, then score every
// job in the pool. Timed per person so it can be added to the model latency honestly rather than
// assumed negligible. This is CPU-local, with no network in it.
function measureDeterministicMsPerPerson(architecture: RankingArchitecture<never>): number {
  const started = process.hrtime.bigint();
  for (const person of corpus.people) {
    const prepared = architecture.prepare(person as never);
    for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
      for (const channel of CHANNELS) architecture.score(prepared, job as never, channel);
    }
  }
  return Number(process.hrtime.bigint() - started) / 1e6 / Math.max(1, corpus.people.length);
}

process.stdout.write(`\n================ ${family} (n=${people}), matcher held at agent-field-match ================\n`);
process.stdout.write(`NOTE: the split arms produce ${SPLIT_PRODUCED_CHANNELS.join(" and ")} only. Their PREFERENCE column is\n`);
process.stdout.write(`      NOT PRODUCED, not a regression -- Preference is a separate architectural question.\n`);
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

// ---- latency: what a real user would actually wait ---------------------------------------
const allSamples: CallLatencySample[] = [
  ...callSamples(jobRunner.records), ...callSamples(sharedRunner.records), ...callSamples(splitRecords),
];
const profile = agentLatencyProfile(allSamples);

process.stdout.write(`\nPER-CALL LATENCY (${LATENCY_VERSION}), fresh calls only\n`);
process.stdout.write(`${"agent".padEnd(20)}${"n".padStart(5)}${"mean".padStart(10)}${"p50".padStart(9)}${"p90".padStart(9)}${"p95".padStart(9)}${"max".padStart(9)}\n`);
for (const [agent, dist] of Object.entries(profile.freshByAgent)) {
  process.stdout.write(
    `${agent.padEnd(20)}${String(dist.n).padStart(5)}${dist.meanMs.toFixed(0).padStart(10)}${dist.p50Ms.toFixed(0).padStart(9)}` +
    `${dist.p90Ms.toFixed(0).padStart(9)}${dist.p95Ms.toFixed(0).padStart(9)}${dist.maxMs.toFixed(0).padStart(9)}` +
    `${dist.percentilesAreStable ? "" : "   <- p90/p95 are order statistics, not percentiles"}\n`,
  );
}
process.stdout.write(`cache-hit population (separate, never mixed in): n=${profile.cacheHit.n}, p50 ${profile.cacheHit.p50Ms.toFixed(1)}ms, max ${profile.cacheHit.maxMs.toFixed(1)}ms\n`);

// The shared baseline is fully cached here, so its FRESH latency cannot be re-measured. It is
// read from the completed arm's recorded telemetry instead of being silently reported as ~0ms.
const priorArmPath = `artifacts/agent_experiments/agent-vs-lexical-${provider}-${family.toLowerCase()}-n${people}.json`;
let sharedFresh = { p50Ms: 0, p95Ms: 0, source: "unavailable" };
if (existsSync(priorArmPath)) {
  const prior = JSON.parse(readFileSync(priorArmPath, "utf8")) as { telemetry?: { person?: { p50LatencyMs?: number; p95LatencyMs?: number } } };
  sharedFresh = {
    p50Ms: prior.telemetry?.person?.p50LatencyMs ?? 0,
    p95Ms: prior.telemetry?.person?.p95LatencyMs ?? 0,
    source: priorArmPath,
  };
}

const deterministicMs = measureDeterministicMsPerPerson(architectures[0]!);
const paths: CriticalPath[] = [];
paths.push(criticalPath({
  architecture: "shared",
  personAgents: [{ promptId: PERSON_BLUEPRINT_PROMPT.id, distribution: { n: people, meanMs: sharedFresh.p50Ms, p50Ms: sharedFresh.p50Ms, p90Ms: sharedFresh.p95Ms, p95Ms: sharedFresh.p95Ms, maxMs: sharedFresh.p95Ms, percentilesAreStable: false } }],
  agentsAreIndependent: false, // one call: nothing to parallelise
  deterministicMs,
}));
// Latency now comes from the cache entries themselves, so a fully-replayed agent is still
// reportable. Deliberately NO fallback to a different prompt generation: substituting v1's slower
// Direction latency for v2's would misreport the architecture under test, and a stated gap is
// better than a confident wrong number.
// Per-subject durations, so the parallel estimate pairs each person's own calls rather than
// taking a maximum of separately-aggregated percentiles.
const perSubject = (() => {
  const bySubject = new Map<string, Record<string, number>>();
  for (const sample of allSamples) {
    const duration = sample.cacheHit ? sample.originalLatencyMs : sample.latencyMs;
    if (!sample.subjectId || duration === null) continue;
    const row = bySubject.get(sample.subjectId) ?? {};
    row[sample.promptId] = duration;
    bySubject.set(sample.subjectId, row);
  }
  return [...bySubject.entries()].map(([subjectId, byAgent]) => ({ subjectId, byAgent }));
})();

for (const variant of VARIANTS) {
  const experience = profile.freshByAgent[EXPERIENCE_AGENT_PROMPT.id];
  const direction = profile.freshByAgent[DIRECTION_AGENT_PROMPT.id];
  if (!experience || !direction) {
    process.stdout.write(
      `  ${variant.id}: latency unavailable — ${!experience ? "experience" : "direction"} agent has no ` +
      `recorded duration (cache entry predates latency persistence). Re-run after the cache carries it.\n`,
    );
    continue;
  }
  paths.push(criticalPath({
    architecture: variant.id,
    personAgents: [
      { promptId: EXPERIENCE_AGENT_PROMPT.id, distribution: experience },
      { promptId: DIRECTION_AGENT_PROMPT.id, distribution: direction },
    ],
    // Experience and Direction read the same evidence and write different channels, so they are
    // independent by the four-channel contract and could be issued concurrently.
    agentsAreIndependent: true,
    deterministicMs,
    perSubject,
  }));
}

process.stdout.write(`\nEND-USER CRITICAL PATH — evidence submitted to first usable recommendations\n`);
process.stdout.write(`(job interpretation EXCLUDED: precomputed per job, amortised, never user wait)\n`);
process.stdout.write(`deterministic assembly + retrieval + ranking: ${deterministicMs.toFixed(1)}ms per person, measured locally\n\n`);
process.stdout.write(`${"architecture".padEnd(20)}${"agents".padStart(7)}${"seq p50".padStart(10)}${"seq p95".padStart(10)}${"par p50*".padStart(10)}${"par p95*".padStart(10)}${"TTFR p50".padStart(11)}${"TTFR p95".padStart(11)}\n`);
for (const path of paths) {
  process.stdout.write(
    `${path.architecture.padEnd(20)}${String(path.agentCount).padStart(7)}` +
    `${(path.sequentialUserWaitP50Ms / 1000).toFixed(1).padStart(9)}s${(path.sequentialUserWaitP95Ms / 1000).toFixed(1).padStart(9)}s` +
    `${(path.estimatedParallelP50Ms / 1000).toFixed(1).padStart(9)}s${(path.estimatedParallelP95Ms / 1000).toFixed(1).padStart(9)}s` +
    `${(path.timeToFirstUsableResultP50Ms / 1000).toFixed(1).padStart(10)}s${(path.timeToFirstUsableResultP95Ms / 1000).toFixed(1).padStart(10)}s\n`,
  );
}
process.stdout.write(`\n* parallel figures are DERIVED from calls timed one at a time. They exclude the contention a\n`);
process.stdout.write(`  concurrent implementation would add, so they are a LOWER BOUND on parallel user wait.\n`);
process.stdout.write(`  TTFR = time to first usable result = parallel agents + deterministic work.\n`);

// Quality against added wait, reported as an exchange rate rather than a blended score: pricing
// NDCG points in seconds is a product judgement, not a measurement.
const trades: Record<string, unknown> = {};
const sharedPath = paths.find((p) => p.architecture === "shared")!;
for (const path of paths.filter((p) => p.architecture !== "shared")) {
  const qualityDelta = (results.get(`${path.architecture}:direction`)?.meanNdcg10 ?? 0) - (results.get("shared:direction")?.meanNdcg10 ?? 0);
  trades[path.architecture] = latencyQualityTrade(qualityDelta, sharedPath.timeToFirstUsableResultP50Ms, path.timeToFirstUsableResultP50Ms);
}
process.stdout.write(`\nQUALITY vs ADDED WAIT (direction channel, at p50 TTFR):\n`);
for (const [id, trade] of Object.entries(trades)) {
  const t = trade as { qualityDelta: number; addedWaitMs: number; dominates: boolean };
  process.stdout.write(
    `  ${id.padEnd(20)} Δndcg=${t.qualityDelta >= 0 ? "+" : ""}${t.qualityDelta.toFixed(3)}  ` +
    `added wait ${(t.addedWaitMs / 1000).toFixed(1)}s  ${t.dominates ? "DOMINATES (better and no slower)" : ""}\n`,
  );
}

const telemetry = {
  job: jobRunner.telemetry(), shared: sharedRunner.telemetry(), split: splitTelemetry,
};
process.stdout.write(`\ncost:\n`);
process.stdout.write(`  reused from cache : ${telemetry.job.cacheHits + telemetry.shared.cacheHits} calls at $0\n`);
process.stdout.write(`  fresh calls made  : ${profile.freshCalls}\n`);
process.stdout.write(`  budget now        : $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd} (HARD), ${ledger.calls} calls\n`);

mkdirSync("artifacts/agent_experiments", { recursive: true });
// The Direction prompt generation is in the filename. Without it, a v2 run overwrites the v1
// artifact -- which it did once, and only git made the v1 latency recoverable.
const outputPath = `artifacts/agent_experiments/split-agents-${provider}-${family.toLowerCase()}-n${people}-direction-${DIRECTION_AGENT_PROMPT.version}.json`;
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
  latency: {
    version: LATENCY_VERSION,
    stablePercentileMinimum: STABLE_PERCENTILE_MINIMUM,
    freshByAgent: profile.freshByAgent,
    cacheHitPopulation: profile.cacheHit,
    freshCalls: profile.freshCalls,
    cachedCalls: profile.cachedCalls,
    deterministicMsPerPerson: deterministicMs,
    sharedBaselineFreshLatency: sharedFresh,
    replayedAgents: profile.replayedAgents,
    criticalPaths: paths,
    qualityVsWait: trades,
    // Raw per-call rows, deliberately unsummarised, so a Pareto frontier can be built later from
    // measurements rather than from remembered timings.
    rawCalls: allSamples,
    notes: [
      "Job interpretation is excluded from user wait: JobBlueprints are precomputed per job and amortised across every user.",
      "Distributions cover FRESH calls only; cache hits are a separate population because mixing them reports a p50 of ~0ms.",
      "Parallel critical-path figures are DERIVED from calls timed individually and exclude concurrency contention, so they are a lower bound.",
      `p90/p95 are single order statistics below ${STABLE_PERCENTILE_MINIMUM} samples and are not percentile estimates.`,
      "Model compute, network round trip and provider queueing are reported together; the API exposes no server-side timing to separate them.",
    ],
  },
  budgetAfter: { spentUsd: ledger.spentUsd, calls: ledger.calls, hardSpendCapUsd: RUNTIME_BUDGET_LIMITS.maxSpendUsd },
}, null, 2) + "\n");
process.stdout.write(`\nwrote ${outputPath}\n`);
