// Positional sampling-bias diagnostics for the preference generator.
//
// THE DEFECT THIS MEASURES
// ------------------------
// The pre-fix generator selected phrases with `DIMENSION_IDS.filter(...).slice(0, N)`.
// Filtering preserves array order, so truncation always kept the dimensions nearest the
// front of DIMENSION_IDS. A dimension's exposure depended on its literal position in a
// config array -- an artifact of code layout, not of the construct or the hidden truth.
//
// The generator now shuffles all expressible dimensions with a seeded Fisher-Yates pass
// BEFORE truncating (src/lab/preferencePhrases.ts). This module quantifies the result:
//
//   OPPORTUNITY   how often a dimension's hidden truth was expressible at all
//   REALIZED      how often it was actually selected and rendered into observable text
//   SELECTION RATE realized / opportunity -- must not trend with array position
//
// The headline statistic is the Spearman correlation between DIMENSION_IDS position and
// selection rate. Under unbiased sampling it is indistinguishable from zero; under the
// pre-fix `slice` it was strongly negative (early dimensions selected far more often).
import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId } from "@/domain/types";
import { availabilityForSubject } from "@/lab/evidenceAvailability";
import { expressibleDimensions } from "@/lab/preferenceSemantics";
import type { VirtualSubject } from "@/lab/types";

export const GENERATOR_BIAS_VERSION = "generator-bias.v1";

export interface DimensionSelectionRow {
  id: DimensionId;
  /** 0-based index in DIMENSION_IDS. The quantity that must NOT predict selection. */
  position: number;
  /** Subjects whose hidden truth made this dimension expressible. */
  opportunities: number;
  opportunityRate: number;
  /** Subjects where directional language for this dimension actually reached observable text. */
  realized: number;
  realizedRate: number;
  /** realized / opportunities. */
  selectionRateGivenOpportunity: number | null;
}

export interface GeneratorBiasReport {
  version: string;
  subjects: number;
  rows: DimensionSelectionRow[];
  /** Spearman correlation of DIMENSION_IDS position with selection rate. ~0 when unbiased. */
  positionVersusSelectionRateSpearman: number;
  /** Spearman correlation of position with raw realized rate (confounded by opportunity). */
  positionVersusRealizedRateSpearman: number;
  /** Largest minus smallest selection rate across dimensions with any opportunity. */
  selectionRateSpread: number;
  /**
   * Mean selection rate over the first and second half of DIMENSION_IDS. Under the pre-fix
   * `slice` the first half dominated; these should now be close.
   */
  firstHalfMeanSelectionRate: number;
  secondHalfMeanSelectionRate: number;
}

/**
 * Report per-dimension selection opportunity and realized selection rate over a subject
 * corpus. Opportunity is computed from the hidden truth (what the generator COULD have
 * expressed); realization is computed from the exposed text (what it DID expose), so the
 * ratio isolates the sampling procedure from the truth distribution.
 */
export function assessGeneratorSelectionBias(subjects: VirtualSubject[]): GeneratorBiasReport {
  const opportunity = new Map<DimensionId, number>();
  const realized = new Map<DimensionId, number>();
  for (const subject of subjects) {
    for (const entry of expressibleDimensions(subject.truth.taskDnaTruth, DIMENSION_IDS)) {
      opportunity.set(entry.dimensionId, (opportunity.get(entry.dimensionId) ?? 0) + 1);
    }
    const availability = availabilityForSubject(subject);
    for (const id of DIMENSION_IDS) {
      if (availability[id].available) realized.set(id, (realized.get(id) ?? 0) + 1);
    }
  }
  const rows: DimensionSelectionRow[] = DIMENSION_IDS.map((id, position) => {
    const opportunities = opportunity.get(id) ?? 0;
    const realizedCount = realized.get(id) ?? 0;
    return {
      id,
      position,
      opportunities,
      opportunityRate: subjects.length ? opportunities / subjects.length : 0,
      realized: realizedCount,
      realizedRate: subjects.length ? realizedCount / subjects.length : 0,
      selectionRateGivenOpportunity: opportunities ? realizedCount / opportunities : null,
    };
  });
  const withOpportunity = rows.filter((row) => row.selectionRateGivenOpportunity !== null);
  const selectionRates = withOpportunity.map((row) => row.selectionRateGivenOpportunity!);
  const half = Math.floor(DIMENSION_IDS.length / 2);
  return {
    version: GENERATOR_BIAS_VERSION,
    subjects: subjects.length,
    rows,
    positionVersusSelectionRateSpearman: spearman(withOpportunity.map((row) => [row.position, row.selectionRateGivenOpportunity!])),
    positionVersusRealizedRateSpearman: spearman(rows.map((row) => [row.position, row.realizedRate])),
    selectionRateSpread: selectionRates.length ? Math.max(...selectionRates) - Math.min(...selectionRates) : 0,
    firstHalfMeanSelectionRate: mean(withOpportunity.filter((row) => row.position < half).map((row) => row.selectionRateGivenOpportunity!)),
    secondHalfMeanSelectionRate: mean(withOpportunity.filter((row) => row.position >= half).map((row) => row.selectionRateGivenOpportunity!)),
  };
}

