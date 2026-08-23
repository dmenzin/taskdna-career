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
import { existsSync, readFileSync } from "node:fs";
import { cacheKeyFor, type ModelRequest } from "../src/agent/runtime";
import {
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_PROMPT_V2,
  PERSON_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_SCHEMA_V2,
  AGENT_ARCHITECTURE_VERSION,
} from "../src/agent/agentArchitecture";
import { ATTRIBUTION_FLOOR, AMBIGUITY_MARGIN, PROVENANCE_VERSION } from "../src/agent/provenance";
import { assertPreregistered } from "../src/agent/experimentRegistry";
import { RuntimeBudgetLedger, RUNTIME_BUDGET_LIMITS, worstCaseCostUsd } from "../src/agent/budget";
import {
  armCachePath,
  buildProvider,
  CANONICAL_EFFORT,
  defaultModelFor,
  type ProviderName,
} from "../src/agent/providerRegistry";
import { allFrameJobs, buildFrameCorpus } from "../src/bench/frameCorpus";
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
  outputSchema: PERSON_BLUEPRINT_SCHEMA_V2 as unknown as Record<string, unknown>, schemaName: "career_blueprint_v2",
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

const loadCache = (path: string): Record<string, unknown> =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown> : {};

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

if (dryRun) {
  process.stdout.write(`\n--dry-run: nothing was sent to the provider.\n`);
  process.exit(0);
}

process.stderr.write(`\nPaid execution is not authorized in this session. Re-run with --dry-run only.\n`);
process.exit(2);
