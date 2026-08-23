// P-01: can the shared CareerBlueprint become auditable by adding per-item evidence?
//
// MINIMAL CHANGE
//   current shared CareerBlueprint + current field matcher + frozen LEXICAL_TRAP DEVELOPMENT
//   + same provider/model/effort. The only new thing is a required supporting phrase per
//   work item on person-blueprint@v2. stripProvenance runs before matching. All JobBlueprints
//   are reused from the v1 job cache.
//
// `--dry-run` is mandatory before spend. This script will not contact the provider when that
// flag is set. Missing job-cache reuse is a stop condition.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { InstrumentedRunner, cacheKeyFor, type ModelRequest } from "../src/agent/runtime";
import {
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_PROMPT_V2,
  PERSON_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_SCHEMA_V2,
  AGENT_ARCHITECTURE_VERSION,
  createAgentFieldMatchArchitecture,
  stripProvenance,
  type CareerBlueprint,
  type CareerBlueprintV2,
  type StructuredWork,
} from "../src/agent/agentArchitecture";
import { ATTRIBUTION_FLOOR, AMBIGUITY_MARGIN, PROVENANCE_VERSION } from "../src/agent/provenance";
import { provenanceForBlueprint, sweepProvenanceThresholds } from "../src/agent/provenanceSensitivity";
import { channelIntegrityFor, channelVolumes, summarizeIntegrity } from "../src/agent/channelIntegrity";
import { assertPreregistered } from "../src/agent/experimentRegistry";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, worstCaseCostUsd } from "../src/agent/budget";
import {
  armCachePath,
  buildProvider,
  CANONICAL_EFFORT,
  checkArmReadiness,
  defaultModelFor,
  type ProviderName,
} from "../src/agent/providerRegistry";
import {
  agentLatencyProfile,
  callSamples,
  criticalPath,
  LATENCY_VERSION,
  STABLE_PERCENTILE_MINIMUM,
} from "../src/agent/latency";
import { allFrameJobs, buildFrameCorpus } from "../src/bench/frameCorpus";
import { evaluateArchitecture, pairedDifference, CHANNELS } from "../src/bench/frameEvaluation";
import { experienceLexicalArchitecture, type RankingArchitecture } from "../src/bench/architectures";
import type { RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const people = Number(arg("people", "12"));
const family = arg("family", "LEXICAL_TRAP") as RenderFamily;
const provider = arg("provider", "openai") as ProviderName;
const model = arg("model", defaultModelFor(provider));
const effort = arg("effort", CANONICAL_EFFORT);
const dryRun = process.argv.includes("--dry-run");
const experimentId = `person-blueprint-v2:${provider}:${family}:${effort}`;
assertPreregistered(experimentId);

// v1 person/job allowances are the ones the paid LEXICAL_TRAP arm used. v2 person gets a
// higher CEILING because it emits a quote per item; this is not a quality knob.
const baselinePersonMaxOutput = Number(arg("baseline-person-max-output", "1800"));
const jobMaxOutput = Number(arg("job-max-output", "700"));
const v2PersonMaxOutput = Number(arg("v2-person-max-output", "2400"));

const corpus = buildFrameCorpus({ people, split: "DEVELOPMENT", family });
const jobs = allFrameJobs(corpus);

const personInput = (personId: string) => {
  const person = corpus.people.find((entry) => entry.personId === personId)!;
  return {
    experience: person.experienceEvidence.map((e) => e.text).join("\n"),
    liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
    disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
    desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
  };
};

const baselinePersonProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: baselinePersonMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "career_blueprint",
});
const v2PersonProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: v2PersonMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA_V2 as unknown as Record<string, unknown>,
  schemaName: "career_blueprint_v2",
  schemaVersion: "person-blueprint.v2",
});
const jobProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: jobMaxOutput,
  outputSchema: JOB_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "job_blueprint",
});

