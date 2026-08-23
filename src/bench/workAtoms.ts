// Canonical WORK ATOMS: the unit of planted truth for every product-level benchmark.
//
// WHY ATOMS EXIST
// ---------------
// A ranking benchmark whose relevance labels come from the scoring algorithm is circular:
// it measures agreement with itself. So relevance here is defined over ATOM IDENTITY --
// which canonical O*NET Task a person performed / likes / wants, and which canonical Tasks a
// job actually contains -- and never over any score the system produces.
//
// The benchmark pipeline is therefore:
//
//   planted atom set (truth)
//     -> independently rendered surface language  (src/bench/render.ts)
//     -> the real production pipeline tries to recover it
//     -> metrics compare recovered ranking against the planted atom overlap
//
// Nothing downstream of the planting step may read an atom id. The algorithm sees only
// rendered text; the grader sees only atom ids.
import { requireOnetCorpus } from "@/onet/corpus";
import { isKnowledgeWorkScope, stratumFor, type OnetStratum } from "@/onet/strata";
import { hashSeed, mulberry32, type Rng } from "@/lab/rng";
import { ONET_VERSION } from "@/onet/types";

export const WORK_ATOM_VERSION = "work-atom.v1";

export interface WorkAtom {
  /** Stable benchmark identity. Never visible to the algorithm under test. */
  atomId: string;
  /** Canonical O*NET Task identity the atom stands for. */
  taskId: string;
  /** Verbatim O*NET task statement. Renderers paraphrase this; they never emit it as-is. */
  statement: string;
  dwaIds: string[];
  occupationCode: string;
  occupationTitle: string;
  stratum: OnetStratum;
  /** O*NET task type, constrained. */
  taskType: "core" | "supplemental" | "unknown";
  /** O*NET mean task importance (IM 1-5) when published. */
  importance: number | null;
  onetVersion: string;
}

export interface AtomPool {
  version: string;
  atoms: WorkAtom[];
  byStratum: Map<OnetStratum, WorkAtom[]>;
}

/**
 * Deterministic stratified atom pool.
 *
 * Only in-scope knowledge-work occupations contribute, and only tasks that carry a DWA and a
 * published importance rating, so every atom has real canonical identity and real importance
 * metadata rather than invented weights. `perStratum` caps each stratum so a few
 * task-heavy occupations cannot dominate the pool.
 */
export function buildAtomPool(seed = 20260823, perStratum = 40): AtomPool {
  const corpus = requireOnetCorpus();
  const rng = mulberry32(hashSeed(`atom-pool:${seed}:${perStratum}`));
  const byStratum = new Map<OnetStratum, WorkAtom[]>();
  const candidates = new Map<OnetStratum, WorkAtom[]>();

  for (const occupation of corpus.occupations) {
    if (!isKnowledgeWorkScope(occupation)) continue;
    const stratum = stratumFor(occupation);
    for (const task of occupation.taskStatements) {
      if (!task.dwaIds.length || task.importance === undefined) continue;
      const statement = task.statement.trim();
      if (statement.length < 40) continue;
      const atom: WorkAtom = {
        atomId: `atom-${occupation.onetSocCode}-${task.taskId}`,
        taskId: String(task.taskId),
        statement,
        dwaIds: [...new Set(task.dwaIds.filter(Boolean))],
        occupationCode: occupation.onetSocCode,
        occupationTitle: occupation.title,
        stratum,
        taskType: /^core$/i.test(task.taskType) ? "core" : /^supplemental$/i.test(task.taskType) ? "supplemental" : "unknown",
        importance: task.importance ?? null,
        onetVersion: ONET_VERSION,
      };
      candidates.set(stratum, [...(candidates.get(stratum) ?? []), atom]);
    }
  }

  const atoms: WorkAtom[] = [];
  for (const stratum of [...candidates.keys()].sort()) {
    const shuffled = shuffle(rng, candidates.get(stratum)!);
    const taken = shuffled.slice(0, perStratum);
    byStratum.set(stratum, taken);
    atoms.push(...taken);
  }
  return { version: WORK_ATOM_VERSION, atoms, byStratum };
}

/** Strata with enough atoms to build a person and a job archetype set from. */
export function usableStrata(pool: AtomPool, minimum = 20): OnetStratum[] {
  return [...pool.byStratum.entries()].filter(([, atoms]) => atoms.length >= minimum).map(([stratum]) => stratum).sort();
}

/** Deterministic Fisher-Yates. Shared so atom selection carries no positional bias. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

export function takeDistinct<T>(rng: Rng, items: readonly T[], count: number, exclude: Set<T> = new Set()): T[] {
  return shuffle(rng, items.filter((item) => !exclude.has(item))).slice(0, count);
}

/** Atom-set identity used by every label computation. */
export function atomIds(atoms: readonly WorkAtom[]): Set<string> {
  return new Set(atoms.map((atom) => atom.atomId));
}
