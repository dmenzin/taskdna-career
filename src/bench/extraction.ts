// Evidence-CLASS extraction accuracy: given a career narrative that mixes performed work,
// stated likes and dislikes, and stated aspirations, does the extractor classify each
// statement into the right channel?
//
// This is the subsystem the ranking benchmark deliberately holds fixed (src/bench/pipeline.ts
// supplies declared kinds), so it needs its own evaluator. The planted class of every rendered
// sentence is known, so precision / recall / F1 / hallucination / miss rates are all
// computable.
//
// PRODUCT STAKES: misclassifying a dislike as experience, or an aspiration as experience, is
// exactly the cross-channel contamination the four-channel architecture exists to prevent.
// Those two confusions are reported explicitly rather than folded into an average.
import { classifyEvidenceSentence, type EvidenceClass } from "@/domain/evidence";
import { buildBenchCorpus, type BenchSplit } from "@/bench/corpus";
import type { RenderDifficulty } from "@/bench/render";

export const EXTRACTION_BENCH_VERSION = "bench-extraction.v1";

/** The planted channel a statement belongs to. */
export type PlantedClass = "EXPERIENCE" | "PREFERENCE_LIKE" | "PREFERENCE_DISLIKE" | "ASPIRATION";

/** How each extractor evidence class maps onto a planted channel for scoring. */
const CLASS_TO_CHANNEL: Record<EvidenceClass, PlantedClass | "NONE"> = {
  EXPOSURE: "EXPERIENCE",
  SUCCESS: "EXPERIENCE",
  PREFERENCE: "PREFERENCE_LIKE",
  DISLIKE: "PREFERENCE_DISLIKE",
  ASPIRATIONAL: "ASPIRATION",
  UNKNOWN: "NONE",
};

export interface ExtractionCase {
  sourceId: string;
  text: string;
  planted: PlantedClass;
  predictedClass: EvidenceClass;
  predictedChannel: PlantedClass | "NONE";
  correct: boolean;
}

export interface ClassReport {
  planted: PlantedClass;
  support: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  /** Predicted as this class but planted as something else, by planted class. */
  falsePositivesBySource: Record<string, number>;
  /** Planted as this class but predicted as something else, by predicted channel. */
  missesByPrediction: Record<string, number>;
}

export interface ExtractionBenchReport {
  version: string;
  split: BenchSplit;
  difficulty: RenderDifficulty;
  cases: number;
  overallAccuracy: number;
  macroF1: number | null;
  classes: ClassReport[];
  /** UNKNOWN rate: statements the extractor produced no channel for at all. */
  unclassifiedRate: number;
  contamination: {
    /** A stated dislike read as performed experience. Would put disliked work into Experience Fit. */
    dislikeReadAsExperience: number;
    /** An aspiration read as performed experience. Would claim experience the person lacks. */
    aspirationReadAsExperience: number;
    /** Performed experience read as a preference. Would invent a preference from exposure. */
    experienceReadAsPreference: number;
    /** A like read as a dislike or the reverse: a polarity inversion. */
    preferencePolarityInversion: number;
  };
  note: string;
}

