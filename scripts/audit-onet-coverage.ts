// Occupation coverage suite: run EVERY O*NET occupation through
// occupation → job structure → function mapping → TaskDNA job vector → capability taxonomy
// and report coverage gaps. This is measurement, not tuning.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIMENSION_IDS, allCareerFunctions } from "../src/config/model";
import { analyzeJob } from "../src/domain/engine";
import { matchFunctionByTasks } from "../src/fixtures/jobs";
import { occupationToJobPosting } from "../src/onet/adapter";
import { loadOnetCorpus } from "../src/onet/corpus";
import { ONET_STRATA, isKnowledgeWorkScope, stratumFor } from "../src/onet/strata";

const corpus = loadOnetCorpus();
if (!corpus) {
  console.error(JSON.stringify({ status: "BLOCKED", reason: "O*NET corpus not built; run pnpm onet:fetch && pnpm onet:verify && pnpm onet:build" }, null, 2));
  process.exit(1);
}

const technicalDemoFunctionIds = new Set(allCareerFunctions.filter((fn) => fn.version === "function.v1").map((fn) => fn.id));
const results = corpus.occupations.map((occupation) => {
  const job = occupationToJobPosting(occupation);
  let crash: string | null = null;
  let primaryFunctionId: string | null = null;
  let neutralVector = false;
  let matchSource = "none";
  try {
    const match = matchFunctionByTasks(job);
    matchSource = match.source;
    const analysis = analyzeJob(job, allCareerFunctions);
    primaryFunctionId = analysis.primaryFunctionId;
    neutralVector = DIMENSION_IDS.every((id) => analysis.jobTaskDnaVector[id] === 5);
  } catch (error) {
    crash = error instanceof Error ? error.message : String(error);
  }
  return {
    code: occupation.onetSocCode,
    title: occupation.title,
    stratum: stratumFor(occupation),
    jobZone: occupation.jobZone,
    knowledgeWorkScope: isKnowledgeWorkScope(occupation),
    missingTasks: occupation.taskStatements.length === 0,
    missingWorkActivities: occupation.workActivities.length === 0,
    missingSkills: occupation.essentialSkills.length === 0 && occupation.transferableSkills.length === 0,
    missingWorkContext: occupation.workContext.length === 0,
    crash,
    matchSource,
    primaryFunctionId,
    technicalDemoOnly: primaryFunctionId !== null && technicalDemoFunctionIds.has(primaryFunctionId),
    neutralTaskDnaVector: neutralVector,
  };
});

const count = (predicate: (item: (typeof results)[number]) => boolean) => results.filter(predicate).length;
const strataCounts = Object.fromEntries(ONET_STRATA.map((stratum) => [stratum, count((item) => item.stratum === stratum)]));
const functionDistribution: Record<string, number> = {};
for (const item of results) {
  const key = item.primaryFunctionId ?? "NO_FUNCTION";
  functionDistribution[key] = (functionDistribution[key] ?? 0) + 1;
}
const jobZoneDistribution: Record<string, number> = {};
for (const item of results) {
  const key = item.jobZone === null ? "unknown" : String(item.jobZone);
  jobZoneDistribution[key] = (jobZoneDistribution[key] ?? 0) + 1;
}

const taskCounts = corpus.occupations.map((occupation) => occupation.taskStatements.length).sort((a, b) => a - b);
const quantile = (q: number) => taskCounts[Math.min(taskCounts.length - 1, Math.floor(q * taskCounts.length))] ?? 0;

const summary = {
  generatedAt: new Date().toISOString(),
  corpusVersion: corpus.version,
  transformVersion: corpus.transformVersion,
  occupationsLoaded: results.length,
  knowledgeWorkScopeCount: count((item) => item.knowledgeWorkScope),
  occupationsMissingTasks: count((item) => item.missingTasks),
  occupationsMissingWorkActivities: count((item) => item.missingWorkActivities),
  occupationsMissingSkills: count((item) => item.missingSkills),
  workContextCoverage: 1 - count((item) => item.missingWorkContext) / results.length,
  crashes: count((item) => item.crash !== null),
  strataCounts,
  emptyStrata: ONET_STRATA.filter((stratum) => stratum !== "other" && strataCounts[stratum] === 0),
  jobZoneDistribution,
  taskCountDistribution: { min: taskCounts[0] ?? 0, p25: quantile(0.25), median: quantile(0.5), p75: quantile(0.75), max: taskCounts[taskCounts.length - 1] ?? 0 },
  functionOntologyCoverage: {
    distribution: functionDistribution,
    noFunction: count((item) => item.primaryFunctionId === null),
    technicalDemoOnly: count((item) => item.technicalDemoOnly),
    technicalDemoOnlyShare: count((item) => item.technicalDemoOnly) / results.length,
    neutralTaskDnaVector: count((item) => item.neutralTaskDnaVector),
    neutralTaskDnaVectorShare: count((item) => item.neutralTaskDnaVector) / results.length,
    titleFallbackShare: count((item) => item.matchSource === "title-fallback") / results.length,
    noMatchShare: count((item) => item.matchSource === "none") / results.length,
  },
  weakTaskDnaMappingSamples: results.filter((item) => item.neutralTaskDnaVector).slice(0, 25).map((item) => `${item.code} ${item.title}`),
  crashSamples: results.filter((item) => item.crash).slice(0, 10),
};

const outDir = join(process.cwd(), "artifacts/logic_audit");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "onet_coverage.json"), JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
// The coverage suite gate: every occupation must flow through without crashing.
if (summary.crashes > 0) process.exit(1);
