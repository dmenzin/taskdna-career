import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { observationsToProfile } from "@/lab/evaluate";
import { availablePreferenceDimensions } from "@/lab/availableEvidence";
import { recognizedPreferenceDimensions } from "@/lab/recognizedEvidence";
import {
  COVERAGE_GATED_CONSTRUCT_VALID_DIMENSIONS,
  ELIGIBILITY_COVERAGE_FLOOR_SENSITIVITY,
  ELIGIBILITY_GENERATOR_COVERAGE_FLOOR,
  PREFERENCE_DIMENSION_DECISIONS,
} from "@/lab/preferenceTarget";
import type { VirtualSubject } from "@/lab/types";

export interface DimensionCoverageRow {
  id: DimensionId;
  classification: string;
  constructValidity: string;
  intervalSemantics: string;
  exclusionLayers: string[];
  currentMaeEligible: boolean;
  constructValidForContinuousMae: boolean;
  generatorAvailableCoverage: number;
  extractorRecognizedCoverage: number;
  eligibilityByFloor: Record<string, boolean>;
  floorsThatChangeEligibility: number[];
}

export function dimensionCoverageRow(subjects: VirtualSubject[], id: DimensionId): DimensionCoverageRow {
  const decision = PREFERENCE_DIMENSION_DECISIONS.find((item) => item.id === id)!;
  const constructValidForContinuousMae = COVERAGE_GATED_CONSTRUCT_VALID_DIMENSIONS.includes(id);
  const generatorAvailableCoverage = subjects.filter((subject) => availablePreferenceDimensions(subject).has(id)).length / Math.max(1, subjects.length);
  const extractorRecognizedCoverage = subjects.filter((subject) => recognizedPreferenceDimensions(observationsToProfile(subject)).has(id)).length / Math.max(1, subjects.length);
  const eligibilityByFloor = Object.fromEntries(ELIGIBILITY_COVERAGE_FLOOR_SENSITIVITY.map((floor) => {
    const eligible = constructValidForContinuousMae && generatorAvailableCoverage >= floor;
    return [String(floor), eligible];
  }));
  const currentPolicyEligible = constructValidForContinuousMae && generatorAvailableCoverage >= ELIGIBILITY_GENERATOR_COVERAGE_FLOOR;
  const floorsThatChangeEligibility = ELIGIBILITY_COVERAGE_FLOOR_SENSITIVITY.filter((floor) => eligibilityByFloor[String(floor)] !== currentPolicyEligible);
  return {
    id,
    classification: decision.classification,
    constructValidity: decision.constructValidity,
    intervalSemantics: decision.intervalSemantics,
    exclusionLayers: decision.exclusionLayers,
    currentMaeEligible: decision.maeEligible,
    constructValidForContinuousMae,
    generatorAvailableCoverage,
    extractorRecognizedCoverage,
    eligibilityByFloor,
    floorsThatChangeEligibility: [...floorsThatChangeEligibility],
  };
}

export function eligibilitySensitivityTable(subjects: VirtualSubject[]) {
  const rows = DIMENSION_IDS.map((id) => dimensionCoverageRow(subjects, id));
  const changesSolelyFromThreshold = rows.filter((row) => row.constructValidForContinuousMae && row.floorsThatChangeEligibility.length > 0);
  return {
    policyFloor: ELIGIBILITY_GENERATOR_COVERAGE_FLOOR,
    policyFloorIsAssumption: true,
    floors: ELIGIBILITY_COVERAGE_FLOOR_SENSITIVITY,
    rows,
    dimensionsWhoseEligibilityChangesSolelyFromThreshold: changesSolelyFromThreshold.map((row) => ({
      id: row.id,
      generatorAvailableCoverage: row.generatorAvailableCoverage,
      currentMaeEligible: row.currentMaeEligible,
      floorsThatWouldFlip: row.floorsThatChangeEligibility,
      note: "Construct is treated as continuously MAE-capable; only the coverage-floor policy changes the decision.",
    })),
  };
}