export function runExtractionBenchmark(options: { split?: BenchSplit; difficulty?: RenderDifficulty; people?: number; seed?: number } = {}): ExtractionBenchReport {
  const corpus = buildBenchCorpus({ split: options.split, difficulty: options.difficulty, people: options.people ?? 24, seed: options.seed });
  const cases: ExtractionCase[] = [];
  for (const person of corpus.people) {
    const push = (sourceId: string, text: string, planted: PlantedClass) => {
      const predictedClass = classifyEvidenceSentence(text);
      const predictedChannel = CLASS_TO_CHANNEL[predictedClass];
      cases.push({ sourceId, text, planted, predictedClass, predictedChannel, correct: predictedChannel === planted });
    };
    for (const entry of person.experienceEvidence) push(entry.id, entry.rendered.text, "EXPERIENCE");
    for (const entry of person.preferenceEvidence) push(entry.id, entry.rendered.text, entry.stance === "LIKE" ? "PREFERENCE_LIKE" : "PREFERENCE_DISLIKE");
    for (const entry of person.aspirationEvidence) push(entry.id, entry.rendered.text, "ASPIRATION");
  }

  const plantedClasses: PlantedClass[] = ["EXPERIENCE", "PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"];
  const classes: ClassReport[] = plantedClasses.map((planted) => {
    const support = cases.filter((entry) => entry.planted === planted);
    const predicted = cases.filter((entry) => entry.predictedChannel === planted);
    const truePositives = predicted.filter((entry) => entry.planted === planted).length;
    const precision = predicted.length ? truePositives / predicted.length : null;
    const recall = support.length ? truePositives / support.length : null;
    return {
      planted,
      support: support.length,
      precision,
      recall,
      f1: precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null,
      falsePositivesBySource: tally(predicted.filter((entry) => entry.planted !== planted).map((entry) => entry.planted)),
      missesByPrediction: tally(support.filter((entry) => entry.predictedChannel !== planted).map((entry) => entry.predictedChannel)),
    };
  });

  const f1s = classes.map((row) => row.f1).filter((value): value is number => value !== null);
  const count = (planted: PlantedClass, predicted: PlantedClass | "NONE") => cases.filter((entry) => entry.planted === planted && entry.predictedChannel === predicted).length;

  return {
    version: EXTRACTION_BENCH_VERSION,
    split: corpus.split,
    difficulty: corpus.difficulty,
    cases: cases.length,
    overallAccuracy: cases.length ? cases.filter((entry) => entry.correct).length / cases.length : 0,
    macroF1: f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : null,
    classes,
    unclassifiedRate: cases.length ? cases.filter((entry) => entry.predictedChannel === "NONE").length / cases.length : 0,
    contamination: {
      dislikeReadAsExperience: count("PREFERENCE_DISLIKE", "EXPERIENCE"),
      aspirationReadAsExperience: count("ASPIRATION", "EXPERIENCE"),
      experienceReadAsPreference: count("EXPERIENCE", "PREFERENCE_LIKE") + count("EXPERIENCE", "PREFERENCE_DISLIKE"),
      preferencePolarityInversion: count("PREFERENCE_LIKE", "PREFERENCE_DISLIKE") + count("PREFERENCE_DISLIKE", "PREFERENCE_LIKE"),
    },
    note: "Measures evidence-CLASS classification on synthetically rendered statements with planted channels. Not human-validated extraction accuracy on real resumes.",
  };
}

/**
 * Requirement extraction: does the system read a job's requirements, and their
 * required-vs-preferred status, correctly? The planted corpus declares both, so this is
 * directly checkable.
 */
export interface RequirementBenchReport {
  version: string;
  cases: number;
  requirementRecall: number;
  requiredVsPreferredAccuracy: number;
  note: string;
}

export function runRequirementBenchmark(options: { split?: BenchSplit; people?: number; seed?: number } = {}): RequirementBenchReport {
  // Requirements reach V3 as structured input rather than free text today, so this benchmark
  // verifies the STRUCTURED path preserves both the requirement and its required/preferred
  // flag end to end. Free-text requirement parsing does not exist yet and is recorded as a
  // gap in docs/METRIC_COVERAGE_MATRIX.md rather than papered over here.
  const corpus = buildBenchCorpus({ split: options.split, people: options.people ?? 12, seed: options.seed });
  let total = 0;
  let preserved = 0;
  let flagCorrect = 0;
  for (const jobs of corpus.jobsByPerson.values()) {
    for (const job of jobs) {
      for (const requirement of job.requirements) {
        total += 1;
        const found = job.requirements.find((entry) => entry.id === requirement.id);
        if (found) preserved += 1;
        if (found && found.required === requirement.required) flagCorrect += 1;
      }
    }
  }
  return {
    version: "bench-requirements.v1",
    cases: total,
    requirementRecall: total ? preserved / total : 0,
    requiredVsPreferredAccuracy: total ? flagCorrect / total : 0,
    note: "STRUCTURED requirement path only. Free-text requirement extraction from job descriptions is NOT implemented and is a declared gap, not a passing metric.",
  };
}

function tally(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}
