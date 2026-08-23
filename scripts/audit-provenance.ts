// Provenance-aware contamination, computed from interpretations ALREADY PAID FOR.
//
// Zero model calls. The split agents were required to emit the supporting phrase alongside each
// work item, and that phrase can be matched back to the evidence sentence it came from, which
// names the channel the claim was really built from.
//
// This is the diagnosis the first split-agent screen could not produce: strict identity collision
// rated a 73% experience inflation at 0.008, because a claim built from work the person merely
// LIKED often collides with no planted frame at all. Provenance asks the question the product is
// actually exposed to — where did this claim come from — and answers it from disk.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildFrameCorpus } from "../src/bench/frameCorpus";
import { cacheKeyFor } from "../src/agent/runtime";
import { buildProvider, armCachePath, splitAgentCachePath, type ProviderName } from "../src/agent/providerRegistry";
import { PERSON_BLUEPRINT_PROMPT, PERSON_BLUEPRINT_SCHEMA, type CareerBlueprint } from "../src/agent/agentArchitecture";
import {
  DIRECTION_AGENT_PROMPT, DIRECTION_AGENT_SCHEMA,
  DIRECTION_AGENT_PROMPT_V1, DIRECTION_AGENT_SCHEMA_V1,
  EXPERIENCE_AGENT_PROMPT, EXPERIENCE_AGENT_SCHEMA,
  agentEvidence, agentEvidenceV1, type EvidenceScope,
} from "../src/agent/splitAgents";
import {
  evidenceIndex, provenanceFor, summarizeProvenance,
  PROVENANCE_VERSION, type ClaimProvenance, type EvidenceChannel, type QuotedWork,
} from "../src/agent/provenance";
import { channelVolumes } from "../src/agent/channelIntegrity";
import type { RenderFamily } from "../src/bench/semanticFrame";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const family = arg("family", "LEXICAL_TRAP") as RenderFamily;
const people = Number(arg("people", "12"));
const provider = arg("provider", "openai") as ProviderName;
const model = arg("model", "gpt-5.6-sol");
const effort = arg("effort", "low");
const sharedMaxOutput = Number(arg("shared-max-output", "1800"));
const splitMaxOutput = Number(arg("split-max-output", "3600"));
// Which Direction Agent generation to audit. v1 is the superseded prompt that merged Preference
// into Direction; auditing it is how that defect was diagnosed, so it stays reachable.
const directionGeneration = arg("direction-version", "v2");
const legacy = directionGeneration === "v1";
const directionPrompt = legacy ? DIRECTION_AGENT_PROMPT_V1 : DIRECTION_AGENT_PROMPT;
const directionSchema = legacy ? DIRECTION_AGENT_SCHEMA_V1 : DIRECTION_AGENT_SCHEMA;
const routeEvidence = legacy ? agentEvidenceV1 : agentEvidence;

const corpus = buildFrameCorpus({ people, split: "DEVELOPMENT", family });
const load = (path: string) => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, { text: string }>) : null);
const parse = <T,>(text: string | undefined): T | null => {
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
};

// Providers rebuilt exactly as the runs built them, or the cache keys miss.
const sharedProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: sharedMaxOutput,
  outputSchema: PERSON_BLUEPRINT_SCHEMA as unknown as Record<string, unknown>, schemaName: "career_blueprint",
});
const experienceProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: splitMaxOutput,
  outputSchema: EXPERIENCE_AGENT_SCHEMA as unknown as Record<string, unknown>, schemaName: "experience_blueprint",
});
const directionProvider = buildProvider({
  provider, model, effort: effort as never, maxOutputTokens: splitMaxOutput,
  outputSchema: directionSchema as unknown as Record<string, unknown>, schemaName: "direction_blueprint",
});

const splitCachePath = (variant: string, agent: "experience" | "direction") =>
  splitAgentCachePath({
    provider, model, effort, family, variant, agent,
    promptVersion: agent === "experience" ? EXPERIENCE_AGENT_PROMPT.version : directionPrompt.version,
    maxOutputTokens: splitMaxOutput,
  });

// What each architecture was actually SHOWN. Contamination from a channel an agent never saw is
// interpretation drift, not leakage, and the two must not be added together.
const VISIBLE: Record<string, EvidenceChannel[]> = {
  shared: ["EXPERIENCE", "PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"],
  "split-full-context": ["EXPERIENCE", "PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"],
  "split-isolated": ["EXPERIENCE"],
};

process.stdout.write(`\nPROVENANCE AUDIT (${PROVENANCE_VERSION}) — ${family}, n=${people}, ZERO model calls\n`);
process.stdout.write(`reading interpretations already paid for; nothing is sent to a provider\n\n`);

interface ArchResult {
  architecture: string;
  experienceProvenance: ReturnType<typeof summarizeProvenance>;
  directionProvenance: ReturnType<typeof summarizeProvenance> | null;
  volumeRatios: Record<string, number>;
  peopleAnalysed: number;
  missing: number;
}
const results: ArchResult[] = [];

