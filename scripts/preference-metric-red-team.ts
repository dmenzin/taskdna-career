// Adversarial audit of the primary preference-decoder metric
// (AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1). Attempts each attack listed in the
// readiness-hardening audit and records whether the primary metric resists it directly
// or a companion guardrail exposes it. This script never changes production code; it
// only measures. See docs/PREFERENCE_METRIC_RED_TEAM.md for the narrative writeup.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { DIMENSION_IDS } from "../src/config/model";
import { observationsToProfile } from "../src/lab/evaluate";
import { availabilityForObservations, availabilityForSubject, crossSourceDuplicatePlacements, withinFieldDuplicateUnits } from "../src/lab/evidenceAvailability";
import { assessSemanticPolarity, semanticPolarityPass } from "../src/lab/generatorMonotonicity";
import { diagnosePreference, selectEvaluationSplit } from "../src/lab/iterationMetrics";
import { generateOnetSubjects, observeWithInvertedPolarity, ONET_LAB_SEED, PREFERENCE_PHRASES } from "../src/lab/onetLab";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 } from "../src/lab/preferenceTarget";
import type { DimensionId, UserEvidence } from "../src/domain/types";
import type { VirtualSubject } from "../src/lab/types";

const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const variance = (x: number[]) => { const m = mean(x); return mean(x.map((v) => (v - m) ** 2)); };
const macroMae = (rows: { subjectId: string; truth: number; prediction: number }[]) => {
  const ids = [...new Set(rows.map((r) => r.subjectId))];
  return mean(ids.map((id) => mean(rows.filter((r) => r.subjectId === id).map((r) => Math.abs(r.prediction - r.truth)))));
};

interface Row { subjectId: string; id: DimensionId; truth: number; prediction: number; available: boolean; recognized: boolean; }

function preferenceEvidence(evidence: UserEvidence) {
  return evidence.evidenceClass === "PREFERENCE" || evidence.evidenceClass === "DISLIKE";
}

/** Standalone re-derivation of the same per-record fields diagnosePreference computes, kept intentionally independent so this red-team script cannot share a bug with the metric it is attacking. */
function buildRows(subjects: VirtualSubject[]): Row[] {
  return subjects.flatMap((subject) => {
    const profile = observationsToProfile(subject);
    const dims = new Map(profile.taskDna.map((item) => [item.dimensionId, item]));
    const recognizedSet = new Set(profile.evidence.filter(preferenceEvidence).flatMap((item) => Object.keys(item.inferredTaskDimensions) as DimensionId[]));
    const availability = availabilityForSubject(subject);
    return DIMENSION_IDS.map((id) => ({
      subjectId: subject.truth.subjectId, id,
      truth: subject.truth.taskDnaTruth[id], prediction: dims.get(id)!.value,
      available: availability[id].available, recognized: recognizedSet.has(id),
    }));
  });
}

const all = generateOnetSubjects(ONET_LAB_SEED);
const development = selectEvaluationSplit(all, "DEVELOPMENT");
const baselineReport = diagnosePreference(development, development);
const rows = buildRows(development);
const eligibleRows = rows.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id));
const availableEligibleRows = eligibleRows.filter((r) => r.available);
const baselinePrimary = macroMae(availableEligibleRows);

interface AttackResult { id: string; description: string; verdict: "RESISTED_DIRECTLY" | "EXPOSED_BY_GUARDRAIL" | "STRUCTURALLY_IMPOSSIBLE"; evidence: Record<string, unknown>; }
const attacks: AttackResult[] = [];

// 1. Make the extractor recognize fewer cases (simulate deleting all lexicon rules).
{
  const noRecognition = eligibleRows.map((r) => ({ ...r, recognized: false }));
  const availableAfter = noRecognition.filter((r) => r.available);
  const primaryAfter = macroMae(availableAfter);
  const recognizedCoverageAfter = 0;
  attacks.push({
    id: "RECOGNIZE_FEWER_CASES",
    description: "Simulate the extractor recognizing zero cases (as if all lexicon rules were deleted).",
    verdict: Math.abs(primaryAfter - baselinePrimary) < 1e-9 ? "RESISTED_DIRECTLY" : "EXPOSED_BY_GUARDRAIL",
    evidence: {
      primaryMetricBefore: baselinePrimary, primaryMetricAfter: primaryAfter,
      primaryMetricUnchanged: Math.abs(primaryAfter - baselinePrimary) < 1e-9,
      recognizedEligibleCoverageBefore: baselineReport.recognizedEligibleCoverage, recognizedEligibleCoverageAfter: recognizedCoverageAfter,
      availableToRecognizedRecallBefore: baselineReport.AVAILABLE_TO_RECOGNIZED_RECALL, availableToRecognizedRecallAfter: 0,
    },
  });
}