const baselinePersonRequest = (personId: string): ModelRequest => ({
  prompt: PERSON_BLUEPRINT_PROMPT,
  input: personInput(personId),
  decoding: { temperature: 0, maxOutputTokens: baselinePersonMaxOutput },
  subjectId: personId,
});
const v2PersonRequest = (personId: string): ModelRequest => ({
  prompt: PERSON_BLUEPRINT_PROMPT_V2,
  input: personInput(personId),
  decoding: { temperature: 0, maxOutputTokens: v2PersonMaxOutput },
  subjectId: personId,
});
const jobRequest = (job: { jobId: string; responsibilities: { text: string }[] }): ModelRequest => ({
  prompt: JOB_BLUEPRINT_PROMPT,
  input: { responsibilities: job.responsibilities.map((r) => r.text).join("\n") },
  decoding: { temperature: 0, maxOutputTokens: jobMaxOutput },
});

const loadCache = (path: string): Record<string, { text?: string }> =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, { text?: string }> : {};

const parseBlueprint = (text: string, personId: string): CareerBlueprint => {
  try {
    const parsed = JSON.parse(text) as Partial<CareerBlueprint>;
    return {
      personId,
      experience: parsed.experience ?? [],
      liked: parsed.liked ?? [],
      disliked: parsed.disliked ?? [],
      desired: parsed.desired ?? [],
    };
  } catch {
    return { personId, experience: [], liked: [], disliked: [], desired: [] };
  }
};
const parseBlueprintV2 = (text: string, personId: string): CareerBlueprintV2 => {
  try {
    const parsed = JSON.parse(text) as Partial<CareerBlueprintV2>;
    return {
      personId,
      experience: parsed.experience ?? [],
      liked: parsed.liked ?? [],
      disliked: parsed.disliked ?? [],
      desired: parsed.desired ?? [],
    };
  } catch {
    return { personId, experience: [], liked: [], disliked: [], desired: [] };
  }
};
const parseJob = (text: string): StructuredWork[] => {
  try {
    return (JSON.parse(text) as { responsibilities?: StructuredWork[] }).responsibilities ?? [];
  } catch {
    return [];
  }
};

const jobCachePath = armCachePath({ provider, model, effort, family, kind: "job" });
const baselinePersonCachePath = armCachePath({ provider, model, effort, family, kind: "person" });
const v2PersonCachePath = armCachePath({
  provider, model, effort, family, kind: "person", promptVersion: PERSON_BLUEPRINT_PROMPT_V2.version,
});
const jobCache = loadCache(jobCachePath);
const baselinePersonCache = loadCache(baselinePersonCachePath);
const v2PersonCache = loadCache(v2PersonCachePath);

const jobHits = jobs.filter((job) => jobCache[cacheKeyFor(jobProvider, jobRequest(job))]).length;
const baselineHits = corpus.people.filter((person) => baselinePersonCache[cacheKeyFor(baselinePersonProvider, baselinePersonRequest(person.personId))]).length;
const v2Hits = corpus.people.filter((person) => v2PersonCache[cacheKeyFor(v2PersonProvider, v2PersonRequest(person.personId))]).length;
const v2Fresh = corpus.people.length - v2Hits;
const jobMisses = jobs.length - jobHits;

const v2WorstCase = corpus.people.reduce(
  (total, person) => total + worstCaseCostUsd(model, PERSON_BLUEPRINT_PROMPT_V2.render(personInput(person.personId)), v2PersonMaxOutput),
  0,
);
const projectedCost = (v2WorstCase / Math.max(1, corpus.people.length)) * v2Fresh;
const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");

