// EXPERIMENTAL candidate retrieval strategies: canonical identity as a SET, not a point.
//
// See `experiments/records/soft-canonical-identity/record.md`.
//
// `mapWork` computes a ranked top-K candidate set with similarity scores and then collapses it
// to a single `selected` Task or DWA, or to nothing when similarity falls under both cutoffs.
// Both existing consumers of canonical identity read only `mapping.selected`; `mapping.candidates`
// is computed and discarded. When person text is degraded, selection fails and the evidence
// contributes nothing, even though the ranked candidates are still there.
//
// These strategies test whether that discarded set carries recoverable identity signal. They
// add NO title, occupation, or industry signal, so the leakage guard is unaffected: the only
// change is which part of an existing mapping result is read.
//
// Nothing here is wired into the production path. `CANDIDATE_STRATEGIES` in
// `src/bench/candidates.ts` is unchanged; these are evaluated alongside it.
import { mapWork } from "@/v3/mapper";
import type { CandidateRetrievalStrategy } from "@/bench/candidates";
import type { PlantedJob, PlantedPerson } from "@/bench/corpus";

export const SOFT_CANDIDATE_VERSION = "bench-soft-candidates.v1";

/** A canonical identity with the confidence the mapper assigned to the candidate that carried it. */
interface WeightedIdentity {
  identity: string;
  weight: number;
}

/**
 * Every canonical identity the mapper retained for this text, at both levels.
 *
 * Task ids are the specific identity; DWA ids are the coarser generalized-work identity that
 * survives paraphrase and deletion better. Both are emitted so the overlap can match at
 * whichever level still carries signal.
 */
function retainedIdentities(text: string): WeightedIdentity[] {
  const mapping = mapWork(text);
  const out: WeightedIdentity[] = [];
  for (const candidate of mapping.candidates) {
    const weight = candidate.similarity;
    if (candidate.task.taskId) out.push({ identity: `task:${candidate.task.taskId}`, weight });
    for (const dwa of candidate.task.dwas) out.push({ identity: `dwa:${dwa.id}`, weight });
  }
  return out;
}

/** Best weight per identity, since the same DWA can arrive from several candidate tasks. */
function identityMap(texts: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const text of texts) {
    for (const { identity, weight } of retainedIdentities(text)) {
      map.set(identity, Math.max(map.get(identity) ?? 0, weight));
    }
  }
  return map;
}

function personTexts(person: PlantedPerson): string[] {
  return [...person.experienceEvidence, ...person.preferenceEvidence, ...person.aspirationEvidence].map((e) => e.rendered.text);
}

function jobTexts(job: PlantedJob): string[] {
  return job.responsibilities.map((r) => r.rendered.text);
}

/**
 * Unweighted set overlap over retained candidates.
 *
 * Mirrors the existing `canonical-work` scoring shape (shared identities over the job's own
 * identity count) so the ONLY difference under test is set-versus-point identity.
 */
export const softCanonicalRetrieval: CandidateRetrievalStrategy = {
  id: "canonical-soft",
  version: "candidate-retrieval.canonical-soft.v1",
  retrieve(person, pool) {
    const personIdentities = new Set(identityMap(personTexts(person)).keys());
    return [...pool]
      .map((job) => {
        const jobIdentities = new Set(identityMap(jobTexts(job)).keys());
        let shared = 0;
        for (const identity of jobIdentities) if (personIdentities.has(identity)) shared += 1;
        return { job, score: jobIdentities.size ? shared / jobIdentities.size : 0 };
      })
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

/**
 * Similarity-weighted variant. A shared identity contributes the product of the confidences
 * the mapper assigned on each side, so a barely-retained candidate cannot count as much as a
 * confidently-matched one. This tests whether the raw set is too permissive.
 */
export const softWeightedCanonicalRetrieval: CandidateRetrievalStrategy = {
  id: "canonical-soft-weighted",
  version: "candidate-retrieval.canonical-soft-weighted.v1",
  retrieve(person, pool) {
    const personIdentities = identityMap(personTexts(person));
    return [...pool]
      .map((job) => {
        const jobIdentities = identityMap(jobTexts(job));
        let shared = 0;
        let total = 0;
        for (const [identity, jobWeight] of jobIdentities) {
          total += jobWeight;
          const personWeight = personIdentities.get(identity);
          if (personWeight !== undefined) shared += personWeight * jobWeight;
        }
        return { job, score: total ? shared / total : 0 };
      })
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

/**
 * DWA-only variant: generalized work activities, ignoring specific task identity entirely.
 * If this matches the full soft strategy, the recoverable signal is the coarse activity rather
 * than the specific task, which is a claim about the right level of the ontology.
 */
export const softDwaRetrieval: CandidateRetrievalStrategy = {
  id: "canonical-soft-dwa",
  version: "candidate-retrieval.canonical-soft-dwa.v1",
  retrieve(person, pool) {
    const keepDwa = (map: Map<string, number>) => new Set([...map.keys()].filter((k) => k.startsWith("dwa:")));
    const personIdentities = keepDwa(identityMap(personTexts(person)));
    return [...pool]
      .map((job) => {
        const jobIdentities = keepDwa(identityMap(jobTexts(job)));
        let shared = 0;
        for (const identity of jobIdentities) if (personIdentities.has(identity)) shared += 1;
        return { job, score: jobIdentities.size ? shared / jobIdentities.size : 0 };
      })
      .sort((a, b) => b.score - a.score || a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => entry.job.jobId);
  },
};

export const SOFT_CANDIDATE_STRATEGIES: CandidateRetrievalStrategy[] = [
  softCanonicalRetrieval,
  softWeightedCanonicalRetrieval,
  softDwaRetrieval,
];
