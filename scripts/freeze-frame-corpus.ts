// Freeze the frame corpus: record a content hash of the observed inputs per family and split.
//
// `docs/RESEARCH_CONTRACT_AMENDMENTS.md` § C requires the benchmark design and the observed
// DEVELOPMENT / VALIDATION inputs to be frozen before any candidate architecture is scored, so
// every architecture is compared on byte-identical text. Without this, a lexicon edit between
// two runs silently turns into an apparent quality difference.
//
// Run with --write to create or update the freeze; run with no flag to VERIFY the current
// corpus still matches it.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { allFrameJobs, buildFrameCorpus, FRAME_CORPUS_VERSION, type BenchSplit } from "../src/bench/frameCorpus";
import { RENDER_FAMILIES, SEMANTIC_FRAME_VERSION, type RenderFamily } from "../src/bench/semanticFrame";

const FREEZE_PATH = "config/frame-corpus-freeze.json";
const FREEZE_PEOPLE = 48;
/** LOCKED_CONFIRMATION is deliberately absent: freezing it would mean building it. */
const SPLITS: BenchSplit[] = ["DEVELOPMENT", "VALIDATION"];

/**
 * Hash the OBSERVED INPUTS only — the text an architecture is allowed to see, plus the job
 * ordering. Planted identity is excluded on purpose: the freeze must detect a change in what
 * systems are shown, and including the hidden truth would make the hash change for reasons the
 * comparison does not care about.
 */
function corpusDigest(split: BenchSplit, family: RenderFamily): { sha256: string; people: number; jobs: number } {
  const corpus = buildFrameCorpus({ people: FREEZE_PEOPLE, split, family });
  const jobs = allFrameJobs(corpus);
  const observed = {
    people: corpus.people.map((person) => ({
      id: person.personId,
      narrative: person.narrative,
      experience: person.experienceEvidence.map((entry) => entry.text),
      preference: person.preferenceEvidence.map((entry) => `${entry.stance}:${entry.text}`),
      aspiration: person.aspirationEvidence.map((entry) => entry.text),
      title: person.homeTitle,
      industry: person.homeIndustry,
      qualifications: person.qualifications.map((q) => q.value),
    })),
    jobs: jobs.map((job) => ({
      id: job.jobId,
      title: job.title,
      industry: job.industry,
      description: job.descriptionText,
      responsibilities: job.responsibilities.map((entry) => entry.text),
      requirements: job.requirements.map((entry) => `${entry.value}:${entry.required}`),
    })),
  };
  return {
    sha256: createHash("sha256").update(JSON.stringify(observed)).digest("hex"),
    people: corpus.people.length,
    jobs: jobs.length,
  };
}

const entries: Record<string, { sha256: string; people: number; jobs: number }> = {};
for (const split of SPLITS) {
  for (const family of RENDER_FAMILIES as readonly RenderFamily[]) {
    entries[`${split}/${family}`] = corpusDigest(split, family);
  }
}

const freeze = {
  version: "frame-corpus-freeze.v1",
  frozenAt: "2026-08-23",
  corpusVersion: FRAME_CORPUS_VERSION,
  frameVersion: SEMANTIC_FRAME_VERSION,
  people: FREEZE_PEOPLE,
  note:
    "Observed inputs only (rendered text, titles, industries, job order). Planted identity is " +
    "deliberately excluded. Changing any of these hashes invalidates every architecture result " +
    "measured against the previous freeze; see docs/RESEARCH_CONTRACT_AMENDMENTS.md section C.",
  lockedConfirmationFrozen: false,
  entries,
};

if (process.argv.includes("--write")) {
  mkdirSync("config", { recursive: true });
  writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2) + "\n");
  process.stdout.write(`wrote ${FREEZE_PATH}\n`);
  for (const [key, value] of Object.entries(entries)) {
    process.stdout.write(`  ${key.padEnd(34)} ${value.sha256.slice(0, 16)}  people=${value.people} jobs=${value.jobs}\n`);
  }
} else {
  if (!existsSync(FREEZE_PATH)) {
    process.stderr.write(`no freeze at ${FREEZE_PATH}; run with --write to create one\n`);
    process.exit(1);
  }
  const recorded = JSON.parse(readFileSync(FREEZE_PATH, "utf8")) as typeof freeze;
  const problems: string[] = [];
  if (recorded.frameVersion !== freeze.frameVersion) problems.push(`frame version ${recorded.frameVersion} -> ${freeze.frameVersion}`);
  if (recorded.corpusVersion !== freeze.corpusVersion) problems.push(`corpus version ${recorded.corpusVersion} -> ${freeze.corpusVersion}`);
  for (const [key, value] of Object.entries(entries)) {
    const before = recorded.entries[key];
    if (!before) problems.push(`${key}: absent from the freeze`);
    else if (before.sha256 !== value.sha256) problems.push(`${key}: ${before.sha256.slice(0, 12)} -> ${value.sha256.slice(0, 12)}`);
  }
  process.stdout.write(`frame corpus freeze ${problems.length ? "MISMATCH" : "verified"} (${Object.keys(entries).length} entries)\n`);
  for (const problem of problems) process.stdout.write(`  ${problem}\n`);
  if (problems.length) {
    process.stderr.write(
      "the observed inputs have changed since the freeze; architecture results measured before " +
      "this change are no longer comparable and must be rerun\n",
    );
    process.exit(1);
  }
}
