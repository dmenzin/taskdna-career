// Explicit governance status for every active V3 behavioral coefficient (src/v3/fit.ts).
//
// This is a documentation/inventory module, not a scoring module. It imports the actual
// coefficient values from src/v3/fit.ts so the registry cannot silently drift from the
// live values (see tests/v3/coefficientGovernance.test.ts). Nothing here changes scoring
// behavior, and nothing here should ever be read by production scoring code.
import { DWA_PARTIAL_CREDIT, EXPERIENCE_OWNERSHIP_WEIGHTS, EXPERIENCE_STRENGTH_WEIGHTS, PREFERENCE_SCORE_CENTER, PREFERENCE_SCORE_SPAN, PREFERRED_REQUIREMENT_WEIGHT } from "@/v3/fit";

export const V3_COEFFICIENT_GOVERNANCE_VERSION = "v3-coefficient-governance.v1";

/**
 * - STRUCTURAL: a necessary consequence of the score's defined range/shape, not an
 *   empirical or heuristic weight (changing it would change the output's mathematical
 *   meaning, not just its calibration).
 * - PROVISIONAL_BASELINE: hand-chosen so the scorer is runnable at all; documented,
 *   never claimed calibrated, never implied human-valid by any test, and a candidate
 *   hypothesis for the future preregistered experiment framework.
 * - EMPIRICALLY_JUSTIFIED: fit to data with a stated estimator (none currently qualify).
 * - UNJUSTIFIED: no defensible rationale offered, including internal ordering anomalies.
 * - EXPERIMENTAL_DISABLED: interface exists but has no active default effect.
 */
export type CoefficientGovernanceStatus = "STRUCTURAL" | "PROVISIONAL_BASELINE" | "EMPIRICALLY_JUSTIFIED" | "UNJUSTIFIED" | "EXPERIMENTAL_DISABLED";

export interface CoefficientGovernanceRecord {
  id: string;
  location: string;
  value: unknown;
  status: CoefficientGovernanceStatus;
  affects: string;
  rationale: string;
}

export const V3_COEFFICIENT_GOVERNANCE: CoefficientGovernanceRecord[] = [
  {
    id: "DWA_PARTIAL_CREDIT",
    location: "src/v3/fit.ts match()",
    value: DWA_PARTIAL_CREDIT,
    status: "PROVISIONAL_BASELINE",
    affects: "match() score for a DWA-level (non-exact-Task) mapping match, used by preference, experience, and direction fit",
    rationale: "A DWA-only match is treated as worth 60% of an exact Task match so it contributes something rather than nothing. This fraction is a fixed semantic fallback (also documented as such in docs/V3_COMPUTATIONAL_CONTRACT.md's metadata-status table) and has never been empirically estimated. It is required for the DWA fallback tier to have any effect at all; without a positive credit value the DWA fallback tier is behaviorally identical to abstention.",
  },
  {
    id: "PREFERENCE_SCORE_CENTER",
    location: "src/v3/fit.ts preferenceFit()",
    value: PREFERENCE_SCORE_CENTER,
    status: "STRUCTURAL",
    affects: "preferenceFit() output range",
    rationale: "Centers the mean bipolar contribution (which can be positive for LIKE-matched responsibilities and negative for DISLIKE-matched ones) at the ChannelScore's neutral midpoint. This is the only value consistent with 'no signed evidence' mapping to a neutral 0.5, given the score is defined on [0,1] and contributions are signed.",
  },
  {
    id: "PREFERENCE_SCORE_SPAN",
    location: "src/v3/fit.ts preferenceFit()",
    value: PREFERENCE_SCORE_SPAN,
    status: "STRUCTURAL",
    affects: "preferenceFit() output range",
    rationale: "Rescales a mean contribution bounded in [-1,1] (since match() * strength is bounded by 1 in magnitude for any single stance) onto the declared [0,1] score range. This is an affine range conversion, not a tunable sensitivity weight.",
  },
  {
    id: "EXPERIENCE_STRENGTH_WEIGHTS",
    location: "src/v3/fit.ts strength()",
    value: EXPERIENCE_STRENGTH_WEIGHTS,
    status: "PROVISIONAL_BASELINE",
    affects: "experienceFit() per-responsibility credit for weak/demonstrated/deep experience evidence",
    rationale: "The ordinal ordering (deep > demonstrated > weak) is defensible on its face, but the specific magnitudes (1 / 0.75 / 0.4) were hand-chosen, not estimated. Runnable-scorer necessity: without some positive weak-evidence weight, 'weak' experience would be indistinguishable from no experience at all.",
  },
  {
    id: "EXPERIENCE_OWNERSHIP_WEIGHTS",
    location: "src/v3/fit.ts ownership()",
    value: EXPERIENCE_OWNERSHIP_WEIGHTS,
    status: "UNJUSTIFIED",
    affects: "experienceFit() per-responsibility credit for assisted/performed/led/unknown ownership",
    rationale: "led (1.0) > performed (0.85) is a defensible ordering, but performed (0.85) > unknown (0.65) > assisted (0.55) is an ordering ANOMALY: unspecified/unknown ownership scores strictly higher than explicitly-stated 'assisted' ownership. No rationale for ranking unknown above an explicit lesser-ownership claim is recorded anywhere in code or docs. Flagged here rather than silently 'fixed', per the audit instruction not to tune coefficients; a future preregistered experiment should treat the ownership-weight ordering (specifically the unknown/assisted relationship) as a hypothesis.",
  },
  {
    id: "PREFERRED_REQUIREMENT_WEIGHT",
    location: "src/v3/fit.ts qualificationFit()",
    value: PREFERRED_REQUIREMENT_WEIGHT,
    status: "PROVISIONAL_BASELINE",
    affects: "qualificationFit() denominator/numerator weight for non-required ('preferred') job requirements",
    rationale: "Preferred requirements are declared to matter less than required ones; 0.25 is a hand-chosen down-weight (matches the ALGORITHM_SPEC/legacy convention of de-emphasizing preferred-only signals) with no empirical estimation. Necessary for qualificationFit to distinguish required from preferred at all -- a weight of 1 would make them equivalent, a weight of 0 would make preferred requirements invisible to the score.",
  },
];
