import { DIMENSION_IDS } from "@/config/model";
import { buildProfileFromCareerInput, profileVector, scoreFunctions, scoreJobs, vectorFit } from "@/domain/engine";
import { createHumanOpportunityGraphFromIntake } from "@/domain/networkEngine";
import type { UserProfile } from "@/domain/types";
import { analogCoordinationJobs, analogInvestigationJobs } from "@/lab/analogJobs";
import type { SubjectEvaluation, TwinPair, VirtualSubject } from "@/lab/types";

/**
 * Hand the four inference-visible observation sources to the engine as FOUR DISTINCT
 * sources.
 *
 * The previous version concatenated `explicitPreferences`, `explicitDislikes`, and
 * `contradictoryStatements` into `careerText` AND passed the first two separately, so one
 * generated statement arrived twice through two plumbing paths and was counted twice in the
 * dependence-aware effective-signal count. The generator now assigns each statement to
 * exactly one source (src/lab/preferencePhrases.ts) and the extractor additionally
 * suppresses exact-normalized cross-source repeats, so the two defences are independent.
 *
 * Keep INFERENCE_VISIBLE_PREFERENCE_FIELDS in src/lab/evidenceAvailability.ts in sync with
 * the fields read here; tests/available-evidence.test.ts asserts the two agree.
 */
export function observationsToProfile(subject: VirtualSubject): UserProfile {
  return buildProfileFromCareerInput({
    id: subject.observations.subjectId,
    name: subject.observations.subjectId,
    currentField: subject.observations.apparentField,
    careerText: subject.observations.resumeText,
    explicitPreferences: subject.observations.explicitPreferences,
    explicitDislikes: subject.observations.explicitDislikes,
    contradictoryStatements: subject.observations.contradictoryStatements,
    skills: subject.observations.statedSkills,
  });
}

