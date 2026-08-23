// Agent-first architecture: interpret once, match cheaply.
//
// THE EXPERIMENT THIS IS DESIGNED TO BE
// -------------------------------------
// A controlled ablation, not a demonstration. The agent arm uses the SAME matching function as
// `experience-lexical` — token overlap between the person's evidence and the job's
// responsibilities — and changes exactly one thing: the text being compared is a model's
// structured interpretation rather than the raw surface. So a difference in score is
// attributable to the REPRESENTATION and not to a cleverer scorer, a different metric, or a
// tuned threshold.
//
// If agent-first wins here, it wins because normalising "near misses on the wards" and
// "reportable safety events within clinical services" into the same structured content bridges
// a vocabulary gap that token overlap cannot cross. If it does not win, that is the result.
//
// COST SHAPE
// ----------
// Interpretation is per PERSON and per JOB, never per (person, job) pair. A person-by-job model
// loop would cost people x jobs calls and is the architecture this file exists to avoid. Every
// interpretation is cached by content, so the same job in two people's pools is paid for once.
import { InstrumentedRunner, type ModelRequest, type PromptSpec } from "@/agent/runtime";
import { worstCaseCostUsd } from "@/agent/anthropicProvider";
import { contentTokens } from "@/bench/render";
import type { Channel } from "@/bench/labels";
import type { PlantedFrameJob, PlantedFramePerson } from "@/bench/frameCorpus";
import type { RankingArchitecture } from "@/bench/architectures";

export const AGENT_ARCHITECTURE_VERSION = "agent-architecture.v1";

/**
 * One piece of work as the agent understands it.
 *
 * Deliberately plain English, NOT concept ids. The agent is never shown the benchmark's
 * ontology; handing it the label space would make the whole comparison circular. What is being
 * tested is whether general language understanding normalises two vocabularies onto common
 * ground, which is a property of the model, not of a lookup table.
 */
export interface StructuredWork {
  action: string;
  object: string;
  purpose: string;
  method: string;
  domain: string;
}

/** The persistent per-person representation. Built once, reused for every job. */
export interface CareerBlueprint {
  personId: string;
  experience: StructuredWork[];
  liked: StructuredWork[];
  disliked: StructuredWork[];
  desired: StructuredWork[];
}

const WORK_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", description: "the core verb, in plain general English" },
    object: { type: "string", description: "what the action is performed on, in plain general English" },
    purpose: { type: "string", description: "why it is done" },
    method: { type: "string", description: "how it is done" },
    domain: { type: "string", description: "the industry or setting" },
  },
  required: ["action", "object", "purpose", "method", "domain"],
  additionalProperties: false,
} as const;

export const PERSON_BLUEPRINT_SCHEMA = {
  type: "object",
  properties: {
    experience: { type: "array", items: WORK_SCHEMA },
    liked: { type: "array", items: WORK_SCHEMA },
    disliked: { type: "array", items: WORK_SCHEMA },
    desired: { type: "array", items: WORK_SCHEMA },
  },
  required: ["experience", "liked", "disliked", "desired"],
  additionalProperties: false,
} as const;

export const JOB_BLUEPRINT_SCHEMA = {
  type: "object",
  properties: { responsibilities: { type: "array", items: WORK_SCHEMA } },
  required: ["responsibilities"],
  additionalProperties: false,
} as const;

/**
 * The normalisation instruction is the load-bearing part of both prompts.
 *
 * Both sides are told to rewrite into *plain, general* language. Neither is told what the other
 * side's vocabulary looks like, and neither is given a target list — that would be handing over
 * the answer. They meet in the middle only if the model genuinely understands both.
 */
const NORMALISE = [
  "Rewrite every field in plain, general, industry-neutral English.",
  "Use the most ordinary word for each idea, not the wording of the source text.",
  "Two people describing the same work in different styles must produce the same fields.",
  "Never copy a distinctive phrase from the input if a plainer word means the same thing.",
].join(" ");

export const PERSON_BLUEPRINT_PROMPT: PromptSpec = {
  id: "person-blueprint",
  version: "v1",
  hypothesis:
    "Normalising a person's own words into structured work content bridges a vocabulary gap that token overlap cannot cross, without merging the four evidence channels.",
  render: (input) =>
    [
      "You are reading one person's description of their own working life.",
      "",
      "Separate what they HAVE DONE from what they LIKE, what they DISLIKE, and what they WANT NEXT.",
      "These four are independent. Never infer one from another: work someone has done is not",
      "automatically work they enjoy, and work they want next is not work they have done.",
      "",
      NORMALISE,
      "",
      "Use only what the text supports. Do not invent work that is not described.",
      "",
      "--- EXPERIENCE (what they have done) ---",
      String(input.experience ?? ""),
      "",
      "--- LIKES ---",
      String(input.liked ?? ""),
      "",
      "--- DISLIKES ---",
      String(input.disliked ?? ""),
      "",
      "--- WANTS NEXT ---",
      String(input.desired ?? ""),
    ].join("\n"),
};