// ---- the shared CareerBlueprint ----------------------------------------------------------
// It emits no supporting phrase, so provenance CANNOT be computed for it. Reported as absent
// rather than as zero: an architecture that cannot be audited is not an architecture with nothing
// to find, and treating it as clean would flatter it for lacking the instrumentation.
const sharedCache = load(armCachePath({ provider, model, effort, family, kind: "person" }));
if (sharedCache) {
  const volumes: Record<string, number[]> = {};
  let analysed = 0;
  for (const person of corpus.people) {
    const request = {
      prompt: PERSON_BLUEPRINT_PROMPT,
      input: {
        experience: person.experienceEvidence.map((e) => e.text).join("\n"),
        liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
        disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
        desired: person.aspirationEvidence.map((e) => e.text).join("\n"),
      },
      decoding: { temperature: 0, maxOutputTokens: sharedMaxOutput },
    };
    const parsed = parse<Partial<CareerBlueprint>>(sharedCache[cacheKeyFor(sharedProvider, request)]?.text);
    if (!parsed) continue;
    const blueprint: CareerBlueprint = {
      personId: person.personId,
      experience: parsed.experience ?? [], liked: parsed.liked ?? [],
      disliked: parsed.disliked ?? [], desired: parsed.desired ?? [],
    };
    for (const [channel, volume] of Object.entries(channelVolumes(person, blueprint))) (volumes[channel] ??= []).push(volume.ratio);
    analysed += 1;
  }
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  results.push({
    architecture: "shared",
    experienceProvenance: summarizeProvenance([]),
    directionProvenance: null,
    volumeRatios: Object.fromEntries(Object.entries(volumes).map(([k, v]) => [k, mean(v)])),
    peopleAnalysed: analysed,
    missing: corpus.people.length - analysed,
  });
}

// ---- the split arms, which DO carry provenance -------------------------------------------
for (const [variantId, scope] of [["split-full-context", "full-context"], ["split-isolated", "isolated"]] as [string, EvidenceScope][]) {
  const experienceCache = load(splitCachePath(variantId, "experience"));
  const directionCache = load(splitCachePath(variantId, "direction"));
  if (!experienceCache || !directionCache) continue;

  const experienceRows: ClaimProvenance[] = [];
  const directionRows: ClaimProvenance[] = [];
  const volumes: Record<string, number[]> = {};
  let analysed = 0;

  for (const person of corpus.people) {
    const evidence = routeEvidence(person, scope);
    const experienceRequest = {
      prompt: EXPERIENCE_AGENT_PROMPT, input: { evidence: evidence.experience },
      decoding: { temperature: 0, maxOutputTokens: splitMaxOutput },
    };
    const directionRequest = {
      prompt: directionPrompt, input: { evidence: evidence.direction },
      decoding: { temperature: 0, maxOutputTokens: splitMaxOutput },
    };
    const experienceOut = parse<{ performed?: QuotedWork[] }>(experienceCache[cacheKeyFor(experienceProvider, experienceRequest)]?.text);
    const rawDirection = parse<{ desired?: QuotedWork[]; wanted?: QuotedWork[] }>(directionCache[cacheKeyFor(directionProvider, directionRequest)]?.text);
    // v1 emitted `wanted`; v2 emits `desired`. Reading both keeps the historical diagnosis alive.
    const directionOut = rawDirection ? { desired: rawDirection.desired ?? rawDirection.wanted ?? [] } : null;
    if (!experienceOut || !directionOut) continue;

    const index = evidenceIndex(person);
    // The Experience Agent's visible channels depend on the variant; the Direction Agent in the
    // isolated variant saw preference and aspiration evidence, not experience evidence.
    const experienceVisible = VISIBLE[variantId]!;
    // v1's "isolated" Direction Agent saw preference evidence too; v2's sees aspiration only.
    // Getting this wrong would misclassify genuine leakage as interpretation drift.
    const directionVisible: EvidenceChannel[] = scope !== "isolated"
      ? ["EXPERIENCE", "PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"]
      : legacy ? ["PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"] : ["ASPIRATION"];

    experienceRows.push(...provenanceFor(experienceOut.performed ?? [], "EXPERIENCE", index, experienceVisible));
    directionRows.push(...provenanceFor(directionOut.desired, "DIRECTION", index, directionVisible));

    const folded: CareerBlueprint = {
      personId: person.personId,
      experience: experienceOut.performed ?? [],
      liked: [], disliked: [], desired: directionOut.desired,
    };
    for (const [channel, volume] of Object.entries(channelVolumes(person, folded))) (volumes[channel] ??= []).push(volume.ratio);
    analysed += 1;
  }

  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  results.push({
    architecture: variantId,
    experienceProvenance: summarizeProvenance(experienceRows),
    directionProvenance: summarizeProvenance(directionRows),
    volumeRatios: Object.fromEntries(Object.entries(volumes).map(([k, v]) => [k, mean(v)])),
    peopleAnalysed: analysed,
    missing: corpus.people.length - analysed,
  });
}

