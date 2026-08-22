// Evaluation harness for the O*NET-backed Virtual Subject Lab.
// Measures how the engine recovers hidden truth and behaves across the real
// occupational universe. Pure measurement: no tuning, no truth leakage.
import { DIMENSION_IDS, allCareerFunctions } from "@/config/model";
import { profileVector, scoreFunctions, scoreJobs } from "@/domain/engine";
import { createHumanOpportunityGraphFromIntake, evaluateNetworkStrategy } from "@/domain/networkEngine";
import type { DimensionId, JobPosting, UserProfile } from "@/domain/types";
import { observationsToProfile } from "@/lab/evaluate";
import { spearman } from "@/lab/invariants";
import type { SubjectCohort, VirtualSubject } from "@/lab/types";
import { occupationToJobPosting } from "@/onet/adapter";
import { loadOnetCorpus } from "@/onet/corpus";

/** Cross-strata shared job set derived from real O*NET occupations. */
export const SHARED_EVAL_OCCUPATION_CODES = [
  "17-2141.00", // Mechanical Engineers
  "17-2112.00", // Industrial Engineers
  "15-1252.00", // Software Developers
  "15-1212.00", // Information Security Analysts
  "15-2051.00", // Data Scientists
  "19-1042.00", // Medical Scientists
  "29-1141.00", // Registered Nurses
  "11-9111.00", // Medical and Health Services Managers
  "13-2051.00", // Financial and Investment Analysts
  "13-2011.00", // Accountants and Auditors
  "13-1111.00", // Management Analysts
  "11-2021.00", // Marketing Managers
  "13-1082.00", // Project Management Specialists
  "13-1081.00", // Logisticians
  "41-4012.00", // Sales Representatives, Wholesale and Manufacturing
  "13-1071.00", // Human Resources Specialists
  "23-1011.00", // Lawyers
  "13-1041.00", // Compliance Officers
  "25-2031.00", // Secondary School Teachers
  "15-1255.00", // Web and Digital Interface Designers
  "43-4051.00", // Customer Service Representatives
  "11-3012.00", // Administrative Services Managers
];

const technicalDemoFunctionIds = new Set(allCareerFunctions.filter((fn) => fn.version === "function.v1").map((fn) => fn.id));

export function sharedEvalJobs(): JobPosting[] {
  const corpus = loadOnetCorpus();
  if (!corpus) return [];
  const byCode = new Map(corpus.occupations.map((occupation) => [occupation.onetSocCode, occupation]));
  return SHARED_EVAL_OCCUPATION_CODES.flatMap((code) => {
    const occupation = byCode.get(code);
    return occupation ? [occupationToJobPosting(occupation)] : [];
  });
}

export interface DimensionRecovery {
  id: DimensionId;
  truth: number;
  inferred: number;
  error: number;
  signedError: number;
  confidence: number;
  supportCount: number;
}

export interface OnetSubjectEvaluation {
  subjectId: string;
  cohort: SubjectCohort;
  stratum: string;
  occupationCode: string;
  sparse: boolean;
  contradictory: boolean;
  misleadingTitle: boolean;
  keywordStuffed: boolean;
  confidence: number;
  mae: number;
  dimensions: DimensionRecovery[];
  missingEvidenceRate: number;
  falseHighCount: number;
  falseLowCount: number;
  topFunctionId: string;
  topFunctionTechnicalDemo: boolean;
  jobScores: { jobId: string; fit: number; hireability: number; overall: number }[];
  fitSpread: number;
  hireabilitySpread: number;
  propertyResults: { id: string; pass: boolean; detail: string }[];
}

export function evaluateOnetSubject(subject: VirtualSubject, jobs: JobPosting[]): OnetSubjectEvaluation {
  const profile = observationsToProfile(subject);
  return evaluateProfileAgainstTruth(subject, profile, jobs);
}