export interface SamplerUniformityReport {
  version: string;
  trials: number;
  /** Selection count per dimension when every dimension is equally expressible. */
  counts: { id: DimensionId; position: number; count: number; rate: number }[];
  /** Spearman correlation of DIMENSION_IDS position with selection rate. ~0 when unbiased. */
  positionVersusRateSpearman: number;
  /** Chi-square statistic against the uniform expectation, and its degrees of freedom. */
  chiSquare: number;
  degreesOfFreedom: number;
  /** Upper critical value at alpha=0.001 for this many degrees of freedom. */
  chiSquareCriticalValue: number;
  maxRate: number;
  minRate: number;
  /**
   * Mean selection rate over the first and second half of DIMENSION_IDS. Under the pre-fix
   * `filter(...).slice(0, N)` the first half was near 1 and the second half near 0.
   */
  firstHalfMeanRate: number;
  secondHalfMeanRate: number;
}

/**
 * Direct mechanism test of the dimension sampler, isolated from the truth distribution.
 *
 * Every dimension is made equally expressible, so the ONLY thing that can make selection
 * rates differ across dimensions is the sampling procedure itself. This is the decisive
 * positional-bias gate: the corpus-level report above is confounded by per-dimension
 * differences in how often the hidden truth happens to be expressible, and with only 17
 * dimensions its rank correlation is noisy.
 *
 * `select` receives the shuffled-and-truncated dimension list for one trial.
 */
export function assessSamplerUniformity(
  select: (trial: number) => readonly DimensionId[],
  trials = 20000,
): SamplerUniformityReport {
  const counts = new Map<DimensionId, number>(DIMENSION_IDS.map((id) => [id, 0]));
  let totalSelections = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    for (const id of new Set(select(trial))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      totalSelections += 1;
    }
  }
  const rows = DIMENSION_IDS.map((id, position) => ({ id, position, count: counts.get(id) ?? 0, rate: trials ? (counts.get(id) ?? 0) / trials : 0 }));
  const expected = totalSelections / DIMENSION_IDS.length;
  const chiSquare = expected ? rows.reduce((sum, row) => sum + (row.count - expected) ** 2 / expected, 0) : 0;
  const half = Math.floor(DIMENSION_IDS.length / 2);
  return {
    version: GENERATOR_BIAS_VERSION,
    trials,
    counts: rows,
    positionVersusRateSpearman: spearman(rows.map((row) => [row.position, row.rate])),
    chiSquare,
    degreesOfFreedom: DIMENSION_IDS.length - 1,
    // chi-square upper critical value, 16 df, alpha=0.001
    chiSquareCriticalValue: 39.252,
    maxRate: Math.max(...rows.map((row) => row.rate)),
    minRate: Math.min(...rows.map((row) => row.rate)),
    firstHalfMeanRate: mean(rows.filter((row) => row.position < half).map((row) => row.rate)),
    secondHalfMeanRate: mean(rows.filter((row) => row.position >= half).map((row) => row.rate)),
  };
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

function pearson(pairs: [number, number][]) {
  const x = pairs.map((p) => p[0]);
  const y = pairs.map((p) => p[1]);
  const mx = mean(x);
  const my = mean(y);
  const den = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0));
  return den ? pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / den : 0;
}

function spearman(pairs: [number, number][]) {
  const rank = (values: number[]) => values.map((v) => values.filter((x) => x < v).length + values.filter((x) => x === v).length / 2);
  const x = rank(pairs.map((p) => p[0]));
  const y = rank(pairs.map((p) => p[1]));
  return pearson(x.map((v, i) => [v, y[i]!]));
}