process.stdout.write(`\nP-01 DRY CENSUS  person-blueprint@v2 + frozen agent-field-match\n`);
process.stdout.write(`experiment=${experimentId}\n`);
process.stdout.write(`provider=${provider} model=${model} effort=${effort}\n`);
process.stdout.write(`family=${family} people=${people} jobs=${jobs.length} split=DEVELOPMENT\n\n`);
process.stdout.write(`ALREADY PAID FOR (cache hits, cost $0):\n`);
process.stdout.write(`  job blueprints @v1     : ${jobHits}/${jobs.length}${jobHits === jobs.length ? "  (all reusable)" : "  <-- STOP: job misses would re-bill the corpus"}\n`);
process.stdout.write(`  shared baseline @v1    : ${baselineHits}/${corpus.people.length}${baselineHits === corpus.people.length ? "  (paired comparison ready)" : "  <-- baseline incomplete"}\n`);
process.stdout.write(`  person-blueprint @v2   : ${v2Hits}/${corpus.people.length}${v2Hits === 0 ? "  (none cached; expected before first paid run)" : ""}\n`);
process.stdout.write(`\nNEW CALLS REQUIRED:\n`);
process.stdout.write(`  fresh person @v2       : ${v2Fresh}\n`);
process.stdout.write(`  fresh jobs             : ${jobMisses}\n`);
process.stdout.write(`  projected WORST-CASE   : $${projectedCost.toFixed(3)}\n`);
process.stdout.write(`\nBUDGET:\n`);
process.stdout.write(`  cumulative spend       : $${ledger.spentUsd.toFixed(4)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}\n`);
process.stdout.write(`  remaining              : $${ledger.remainingUsd().toFixed(3)}\n`);
process.stdout.write(`  after this run (worst) : $${(ledger.remainingUsd() - projectedCost).toFixed(3)}\n`);
process.stdout.write(`  share of remaining     : ${((projectedCost / Math.max(1e-9, ledger.remainingUsd())) * 100).toFixed(1)}%\n`);
process.stdout.write(`\nCONFIGURATION:\n`);
process.stdout.write(`  prompts                : person v1=${PERSON_BLUEPRINT_PROMPT.version} person v2=${PERSON_BLUEPRINT_PROMPT_V2.version} job=${JOB_BLUEPRINT_PROMPT.version}\n`);
process.stdout.write(`  schemas                : v1=${AGENT_ARCHITECTURE_VERSION} v2=person-blueprint.v2 (evidence required)\n`);
process.stdout.write(`  matcher                : agent-field-match, all five fields, FROZEN (R-01 diagnostic only)\n`);
process.stdout.write(`  provenance             : stripped before matching; scored with ${PROVENANCE_VERSION}\n`);
process.stdout.write(`  output allowance       : v2 person ${v2PersonMaxOutput} (ceiling), job ${jobMaxOutput}, baseline person ${baselinePersonMaxOutput}\n`);
process.stdout.write(`  schema hashes          : v2 person=${v2PersonProvider.schemaHash} job=${jobProvider.schemaHash}\n`);
process.stdout.write(`\nUSER-FACING LATENCY:\n`);
process.stdout.write(`  Still one person call on the critical path. Jobs stay precomputed.\n`);
process.stdout.write(`  Expected small increase in output tokens from the evidence field.\n`);
process.stdout.write(`  Measure v2 fresh person latency against v1 originalLatencyMs after the paid run.\n`);
process.stdout.write(`  Do not treat this dry run's 0ms cache lookups as user wait.\n`);
process.stdout.write(`\nPROVENANCE-THRESHOLD SENSITIVITY PLAN (T-01, zero extra calls):\n`);
process.stdout.write(`  After the paid run, sweep ATTRIBUTION_FLOOR around ${ATTRIBUTION_FLOOR} (0.40–0.80)\n`);
process.stdout.write(`  and AMBIGUITY_MARGIN around ${AMBIGUITY_MARGIN} (0.05–0.20) over the new quotes.\n`);
process.stdout.write(`  KEEP/REJECT for P-01 uses the preregistered 0.6 / 0.1 pair; the sweep is reported,\n`);
process.stdout.write(`  not used to pick a friendlier threshold.\n`);

