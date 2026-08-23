// Candidate architectures, competing on the frame corpus.
//
// One interface, several implementations, all scored by identical metrics on identical frozen
// inputs. The point is to let the evidence choose, so nothing here is privileged: the
// production O*NET path is a competitor, not the reference.
//
// BASELINES ARE NEVER WEAKENED
// ----------------------------
// `experience-lexical` restricts the query to the person's experience statements rather than
// the whole narrative. On the previous corpus that raised experience NDCG@5 from 0.920 to
// 0.994 and beat the full four-channel pipeline. A baseline must be represented by its
// STRONGEST honest form, or "we beat the baseline" means only "we beat a version of it we
// chose to handicap".
import { contentTokens } from "@/bench/render";
import { mulberry32 } from "@/lab/rng";
import type { Channel } from "@/bench/labels";
import type { PlantedFrameJob, PlantedFramePerson } from "@/bench/frameCorpus";

export const ARCHITECTURE_HARNESS_VERSION = "architectures.v1";

/**
 * A candidate architecture.
 *
 * `prepare` exists to make the persistent-blueprint economics measurable: work done once per
 * PERSON is charged once, and work done per (person, job) pair is charged per pair. An
 * architecture that must re-read the person for every job is not the same product as one that
 * interprets them once and reuses it, even if their rankings are identical.
 */
export interface RankingArchitecture<Prepared = unknown> {
  id: string;
  version: string;
  description: string;
  /** Interpret the person once. Cost attributed to onboarding. */
  prepare(person: PlantedFramePerson): Prepared;
  /** Score one job on one channel. Higher is better. Cost attributed to matching. */
  score(prepared: Prepared, job: PlantedFrameJob, channel: Channel): number;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

/** Rank a person's jobs for one channel. Ties break on job id so ordering is deterministic. */
export function rankJobs<P>(
  architecture: RankingArchitecture<P>,
  person: PlantedFramePerson,
  jobs: PlantedFrameJob[],
  channel: Channel,
): string[] {
  const prepared = architecture.prepare(person);
  const scored = jobs.map((job) => ({ jobId: job.jobId, score: architecture.score(prepared, job, channel) }));
  return scored.sort((a, b) => b.score - a.score || a.jobId.localeCompare(b.jobId)).map((entry) => entry.jobId);
}

// ---------------------------------------------------------------------------
// Deterministic reference architectures
// ---------------------------------------------------------------------------

/** Control. Any architecture that cannot beat this is not doing anything. */
export const randomArchitecture: RankingArchitecture<{ seed: number }> = {
  id: "random",
  version: "1",
  description: "Deterministic pseudo-random ordering. The floor.",
  prepare: (person) => ({ seed: [...person.personId].reduce((total, ch) => total + ch.charCodeAt(0), 0) }),
  score: (prepared, job) => mulberry32(prepared.seed + [...job.jobId].reduce((t, c) => t + c.charCodeAt(0), 0))(),
};

/**
 * Title matching. The conventional product, reduced to its essence.
 *
 * The corpus is built so this MUST score at chance — that is an acceptance gate, not a
 * prediction. It is included so the claim is visible in the results table rather than only in
 * the gate output.
 */
export const titleOnlyArchitecture: RankingArchitecture<PlantedFramePerson> = {
  id: "title-only",
  version: "1",
  description: "Score by title-family match against the person's own title.",
  prepare: (person) => person,
  score: (person, job) =>
    (job.titleFamily === person.homeTitleFamily ? 1 : 0) + (job.industry === person.homeIndustry ? 0.5 : 0),
};

/** Whole-resume lexical similarity. Mixes all four channels into one query. */
export const resumeLexicalArchitecture: RankingArchitecture<Set<string>> = {
  id: "resume-lexical",
  version: "1",
  description: "Token overlap between the whole narrative and the whole job description.",
  prepare: (person) => contentTokens(person.narrative),
  score: (tokens, job) => jaccard(tokens, contentTokens(job.descriptionText)),
};

/**
 * Channel-restricted lexical similarity. The strongest simple reference.
 *
 * Each channel queries only the evidence that belongs to it, so the baseline is not diluted by
 * text about a different channel. Preference is signed — liked evidence minus disliked — for
 * the same reason the label is: a job full of work the person hates must not score well just
 * because it also contains something they like.
 */
export const experienceLexicalArchitecture: RankingArchitecture<{
  experience: Set<string>;
  liked: Set<string>;
  disliked: Set<string>;
  desired: Set<string>;
}> = {
  id: "experience-lexical",
  version: "1",
  description: "Per-channel token overlap using only that channel's own evidence.",
  prepare: (person) => ({
    experience: contentTokens(person.experienceEvidence.map((entry) => entry.text).join(" ")),
    liked: contentTokens(person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join(" ")),
    disliked: contentTokens(person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join(" ")),
    desired: contentTokens(person.aspirationEvidence.map((entry) => entry.text).join(" ")),
  }),
  score: (prepared, job, channel) => {
    const jobTokens = contentTokens(job.responsibilities.map((entry) => entry.text).join(" "));
    if (channel === "experience") return jaccard(prepared.experience, jobTokens);
    if (channel === "direction") return jaccard(prepared.desired, jobTokens);
    return jaccard(prepared.liked, jobTokens) - jaccard(prepared.disliked, jobTokens);
  },
};

/**
 * The production O*NET canonical path, as a competitor.
 *
 * Person evidence and job responsibilities are each mapped to canonical O*NET Task/DWA
 * identity by `src/v3/mapper`, and the score is the overlap of those canonical id sets. This
 * is the architecture the product currently ships; it is evaluated here on exactly the same
 * footing as everything else, and is permitted to lose.
 *
 * The mapper is lexical overlap against O*NET statements with no stemming or embeddings, so
 * on SEMANTIC_BRIDGE it has no mechanism and abstains almost everywhere. That is a real
 * property of the architecture, not a handicap imposed by the corpus.
 */
export function onetCanonicalArchitecture(
  mapWork: (text: string) => { level: string; selected: unknown },
): RankingArchitecture<{ experience: Set<string>; liked: Set<string>; disliked: Set<string>; desired: Set<string> }> {
  const canonicalIds = (texts: string[]): Set<string> => {
    const ids = new Set<string>();
    for (const text of texts) {
      const mapped = mapWork(text);
      const selected = mapped.selected as { taskId?: string | null; id?: string } | null;
      if (!selected) continue;
      if (mapped.level === "task" && selected.taskId) ids.add(`task:${selected.taskId}`);
      else if (mapped.level === "dwa" && selected.id) ids.add(`dwa:${selected.id}`);
    }
    return ids;
  };
  return {
    id: "onet-canonical",
    version: "1",
    description: "Map both sides to canonical O*NET Task/DWA identity, then overlap the id sets.",
    prepare: (person) => ({
      experience: canonicalIds(person.experienceEvidence.map((entry) => entry.text)),
      liked: canonicalIds(person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text)),
      disliked: canonicalIds(person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text)),
      desired: canonicalIds(person.aspirationEvidence.map((entry) => entry.text)),
    }),
    score: (prepared, job, channel) => {
      const jobIds = canonicalIds(job.responsibilities.map((entry) => entry.text));
      if (channel === "experience") return jaccard(prepared.experience, jobIds);
      if (channel === "direction") return jaccard(prepared.desired, jobIds);
      return jaccard(prepared.liked, jobIds) - jaccard(prepared.disliked, jobIds);
    },
  };
}