export function evaluateProfileAgainstTruth(subject: VirtualSubject, profile: UserProfile, jobs: JobPosting[]): OnetSubjectEvaluation {
  const inferred = profileVector(profile);
  const dimensions: DimensionRecovery[] = DIMENSION_IDS.map((id) => {
    const dimension = profile.taskDna.find((item) => item.dimensionId === id)!;
    const truth = subject.truth.taskDnaTruth[id];
    return {
      id,
      truth,
      inferred: inferred[id],
      error: Math.abs(inferred[id] - truth),
      signedError: inferred[id] - truth,
      confidence: dimension.confidence,
      supportCount: dimension.supportingEvidenceIds.length,
    };
  });
  const mae = dimensions.reduce((sum, item) => sum + item.error, 0) / dimensions.length;
  const functions = scoreFunctions(profile, allCareerFunctions);
  const top = functions[0]!;
  const scored = jobs.length ? scoreJobs(profile, jobs, allCareerFunctions) : [];
  const fits = scored.map((item) => item.score.predictedFit);
  const hires = scored.map((item) => item.score.hireability);
  const propertyResults = subject.truth.expectedGeneralProperties.map((id) => {
    if (id === "occupation_does_not_define_preference") {
      // Occupation tasks describe exposure only; inferred preference must not simply copy them.
      const investigativeOccupation = subject.truth.occupationalSkeleton.tasks.join(" ").toLowerCase().includes("investigat");
      const truthInvestigation = subject.truth.taskDnaTruth.investigation_orientation;
      const inferredInvestigation = inferred.investigation_orientation;
      const pass = !investigativeOccupation || truthInvestigation >= 6 || inferredInvestigation - truthInvestigation < 3.5;
      return { id, pass, detail: `inferred investigation ${inferredInvestigation.toFixed(2)} vs truth ${truthInvestigation.toFixed(2)}` };
    }
    if (id === "hireability_tracks_demonstrated_skills") {
      const pass = profile.capabilities.some((capability) => capability.evidenceLevel === "DIRECT_PROFESSIONAL" || subject.observations.statedSkills.includes(capability.name));
      return { id, pass, detail: `capabilities ${profile.capabilities.map((capability) => capability.name).join(",")}` };
    }
    if (id === "preference_capability_independence") {
      const pass = profile.capabilities.every((capability) => capability.evidenceLevel !== "DIRECT_PROFESSIONAL" || profile.evidence.some((item) => item.originalText.toLowerCase().includes(capability.name.toLowerCase()) || subject.observations.statedSkills.includes(capability.name)));
      return { id, pass, detail: "capabilities remain evidence-tied" };
    }
    if (id === "investigative_outranks_coordination") {
      const investigative = functions.find((item) => item.function.id === "investigative-analysis");
      const coordination = functions.find((item) => item.function.id === "operations-coordination" || item.function.id === "product-discovery");
      const pass = Boolean(investigative && coordination && investigative.predictedFit > coordination.predictedFit);
      return { id, pass, detail: `investigative ${investigative?.predictedFit.toFixed(2)} vs coordination ${coordination?.predictedFit.toFixed(2)}` };
    }
    if (id === "documentation_has_friction") {
      const complianceJob = scored.find((item) => item.job.canonicalId === "onet-13-1041.00");
      const pass = !complianceJob || complianceJob.score.negativeFitRisk > 0 || complianceJob.score.predictedFit < 8;
      return { id, pass, detail: `compliance fit ${complianceJob?.score.predictedFit.toFixed(2)} risk ${complianceJob?.score.negativeFitRisk.toFixed(2)}` };
    }
    return { id, pass: true, detail: "recorded expectation" };
  });
  propertyResults.push({
    id: "unknown_not_confident_neutral",
    pass: !subject.observations.evidenceQualityMetadata.sparse || profile.confidence < 0.58,
    detail: `confidence ${profile.confidence.toFixed(2)} sparse=${subject.observations.evidenceQualityMetadata.sparse}`,
  });
  return {
    subjectId: subject.truth.subjectId,
    cohort: subject.truth.cohort,
    stratum: String(subject.truth.occupationalSkeleton.family),
    occupationCode: subject.truth.occupationalSkeleton.onetCode,
    sparse: subject.observations.evidenceQualityMetadata.sparse,
    contradictory: subject.observations.evidenceQualityMetadata.contradictory,
    misleadingTitle: subject.observations.evidenceQualityMetadata.misleadingTitle,
    keywordStuffed: subject.observations.resumeText.includes(" Skills: "),
    confidence: profile.confidence,
    mae,
    dimensions,
    missingEvidenceRate: dimensions.filter((item) => item.supportCount === 0).length / dimensions.length,
    falseHighCount: dimensions.filter((item) => item.truth <= 4 && item.inferred >= 6.5).length,
    falseLowCount: dimensions.filter((item) => item.truth >= 6 && item.inferred <= 3.5).length,
    topFunctionId: top.function.id,
    topFunctionTechnicalDemo: technicalDemoFunctionIds.has(top.function.id),
    jobScores: scored.map((item) => ({ jobId: item.job.canonicalId, fit: item.score.predictedFit, hireability: item.score.hireability, overall: item.score.overall })),
    fitSpread: fits.length ? Math.max(...fits) - Math.min(...fits) : 0,
    hireabilitySpread: hires.length ? Math.max(...hires) - Math.min(...hires) : 0,
    propertyResults,
  };
}

