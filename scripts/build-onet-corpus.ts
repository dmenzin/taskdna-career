// Build the normalized O*NET occupation corpus from the verified 30.3 download.
// Output: data/derived/onet/30.3/occupation-corpus.json.gz (committed, compact)
//         data/derived/onet/30.3/coverage-summary.json (committed)
// O*NET descriptors describe work exposure only; they are never used as preference truth.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseCsvTable, type CsvTable } from "../src/onet/csv";
import {
  ONET_LICENSE,
  ONET_TRANSFORM_VERSION,
  ONET_VERSION,
  type OnetCoverageSummary,
  type OnetCorpus,
  type OnetOccupationSkeleton,
  type OnetTaskStatement,
  type RatedElement,
  type WorkContextElement,
} from "../src/onet/types";

const externalDir = join(process.cwd(), "data/external/onet", ONET_VERSION, "db_30_3_csv");
const derivedDir = join(process.cwd(), "data/derived/onet", ONET_VERSION);

function fail(message: string): never {
  console.error(`O*NET corpus build FAILED: ${message}`);
  console.error("Run `pnpm onet:fetch && pnpm onet:verify` first. O*NET-dependent gates are BLOCKED until this succeeds.");
  process.exit(1);
}

function table(name: string, required: string[]): CsvTable {
  const path = join(externalDir, `${name}.csv`);
  if (!existsSync(path)) fail(`missing table ${name}.csv`);
  try {
    return parseCsvTable(readFileSync(path, "utf8"), required);
  } catch (error) {
    fail(`${name}.csv: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Collect per-occupation IM (+optional LV) element ratings, honoring Recommend Suppress. */
function collectRated(name: string, keepTop: number | null): Map<string, RatedElement[]> {
  const t = table(name, ["O*NET-SOC Code", "Element ID", "Element Name", "Scale ID", "Data Value"]);
  const code = t.col("O*NET-SOC Code");
  const elementId = t.col("Element ID");
  const elementName = t.col("Element Name");
  const scale = t.col("Scale ID");
  const value = t.col("Data Value");
  const suppress = t.header.includes("Recommend Suppress") ? t.col("Recommend Suppress") : -1;
  const byOccupation = new Map<string, Map<string, RatedElement>>();
  for (const row of t.rows) {
    if (suppress >= 0 && row[suppress] === "Y") continue;
    const scaleId = row[scale]!;
    if (scaleId !== "IM" && scaleId !== "LV") continue;
    const numeric = Number(row[value]);
    if (!Number.isFinite(numeric)) fail(`${name}.csv has non-numeric Data Value "${row[value]}"`);
    const occ = byOccupation.get(row[code]!) ?? new Map<string, RatedElement>();
    const existing = occ.get(row[elementId]!) ?? { elementId: row[elementId]!, name: row[elementName]!, importance: 0 };
    if (scaleId === "IM") existing.importance = round2(numeric);
    else existing.level = round2(numeric);
    occ.set(row[elementId]!, existing);
    byOccupation.set(row[code]!, occ);
  }
  const out = new Map<string, RatedElement[]>();
  for (const [occ, elements] of byOccupation) {
    let list = Array.from(elements.values()).filter((element) => element.importance > 0);
    list.sort((a, b) => b.importance - a.importance || a.elementId.localeCompare(b.elementId));
    if (keepTop !== null) list = list.slice(0, keepTop);
    out.set(occ, list);
  }
  return out;
}

// ---- occupation_data ----
const occupationData = table("occupation_data", ["O*NET-SOC Code", "Title", "Description"]);
const occCode = occupationData.col("O*NET-SOC Code");
const occTitle = occupationData.col("Title");
const occDescription = occupationData.col("Description");

// ---- task statements + ratings + DWAs ----
const taskStatements = table("task_statements", ["O*NET-SOC Code", "Task ID", "Task", "Task Type"]);
const taskRatings = table("task_ratings", ["O*NET-SOC Code", "Task ID", "Scale ID", "Data Value"]);
const tasksToDwas = table("tasks_to_dwas", ["Task ID", "DWA Element ID"]);

const taskImportance = new Map<string, number>();
{
  const code = taskRatings.col("O*NET-SOC Code");
  const id = taskRatings.col("Task ID");
  const scale = taskRatings.col("Scale ID");
  const value = taskRatings.col("Data Value");
  for (const row of taskRatings.rows) {
    if (row[scale] !== "IM") continue;
    taskImportance.set(`${row[code]}:${row[id]}`, round2(Number(row[value])));
  }
}
const dwasByTask = new Map<string, string[]>();
{
  const id = tasksToDwas.col("Task ID");
  const dwa = tasksToDwas.col("DWA Element ID");
  for (const row of tasksToDwas.rows) {
    const list = dwasByTask.get(row[id]!) ?? [];
    if (list.length < 4) list.push(row[dwa]!);
    dwasByTask.set(row[id]!, list);
  }
}
const tasksByOccupation = new Map<string, OnetTaskStatement[]>();
{
  const code = taskStatements.col("O*NET-SOC Code");
  const id = taskStatements.col("Task ID");
  const statement = taskStatements.col("Task");
  const type = taskStatements.col("Task Type");
  for (const row of taskStatements.rows) {
    const list = tasksByOccupation.get(row[code]!) ?? [];
    const taskId = Number(row[id]);
    list.push({
      taskId,
      statement: row[statement]!,
      taskType: row[type]! || "Unknown",
      importance: taskImportance.get(`${row[code]}:${row[id]}`),
      dwaIds: dwasByTask.get(row[id]!) ?? [],
    });
    tasksByOccupation.set(row[code]!, list);
  }
  for (const [occ, list] of tasksByOccupation) {
    list.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || a.taskId - b.taskId);
    tasksByOccupation.set(occ, list.slice(0, 14));
  }
}

// ---- element rating tables ----
const workActivities = collectRated("work_activities", null); // all 41 GWAs
const essentialSkills = collectRated("essential_skills", null);
const transferableSkills = collectRated("transferable_skills", 14);
const knowledge = collectRated("knowledge", 12);
const abilities = collectRated("abilities", 12);

// ---- work context (CX scale) ----
const workContextByOccupation = new Map<string, WorkContextElement[]>();
{
  const t = table("work_context", ["O*NET-SOC Code", "Element ID", "Element Name", "Scale ID", "Data Value"]);
  const code = t.col("O*NET-SOC Code");
  const elementId = t.col("Element ID");
  const elementName = t.col("Element Name");
  const scale = t.col("Scale ID");
  const value = t.col("Data Value");
  const suppress = t.header.includes("Recommend Suppress") ? t.col("Recommend Suppress") : -1;
  for (const row of t.rows) {
    if (row[scale] !== "CX") continue;
    if (suppress >= 0 && row[suppress] === "Y") continue;
    const numeric = Number(row[value]);
    if (!Number.isFinite(numeric)) continue;
    const list = workContextByOccupation.get(row[code]!) ?? [];
    list.push({ elementId: row[elementId]!, name: row[elementName]!, value: round2(numeric) });
    workContextByOccupation.set(row[code]!, list);
  }
  for (const [occ, list] of workContextByOccupation) {
    list.sort((a, b) => b.value - a.value || a.elementId.localeCompare(b.elementId));
    workContextByOccupation.set(occ, list.slice(0, 18));
  }
}

// ---- education (modal RL category) + names ----
const educationCategoryNames = new Map<number, string>();
{
  const t = table("education_categories", ["Scale ID", "Category", "Category Description"]);
  const scale = t.col("Scale ID");
  const category = t.col("Category");
  const description = t.col("Category Description");
  for (const row of t.rows) {
    if (row[scale] === "RL") educationCategoryNames.set(Number(row[category]), row[description]!);
  }
}
const educationModal = new Map<string, number>();
{
  const t = table("education", ["O*NET-SOC Code", "Scale ID", "Category", "Data Value"]);
  const code = t.col("O*NET-SOC Code");
  const scale = t.col("Scale ID");
  const category = t.col("Category");
  const value = t.col("Data Value");
  const best = new Map<string, { category: number; pct: number }>();
  for (const row of t.rows) {
    if (row[scale] !== "RL") continue;
    const pct = Number(row[value]);
    const current = best.get(row[code]!);
    if (!current || pct > current.pct) best.set(row[code]!, { category: Number(row[category]), pct });
  }
  for (const [occ, item] of best) educationModal.set(occ, item.category);
}

// ---- training and experience (modal RW category) ----
const experienceModal = new Map<string, number>();
{
  const t = table("training_and_experience", ["O*NET-SOC Code", "Scale ID", "Category", "Data Value"]);
  const code = t.col("O*NET-SOC Code");
  const scale = t.col("Scale ID");
  const category = t.col("Category");
  const value = t.col("Data Value");
  const best = new Map<string, { category: number; pct: number }>();
  for (const row of t.rows) {
    if (row[scale] !== "RW") continue;
    const pct = Number(row[value]);
    const current = best.get(row[code]!);
    if (!current || pct > current.pct) best.set(row[code]!, { category: Number(row[category]), pct });
  }
  for (const [occ, item] of best) experienceModal.set(occ, item.category);
}

// ---- job zones ----
const jobZones = new Map<string, number>();
{
  const t = table("job_zones", ["O*NET-SOC Code", "Job Zone"]);
  const code = t.col("O*NET-SOC Code");
  const zone = t.col("Job Zone");
  for (const row of t.rows) jobZones.set(row[code]!, Number(row[zone]));
}

// ---- alternate titles ----
const alternateTitles = new Map<string, string[]>();
{
  const t = table("sample_of_reported_titles", ["O*NET-SOC Code", "Reported Job Title"]);
  const code = t.col("O*NET-SOC Code");
  const title = t.col("Reported Job Title");
  for (const row of t.rows) {
    const list = alternateTitles.get(row[code]!) ?? [];
    if (list.length < 8) list.push(row[title]!);
    alternateTitles.set(row[code]!, list);
  }
}

// ---- related occupations (primary tiers only) ----
const relatedOccupations = new Map<string, string[]>();
{
  const t = table("related_occupations", ["O*NET-SOC Code", "Related O*NET-SOC Code", "Relatedness Tier"]);
  const code = t.col("O*NET-SOC Code");
  const related = t.col("Related O*NET-SOC Code");
  const tier = t.col("Relatedness Tier");
  for (const row of t.rows) {
    if (!row[tier]!.startsWith("Primary")) continue;
    const list = relatedOccupations.get(row[code]!) ?? [];
    if (list.length < 10 && !list.includes(row[related]!)) list.push(row[related]!);
    relatedOccupations.set(row[code]!, list);
  }
}

// ---- assemble ----
const occupations: OnetOccupationSkeleton[] = occupationData.rows.map((row) => {
  const code = row[occCode]!;
  const modalEducation = educationModal.get(code) ?? null;
  return {
    onetSocCode: code,
    title: row[occTitle]!,
    description: row[occDescription]!,
    taskStatements: tasksByOccupation.get(code) ?? [],
    workActivities: workActivities.get(code) ?? [],
    workContext: workContextByOccupation.get(code) ?? [],
    essentialSkills: essentialSkills.get(code) ?? [],
    transferableSkills: transferableSkills.get(code) ?? [],
    knowledge: knowledge.get(code) ?? [],
    abilities: abilities.get(code) ?? [],
    educationProfile: {
      modalCategory: modalEducation,
      categoryName: modalEducation === null ? null : educationCategoryNames.get(modalEducation) ?? null,
    },
    trainingExperienceProfile: { modalRelatedExperienceCategory: experienceModal.get(code) ?? null },
    jobZone: jobZones.get(code) ?? null,
    alternateTitles: alternateTitles.get(code) ?? [],
    relatedOccupationCodes: relatedOccupations.get(code) ?? [],
    sourceVersion: `onet-${ONET_VERSION}`,
  };
});

if (occupations.length < 900) fail(`only ${occupations.length} occupations parsed; expected ~1016`);
const withTasks = occupations.filter((occupation) => occupation.taskStatements.length > 0).length;
if (withTasks < 800) fail(`only ${withTasks} occupations have task statements; expected ~923`);

const corpus: OnetCorpus = {
  version: ONET_VERSION,
  transformVersion: ONET_TRANSFORM_VERSION,
  builtAt: new Date().toISOString(),
  license: ONET_LICENSE,
  occupationCount: occupations.length,
  occupations,
};

const taskCounts = occupations.map((occupation) => occupation.taskStatements.length).sort((a, b) => a - b);
const quantile = (q: number) => taskCounts[Math.min(taskCounts.length - 1, Math.floor(q * taskCounts.length))] ?? 0;
const majorGroupCounts: Record<string, number> = {};
for (const occupation of occupations) {
  const group = occupation.onetSocCode.slice(0, 2);
  majorGroupCounts[group] = (majorGroupCounts[group] ?? 0) + 1;
}
const jobZoneDistribution: Record<string, number> = {};
for (const occupation of occupations) {
  const key = occupation.jobZone === null ? "unknown" : String(occupation.jobZone);
  jobZoneDistribution[key] = (jobZoneDistribution[key] ?? 0) + 1;
}
const coverage: OnetCoverageSummary = {
  version: ONET_VERSION,
  transformVersion: ONET_TRANSFORM_VERSION,
  builtAt: corpus.builtAt,
  occupationsLoaded: occupations.length,
  occupationsMissingTasks: occupations.filter((occupation) => occupation.taskStatements.length === 0).length,
  occupationsMissingWorkActivities: occupations.filter((occupation) => occupation.workActivities.length === 0).length,
  occupationsMissingSkills: occupations.filter((occupation) => occupation.essentialSkills.length === 0 && occupation.transferableSkills.length === 0).length,
  jobZoneDistribution,
  taskCountDistribution: { min: taskCounts[0] ?? 0, p25: quantile(0.25), median: quantile(0.5), p75: quantile(0.75), max: taskCounts[taskCounts.length - 1] ?? 0 },
  majorGroupCounts,
};

mkdirSync(derivedDir, { recursive: true });
const json = JSON.stringify(corpus);
writeFileSync(join(derivedDir, "occupation-corpus.json.gz"), gzipSync(Buffer.from(json), { level: 9 }));
writeFileSync(join(derivedDir, "coverage-summary.json"), JSON.stringify(coverage, null, 2));
console.log(JSON.stringify({
  ok: true,
  occupations: occupations.length,
  withTasks,
  uncompressedBytes: json.length,
  gzipBytes: gzipSync(Buffer.from(json), { level: 9 }).length,
  out: derivedDir,
}, null, 2));
