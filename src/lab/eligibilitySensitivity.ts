// Coverage-floor sensitivity analysis for continuous-MAE eligibility.
//
// The current eligibility floor (see ELIGIBILITY_COVERAGE_FLOOR_POLICY in
// preferenceTarget.ts) is a POLICY PARAMETER, not a scientific fact. This module makes
// that explicit by reporting, for a set of plausible floors, which dimensions would be
// eligible for continuous MAE SOLELY as a function of the threshold -- holding every
// non-coverage requirement (bipolar/non-overlapping construct validity, correct-sign
// association, monotone quartile signal) fixed at what was actually measured.
//
// This module never changes AUTONOMOUS_PREFERENCE_DIMENSIONS_V1. It is a diagnostic,
// not a mechanism for auto-expanding or auto-shrinking the eligible set.
import type { MonotonicityResult } from "@/lab/generatorMonotonicity";
import { PREFERENCE_DIMENSION_DECISIONS, type PreferenceDimensionClass } from "@/lab/preferenceTarget";

export const ELIGIBILITY_SENSITIVITY_VERSION = "eligibility-sensitivity.v1";

/** Classifications whose only stated obstacle to MAE eligibility *could* be coverage. */
export const COVERAGE_GATABLE_CLASSIFICATIONS: PreferenceDimensionClass[] = [
  "VALID_BIPOLAR_CONTINUOUS",
  "CONSTRUCT_VALID_BUT_INSUFFICIENT_TEST_COVERAGE",
];

export const DEFAULT_SENSITIVITY_FLOORS = [0, 0.05, 0.10, 0.20];

export interface SensitivityRow {
  id: string;
  classification: PreferenceDimensionClass;
  currentMaeEligible: boolean;
  measuredCoverage: number;
  /** True if every non-coverage monotonicity requirement holds at the measured sample. */
  nonCoverageCriteriaPass: boolean;
  /** Hypothetical eligibility at each floor, holding non-coverage criteria fixed. */
  eligibleAtFloor: Record<string, boolean>;
}

export function computeEligibilitySensitivity(
  results: MonotonicityResult[],
  floors: number[] = DEFAULT_SENSITIVITY_FLOORS,
): SensitivityRow[] {
  const decisionById = new Map(PREFERENCE_DIMENSION_DECISIONS.map((d) => [d.id, d]));
  return results.map((r) => {
    const decision = decisionById.get(r.id)!;
    const coverageGatable = COVERAGE_GATABLE_CLASSIFICATIONS.includes(decision.classification);
    const nonCoverageCriteriaPass = r.highMeaningAssociation > 0 && r.lowMeaningAssociation < 0 && r.observableSignalAssociation > 0 && r.monotonicBins;
    const eligibleAtFloor: Record<string, boolean> = {};
    for (const floor of floors) {
      eligibleAtFloor[String(floor)] = coverageGatable && nonCoverageCriteriaPass && r.coverage >= floor;
    }
    return {
      id: r.id,
      classification: decision.classification,
      currentMaeEligible: decision.maeEligible,
      measuredCoverage: r.coverage,
      nonCoverageCriteriaPass,
      eligibleAtFloor,
    };
  });
}

/** Dimensions whose hypothetical eligibility differs between any two of the given floors. */
export function dimensionsThatFlip(rows: SensitivityRow[], floors: number[] = DEFAULT_SENSITIVITY_FLOORS): string[] {
  return rows
    .filter((row) => {
      const values = floors.map((f) => row.eligibleAtFloor[String(f)]);
      return new Set(values).size > 1;
    })
    .map((row) => row.id);
}
