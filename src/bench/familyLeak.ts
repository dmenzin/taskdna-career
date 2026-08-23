// Per-family lexical-leak measurement — the acceptance gate for the frame corpus.
//
// WHY PER-FAMILY AND NOT ONE GLOBAL THRESHOLD
// -------------------------------------------
// The old corpus was rejected because raw token overlap identified same-work pairs at ROC AUC
// 0.9814 — the wording nearly gave away the answer. The naive repair is to demand AUC 0.50
// everywhere. That would be a different mistake: real resumes and real job postings DO share
// vocabulary, so a corpus engineered to forbid it measures performance in a world that does
// not exist, and would flatter whichever architecture happens to suit that extreme.
//
// So each family carries its OWN preregistered expectation
// (`docs/BENCHMARK_FAMILIES_PREREGISTRATION.md` § 2), and they are reported separately and
// never averaged:
//
//   SEMANTIC_BRIDGE  AUC must sit in [0.45, 0.55]. Above that, the disjoint lexicon leaks.
//   NATURAL          AUC is EXPECTED above chance. There is no upper gate — only a floor,
//                    because a NATURAL family at chance would mean the neutral register is
//                    secretly disjoint and the family is not natural at all.
//   LEXICAL_TRAP     Graded by confusability, not by AUC: trap-partner pairs must LOOK more
//                    alike than genuinely same-work pairs do. A trap that does not look
//                    similar is not a trap.
import { contentTokens } from "@/bench/render";
import { mulberry32, type Rng } from "@/lab/rng";
import {
  frameIdentity,
  renderJobFrame,
  renderPersonFrame,
  sampleFrame,
  trapVariant,
  type Concept,
  type RenderFamily,
  type WorkFrame,
} from "@/bench/semanticFrame";

export const FAMILY_LEAK_VERSION = "family-leak.v1";

/** Preregistered per-family expectations. Changing these is a metric-contract change. */
export const FAMILY_LEAK_EXPECTATIONS: Record<RenderFamily, { minAuc: number; maxAuc: number; rationale: string }> = {
  SEMANTIC_BRIDGE: {
    minAuc: 0.45,
    maxAuc: 0.55,
    rationale: "disjoint vocabulary must leave token overlap at chance; above 0.55 the lexicon leaks",
  },
  NATURAL: {
    minAuc: 0.55,
    maxAuc: 1,
    rationale: "natural documents legitimately share words; at chance the register would secretly be disjoint",
  },
  LEXICAL_TRAP: {
    // Graded by the confusability margin below, not by AUC. The permissive band records that
    // AUC is reported for inspection but is not the gate for this family.
    minAuc: 0,
    maxAuc: 1,
    rationale: "graded by trap confusability margin, not by AUC",
  },
};

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

