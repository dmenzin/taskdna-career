// Person-understanding analysis, computed from the CACHE at zero additional cost.
//
// The ranking benchmark answers "did the right jobs come out on top". It does not answer
// "did the system understand the person", and those can come apart: a blueprint can be wrong
// in ways that happen not to change a ranking, and right in ways the ranking cannot reward.
//
// Because interpretations are cached by content hash on disk, this replays the exact same
// requests and reads every answer from cache — no provider calls, no spend. A cache miss here
// means the interpretation was never made, and is reported rather than silently re-billed.
//
// WHAT IS BEING MEASURED
//   channel separation  did performed work land in `experience` and liked work in `liked`,
//                       or did the model merge channels the product must keep distinct?
//   role recovery       for each planted frame, did the interpretation mention the planted
//                       ACTION / OBJECT / DOMAIN in recognisable plain English?
//   invention           interpreted works that correspond to no planted work at all.
//
// ROLE RECOVERY IS DELIBERATELY GENEROUS AND ITS LIMITS ARE STATED
//   Matching is by word overlap between the interpreted field and the planted concept's own
//   surface forms. It cannot tell "safety events" from "near misses" unless the concept's
//   lexicon happens to contain the word used. So this UNDERSTATES recovery and must be read as
//   a lower bound, never as an accuracy figure.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { buildFrameCorpus } from "../src/bench/frameCorpus";
import { cacheKeyFor, type ModelProvider, type ModelRequest } from "../src/agent/runtime";
import { PERSON_BLUEPRINT_PROMPT, PERSON_BLUEPRINT_SCHEMA, type CareerBlueprint } from "../src/agent/agentArchitecture";
import { mentionsConcept } from "../src/agent/channelIntegrity";
import { armCachePath, buildProvider, type ProviderName } from "../src/agent/providerRegistry";
import { IDENTITY_ROLES, type RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const people = Number(arg("people", "12"));
const family = arg("family", "SEMANTIC_BRIDGE") as RenderFamily;

// Which arm's cache to read. The Anthropic cache no longer exists anywhere
// (`docs/PROVIDER_HANDOFF_STATE.md`), so the default is the arm that does.
const providerName = arg("provider", "openai");
const modelId = arg("model", providerName === "openai" ? "gpt-5.6-sol" : "claude-opus-5");
const effort = arg("effort", "low");
const maxOutputTokens = Number(arg("person-max-output", providerName === "openai" ? "1800" : "1200"));

const cachePath = providerName === "anthropic"
  ? `artifacts/agent_runtime/cache-person-${family.toLowerCase()}.json`
  : armCachePath({ provider: providerName as ProviderName, model: modelId, effort, family, kind: "person" });
if (!existsSync(cachePath)) {
  process.stderr.write(`no cached interpretations at ${cachePath}; run the experiment first\n`);
  process.exit(1);
}
const cache = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, { text: string }>;

// The provider identity participates in the cache key, so it must be reconstructed EXACTLY --
// including the schema hash and the provider's declared settings, or every lookup misses.
const provider: ModelProvider = providerName === "openai"
  ? buildProvider({
      provider: "openai", model: modelId, effort: effort as never, maxOutputTokens,
      outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "career_blueprint",
    })
  : ({ name: "anthropic", model: modelId } as ModelProvider);
const corpus = buildFrameCorpus({ people, split: "DEVELOPMENT", family });

// One implementation of concept mention, shared with the contamination metrics. The copy that
// used to live here treated a concept id's TYPE PREFIX (`act.`, `obj.`, `dom.`) as a matchable
// word, so any text containing "act" matched every action concept. Role-recovery figures
// published before this fix should be read as having had that false-positive path open.
const mentions = mentionsConcept;

interface PersonAnalysis {
  personId: string;
  interpreted: boolean;
  counts: { experience: number; liked: number; disliked: number; desired: number };
  planted: { experience: number; liked: number; disliked: number; desired: number };
  roleRecovery: Record<string, { hit: number; total: number }>;
  /** Interpreted experience works matching NO planted performed frame. */
  unmatchedExperience: number;
  /** Disliked work that leaked into the experience or liked channel. */
  channelLeak: number;
}

const analyses: PersonAnalysis[] = [];
let missing = 0;

for (const person of corpus.people) {
  const request: ModelRequest = {
    prompt: PERSON_BLUEPRINT_PROMPT,
    input: {
      experience: person.experienceEvidence.map((e) => e.text).join("\n"),
      liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
      disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
      desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
    },
    // Must equal the arm's allowance exactly: decoding participates in the cache key, so a
    // hardcoded number here turns every lookup into a miss and the analysis reports zeroes.
    decoding: { temperature: 0, maxOutputTokens },
  };
  const entry = cache[cacheKeyFor(provider, request)];
  if (!entry) {
    missing += 1;
    continue;
  }
  let blueprint: Partial<CareerBlueprint> = {};
  try {
    blueprint = JSON.parse(entry.text) as Partial<CareerBlueprint>;
  } catch { /* an unparseable interpretation counts as an empty one, and is visible in counts */ }

  const experience = blueprint.experience ?? [];
  const roleRecovery: Record<string, { hit: number; total: number }> = {};
  for (const role of IDENTITY_ROLES) roleRecovery[role] = { hit: 0, total: 0 };

  // Each planted performed frame: is there ANY interpreted experience work that mentions its
  // action / object / domain? Best-match over the interpretation set, not positional.
  for (const performed of person.performed) {
    for (const role of IDENTITY_ROLES) {
      roleRecovery[role]!.total += 1;
      if (experience.some((work) => mentions(work, performed.work.frame[role]))) roleRecovery[role]!.hit += 1;
    }
  }

  const plantedPerformedConcepts = person.performed.map((entry_) => entry_.work.frame);
  const unmatchedExperience = experience.filter(
    (work) => !plantedPerformedConcepts.some((frame) => IDENTITY_ROLES.some((role) => mentions(work, frame[role]))),
  ).length;

  // Channel separation: disliked work must not appear as liked. This is the non-implication the
  // product depends on most — recommending someone back into work they are trying to leave.
  //
  // ALL FIVE identity roles must match. A 3-of-5 threshold reported 9 leaks across 12 people;
  // every one was a false positive of this matcher, because the plausibility constraints make
  // unrelated frames share a domain and purpose routinely. At 5/5 the count is 0, and manual
  // inspection confirms the model separated the channels correctly. A crude detector reporting
  // a headline failure that isn't there is worse than no detector.
  const dislikedFrames = person.disliked.map((work) => work.frame);
  const channelLeak = (blueprint.liked ?? []).filter(
    (work) => dislikedFrames.some((frame) => IDENTITY_ROLES.every((role) => mentions(work, frame[role]))),
  ).length;

  analyses.push({
    personId: person.personId,
    interpreted: true,
    counts: {
      experience: experience.length,
      liked: (blueprint.liked ?? []).length,
      disliked: (blueprint.disliked ?? []).length,
      desired: (blueprint.desired ?? []).length,
    },
    planted: {
      experience: person.performed.length,
      liked: person.liked.length,
      disliked: person.disliked.length,
      desired: person.desired.length,
    },
    roleRecovery,
    unmatchedExperience,
    channelLeak,
  });
}

const sum = (pick: (a: PersonAnalysis) => number) => analyses.reduce((total, a) => total + pick(a), 0);
const mean = (pick: (a: PersonAnalysis) => number) => (analyses.length ? sum(pick) / analyses.length : 0);

process.stdout.write(`\nPERSON UNDERSTANDING — ${family}, ${analyses.length} interpreted (${missing} missing from cache)\n`);
process.stdout.write(`  computed entirely from cache: no provider calls, no spend\n\n`);

process.stdout.write(`channel volume (interpreted vs planted, mean per person):\n`);
for (const channel of ["experience", "liked", "disliked", "desired"] as const) {
  process.stdout.write(
    `  ${channel.padEnd(11)} ${mean((a) => a.counts[channel]).toFixed(1).padStart(5)} vs ${mean((a) => a.planted[channel]).toFixed(1).padStart(5)} planted\n`,
  );
}

process.stdout.write(`\nplanted role recovery (LOWER BOUND — see header):\n`);
for (const role of IDENTITY_ROLES) {
  const hit = sum((a) => a.roleRecovery[role]!.hit);
  const total = sum((a) => a.roleRecovery[role]!.total);
  process.stdout.write(`  ${role.padEnd(9)} ${total ? ((hit / total) * 100).toFixed(1) : "0.0"}%  (${hit}/${total})\n`);
}

process.stdout.write(`\nchannel separation and invention:\n`);
process.stdout.write(`  disliked work leaking into LIKED: ${sum((a) => a.channelLeak)} across ${analyses.length} people\n`);
process.stdout.write(`  interpreted experience matching no planted work: ${sum((a) => a.unmatchedExperience)} of ${sum((a) => a.counts.experience)}\n`);

// The provider is in the FILENAME. Without it this script overwrites the Claude-era artifact,
// which is the only surviving person-understanding evidence from an arm that can never be re-run.
mkdirSync("artifacts/agent_experiments", { recursive: true });
const outputPath = `artifacts/agent_experiments/person-understanding-${providerName}-${family.toLowerCase()}.json`;
writeFileSync(
  outputPath,
  JSON.stringify({ family, provider: providerName, model: modelId, effort, people: analyses.length, missing, analyses }, null, 2) + "\n",
);
process.stdout.write(`\nwrote ${outputPath}\n`);