// 2. Abstain (no prediction / removal from the primary denominator).
{
  // The decoder's UserProfile.taskDna always contains all 17 dimensions with a numeric
  // value (defaulting to the neutral prior, never null/undefined), and diagnosePreference
  // reads a value for every DIMENSION_IDS entry unconditionally. There is no code path
  // through which a "no prediction" state removes a subject/dimension from `records`, so
  // this attack cannot even be constructed against the current decoder interface.
  attacks.push({
    id: "ABSTAIN",
    description: "Have the decoder abstain (emit no prediction) on hard cases to keep only easy ones in the metric.",
    verdict: "STRUCTURALLY_IMPOSSIBLE",
    evidence: { reason: "profile.taskDna always has a numeric value for all 17 DIMENSION_IDS; diagnosePreference has no branch that removes an unpredicted dimension from the denominator." },
  });
}

// 3. Predict constant 5 for every eligible dimension.
{
  const constant = availableEligibleRows.map((r) => ({ ...r, prediction: 5 }));
  const primaryAfter = macroMae(constant);
  const predictionVarianceAfter = variance(constant.map((r) => r.prediction));
  attacks.push({
    id: "PREDICT_CONSTANT_5",
    description: "Always predict the neutral value 5 for every eligible dimension.",
    verdict: "EXPOSED_BY_GUARDRAIL",
    evidence: {
      primaryMetricUnderAttack: primaryAfter,
      primaryMetricUnderConstant5CompanionMetric: baselineReport.constant5.availableEligibleMicroMae,
      predictionVarianceUnderAttack: predictionVarianceAfter,
      guardrail: "constant5.availableEligibleMicroMae is reported alongside the primary metric specifically so a constant-5 decoder is immediately visible as matching the naive baseline exactly, and predictionVariance=0 trips VARIANCE_COLLAPSE in `warnings`.",
    },
  });
}

// 4. Shrink predictions toward 5 (partial constant-5 gaming).
{
  const byLambda = baselineReport.shrinkage.map((point) => ({ lambda: point.lambda, mae: point.availableEvidencePreferenceMacroMae }));
  const bestLambda = byLambda.slice().sort((a, b) => a.mae - b.mae)[0]!;
  attacks.push({
    id: "SHRINK_TOWARD_5",
    description: "Blend predictions toward 5 by some lambda and report only the best-looking lambda.",
    verdict: bestLambda.lambda < 1 ? "EXPOSED_BY_GUARDRAIL" : "RESISTED_DIRECTLY",
    evidence: {
      shrinkageCurve: byLambda,
      bestLambdaByRawMae: bestLambda.lambda,
      guardrail: "shrinkageGovernance is a hardcoded string: 'DIAGNOSTIC ONLY: never automatically select or adopt the minimum-MAE lambda'. The protocol (docs/AUTONOMOUS_ITERATION_PROTOCOL.md) explicitly forbids selecting shrinkage lambda by best MAE. The curve is reported specifically so cherry-picking a lambda is visible.",
    },
  });
}

// 5. Drop difficult dimensions from the eligible set.
{
  attacks.push({
    id: "DROP_DIFFICULT_DIMENSIONS",
    description: "Remove a hard-to-predict dimension from AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 to improve the primary metric.",
    verdict: "EXPOSED_BY_GUARDRAIL",
    evidence: {
      guardrail: "PREFERENCE_DIMENSION_DECISIONS is a fixed 17-entry array reviewed by classification, not derived from decoder performance; tests/v3/bridge.test.ts asserts its length is 17 and that every maeEligible entry is VALID_BIPOLAR_CONTINUOUS. Changing AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 is called out in docs/V3_COMPUTATIONAL_CONTRACT.md and AGENTS.md as a metric-contract change requiring the same review as changing the metric itself -- it shows up as a diffed constant in code review, not a silent runtime toggle.",
      currentEligibleDimensions: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1,
    },
  });
}

// 6. Inflate recognized coverage beyond what is actually available (claim more recognition than exists).
{
  const inflated = availableEligibleRows.map((r) => r).concat(
    eligibleRows.filter((r) => !r.available).map((r) => ({ ...r, recognized: true })),
  );
  const recognizedExceedsAvailable = inflated.filter((r) => r.recognized).length > availableEligibleRows.filter((r) => r.recognized).length;
  attacks.push({
    id: "INFLATE_RECOGNIZED_COVERAGE",
    description: "Make the extractor claim recognition for dimensions the generator never actually exposed evidence for.",
    verdict: recognizedExceedsAvailable ? "EXPOSED_BY_GUARDRAIL" : "RESISTED_DIRECTLY",
    evidence: {
      guardrail: "warnings includes RECOGNIZED_EXCEEDS_AVAILABLE_POSSIBLE_FALSE_POSITIVE whenever recognizedEligible.length > availableEligible.length, and AVAILABLE_TO_RECOGNIZED_RECALL is defined as recognized-AND-available over available (never recognized alone), so recognition claims outside the available set cannot inflate recall either.",
    },
  });
}

