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
import type { WorkFrame } from "@/bench/semanticFrame";

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

/**
 * Character n-gram TF-IDF cosine similarity. A deliberately STRONGER lexical competitor.
 *
 * Whole-token overlap misses morphological variation entirely — "reconcile"/"reconciliation",
 * "forecast"/"forecasting" share no token but most of their characters. Sub-word matching
 * recovers that, so this closes the cheapest gap between token counting and anything claiming
 * to understand meaning.
 *
 * It is NOT a semantic embedding retriever and must not be reported as one: it has no notion
 * that "near misses" and "safety events" are related, because they share no characters either.
 * A true dense retriever needs an embedding provider, which this environment does not have —
 * recorded as a limitation rather than approximated and mislabelled.
 */
function charNgrams(text: string, n = 4): Map<string, number> {
  const cleaned = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const counts = new Map<string, number>();
  for (let index = 0; index + n <= cleaned.length; index += 1) {
    const gram = cleaned.slice(index, index + n);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const value of a.values()) normA += value * value;
  for (const [gram, value] of b) {
    normB += value * value;
    const other = a.get(gram);
    if (other) dot += other * value;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const charNgramArchitecture: RankingArchitecture<{
  experience: Map<string, number>;
  liked: Map<string, number>;
  disliked: Map<string, number>;
  desired: Map<string, number>;
}> = {
  id: "char-ngram-lexical",
  version: "1",
  description: "Character 4-gram cosine similarity per channel. Stronger lexical: catches morphological variation.",
  prepare: (person) => ({
    experience: charNgrams(person.experienceEvidence.map((entry) => entry.text).join(" ")),
    liked: charNgrams(person.preferenceEvidence.filter((e) => e.stance === "LIKE").map((e) => e.text).join(" ")),
    disliked: charNgrams(person.preferenceEvidence.filter((e) => e.stance === "DISLIKE").map((e) => e.text).join(" ")),
    desired: charNgrams(person.aspirationEvidence.map((entry) => entry.text).join(" ")),
  }),
  score: (prepared, job, channel) => {
    const jobGrams = charNgrams(job.responsibilities.map((entry) => entry.text).join(" "));
    if (channel === "experience") return cosine(prepared.experience, jobGrams);
    if (channel === "direction") return cosine(prepared.desired, jobGrams);
    return cosine(prepared.liked, jobGrams) - cosine(prepared.disliked, jobGrams);
  },
};

/**
 * ORACLE NORMALIZER — a control, not a candidate.
 *
 * WHAT VALIDITY THREAT THIS EXISTS TO TEST
 * ----------------------------------------
 * The agent arm is told to normalise both sides into "plain, general English". The corpus's
 * own `neutralForms` are also plain English. So an agent win could mean either of two very
 * different things:
 *
 *   (a) the model genuinely understands both vocabularies and maps them onto common ground, or
 *   (b) the task reduces to "reach the neutral register the corpus author happened to write",
 *       in which case the result is partly an artifact of how the lexicon was authored.
 *
 * This control performs PERFECT normalisation by construction: it reads planted frames and
 * renders them through `neutralForms` on both sides. It therefore measures the CEILING of the
 * normalise-then-token-match strategy.
 *
 * How to read it against the agent:
 *   agent ≈ this        normalisation is the whole game; interpretation quality is not the
 *                       binding constraint, and (b) is a live concern for the headline.
 *   agent << this       the agent's interpretation is lossy; there is real headroom.
 *   this << 1.000       even PERFECT normalisation cannot solve the task by token matching,
 *                       so the matching function — not the representation — is the bottleneck.
 *
 * It reads hidden truth, so it can never be reported as a competing architecture.
 */
export function oracleNormalizerArchitecture(
  neutralFormsFor: (conceptId: string) => string[],
  identityRoles: readonly string[],
): RankingArchitecture<{ experience: Set<string>; liked: Set<string>; disliked: Set<string>; desired: Set<string> }> {
  // Deterministic: always the FIRST neutral form, so both sides normalise identically. Picking
  // randomly would inject noise that has nothing to do with the property being measured.
  const normalise = (frames: { frame: WorkFrame }[]): Set<string> =>
    contentTokens(
      frames
        .map((entry) => identityRoles.map((role) => neutralFormsFor(entry.frame[role as keyof WorkFrame] ?? "")[0] ?? "").join(" "))
        .join(" "),
    );

  return {
    id: "oracle-normalizer",
    version: "1",
    description: "CONTROL. Perfect normalisation of planted truth through the corpus's own neutral register.",
    prepare: (person) => ({
      experience: normalise(person.performed.map((entry) => entry.work)),
      liked: normalise(person.liked),
      disliked: normalise(person.disliked),
      desired: normalise(person.desired),
    }),
    score: (prepared, job, channel) => {
      const jobTokens = normalise([...job.coreWork, ...job.incidentalWork]);
      if (channel === "experience") return jaccard(prepared.experience, jobTokens);
      if (channel === "direction") return jaccard(prepared.desired, jobTokens);
      return jaccard(prepared.liked, jobTokens) - jaccard(prepared.disliked, jobTokens);
    },
  };
}
