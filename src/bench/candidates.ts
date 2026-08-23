// Candidate job retrieval benchmark.
//
// WHY THIS IS SEPARATE AND PRODUCT-CRITICAL
// -----------------------------------------
// A perfect reranker cannot recover a relevant job that candidate generation never retrieved.
// Retrieval recall is therefore an upper bound on every downstream ranking metric, and it must
// be measured on its own.
//
// SCOPE: this benchmarks CANDIDATE GENERATION over a controlled job pool. LIVE POSTING
// INGESTION, freshness, and closed-job detection are explicitly out of scope for this
// algorithmic loop (docs/METRIC_COVERAGE_MATRIX.md) and are not an excuse for skipping this
// benchmark.
import { mapWork } from "@/v3/mapper";
import type { PlantedJob, PlantedPerson } from "@/bench/corpus";
import { contentTokens } from "@/bench/render";
import { isRelevant, isSurprisingTransfer, labelPair, type PairLabel } from "@/bench/labels";

export const CANDIDATE_BENCH_VERSION = "bench-candidates.v1";

export interface CandidateRetrievalStrategy {
  id: string;
  version: string;
  /** Return job ids in retrieval-priority order. Length may exceed K; callers truncate. */
  retrieve(person: PlantedPerson, pool: PlantedJob[]): string[];
}

/** Lexical retrieval over the person narrative and job text. The cheap deterministic default. */
export const lexicalRetrieval: CandidateRetrievalStrategy = {
  id: "lexical-overlap",
  version: "candidate-retrieval.lexical.v1",
  retrieve(person, pool) {
    const query = contentTokens(person.narrative);
    return [...pool]
      .map((job) => ({ job, score: overlap(query, contentTokens(job.descriptionText)) }))
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

/**
 * Canonical-work retrieval: map the person's evidence to canonical Tasks/DWAs, map each job's
 * responsibilities, and rank jobs by shared canonical identity. This is the retrieval strategy
 * the product thesis actually depends on, and the one whose recall the loop may optimize.
 */
export const canonicalWorkRetrieval: CandidateRetrievalStrategy = {
  id: "canonical-work",
  version: "candidate-retrieval.canonical.v1",
  retrieve(person, pool) {
    const personIdentities = new Set(
      [...person.experienceEvidence, ...person.preferenceEvidence, ...person.aspirationEvidence]
        .flatMap((entry) => canonicalIdentities(entry.rendered.text)),
    );
    return [...pool]
      .map((job) => {
        const jobIdentities = new Set(job.responsibilities.flatMap((entry) => canonicalIdentities(entry.rendered.text)));
        let shared = 0;
        for (const identity of jobIdentities) if (personIdentities.has(identity)) shared += 1;
        return { job, score: jobIdentities.size ? shared / jobIdentities.size : 0 };
      })
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

/** Title-only retrieval, as the conventional reference. */
export const titleRetrieval: CandidateRetrievalStrategy = {
  id: "title-only",
  version: "candidate-retrieval.title.v1",
  retrieve(person, pool) {
    const query = contentTokens(person.homeTitle);
    return [...pool]
      .map((job) => ({ job, score: overlap(query, contentTokens(job.title)) + (job.titleStratum === person.homeStratum ? 0.5 : 0) }))
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

export const CANDIDATE_STRATEGIES: CandidateRetrievalStrategy[] = [canonicalWorkRetrieval, lexicalRetrieval, titleRetrieval];

export interface CandidateReport {
  strategy: string;
  version: string;
  k: number;
  /** Fraction of experience-relevant jobs that entered the top-K candidate set. */
  candidateRecallAtK: number | null;
  /** 1 - candidateRecallAtK. The headline "we never even saw it" number. */
  relevantJobMissRate: number | null;
  crossTitleRecallAtK: number | null;
  crossIndustryRecallAtK: number | null;
  surprisingTransferRecallAtK: number | null;
  preferenceRecallAtK: number | null;
  directionRecallAtK: number | null;
  /** Distinct titles / strata / industries in the top-K set, over K. Higher is more diverse. */
  titleDiversity: number;
  stratumDiversity: number;
  industryDiversity: number;
  /** Largest share of the top-K set held by one title / stratum / industry. Lower is better. */
  titleConcentration: number;
  stratumConcentration: number;
  industryConcentration: number;
  /** Precision@K restricted to jobs that are BOTH surprising and experience-relevant. */
  noveltyConditionedRelevance: number | null;
}

/** Evaluate one retrieval strategy for one person over the full job pool. */
export function evaluateRetrieval(
  strategy: CandidateRetrievalStrategy,
  person: PlantedPerson,
  pool: PlantedJob[],
  k: number,
): CandidateReport {
  const labels = new Map<string, PairLabel>(pool.map((job) => [job.jobId, labelPair(person, job)]));
  const byId = new Map(pool.map((job) => [job.jobId, job]));
  const ranked = strategy.retrieve(person, pool);
  const head = ranked.slice(0, k);
  const headSet = new Set(head);

  const recallFor = (predicate: (label: PairLabel) => boolean) => {
    const targets = pool.filter((job) => predicate(labels.get(job.jobId)!));
    if (!targets.length) return null;
    return targets.filter((job) => headSet.has(job.jobId)).length / targets.length;
  };

  const headJobs = head.map((jobId) => byId.get(jobId)!).filter(Boolean);
  const share = (values: string[]) => {
    if (!values.length) return 0;
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return Math.max(...counts.values()) / values.length;
  };
  const distinct = (values: string[]) => (values.length ? new Set(values).size / values.length : 0);

  const candidateRecallAtK = recallFor((label) => isRelevant(label, "experience"));
  const surprising = headJobs.filter((job) => isSurprisingTransfer(labels.get(job.jobId)!));

  return {
    strategy: strategy.id,
    version: strategy.version,
    k,
    candidateRecallAtK,
    relevantJobMissRate: candidateRecallAtK === null ? null : 1 - candidateRecallAtK,
    crossTitleRecallAtK: recallFor((label) => label.crossTitle && isRelevant(label, "experience")),
    crossIndustryRecallAtK: recallFor((label) => label.crossIndustry && isRelevant(label, "experience")),
    surprisingTransferRecallAtK: recallFor(isSurprisingTransfer),
    preferenceRecallAtK: recallFor((label) => isRelevant(label, "preference")),
    directionRecallAtK: recallFor((label) => isRelevant(label, "direction")),
    titleDiversity: distinct(headJobs.map((job) => job.title)),
    stratumDiversity: distinct(headJobs.map((job) => job.titleStratum)),
    industryDiversity: distinct(headJobs.map((job) => job.industry)),
    titleConcentration: share(headJobs.map((job) => job.title)),
    stratumConcentration: share(headJobs.map((job) => job.titleStratum)),
    industryConcentration: share(headJobs.map((job) => job.industry)),
    noveltyConditionedRelevance: headJobs.length ? surprising.length / headJobs.length : null,
  };
}

function canonicalIdentities(text: string): string[] {
  const mapping = mapWork(text);
  if (!mapping.selected) return [];
  const selected = mapping.selected as { taskId?: string | null; id?: string };
  if (mapping.level === "task" && selected.taskId) return [`task:${selected.taskId}`];
  if (mapping.level === "dwa" && selected.id) return [`dwa:${selected.id}`];
  return [];
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}
