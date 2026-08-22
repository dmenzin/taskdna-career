import { mkdirSync, writeFileSync } from "node:fs";
import { allCareerFunctions } from "../src/config/model";
import { analyzeJob } from "../src/domain/engine";
import { occupationToJobPosting } from "../src/onet/adapter";
import { loadOnetCorpus } from "../src/onet/corpus";
import { stratumFor } from "../src/onet/strata";

const corpus = loadOnetCorpus();
if (!corpus) {
  console.error(JSON.stringify({ status: "BLOCKED", reason: "O*NET corpus not built" }, null, 2));
  process.exit(1);
}

const technical = new Set(allCareerFunctions.filter((fn) => fn.version === "function.v1").map((fn) => fn.id));
const distribution: Record<string, number> = {};
const byStratum: Record<string, Record<string, number>> = {};
let noPlausible = 0;
let technicalOnly = 0;
for (const occupation of corpus.occupations) {
  const analysis = analyzeJob(occupationToJobPosting(occupation), allCareerFunctions);
  const fn = analysis.primaryFunctionId;
  distribution[fn] = (distribution[fn] ?? 0) + 1;
  const stratum = stratumFor(occupation);
  byStratum[stratum] ??= {};
  byStratum[stratum][fn] = (byStratum[stratum][fn] ?? 0) + 1;
  if (fn === "modeling-simulation" && analysis.classificationConfidence < 0.45) noPlausible += 1;
  if (technical.has(fn)) technicalOnly += 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  occupations: corpus.occupations.length,
  distribution,
  noPlausibleFunction: noPlausible,
  technicalDemoMapped: technicalOnly,
  technicalDemoShare: technicalOnly / corpus.occupations.length,
  overCompressed: Object.entries(distribution).filter(([, count]) => count > corpus.occupations.length * 0.25).map(([id, count]) => ({ id, count })),
  genericVsDomainVsUser: {
    genericWorkStructureDimensions: 17,
    domainFunctionPacks: allCareerFunctions.filter((fn) => fn.version === "function.v2-extended").length,
    currentUserFunctionHypotheses: allCareerFunctions.filter((fn) => fn.version === "function.v1").length,
  },
  newFunctionRecommendation: "No new function concepts added. Coverage holes are matching/extraction, not missing occupation-specific packs.",
};

mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync("artifacts/logic_audit/function_coverage.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