export interface CohortAggregate {
  n: number;
  meanMae: number;
  worstStratumMae: { stratum: string; meanMae: number; n: number } | null;
  perDimension: { id: DimensionId; mae: number; bias: number; falseHighRate: number; falseLowRate: number; missingEvidenceRate: number; meanConfidence: number }[];
  propertyPassRate: number;
  meanFitSpread: number;
  meanHireabilitySpread: number;
  technicalDemoTopFunctionShare: number;
  confidenceErrorBuckets: { bucket: string; n: number; meanMae: number }[];
  byStratum: { stratum: string; n: number; meanMae: number; propertyPassRate: number }[];
}

export function aggregate(evaluations: OnetSubjectEvaluation[]): CohortAggregate {
  const n = evaluations.length;
  if (!n) {
    return { n: 0, meanMae: 0, worstStratumMae: null, perDimension: [], propertyPassRate: 0, meanFitSpread: 0, meanHireabilitySpread: 0, technicalDemoTopFunctionShare: 0, confidenceErrorBuckets: [], byStratum: [] };
  }
  const perDimension = DIMENSION_IDS.map((id) => {
    const records = evaluations.map((evaluation) => evaluation.dimensions.find((item) => item.id === id)!);
    return {
      id,
      mae: mean(records.map((item) => item.error)),
      bias: mean(records.map((item) => item.signedError)),
      falseHighRate: records.filter((item) => item.truth <= 4 && item.inferred >= 6.5).length / n,
      falseLowRate: records.filter((item) => item.truth >= 6 && item.inferred <= 3.5).length / n,
      missingEvidenceRate: records.filter((item) => item.supportCount === 0).length / n,
      meanConfidence: mean(records.map((item) => item.confidence)),
    };
  });
  const strata = Array.from(new Set(evaluations.map((evaluation) => evaluation.stratum)));
  const byStratum = strata.map((stratum) => {
    const slice = evaluations.filter((evaluation) => evaluation.stratum === stratum);
    return {
      stratum,
      n: slice.length,
      meanMae: mean(slice.map((item) => item.mae)),
      propertyPassRate: rate(slice.flatMap((item) => item.propertyResults)),
    };
  }).sort((a, b) => b.meanMae - a.meanMae);
  const buckets = [
    { bucket: "<0.35", min: 0, max: 0.35 },
    { bucket: "0.35-0.5", min: 0.35, max: 0.5 },
    { bucket: "0.5-0.65", min: 0.5, max: 0.65 },
    { bucket: ">=0.65", min: 0.65, max: 1.01 },
  ].map(({ bucket, min, max }) => {
    const slice = evaluations.filter((evaluation) => evaluation.confidence >= min && evaluation.confidence < max);
    return { bucket, n: slice.length, meanMae: slice.length ? mean(slice.map((item) => item.mae)) : 0 };
  });
  const stratumWithEnough = byStratum.filter((item) => item.n >= 3);
  return {
    n,
    meanMae: mean(evaluations.map((item) => item.mae)),
    worstStratumMae: stratumWithEnough[0] ? { stratum: stratumWithEnough[0].stratum, meanMae: stratumWithEnough[0].meanMae, n: stratumWithEnough[0].n } : null,
    perDimension,
    propertyPassRate: rate(evaluations.flatMap((item) => item.propertyResults)),
    meanFitSpread: mean(evaluations.map((item) => item.fitSpread)),
    meanHireabilitySpread: mean(evaluations.map((item) => item.hireabilitySpread)),
    technicalDemoTopFunctionShare: evaluations.filter((item) => item.topFunctionTechnicalDemo).length / n,
    confidenceErrorBuckets: buckets,
    byStratum,
  };
}