/**
 * ORACLE — not a candidate. Scores directly from planted frame identity.
 *
 * Included to establish the CEILING. Without it, a low score is ambiguous between "the
 * architecture is weak" and "this channel or family is not solvable from the text at all", and
 * that ambiguity is exactly where over-claiming happens. Its score is the metric's maximum by
 * construction, so it must never appear in a comparison as if it were a competitor.
 */
export const oracleArchitecture: RankingArchitecture<{
  experience: Set<string>;
  liked: Set<string>;
  disliked: Set<string>;
  desired: Set<string>;
}> = {
  id: "oracle-planted-truth",
  version: "1",
  description: "CEILING ONLY. Reads planted frame identity directly; never a candidate architecture.",
  prepare: (person) => ({
    experience: new Set(person.performed.map((entry) => entry.work.identity)),
    liked: new Set(person.liked.map((work) => work.identity)),
    disliked: new Set(person.disliked.map((work) => work.identity)),
    desired: new Set(person.desired.map((work) => work.identity)),
  }),
  score: (prepared, job, channel) => {
    const jobIdentities = new Set([...job.coreWork, ...job.incidentalWork].map((work) => work.identity));
    if (channel === "experience") return jaccard(prepared.experience, jobIdentities);
    if (channel === "direction") return jaccard(prepared.desired, jobIdentities);
    return jaccard(prepared.liked, jobIdentities) - jaccard(prepared.disliked, jobIdentities);
  },
};

/**
 * DEGENERATE CONTROL — scores every job identically.
 *
 * Its only job is to expose ordering artifacts. A constant-score ranker carries zero
 * information, so its NDCG must sit at the same level as `random`. If it scores higher, the
 * position of a job in the pool is correlated with its relevance and every tied or abstaining
 * architecture is being silently rewarded for it.
 *
 * This is not hypothetical: before the corpus shuffled jobs prior to assigning ids, this
 * control scored NDCG@10 0.933 on SEMANTIC_BRIDGE — and so did the O*NET path, which abstains
 * on 100% of bridge text and was in fact returning exactly this ranking.
 */
export const constantScoreArchitecture: RankingArchitecture<null> = {
  id: "constant-score",
  version: "1",
  description: "DEGENERATE CONTROL. Scores every job 0; detects pool-ordering artifacts.",
  prepare: () => null,
  score: () => 0,
};

/** The deterministic architectures available without any model runtime. */
export const DETERMINISTIC_ARCHITECTURES: RankingArchitecture<never>[] = [
  randomArchitecture,
  titleOnlyArchitecture,
  resumeLexicalArchitecture,
  experienceLexicalArchitecture,
] as unknown as RankingArchitecture<never>[];