/** Rank-based ROC AUC with tie handling. */
export function rocAuc(positive: number[], negative: number[]): number {
  if (!positive.length || !negative.length) return 0.5;
  const all = [...positive.map((v) => ({ v, p: 1 })), ...negative.map((v) => ({ v, p: 0 }))].sort((a, b) => a.v - b.v);
  let index = 0;
  let rankSum = 0;
  while (index < all.length) {
    let end = index;
    while (end + 1 < all.length && all[end + 1]!.v === all[index]!.v) end += 1;
    const averageRank = (index + end) / 2 + 1;
    for (let t = index; t <= end; t += 1) if (all[t]!.p === 1) rankSum += averageRank;
    index = end + 1;
  }
  return (rankSum - (positive.length * (positive.length + 1)) / 2) / (positive.length * negative.length);
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export interface FamilyLeakReport {
  family: RenderFamily;
  frames: number;
  sameIdentityPairs: number;
  differentIdentityPairs: number;
  meanSameIdentityOverlap: number;
  meanDifferentIdentityOverlap: number;
  /** Token overlap used as a same-work detector. */
  lexicalAuc: number;
  /** Mean overlap between a frame and its trap variant. Only meaningful for LEXICAL_TRAP. */
  meanTrapPartnerOverlap: number | null;
  /**
   * How much MORE alike a trap pair looks than a genuinely same-work pair. Positive means the
   * trap is doing its job: superficially similar, materially different work.
   */
  trapConfusabilityMargin: number | null;
  /** Verbatim-identical rendered sentences across the two sides. Must always be zero. */
  identicalRenderings: number;
  pass: boolean;
  failures: string[];
}

/**
 * Measure one rendering family.
 *
 * Person and job text are rendered from the SAME frames, then every person is compared with
 * every job. Pairs whose frame identity matches are the positives.
 */
export function measureFamilyLeak(
  family: RenderFamily,
  options: { frames?: number; seed?: number; vocabulary?: Concept["family"][] } = {},
): FamilyLeakReport {
  const frameCount = options.frames ?? 300;
  const vocabulary = options.vocabulary ?? ["core"];
  const rng: Rng = mulberry32(options.seed ?? 20260823);

  const frames: WorkFrame[] = Array.from({ length: frameCount }, (_, i) => sampleFrame(rng, vocabulary, i));
  const personText = frames.map((frame) => renderPersonFrame(frame, rng, family));
  const jobText = frames.map((frame) => renderJobFrame(frame, rng, family));

  const person = frames.map((frame, i) => ({ id: frameIdentity(frame), tokens: contentTokens(personText[i]!) }));
  const job = frames.map((frame, i) => ({ id: frameIdentity(frame), tokens: contentTokens(jobText[i]!) }));

  const same: number[] = [];
  const different: number[] = [];
  for (const p of person) {
    for (const j of job) (p.id === j.id ? same : different).push(jaccard(p.tokens, j.tokens));
  }

  // A rendered person sentence must never equal a rendered job sentence. The person and job
  // template pools are disjoint, so this is structurally impossible — checked anyway, because
  // a shared source string is precisely the defect this corpus exists to remove.
  const jobTextSet = new Set(jobText);
  const identicalRenderings = personText.filter((text) => jobTextSet.has(text)).length;

  // Trap confusability: compare each frame's person text against its TRAP VARIANT's job text.
  // Those are different work by construction, so a high overlap is the trap working.
  let meanTrapPartnerOverlap: number | null = null;
  let trapConfusabilityMargin: number | null = null;
  if (family === "LEXICAL_TRAP") {
    const trapRng = mulberry32((options.seed ?? 20260823) + 1);
    const overlaps: number[] = [];
    frames.forEach((frame, i) => {
      const variant = trapVariant(frame, trapRng, i);
      if (!variant) return;
      if (frameIdentity(variant) === frameIdentity(frame)) return; // must be different work
      overlaps.push(jaccard(contentTokens(personText[i]!), contentTokens(renderJobFrame(variant, trapRng, family))));
    });
    meanTrapPartnerOverlap = mean(overlaps);
    trapConfusabilityMargin = meanTrapPartnerOverlap - mean(same);
  }

  const lexicalAuc = rocAuc(same, different);
  const expectation = FAMILY_LEAK_EXPECTATIONS[family];
  const failures: string[] = [];
  if (identicalRenderings > 0) {
    failures.push(`${identicalRenderings} person/job renderings are byte-identical: a shared source string has returned`);
  }
  if (lexicalAuc < expectation.minAuc || lexicalAuc > expectation.maxAuc) {
    failures.push(
      `lexical AUC ${lexicalAuc.toFixed(4)} outside preregistered [${expectation.minAuc}, ${expectation.maxAuc}] — ${expectation.rationale}`,
    );
  }
  if (family === "LEXICAL_TRAP" && (trapConfusabilityMargin ?? -1) <= 0) {
    failures.push(
      `trap confusability margin ${(trapConfusabilityMargin ?? 0).toFixed(4)} is not positive: trap pairs do not look more alike than same-work pairs, so this family is not a trap`,
    );
  }

  return {
    family,
    frames: frameCount,
    sameIdentityPairs: same.length,
    differentIdentityPairs: different.length,
    meanSameIdentityOverlap: mean(same),
    meanDifferentIdentityOverlap: mean(different),
    lexicalAuc,
    meanTrapPartnerOverlap,
    trapConfusabilityMargin,
    identicalRenderings,
    pass: failures.length === 0,
    failures,
  };
}