/** Network invariance + Next-Best-Action feasibility on a subsample (expensive). */
export function evaluateStrategySample(subjects: VirtualSubject[], jobs: JobPosting[], sampleSize = 24) {
  const sample = subjects.filter((_, index) => index % Math.max(1, Math.floor(subjects.length / sampleSize)) === 0).slice(0, sampleSize);
  const results = sample.map((subject) => {
    const profile = observationsToProfile(subject);
    const scored = scoreJobs(profile, jobs, allCareerFunctions).slice(0, 8);
    const graph = createHumanOpportunityGraphFromIntake(profile, scored, subject.observations.networkIntake);
    const strategy = evaluateNetworkStrategy(graph);
    return {
      subjectId: subject.truth.subjectId,
      actions: graph.nextBestActions.length,
      strategyPassed: strategy.passed,
      strategyCases: strategy.cases.filter((item) => !item.pass).map((item) => item.id),
      hasActions: graph.nextBestActions.length >= 1,
    };
  });
  return {
    n: results.length,
    nbaFeasibleRate: rate(results.map((item) => ({ pass: item.hasActions }))),
    strategyPassRate: rate(results.map((item) => ({ pass: item.strategyPassed }))),
    failingCases: results.filter((item) => !item.strategyPassed).slice(0, 8),
  };
}

/** Rank stability under tiny perturbation, measured on the shared job set. */
export function evaluateRankStability(subjects: VirtualSubject[], jobs: JobPosting[], sampleSize = 12) {
  const sample = subjects.slice(0, sampleSize);
  const rhos = sample.map((subject) => {
    const profile = observationsToProfile(subject);
    const a = scoreJobs(profile, jobs, allCareerFunctions);
    const noisy: UserProfile = {
      ...profile,
      taskDna: profile.taskDna.map((dimension, index) => ({ ...dimension, value: Math.min(10, Math.max(0, dimension.value + (index % 2 === 0 ? 0.05 : -0.05))) })),
    };
    const b = scoreJobs(noisy, jobs, allCareerFunctions);
    const orderA = a.map((item) => item.job.canonicalId);
    const orderB = b.map((item) => item.job.canonicalId);
    return spearman(orderA.map((id) => orderA.indexOf(id)), orderB.map((id) => orderA.indexOf(id)));
  });
  return { n: rhos.length, meanSpearman: mean(rhos), minSpearman: rhos.length ? Math.min(...rhos) : 1 };
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(items: { pass: boolean }[]) {
  return items.length ? items.filter((item) => item.pass).length / items.length : 0;
}
