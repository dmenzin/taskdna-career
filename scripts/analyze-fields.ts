// R-01: leave-one-field-out ablation of the frozen field-aware matcher.
//
// Zero model calls. Reads the paid LEXICAL_TRAP OpenAI caches and scores the same
// interpretations with each field dropped in turn. Does NOT modify agent-field-match.
//
// A small or zero delta is a research observation. It is not a licence to drop a field
// before P-01.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cacheKeyFor, type ModelRequest } from "../src/agent/runtime";
import {
  JOB_BLUEPRINT_PROMPT,
  JOB_BLUEPRINT_SCHEMA,
  PERSON_BLUEPRINT_PROMPT,
  PERSON_BLUEPRINT_SCHEMA,
  type CareerBlueprint,
  type StructuredWork,
} from "../src/agent/agentArchitecture";
import { productionMatcherAgrees, runFieldAblation } from "../src/agent/fieldAblation";
import { armCachePath, buildProvider, CANONICAL_EFFORT, defaultModelFor, type ProviderName } from "../src/agent/providerRegistry";
import { allFrameJobs, buildFrameCorpus } from "../src/bench/frameCorpus";
import type { RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const people = Number(arg("people", "12"));
const family = arg("family", "LEXICAL_TRAP") as RenderFamily;
const provider = arg("provider", "openai") as ProviderName;
const model = arg("model", defaultModelFor(provider));
const effort = arg("effort", CANONICAL_EFFORT);
const personMaxOutput = Number(arg("person-max-output", "1800"));
const jobMaxOutput = Number(arg("job-max-output", "700"));

const personCachePath = armCachePath({ provider, model, effort, family, kind: "person" });
const jobCachePath = armCachePath({ provider, model, effort, family, kind: "job" });
if (!existsSync(personCachePath) || !existsSync(jobCachePath)) {
  process.stderr.write(`missing cache: person=${personCachePath} job=${jobCachePath}\n`);
  process.exit(1);
}
const personCache = JSON.parse(readFileSync(personCachePath, "utf8")) as Record<string, { text: string }>;
const jobCache = JSON.parse(readFileSync(jobCachePath, "utf8")) as Record<string, { text: string }>;

const personProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: personMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "career_blueprint",
});
const jobProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: jobMaxOutput,
  outputSchema: JOB_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "job_blueprint",
});

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

const personRequest = (personId: string): ModelRequest => ({
  prompt: PERSON_BLUEPRINT_PROMPT,
  input: personInput(personId),
  decoding: { temperature: 0, maxOutputTokens: personMaxOutput },
});
const jobRequest = (job: { jobId: string; responsibilities: { text: string }[] }): ModelRequest => ({
  prompt: JOB_BLUEPRINT_PROMPT,
  input: { responsibilities: job.responsibilities.map((r) => r.text).join("\n") },
  decoding: { temperature: 0, maxOutputTokens: jobMaxOutput },
});

const blueprints = new Map<string, CareerBlueprint>();
let personHits = 0;
for (const person of corpus.people) {
  const hit = personCache[cacheKeyFor(personProvider, personRequest(person.personId))];
  if (!hit) continue;
  personHits += 1;
  const parsed = JSON.parse(hit.text) as Partial<CareerBlueprint>;
  blueprints.set(person.personId, {
    personId: person.personId,
    experience: parsed.experience ?? [],
    liked: parsed.liked ?? [],
    disliked: parsed.disliked ?? [],
    desired: parsed.desired ?? [],
  });
}

const jobWork = new Map<string, StructuredWork[]>();
let jobHits = 0;
for (const job of jobs) {
  const hit = jobCache[cacheKeyFor(jobProvider, jobRequest(job))];
  if (!hit) continue;
  jobHits += 1;
  jobWork.set(job.jobId, (JSON.parse(hit.text) as { responsibilities?: StructuredWork[] }).responsibilities ?? []);
}

if (personHits !== corpus.people.length || jobHits !== jobs.length) {
  process.stderr.write(
    `cache incomplete: people ${personHits}/${corpus.people.length}, jobs ${jobHits}/${jobs.length}. R-01 refuses to invent missing interpretations.\n`,
  );
  process.exit(1);
}

if (!productionMatcherAgrees(corpus, blueprints, jobWork)) {
  process.stderr.write("diagnostic five-field scorer disagrees with production agent-field-match; aborting.\n");
  process.exit(1);
}

const report = runFieldAblation(corpus, blueprints, jobWork);
mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/agent_experiments/field-ablation-${provider}-${family.toLowerCase()}-n${people}.json`;
writeFileSync(outputPath, `${JSON.stringify({
  experiment: "R-01",
  diagnosticOnly: true,
  matcherFrozen: "agent-field-match.v1",
  personCachePath,
  jobCachePath,
  personHits,
  jobHits,
  ...report,
}, null, 2)}\n`);

process.stdout.write(`\nR-01 field ablation (diagnostic only; matcher frozen)\n`);
process.stdout.write(`family=${family} people=${people} cache people=${personHits} jobs=${jobHits}\n`);
process.stdout.write(`full experience=${report.full.experience?.toFixed(3)} preference=${report.full.preference?.toFixed(3)} direction=${report.full.direction?.toFixed(3)}\n`);
for (const row of report.leaveOneOut) {
  const delta = row.experienceDeltaVsFull;
  process.stdout.write(
    `  minus ${row.dropped?.padEnd(8)} experience=${row.experience?.toFixed(3)} Δ=${delta === null ? "?" : (delta >= 0 ? "+" : "") + delta.toFixed(3)}\n`,
  );
}
process.stdout.write(`redundant on experience (|Δ|<0.001): ${report.redundantOnExperience.join(", ") || "none"}\n`);
process.stdout.write(`wrote ${outputPath}\n`);
process.stdout.write(`${report.note}\n`);