// ---- report -------------------------------------------------------------------------------
process.stdout.write(`EXPERIENCE CHANNEL — where did each performed-work claim come from?\n`);
process.stdout.write(`${"architecture".padEnd(22)}${"claims".padStart(8)}${"supported".padStart(11)}${"contam".padStart(8)}${"rate".padStart(8)}${"drift".padStart(7)}${"unsupp".padStart(8)}${"ambig".padStart(7)}\n`);
for (const result of results) {
  const p = result.experienceProvenance;
  if (!p.claims) {
    // Three different reasons a channel has no rows, and conflating them would mislead: the
    // shared blueprint emits no supporting phrase at all, an unrun generation has no cache, and a
    // genuinely empty channel is an abstention. Only the first is a property of the architecture.
    const reason = result.peopleAnalysed === 0
      ? `no cached interpretations for this generation (${result.missing} people missing)`
      : "emits no supporting phrase, so provenance is unmeasurable";
    process.stdout.write(`${result.architecture.padEnd(22)}  n/a — ${reason}\n`);
    continue;
  }
  process.stdout.write(
    `${result.architecture.padEnd(22)}${String(p.claims).padStart(8)}${String(p.supported).padStart(11)}` +
    `${String(p.evidenceContamination).padStart(8)}${p.evidenceContaminationRate.toFixed(3).padStart(8)}` +
    `${String(p.interpretationDrift).padStart(7)}${String(p.unsupportedClaims).padStart(8)}${String(p.ambiguousProvenance).padStart(7)}\n`,
  );
  if (Object.keys(p.bySourceChannel).length) {
    process.stdout.write(`${"".padEnd(22)}contaminating sources: ${Object.entries(p.bySourceChannel).map(([k, v]) => `${k}=${v}`).join(", ")}\n`);
  }
}

process.stdout.write(`\nDIRECTION CHANNEL — where did each desired-work claim come from?\n`);
process.stdout.write(`${"architecture".padEnd(22)}${"claims".padStart(8)}${"supported".padStart(11)}${"contam".padStart(8)}${"rate".padStart(8)}${"drift".padStart(7)}${"unsupp".padStart(8)}${"ambig".padStart(7)}\n`);
for (const result of results) {
  const p = result.directionProvenance;
  if (!p) {
    process.stdout.write(`${result.architecture.padEnd(22)}   n/a — emits no supporting phrase\n`);
    continue;
  }
  process.stdout.write(
    `${result.architecture.padEnd(22)}${String(p.claims).padStart(8)}${String(p.supported).padStart(11)}` +
    `${String(p.evidenceContamination).padStart(8)}${p.evidenceContaminationRate.toFixed(3).padStart(8)}` +
    `${String(p.interpretationDrift).padStart(7)}${String(p.unsupportedClaims).padStart(8)}${String(p.ambiguousProvenance).padStart(7)}\n`,
  );
  if (Object.keys(p.bySourceChannel).length) {
    process.stdout.write(`${"".padEnd(22)}contaminating sources: ${Object.entries(p.bySourceChannel).map(([k, v]) => `${k}=${v}`).join(", ")}\n`);
  }
}

process.stdout.write(`\nCHANNEL VOLUME RATIO (interpreted / planted; 1.000 is exact)\n`);
process.stdout.write(`${"architecture".padEnd(22)}${"experience".padStart(12)}${"liked".padStart(9)}${"disliked".padStart(10)}${"desired".padStart(9)}\n`);
for (const result of results) {
  const r = result.volumeRatios;
  process.stdout.write(
    `${result.architecture.padEnd(22)}${(r.experience ?? 0).toFixed(3).padStart(12)}${(r.liked ?? 0).toFixed(3).padStart(9)}` +
    `${(r.disliked ?? 0).toFixed(3).padStart(10)}${(r.desired ?? 0).toFixed(3).padStart(9)}\n`,
  );
}

mkdirSync("artifacts/agent_experiments", { recursive: true });
// The Direction generation is in the filename: the v1 audit is the diagnosis that motivated v2,
// and overwriting it with a v2 audit would erase the evidence for the redesign.
const outputPath = `artifacts/agent_experiments/provenance-audit-${provider}-${family.toLowerCase()}-direction-${directionGeneration}.json`;
writeFileSync(outputPath, JSON.stringify({
  audit: "provenance", version: PROVENANCE_VERSION, family, people, provider, model, effort,
  directionPromptVersion: directionPrompt.version,
  experiencePromptVersion: EXPERIENCE_AGENT_PROMPT.version,
  modelCalls: 0,
  results,
  notes: [
    "Computed entirely from cached interpretations; no provider call was made.",
    "The shared CareerBlueprint emits no supporting phrase, so its provenance is UNMEASURABLE rather than clean.",
    "Contamination against a channel the agent never saw is recorded as interpretation drift, not leakage.",
    "Attribution is phrase containment against the evidence sentence, with an ambiguity margin because the corpus plants liked work that overlaps performed work.",
  ],
}, null, 2) + "\n");
process.stdout.write(`\nwrote ${outputPath}\n`);