export const JOB_BLUEPRINT_PROMPT: PromptSpec = {
  id: "job-blueprint",
  version: "v1",
  hypothesis:
    "Normalising job responsibilities into the same structured work content as the person side makes the two comparable without either side seeing the other's vocabulary.",
  render: (input) =>
    [
      "You are reading the responsibilities of one job posting.",
      "Express each distinct responsibility as structured work content.",
      "",
      NORMALISE,
      "",
      "Use only what the text supports. Do not invent responsibilities.",
      "",
      "--- RESPONSIBILITIES ---",
      String(input.responsibilities ?? ""),
    ].join("\n"),
};

const safeParse = <T,>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

export interface InterpretationOptions {
  maxOutputTokens?: number;
  model?: string;
  /** Called after each interpretation so a long run reports progress rather than going silent. */
  onProgress?: (done: number, total: number, kind: "person" | "job") => void;
}

/**
 * Interpret every person and job in a corpus.
 *
 * Returns the blueprints plus the runner, so cost and latency are attributable per phase:
 * person interpretation is ONBOARDING cost, job interpretation is CORPUS cost paid once and
 * amortised over every user who ever sees that job.
 */
export async function interpretCorpus(
  runner: InstrumentedRunner,
  people: PlantedFramePerson[],
  jobsByPerson: Map<string, PlantedFrameJob[]>,
  options: InterpretationOptions = {},
): Promise<{ blueprints: Map<string, CareerBlueprint>; jobWork: Map<string, StructuredWork[]> }> {
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const blueprints = new Map<string, CareerBlueprint>();
  const jobWork = new Map<string, StructuredWork[]>();

  let personDone = 0;
  for (const person of people) {
    const request: ModelRequest = {
      prompt: PERSON_BLUEPRINT_PROMPT,
      input: {
        experience: person.experienceEvidence.map((entry) => entry.text).join("\n"),
        liked: person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join("\n"),
        disliked: person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join("\n"),
        desired: person.aspirationEvidence.map((entry) => entry.text).join("\n"),
      },
      decoding: { temperature: 0, maxOutputTokens },
    };
    const { text } = await runner.run(request);
    const parsed = safeParse<Partial<CareerBlueprint>>(text, {});
    blueprints.set(person.personId, {
      personId: person.personId,
      experience: parsed.experience ?? [],
      liked: parsed.liked ?? [],
      disliked: parsed.disliked ?? [],
      desired: parsed.desired ?? [],
    });
    personDone += 1;
    options.onProgress?.(personDone, people.length, "person");
  }

  const allJobs = [...jobsByPerson.values()].flat();
  let jobDone = 0;
  for (const job of allJobs) {
    const request: ModelRequest = {
      prompt: JOB_BLUEPRINT_PROMPT,
      input: { responsibilities: job.responsibilities.map((entry) => entry.text).join("\n") },
      decoding: { temperature: 0, maxOutputTokens },
    };
    const { text } = await runner.run(request);
    jobWork.set(job.jobId, safeParse<{ responsibilities?: StructuredWork[] }>(text, {}).responsibilities ?? []);
    jobDone += 1;
    options.onProgress?.(jobDone, allJobs.length, "job");
  }

  return { blueprints, jobWork };
}

const workTokens = (works: StructuredWork[]): Set<string> =>
  contentTokens(works.map((work) => [work.action, work.object, work.purpose, work.method, work.domain].join(" ")).join(" "));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

/**
 * The agent architecture, over precomputed interpretations.
 *
 * The scoring function is IDENTICAL to `experience-lexical` — per-channel Jaccard, preference
 * signed as liked minus disliked. Only the text differs. Keeping the scorer identical is what
 * makes this an ablation of the representation rather than a comparison of two whole systems.
 */
export function createAgentArchitecture(
  blueprints: Map<string, CareerBlueprint>,
  jobWork: Map<string, StructuredWork[]>,
  id = "agent-blueprint",
): RankingArchitecture<{ experience: Set<string>; liked: Set<string>; disliked: Set<string>; desired: Set<string> }> {
  return {
    id,
    version: AGENT_ARCHITECTURE_VERSION,
    description: "Model-normalised structured work on both sides, matched by the same scorer as experience-lexical.",
    prepare: (person) => {
      const blueprint = blueprints.get(person.personId);
      return {
        experience: workTokens(blueprint?.experience ?? []),
        liked: workTokens(blueprint?.liked ?? []),
        disliked: workTokens(blueprint?.disliked ?? []),
        desired: workTokens(blueprint?.desired ?? []),
      };
    },
    score: (prepared, job, channel: Channel) => {
      const jobTokens = workTokens(jobWork.get(job.jobId) ?? []);
      if (channel === "experience") return jaccard(prepared.experience, jobTokens);
      if (channel === "direction") return jaccard(prepared.desired, jobTokens);
      return jaccard(prepared.liked, jobTokens) - jaccard(prepared.disliked, jobTokens);
    },
  };
}

/** Worst-case cost of one interpretation, for budget reservation. */
export const interpretationCost = (model: string, maxOutputTokens: number) => (request: ModelRequest) =>
  worstCaseCostUsd(model, request.prompt.render(request.input), maxOutputTokens);