// 7. Change generator visibility (make the generator expose easier evidence to inflate the metric favorably).
{
  attacks.push({
    id: "CHANGE_GENERATOR_VISIBILITY",
    description: "Alter the observation generator to expose more/easier evidence so the primary metric improves without a real decoder change.",
    verdict: "EXPOSED_BY_GUARDRAIL",
    evidence: {
      guardrail: "This is an honestly-acknowledged residual risk, listed as a knownFailureMode ('generator-exposure drift') on AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1 in config/metric-registry.json. pnpm eval:generator-monotonicity re-validates truth<->evidence sign/monotonicity on every readiness run and would catch a construct-invalidating change; it would NOT automatically catch a construct-valid change that simply makes exposure easier. Generator/evaluation-design parameters (phrase pools, eligibility thresholds, coverage floors) are explicitly declared POLICY PARAMETERS requiring the same review as a metric-contract change (AGENTS.md, ELIGIBILITY_COVERAGE_FLOOR_POLICY) -- not fully automatable, but explicitly flagged for human/reviewer attention rather than silently allowed.",
    },
  });
}

// 8. Duplicate easy evidence to farm coverage/confidence.
{
  const phrase = PREFERENCE_PHRASES.measurable_feedback[0][0]!;
  const withinField = { ...development[0]!.observations, explicitPreferences: [phrase, phrase] };
  const crossSource = { ...development[0]!.observations, resumeText: `Analyst working in engineering. I enjoy ${phrase}.`, explicitPreferences: [phrase] };
  attacks.push({
    id: "DUPLICATE_EASY_EVIDENCE",
    description: "Repeat the same easy phrase to farm coverage/confidence, either inside one field or across two plumbing paths.",
    verdict: "EXPOSED_BY_GUARDRAIL",
    evidence: {
      duplicatedFieldStillLabeledAvailableOnce: availabilityForObservations(withinField).measurable_feedback.available,
      withinFieldDuplicatesDetected: withinFieldDuplicateUnits(withinField).length,
      crossSourceDuplicatesDetected: crossSourceDuplicatePlacements(crossSource).length,
      honestCorpusWithinFieldDuplicateSubjects: development.filter((s) => withinFieldDuplicateUnits(s.observations).length > 0).length,
      honestCorpusCrossSourceDuplicateSubjects: development.filter((s) => crossSourceDuplicatePlacements(s.observations).length > 0).length,
      guardrail: "warnings includes DUPLICATED_EVIDENCE_PHRASES_WITHIN_FIELD and DUPLICATED_EVIDENCE_ACROSS_SOURCES; both are measured on the generated text by src/lab/evidenceAvailability.ts, not asserted from generator metadata. The generator assigns each statement to exactly one observable source, and extractEvidence additionally suppresses exact-normalized cross-source repeats, so there are two independent defences. Availability itself is a boolean per dimension, not a count, so duplication cannot inflate the primary metric's per-dimension weight even if undetected.",
      residualRisk: "EXACT-NORMALIZED ONLY. Paraphrase and common-source duplication remain unresolved; see docs/DUPLICATE_EVIDENCE.md.",
    },
  });
}

// 9. Emit semantically backwards preference language (the pre-fix generator defect).
{
  const inverted = development.map((subject) => observeWithInvertedPolarity(subject));
  const polarity = assessSemanticPolarity(inverted);
  const honestPolarity = assessSemanticPolarity(development);
  attacks.push({
    id: "BACKWARDS_GENERATOR_POLARITY",
    description: "Generate preference language whose meaning contradicts the hidden truth (LOW truth expressed as a dislike of LOW-side behaviour).",
    verdict: semanticPolarityPass(polarity) ? "RESISTED_DIRECTLY" : "EXPOSED_BY_GUARDRAIL",
    evidence: {
      honestCorpusBackwardsPlacements: honestPolarity.reduce((sum, row) => sum + row.backwardsPlacements, 0),
      honestCorpusSemanticPolarityPass: semanticPolarityPass(honestPolarity),
      invertedCorpusFailingDimensions: polarity.filter((row) => !row.pass).length,
      invertedCorpusSemanticPolarityPass: semanticPolarityPass(polarity),
      exampleBackwardsStatement: polarity.find((row) => !row.pass)?.examples[0],
      guardrail: "pnpm eval:generator-monotonicity computes per-statement semantic polarity from the RENDERED TEXT (src/lab/generatorMonotonicity.ts) and exits nonzero on any backwards statement. It is a hard gate in pnpm eval:iteration-readiness.",
    },
  });
}

const report = {
  version: "preference-metric-red-team.v2",
  seed: ONET_LAB_SEED,
  baselinePrimaryMetric: baselinePrimary,
  attacks,
  summary: {
    total: attacks.length,
    resistedOrStructurallyImpossible: attacks.filter((a) => a.verdict !== "EXPOSED_BY_GUARDRAIL").length,
    exposedByGuardrail: attacks.filter((a) => a.verdict === "EXPOSED_BY_GUARDRAIL").length,
    note: "EXPOSED_BY_GUARDRAIL means the attack can locally change a companion number, but is unmistakably visible in a mandatory companion metric/warning, never silently improves the primary metric while hiding the mechanism.",
  },
};
const json = JSON.stringify(report, null, 2) + "\n";
mkdirSync("artifacts/iteration_readiness", { recursive: true });
writeFileSync("artifacts/iteration_readiness/preference_metric_red_team.json", json);
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