if (jobMisses > 0) {
  process.stderr.write(`\nSTOP CONDITION: ${jobMisses} job cache misses. Diagnose before any paid call.\n`);
  process.exit(1);
}
if (baselineHits < corpus.people.length) {
  process.stderr.write(`\nSTOP CONDITION: v1 baseline is incomplete. The paired comparison would be invalid.\n`);
  process.exit(1);
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

const projectedFor = (r: { prompt: { render: (i: Record<string, unknown>) => string }; input: Record<string, unknown> }) =>
  worstCaseCostUsd(model, r.prompt.render(r.input), v2PersonMaxOutput);

const jobRunner = new InstrumentedRunner(jobProvider, { experimentId, cachePath: jobCachePath, budget: ledger, projectedCostUsd: projectedFor });
const jobWork = new Map<string, StructuredWork[]>();
for (const job of jobs) {
  const { text } = await jobRunner.run(jobRequest(job));
  jobWork.set(job.jobId, parseJob(text));
}

const baselineRunner = new InstrumentedRunner(baselinePersonProvider, {
  experimentId, cachePath: baselinePersonCachePath, budget: ledger, projectedCostUsd: projectedFor,
});
const v1Blueprints = new Map<string, CareerBlueprint>();
for (const person of corpus.people) {
  const { text } = await baselineRunner.run(baselinePersonRequest(person.personId));
  v1Blueprints.set(person.personId, parseBlueprint(text, person.personId));
}

process.stdout.write(`\ninterpreting person-blueprint@v2...\n`);
const v2Runner = new InstrumentedRunner(v2PersonProvider, {
  experimentId, cachePath: v2PersonCachePath, budget: ledger, projectedCostUsd: projectedFor,
});
const v2Blueprints = new Map<string, CareerBlueprintV2>();
let done = 0;
for (const person of corpus.people) {
  const { text } = await v2Runner.run(v2PersonRequest(person.personId));
  v2Blueprints.set(person.personId, parseBlueprintV2(text, person.personId));
  done += 1;
  process.stdout.write(`  person ${done}/${corpus.people.length}\n`);
}
const stripped = new Map<string, CareerBlueprint>(
  [...v2Blueprints.entries()].map(([id, blueprint]) => [id, stripProvenance(blueprint)]),
);

const architectures = [
  createAgentFieldMatchArchitecture(v1Blueprints, jobWork, "person-blueprint-v1"),
  createAgentFieldMatchArchitecture(stripped, jobWork, "person-blueprint-v2"),
].map((architecture) => architecture as unknown as RankingArchitecture<never>);

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
process.stdout.write(`${"architecture".padEnd(24)}${CHANNELS.map((c) => c.padStart(14)).join("")}\n`);
const results = new Map<string, ReturnType<typeof evaluateArchitecture>>();
for (const architecture of [experienceLexicalArchitecture as unknown as RankingArchitecture<never>, ...architectures]) {
  const cells: string[] = [];
  for (const channel of CHANNELS) {
    const result = evaluateArchitecture(architecture, corpus, channel, 10);
    results.set(`${architecture.id}:${channel}`, result);
    cells.push((result.meanNdcg10 ?? NaN).toFixed(3).padStart(14));
  }
  process.stdout.write(`${architecture.id.padEnd(24)}${cells.join("")}\n`);
}

const comparisons: unknown[] = [];
process.stdout.write(`\npaired person-blueprint-v2 vs v1 (95% bootstrap CI over persons):\n`);
for (const channel of CHANNELS) {
  const diff = pairedDifference(results.get(`person-blueprint-v2:${channel}`)!, results.get(`person-blueprint-v1:${channel}`)!);
  const verdict = diff.significant ? (diff.meanDifference > 0 ? "BETTER" : "WORSE") : "INCONCLUSIVE";
  process.stdout.write(
    `  ${channel.padEnd(12)} Δ=${diff.meanDifference >= 0 ? "+" : ""}${diff.meanDifference.toFixed(3)}` +
    `  CI [${diff.ci95.low.toFixed(3)}, ${diff.ci95.high.toFixed(3)}]  n=${diff.pairedN}  ${verdict}\n`,
  );
  comparisons.push({ ...diff });
}

const defaultProvenance = Object.fromEntries(
  corpus.people.map((person) => [person.personId, provenanceForBlueprint(person, v2Blueprints.get(person.personId)!)]),
);
const mergeChannel = (key: "experience" | "liked" | "disliked" | "desired") => {
  const rows = corpus.people.map((person) => defaultProvenance[person.personId]![key]!);
  const claims = rows.reduce((n, row) => n + row.claims, 0);
  const contamination = rows.reduce((n, row) => n + row.evidenceContamination, 0);
  const unsupported = rows.reduce((n, row) => n + row.unsupportedClaims, 0);
  const ambiguous = rows.reduce((n, row) => n + row.ambiguousProvenance, 0);
  return {
    claims,
    contaminationRate: claims ? contamination / claims : 0,
    unsupportedClaimRate: claims ? unsupported / claims : 0,
    ambiguousRate: claims ? ambiguous / claims : 0,
    keep: (claims ? contamination / claims : 0) <= 0.05,
  };
};
const provenanceByChannel = {
  experience: mergeChannel("experience"),
  liked: mergeChannel("liked"),
  disliked: mergeChannel("disliked"),
  desired: mergeChannel("desired"),
};
process.stdout.write(`\nPROVENANCE (${PROVENANCE_VERSION}, floor=${ATTRIBUTION_FLOOR}, margin=${AMBIGUITY_MARGIN})\n`);
for (const [channel, row] of Object.entries(provenanceByChannel)) {
  process.stdout.write(
    `  ${channel.padEnd(12)} claims=${String(row.claims).padStart(4)}  contamination=${row.contaminationRate.toFixed(3)}` +
    `  unsupported=${row.unsupportedClaimRate.toFixed(3)}  ambiguous=${row.ambiguousRate.toFixed(3)}  ${row.keep ? "KEEP" : "OVER CEILING"}\n`,
  );
}

const volumes = corpus.people.map((person) => channelVolumes(person, stripped.get(person.personId)!));
const meanRatio = (key: "experience" | "liked" | "disliked" | "desired") =>
  volumes.reduce((n, row) => n + row[key].ratio, 0) / Math.max(1, volumes.length);
process.stdout.write(`\nCHANNEL VOLUME (interpreted / planted)\n`);
process.stdout.write(`  experience ${meanRatio("experience").toFixed(3)}  liked ${meanRatio("liked").toFixed(3)}  disliked ${meanRatio("disliked").toFixed(3)}  desired ${meanRatio("desired").toFixed(3)}\n`);

const integrityRows = corpus.people.map((person) => channelIntegrityFor(person, stripped.get(person.personId)!));
const integrity = summarizeIntegrity(integrityRows);

const sensitivity = sweepProvenanceThresholds(corpus.people, v2Blueprints);
process.stdout.write(`\nT-01 THRESHOLD SENSITIVITY (${sensitivity.cells.length} pairs; default keep=${JSON.stringify(sensitivity.defaultKeeps)})\n`);
process.stdout.write(`  architectural KEEP set ${sensitivity.conclusionFlips ? "FLIPS" : "is STABLE"} across the sweep\n`);
process.stdout.write(`  Thresholds remain research parameters, not a post-hoc product gate.\n`);

const experienceDiff = comparisons.find((row) => (row as { channel: string }).channel === "experience") as {
  meanDifference: number; ci95: { low: number; high: number }; significant: boolean;
};
const retrievalRegressed = experienceDiff.significant && experienceDiff.meanDifference < 0;
const retrievalHolds = !retrievalRegressed;
const provenanceClean = Object.values(provenanceByChannel).every((row) => row.keep);
const p01Case = retrievalRegressed ? "C" : retrievalHolds && provenanceClean ? "A" : retrievalHolds && !provenanceClean ? "B" : "D";
const p01Result = retrievalRegressed ? "REJECTED" : retrievalHolds && provenanceClean ? "SUPPORTED" : "INCONCLUSIVE";
process.stdout.write(`\nP-01 DECISION  case=${p01Case}  result=${p01Result}\n`);

const profile = agentLatencyProfile([...callSamples(jobRunner.records), ...callSamples(baselineRunner.records), ...callSamples(v2Runner.records)]);
const v2FreshDist = profile.freshByAgent[PERSON_BLUEPRINT_PROMPT_V2.id];
const deterministicMs = measureDeterministicMsPerPerson(architectures[1]!);
const v2Path = criticalPath({
  architecture: "person-blueprint-v2",
  personAgents: v2FreshDist
    ? [{ promptId: PERSON_BLUEPRINT_PROMPT_V2.id, distribution: v2FreshDist }]
    : [],
  agentsAreIndependent: false,
  deterministicMs,
});

process.stdout.write(`\nUSER-FACING LATENCY (${LATENCY_VERSION})\n`);
if (v2FreshDist) {
  process.stdout.write(
    `  fresh person@v2 n=${v2FreshDist.n} p50=${(v2FreshDist.p50Ms / 1000).toFixed(1)}s` +
    ` p95=${(v2FreshDist.p95Ms / 1000).toFixed(1)}s` +
    `${v2FreshDist.percentilesAreStable ? "" : `  (p90/p95 are order statistics; stable needs >=${STABLE_PERCENTILE_MINIMUM})`}\n`,
  );
} else {
  process.stdout.write(`  no fresh v2 calls — this was a cache replay\n`);
}
process.stdout.write(`  deterministic downstream ${deterministicMs.toFixed(1)}ms/person\n`);
process.stdout.write(`  TTFR p50 ${(v2Path.timeToFirstUsableResultP50Ms / 1000).toFixed(1)}s\n`);
process.stdout.write(`\ncost: fresh=${profile.freshCalls}  budget now $${ledger.spentUsd.toFixed(4)} / $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}\n`);

mkdirSync("artifacts/eval", { recursive: true });
mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/eval/person-blueprint-v2-${provider}-${family}-low.json`;
const artifact = {
  experiment: "P-01",
  experimentId,
  family,
  people,
  provider,
  requestedModel: model,
  reasoning: effort,
  promptVersions: { personV1: PERSON_BLUEPRINT_PROMPT.version, personV2: PERSON_BLUEPRINT_PROMPT_V2.version, job: JOB_BLUEPRINT_PROMPT.version },
  schema: "person-blueprint.v2",
  matcher: "agent-field-match",
  matcherPolicy: "frozen; R-01 diagnostic only",
  stripProvenanceBeforeMatch: true,
  scores: [...results.entries()].map(([key, value]) => ({
    key,
    ndcg10: value.meanNdcg10,
    recall10: value.meanRecall10,
    surprising: value.meanSurprisingRecall10,
  })),
  comparisons,
  provenance: { version: PROVENANCE_VERSION, floor: ATTRIBUTION_FLOOR, margin: AMBIGUITY_MARGIN, byChannel: provenanceByChannel, perPerson: defaultProvenance },
  volumes: { meanRatio: { experience: meanRatio("experience"), liked: meanRatio("liked"), disliked: meanRatio("disliked"), desired: meanRatio("desired") }, perPerson: volumes },
  integrity,
  decision: { case: p01Case, result: p01Result, retrievalHolds, provenanceClean, retrievalRegressed },
  blueprintsV2: Object.fromEntries(v2Blueprints),
  telemetry: { job: jobRunner.telemetry(), baseline: baselineRunner.telemetry(), v2: v2Runner.telemetry() },
  latency: {
    version: LATENCY_VERSION,
    freshByAgent: profile.freshByAgent,
    cacheHitPopulation: profile.cacheHit,
    freshCalls: profile.freshCalls,
    cachedCalls: profile.cachedCalls,
    deterministicMsPerPerson: deterministicMs,
    criticalPath: v2Path,
  },
  budgetAfter: { spentUsd: ledger.spentUsd, calls: ledger.calls, hardSpendCapUsd: RUNTIME_BUDGET_LIMITS.maxSpendUsd },
};
writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + "\n");
writeFileSync(`artifacts/agent_experiments/person-blueprint-v2-${provider}-${family.toLowerCase()}-n${people}.json`, JSON.stringify(artifact, null, 2) + "\n");

const sensitivityPath = "artifacts/eval/p01-threshold-sensitivity.json";
writeFileSync(sensitivityPath, JSON.stringify({
  experiment: "T-01",
  source: outputPath,
  floors: [...new Set(sensitivity.cells.map((c) => c.floor))],
  margins: [...new Set(sensitivity.cells.map((c) => c.margin))],
  defaultKeeps: sensitivity.defaultKeeps,
  conclusionFlips: sensitivity.conclusionFlips,
  cells: sensitivity.cells,
}, null, 2) + "\n");
process.stdout.write(`\nwrote ${outputPath}\nwrote ${sensitivityPath}\n`);