export function evaluateSubject(subject: VirtualSubject): SubjectEvaluation {
  const profile = observationsToProfile(subject);
  const inferred = profileVector(profile);
  const mae = DIMENSION_IDS.reduce((sum, id) => sum + Math.abs(inferred[id] - subject.truth.taskDnaTruth[id]), 0) / DIMENSION_IDS.length;
  const functions = scoreFunctions(profile);
  const analogJobs = scoreJobs(profile, [...analogInvestigationJobs, ...analogCoordinationJobs]);
  const investigative = functions.find((item) => item.function.id === "investigative-analysis" || item.function.id === "failure-analysis");
  const coordination = functions.find((item) => item.function.id === "product-discovery" || item.function.id === "product-systems-engineering");
  const investigationJob = analogJobs.find((item) => item.job.canonicalId === "analog-cyber-incident");
  const coordinationJob = analogJobs.find((item) => item.job.canonicalId === "analog-product-requirements");
  const documentationJob = analogJobs.find((item) => item.job.canonicalId === "analog-compliance-admin");
  const propertyResults = subject.truth.expectedGeneralProperties.map((id) => {
    if (id === "investigative_outranks_coordination") {
      const pass = Boolean(investigative && coordination && investigative.predictedFit > coordination.predictedFit);
      return { id, pass, detail: `investigative ${investigative?.predictedFit.toFixed(2)} vs coordination ${coordination?.predictedFit.toFixed(2)}` };
    }
    if (id === "documentation_has_friction") {
      const pass = Boolean(documentationJob && investigationJob && documentationJob.score.negativeFitRisk + 0.4 >= investigationJob.score.negativeFitRisk);
      return { id, pass, detail: `doc risk ${documentationJob?.score.negativeFitRisk.toFixed(2)}` };
    }
    if (id === "occupation_does_not_define_preference") {
      const occupationPull = subject.truth.occupationalSkeleton.tasks.join(" ").toLowerCase();
      const inferredInvestigation = inferred.investigation_orientation;
      const truthInvestigation = subject.truth.taskDnaTruth.investigation_orientation;
      const pass = Math.abs(inferredInvestigation - truthInvestigation) < 3.8 || !occupationPull.includes("investigate") || truthInvestigation >= 6;
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
    return { id, pass: true, detail: "recorded expectation" };
  });
  if (investigationJob && coordinationJob && subject.truth.taskDnaTruth.investigation_orientation >= 7.5) {
    propertyResults.push({
      id: "same_structure_cross_industry",
      pass: investigationJob.score.predictedFit + 0.15 >= coordinationJob.score.predictedFit,
      detail: `cyber fit ${investigationJob.score.predictedFit.toFixed(2)} vs requirements fit ${coordinationJob.score.predictedFit.toFixed(2)}`,
    });
  }
  propertyResults.push({
    id: "unknown_not_confident_neutral",
    pass: !subject.observations.evidenceQualityMetadata.sparse || profile.confidence < 0.58,
    detail: `confidence ${profile.confidence.toFixed(2)} sparse=${subject.observations.evidenceQualityMetadata.sparse}`,
  });
  return { subjectId: subject.truth.subjectId, cohort: subject.truth.cohort, confidence: profile.confidence, taskDnaMae: mae, propertyResults };
}

export function evaluateTwins(pairs: TwinPair[]) {
  return pairs.map((pair) => {
    const a = observationsToProfile(pair.a);
    const b = observationsToProfile(pair.b);
    if (pair.kind === "same_experience_different_preference") {
      const jobsA = scoreJobs(a, analogInvestigationJobs);
      const jobsB = scoreJobs(b, analogInvestigationJobs);
      const fitDelta = averageAbsDelta(jobsA.map((item) => item.score.predictedFit), jobsB.map((item) => item.score.predictedFit));
      const hireDelta = averageAbsDelta(jobsA.map((item) => item.score.hireability), jobsB.map((item) => item.score.hireability));
      return { id: pair.id, kind: pair.kind, pass: fitDelta > hireDelta, detail: `fitΔ ${fitDelta.toFixed(2)} hireΔ ${hireDelta.toFixed(2)}` };
    }
    if (pair.kind === "same_preference_different_experience") {
      const jobsA = scoreJobs(a, analogInvestigationJobs);
      const jobsB = scoreJobs(b, analogInvestigationJobs);
      const fitDelta = averageAbsDelta(jobsA.map((item) => item.score.predictedFit), jobsB.map((item) => item.score.predictedFit));
      const hireDelta = averageAbsDelta(jobsA.map((item) => item.score.hireability), jobsB.map((item) => item.score.hireability));
      return { id: pair.id, kind: pair.kind, pass: hireDelta + 0.05 >= fitDelta * 0.35, detail: `fitΔ ${fitDelta.toFixed(2)} hireΔ ${hireDelta.toFixed(2)}` };
    }
    if (pair.kind === "same_user_different_network") {
      const jobs = analogInvestigationJobs;
      const scored = scoreJobs(a, jobs);
      const graphA = createHumanOpportunityGraphFromIntake(a, scored, pair.a.observations.networkIntake);
      const graphB = createHumanOpportunityGraphFromIntake(a, scored, pair.b.observations.networkIntake);
      const sameFit = graphA.scoredJobs.every((job, index) => job.score.predictedFit === graphB.scoredJobs[index]?.score.predictedFit);
      return { id: pair.id, kind: pair.kind, pass: sameFit, detail: "Work Fit invariant across network variants" };
    }
    const fitA = vectorFit(profileVector(a), pair.a.truth.taskDnaTruth);
    const fitB = vectorFit(profileVector(b), pair.b.truth.taskDnaTruth);
    return { id: pair.id, kind: pair.kind, pass: Math.abs(fitA - fitB) < 2.5, detail: `title-on ${fitA.toFixed(2)} title-off ${fitB.toFixed(2)}` };
  });
}

export function evaluateZeroOrigin(subjects: VirtualSubject[]) {
  const generic = subjects.filter((subject) => subject.truth.cohort === "holdout").slice(0, 12);
  return generic.map((subject) => {
    const profile = observationsToProfile(subject);
    const functions = scoreFunctions(profile);
    const jobs = scoreJobs(profile, analogInvestigationJobs);
    const graph = createHumanOpportunityGraphFromIntake(profile, jobs, subject.observations.networkIntake);
    const pass = Boolean(profile.taskDna.length === 17 && functions.length >= 13 && jobs.length >= 1 && graph.nextBestActions.length >= 1);
    return { id: subject.truth.subjectId, pass, detail: `dna ${profile.taskDna.length} functions ${functions.length} actions ${graph.nextBestActions.length}` };
  });
}

function averageAbsDelta(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  return a.slice(0, n).reduce((sum, value, index) => sum + Math.abs(value - (b[index] ?? value)), 0) / n;
}
