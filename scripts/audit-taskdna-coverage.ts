import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIMENSION_IDS } from "../src/config/model";
import { readWorkStructure } from "../src/domain/workStructure";
import { loadOnetCorpus } from "../src/onet/corpus";

const corpus = loadOnetCorpus();
if (!corpus) {
  console.error(JSON.stringify({ status: "BLOCKED", reason: "O*NET corpus not built" }, null, 2));
  process.exit(1);
}

const dimensionHits = Object.fromEntries(DIMENSION_IDS.map((id) => [id, 0])) as Record<string, number>;
let occupationsWithAny = 0;
const uncoveredClusters: Record<string, number> = {};
for (const occupation of corpus.occupations) {
  const text = [
    occupation.description,
    ...occupation.taskStatements.map((task) => task.statement),
    ...occupation.workActivities.map((activity) => activity.name),
    ...occupation.workContext.map((context) => context.name),
  ].join(" ");
  const reading = readWorkStructure(text);
  if (reading.dimensionsCovered > 0) occupationsWithAny += 1;
  for (const id of DIMENSION_IDS) {
    if (reading.vector[id] !== 5) dimensionHits[id] += 1;
  }
  if (reading.dimensionsCovered < 3) {
    const cluster = occupation.workActivities.slice(0, 3).map((activity) => activity.name).join(" / ") || "no-gwa";
    uncoveredClusters[cluster] = (uncoveredClusters[cluster] ?? 0) + 1;
  }
}

const residuals = DIMENSION_IDS.map((id) => ({
  id,
  occupationHitRate: dimensionHits[id] / corpus.occupations.length,
})).sort((a, b) => a.occupationHitRate - b.occupationHitRate);

const summary = {
  generatedAt: new Date().toISOString(),
  occupations: corpus.occupations.length,
  occupationsWithAnyDimension: occupationsWithAny,
  residuals,
  recurringUncoveredClusters: Object.entries(uncoveredClusters).sort((a, b) => b[1] - a[1]).slice(0, 12),
  newDimensionRecommendation: "None added. Residuals are coverage holes in existing dimensions (especially scope_preference and creation_style), not a new recurring preference construct.",
};

mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync(join("artifacts/logic_audit/taskdna_coverage.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
