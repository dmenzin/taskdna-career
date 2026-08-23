// S-01: exact-repeat stochastic stability of person-blueprint@v2.
//
// Same person, evidence, prompt, schema, provider, model, effort, matcher.
// Multiple independent fresh generations. trialId is experiment identity only —
// it is not rendered into the prompt. No cache reuse across trials.
//
// Sample size: 12 DEVELOPMENT people × 4 trials = 48 fresh person calls.
// Why 4, not 3: P-01's Direction point estimate was −0.062 with a CI that spans
// zero. Three trials is conventional; four is the smallest N that can show a
// 3-to-1 sign majority on that near-zero delta. Person-sample power stays n=12
// (POW-01); trials reduce generation variance, not person-sampling variance.
//
// `--dry-run` is mandatory. Paid execution is not authorized in this session.
import { existsSync, readFileSync } from "node:fs";
import { cacheKeyFor, type ModelRequest } from "../src/agent/runtime";
import {
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT_V2,
  PERSON_BLUEPRINT_SCHEMA_V2,
} from "../src/agent/agentArchitecture";
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
const trials = Number(arg("trials", "4"));
const family = arg("family", "LEXICAL_TRAP") as RenderFamily;
const provider = arg("provider", "openai") as ProviderName;
const model = arg("model", defaultModelFor(provider));
const effort = arg("effort", CANONICAL_EFFORT);
const dryRun = process.argv.includes("--dry-run");
const experimentId = `stochastic-stability:${provider}:${family}:${effort}`;
assertPreregistered(experimentId);

const v2PersonMaxOutput = Number(arg("v2-person-max-output", "2400"));
const jobMaxOutput = Number(arg("job-max-output", "700"));
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

const v2PersonRequest = (personId: string, trialId: string): ModelRequest => ({
  prompt: PERSON_BLUEPRINT_PROMPT_V2,
  input: personInput(personId),
  decoding: { temperature: 0, maxOutputTokens: v2PersonMaxOutput },
  subjectId: personId,
  trialId,
});
const jobRequest = (job: { jobId: string; responsibilities: { text: string }[] }): ModelRequest => ({
  prompt: JOB_BLUEPRINT_PROMPT,
  input: { responsibilities: job.responsibilities.map((r) => r.text).join("\n") },
  decoding: { temperature: 0, maxOutputTokens: jobMaxOutput },
});

const loadCache = (path: string): Record<string, unknown> =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown> : {};

const jobCachePath = armCachePath({ provider, model, effort, family, kind: "job" });
const jobCache = loadCache(jobCachePath);
const jobHits = jobs.filter((job) => jobCache[cacheKeyFor(jobProvider, jobRequest(job))]).length;

let personHits = 0;
let personFresh = 0;
for (let trial = 1; trial <= trials; trial += 1) {
  const trialId = `t${trial}`;
  const cachePath = armCachePath({
    provider, model, effort, family, kind: "person", promptVersion: `${PERSON_BLUEPRINT_PROMPT_V2.version}-${trialId}`,
  });
  const cache = loadCache(cachePath);
  for (const person of corpus.people) {
    if (cache[cacheKeyFor(v2PersonProvider, v2PersonRequest(person.personId, trialId))]) personHits += 1;
    else personFresh += 1;
  }
}

const perPersonWorst = corpus.people.reduce(
  (total, person) => total + worstCaseCostUsd(model, PERSON_BLUEPRINT_PROMPT_V2.render(personInput(person.personId)), v2PersonMaxOutput),
  0,
) / Math.max(1, corpus.people.length);
const projectedCost = perPersonWorst * personFresh;
const ledger = new RuntimeBudgetLedger("artifacts/agent_runtime/budget-ledger.json");

process.stdout.write(`\nS-01 DRY CENSUS  exact-repeat stochastic stability\n`);
process.stdout.write(`experiment=${experimentId}\n`);
process.stdout.write(`provider=${provider} model=${model} effort=${effort}\n`);
process.stdout.write(`family=${family} people=${people} trials=${trials} jobs=${jobs.length} split=DEVELOPMENT\n`);
process.stdout.write(`trialId is cache identity only; the rendered prompt is identical across trials.\n\n`);
process.stdout.write(`ALREADY PAID FOR:\n`);
process.stdout.write(`  job blueprints @v1 : ${jobHits}/${jobs.length}${jobHits === jobs.length ? "  (all reusable)" : "  <-- STOP"}\n`);
process.stdout.write(`  person@v2 trials   : ${personHits}/${people * trials} hits, ${personFresh} fresh\n`);
process.stdout.write(`\nNEW CALLS REQUIRED:\n`);
process.stdout.write(`  fresh person @v2   : ${personFresh}\n`);
process.stdout.write(`  fresh jobs         : ${jobs.length - jobHits}\n`);
process.stdout.write(`  projected WORST-CASE: $${projectedCost.toFixed(3)}\n`);
process.stdout.write(`\nBUDGET:\n`);
process.stdout.write(`  cumulative spend   : $${ledger.spentUsd.toFixed(4)} of $${RUNTIME_BUDGET_LIMITS.maxSpendUsd}\n`);
process.stdout.write(`  remaining          : $${ledger.remainingUsd().toFixed(3)}\n`);
process.stdout.write(`  after this run     : $${(ledger.remainingUsd() - projectedCost).toFixed(3)}\n`);
process.stdout.write(`  share of remaining : ${((projectedCost / Math.max(1e-9, ledger.remainingUsd())) * 100).toFixed(1)}%\n`);
process.stdout.write(`\nSAMPLE-SIZE JUSTIFICATION:\n`);
process.stdout.write(`  4 trials, not 3: P-01 Direction Δ was −0.062 with CI spanning zero.\n`);
process.stdout.write(`  Four independent generations can show a 3-to-1 sign majority.\n`);
process.stdout.write(`  Person-sample power remains n=12 (POW-01). Trials are not a substitute for more people.\n`);
process.stdout.write(`  No cache reuse across trials. P-01's single generation is not a trial-0 replay.\n`);

if (jobHits < jobs.length) {
  process.stderr.write(`\nSTOP CONDITION: job cache incomplete.\n`);
  process.exit(1);
}

if (dryRun) {
  process.stdout.write(`\n--dry-run: nothing was sent to the provider.\n`);
  process.exit(0);
}

process.stderr.write(`\nPaid execution of S-01 is not authorized in this session. Re-run with --dry-run only.\n`);
process.exit(2);
