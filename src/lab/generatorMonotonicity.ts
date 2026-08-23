// Generator semantic-consistency and monotonicity audit.
//
// WHAT THE OLD AUDIT ASSUMED, AND WHY IT WAS INSUFFICIENT
// ------------------------------------------------------
// The previous audit correlated hidden truth against PHRASE LOCATION: "a low-side phrase
// appears in explicitDislikes" was treated as evidence pointing toward LOW truth. That is
// not what such a sentence means. "I avoid solo deep work" is a dislike of the LOW-side
// behaviour and therefore means the person leans HIGH on coordination_preference. A
// perfectly backwards generator passed the old audit.
//
// WHAT THIS AUDIT ASSESSES
// ------------------------
// The SEMANTIC preference direction created by (behaviour side x LIKE/DISLIKE stance), read
// back out of the generated text by src/lab/evidenceAvailability.ts. Two independent checks:
//
//   1. SEMANTIC POLARITY -- per statement, does the direction the language MEANS agree with
//      the side of the hidden truth? A single backwards sentence is a hard failure, not a
//      correlation nudge.
//   2. MONOTONICITY -- across subjects, does the net exposed direction increase with hidden
//      truth? This catches distributional drift that per-statement checks would miss.
import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { availabilityForSubject, exposedDirectionSignal, type PreferencePlacement } from "@/lab/evidenceAvailability";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 } from "@/lab/preferenceTarget";
import { truthDirection } from "@/lab/preferenceSemantics";
import type { VirtualSubject } from "@/lab/types";

export interface MonotonicityResult {
  id: DimensionId;
  n: number;
  coverage: number;
  /** Correlation of hidden truth with "HIGH-meaning language was exposed". Must be > 0. */
  highMeaningAssociation: number;
  /** Correlation of hidden truth with "LOW-meaning language was exposed". Must be < 0. */
  lowMeaningAssociation: number;
  /** Correlation of hidden truth with the net exposed direction. Must be > 0. */
  observableSignalAssociation: number;
  signalByTruthQuartile: number[];
  monotonicBins: boolean;
  eligible: boolean;
  failures: string[];
}

export interface SemanticPolarityResult {
  id: DimensionId;
  eligible: boolean;
  /** Placements whose meaning could be compared against a non-neutral hidden truth. */
  checkedPlacements: number;
  /** Placements whose meaning contradicts the side of the hidden truth. */
  backwardsPlacements: number;
  backwardsRate: number;
  examples: { subjectId: string; truth: number; unit: string; phrase: string; behaviorSide: string; stance: string; meaning: string }[];
  pass: boolean;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
function corr(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  const den = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0));
  return den ? x.reduce((s, v, i) => s + (v - mx) * (y[i]! - my), 0) / den : 0;
}

/**
 * Per-statement semantic consistency. For every placement the availability reader recovered
 * from the generated text, compare the direction the LANGUAGE means against the side of the
 * hidden truth. A backwards sentence fails here regardless of how the corpus correlates in
 * aggregate.
 *
 * Neutral-truth dimensions are skipped: a phrase can appear incidentally in narrative text
 * for a dimension whose truth sits between the expressibility thresholds, and there is no
 * defensible expected direction for those.
 */
export function assessSemanticPolarity(subjects: VirtualSubject[], maxExamples = 3): SemanticPolarityResult[] {
  const rows = subjects.flatMap((subject) => {
    const availability = availabilityForSubject(subject);
    return DIMENSION_IDS.flatMap((id) =>
      availability[id].placements.map((placement) => ({ subjectId: subject.truth.subjectId, id, truth: subject.truth.taskDnaTruth[id], placement })),
    );
  });
  return DIMENSION_IDS.map((id) => {
    const checked = rows.filter((row) => row.id === id && truthDirection(row.truth) !== null);
    const backwards = checked.filter((row) => row.placement.meaning !== truthDirection(row.truth));
    return {
      id,
      eligible: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(id),
      checkedPlacements: checked.length,
      backwardsPlacements: backwards.length,
      backwardsRate: checked.length ? backwards.length / checked.length : 0,
      examples: backwards.slice(0, maxExamples).map((row) => describe(row.subjectId, row.truth, row.placement)),
      pass: backwards.length === 0,
    };
  });
}

/** Every dimension's generated language must mean what the hidden truth says. */
export function semanticPolarityPass(results: SemanticPolarityResult[]) {
  return results.every((result) => result.pass);
}

/**
 * Distributional monotonicity of the SEMANTIC signal (not phrase location) against hidden
 * truth.
 */
export function assessGeneratorMonotonicity(subjects: VirtualSubject[]): MonotonicityResult[] {
  const availability = subjects.map((subject) => availabilityForSubject(subject));
  return DIMENSION_IDS.map((id) => {
    const truth = subjects.map((subject) => subject.truth.taskDnaTruth[id]);
    const high = availability.map((entry) => Number(entry[id].availableHigh));
    const low = availability.map((entry) => Number(entry[id].availableLow));
    const signal = availability.map((entry) => exposedDirectionSignal(entry[id]));
    const bounds = [0, 2.5, 5, 7.5, 10.01];
    const bins = bounds.slice(0, -1).map((min, i) => mean(signal.filter((_v, j) => truth[j]! >= min && truth[j]! < bounds[i + 1]!)));
    const highMeaningAssociation = corr(truth, high);
    const lowMeaningAssociation = corr(truth, low);
    const observableSignalAssociation = corr(truth, signal);
    /* finite seeded samples may jitter around zero in adjacent middle bins; 0.05 is declared tolerance, not a tuned score */
    const monotonicBins = bins.every((v, i) => i === 0 || v + 0.05 >= bins[i - 1]!);
    return {
      id,
      n: subjects.length,
      coverage: signal.filter((value) => value !== 0).length / subjects.length,
      highMeaningAssociation,
      lowMeaningAssociation,
      observableSignalAssociation,
      signalByTruthQuartile: bins,
      monotonicBins,
      eligible: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(id),
      failures: [
        ...(highMeaningAssociation <= 0 ? ["HIGH-meaning language does not increase with truth"] : []),
        ...(lowMeaningAssociation >= 0 ? ["LOW-meaning language does not decrease with truth"] : []),
        ...(!monotonicBins ? ["binned observable signal is non-monotone beyond 0.05 sampling tolerance"] : []),
      ],
    };
  });
}

export function eligibleMonotonicityPass(results: MonotonicityResult[]) {
  return results
    .filter((result) => result.eligible)
    .every((result) => result.coverage > 0 && result.highMeaningAssociation > 0 && result.lowMeaningAssociation < 0 && result.observableSignalAssociation > 0 && result.monotonicBins);
}

function describe(subjectId: string, truth: number, placement: PreferencePlacement) {
  return {
    subjectId,
    truth,
    unit: placement.unit,
    phrase: placement.phrase,
    behaviorSide: placement.behaviorSide,
    stance: placement.stance,
    meaning: placement.meaning,
  };
}
