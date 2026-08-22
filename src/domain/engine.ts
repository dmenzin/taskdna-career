import { allCareerFunctions, careerFunctions, dimensions, scoringConfig, skillLexicon, vector } from "@/config/model";
import { scenarioBank } from "@/config/scenarios";
import { classifySentence, sourceGroupFor } from "@/domain/evidence";
import { buildRequirementMatrix } from "@/domain/hireability";
import { sentenceWorkSignals } from "@/domain/workStructure";
import { createJobSourceObservations, createSyntheticJobs, inferJobVector, jobStructureCoverage, matchFunctionByTasks } from "@/fixtures/jobs";
import { personas } from "@/fixtures/personas";
import type {
  Capability,
  CareerFunction,
  DimensionId,
  FeedbackEvent,
  FeedbackResult,
  FreshnessState,
  InterviewPlan,
  JobAnalysis,
  JobPosting,
  JobSourceObservation,
  ProfileSnapshot,
  ActionTier,
  ScenarioResponse,
  ScoredJob,
  Sellability,
  SearchRun,
  TaskDNADimension,
  UserEvidence,
  UserProfile,
  Vector,
} from "@/domain/types";

const now = "2026-08-22T15:07:00.000Z";

export interface DemoDataset {
  personas: typeof personas;
  functions: CareerFunction[];
  jobs: JobPosting[];
  rawObservations: ReturnType<typeof createJobSourceObservations>;
  searchRun: SearchRun;
}

export function createDemoDataset(): DemoDataset {
  const rawObservations = createJobSourceObservations();
  const jobs = createSyntheticJobs();
  return {
    personas,
    functions: careerFunctions,
    jobs,
    rawObservations,
    searchRun: {
      id: "search-run-demo-001",
      queryOrLane: "sandbox synthetic multi-lane corpus",
      provider: "SyntheticJobProvider",
      rawCount: rawObservations.length,
      canonicalCount: jobs.length,
      hardFilterPassCount: jobs.filter((job) => !isExtremeMismatch(job)).length,
      semanticScreenCount: Math.min(104, jobs.length),
      deepAnalysisCount: Math.min(91, jobs.length),
      recommendationCount: Math.min(75, jobs.length),
      startedAt: "2026-08-22T15:00:00.000Z",
      completedAt: now,
    },
  };
}

export function buildUserProfile(personaId = "failure-analyst", careerText?: string): UserProfile {
  const persona = personas.find((item) => item.id === personaId) ?? personas[0];
  const evidence = extractEvidence(persona, careerText ?? persona.careerText);
  const taskDna = inferTaskDna(persona, evidence);
  const capabilities = inferCapabilities(persona, evidence);
  const contradictions = inferContradictions(persona, evidence);
  const confidence = average(taskDna.map((dimension) => dimension.confidence));
  return { persona: { ...persona, careerText: careerText ?? persona.careerText }, evidence, taskDna, capabilities, contradictions, confidence };
}

export interface CareerInput {
  id?: string;
  name?: string;
  currentField?: string;
  careerText: string;
  explicitPreferences?: string[];
  explicitDislikes?: string[];
  skills?: string[];
}

// Generic persona-free entry point: inference sees only observable input, never fixture priors.
export function buildProfileFromCareerInput(input: CareerInput): UserProfile {
  const combinedText = [input.careerText, ...(input.explicitPreferences ?? []), ...(input.explicitDislikes ?? [])].join(" ");
  const detectedSkills = input.skills?.length ? input.skills : skillLexicon.filter((skill) => combinedText.toLowerCase().includes(skill));
  const genericPersona: (typeof personas)[number] = {
    id: input.id ?? "generic-user",
    name: input.name ?? "Generic user",
    summary: "Persona-free generic career input",
    currentField: input.currentField ?? "unknown",
    careerText: combinedText,
    preferenceVector: vector({}),
    capabilityKeywords: detectedSkills,
    repellents: input.explicitDislikes ?? [],
    desiredConstraints: [],
    expectedHighFunctions: [],
    expectedLowFunctions: [],
  };
  const evidence = extractEvidence(genericPersona, input.careerText, {
    explicitPreferences: input.explicitPreferences,
    explicitDislikes: input.explicitDislikes,
  });
  const taskDna = inferTaskDna(genericPersona, evidence, { neutralPrior: true });
  const capabilities = inferCapabilities(genericPersona, evidence);
  const contradictions = inferContradictions(genericPersona, evidence);
  const confidence = average(taskDna.map((dimension) => dimension.confidence));
  return { persona: genericPersona, evidence, taskDna, capabilities, contradictions, confidence };
}

export function extractEvidence(
  persona: (typeof personas)[number],
  careerText: string,
  options: { explicitPreferences?: string[]; explicitDislikes?: string[] } = {},
): UserEvidence[] {
  const sentences = careerText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const uniqueSentences = Array.from(new Map(sentences.map((sentence) => [sentence.toLowerCase(), sentence])).values());
  const fallback = uniqueSentences.length ? uniqueSentences : [careerText];
  const fromText = fallback.slice(0, 10).map((sentence, index) => {
    const classified = classifySentence(sentence);
    return makeEvidence(persona, sentence, {
      id: `ev-${persona.id}-${index + 1}`,
      sourceType: index === 0 ? "RESUME" : classified.evidenceClass === "DISLIKE" ? "EXPLICIT_DISLIKE" : "WORK_HISTORY",
      sourceReference: "career text",
      classified,
      reliability: evidenceReliability(sentence, index),
    });
  });
  // Explicit stated preferences/dislikes carry a forced class: a bare phrase in a
  // dislike list is a dislike even without a dislike verb.
  const explicitPreferences = (options.explicitPreferences ?? []).slice(0, 4).map((phrase, index) => {
    const signals = sentenceWorkSignals(phrase);
    return makeEvidence(persona, phrase, {
      id: `ev-${persona.id}-pref-${index + 1}`,
      sourceType: "EXPLICIT_PREFERENCE",
      sourceReference: "stated preferences",
      classified: { evidenceClass: "PREFERENCE", preferenceSignals: signals, workSignals: signals, signalWeight: 1 },
      reliability: 0.78,
    });
  });
  const explicitDislikes = (options.explicitDislikes ?? []).slice(0, 4).map((phrase, index) => {
    const signals = sentenceWorkSignals(phrase);
    const inverted = Object.fromEntries(Object.entries(signals).map(([key, value]) => [key, 10 - (value ?? 5)])) as Partial<Vector>;
    return makeEvidence(persona, phrase, {
      id: `ev-${persona.id}-dislike-${index + 1}`,
      sourceType: "EXPLICIT_DISLIKE",
      sourceReference: "stated dislikes",
      classified: { evidenceClass: "DISLIKE", preferenceSignals: inverted, workSignals: signals, signalWeight: 1 },
      reliability: 0.78,
    });
  });
  return [...fromText, ...explicitPreferences, ...explicitDislikes];
}

function makeEvidence(
  persona: (typeof personas)[number],
  sentence: string,
  input: { id: string; sourceType: UserEvidence["sourceType"]; sourceReference: string; classified: ReturnType<typeof classifySentence>; reliability: number },
): UserEvidence {
  const lower = sentence.toLowerCase();
  return {
    id: input.id,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    evidenceClass: input.classified.evidenceClass,
    sourceGroup: sourceGroupFor(input.sourceType, input.sourceReference),
    signalWeight: input.classified.signalWeight,
    originalText: sentence,
    activity: classifyActivity(sentence),
    context: persona.currentField,
    tools: keywordHits(sentence, ["Python", "TypeScript", "SQL", "MATLAB", "logs", "bench tests", "ROS", "C++"]),
    problemType: classifyProblem(sentence),
    outcome: input.classified.evidenceClass === "SUCCESS" ? "successful outcome indicated" : "experience reported",
    demonstratedSkills: keywordHits(sentence, persona.capabilityKeywords),
    capabilitySignals: keywordHits(sentence, persona.capabilityKeywords),
    enjoymentSignals: input.classified.evidenceClass === "PREFERENCE" || input.classified.evidenceClass === "ASPIRATIONAL" ? [sentence] : [],
    dislikeSignals: input.classified.evidenceClass === "DISLIKE" ? [sentence] : [],
    inferredTaskDimensions: input.classified.preferenceSignals,
    recency: lower.includes("older role") ? 0.5 : 0.8,
    reliability: input.reliability,
  };
}

export function inferTaskDna(persona: (typeof personas)[number], evidence: UserEvidence[], options: { neutralPrior?: boolean } = {}): TaskDNADimension[] {
  const sparse = evidence.length < scoringConfig.inference.sparseEvidenceThreshold;
  return dimensions.map((definition) => {
    // Only preference-class evidence moves preference dimensions (exposure never does).
    const signals = evidence
      .map((item) => ({ item, value: item.inferredTaskDimensions[definition.id] }))
      .filter((item): item is { item: UserEvidence; value: number } => typeof item.value === "number" && item.item.signalWeight > 0);
    const baseValue = options.neutralPrior ? 5 : persona.preferenceVector[definition.id];
    const evidenceValue = signals.length
      ? weightedAverage(signals.map(({ item, value }) => ({ value, weight: item.reliability * item.signalWeight })))
      : baseValue;
    // Dependence-aware effective signals: distinct source groups count fully;
    // extra sentences inside one group add diminishing partial credit.
    const groups = new Map<string, number>();
    for (const { item } of signals) groups.set(item.sourceGroup, (groups.get(item.sourceGroup) ?? 0) + 1);
    const distinctGroups = groups.size;
    const extraWithinGroups = Array.from(groups.values()).reduce((sum, count) => sum + Math.min(2, count - 1), 0);
    const effectiveSignals = Math.min(scoringConfig.inference.maxEffectiveSignals, distinctGroups + extraWithinGroups * 0.5);
    const evidenceWeight = effectiveSignals >= 2 ? scoringConfig.inference.evidenceWeightTwoPlus : effectiveSignals >= 1 ? scoringConfig.inference.evidenceWeightSingle : 0;
    const value = clamp(baseValue * (1 - evidenceWeight) + evidenceValue * evidenceWeight, 0, 10);
    const polarity = signals.length ? evidenceValue : value;
    const supportingEvidenceIds = signals.filter(({ value: signal }) => sameSide(signal, polarity)).map(({ item }) => item.id);
    const contradictoryEvidenceIds = signals.filter(({ value: signal }) => !sameSide(signal, polarity) && Math.abs(signal - polarity) >= 2.2).map(({ item }) => item.id);
    const unknown = options.neutralPrior && signals.length === 0;
    const aspirationalOnly = signals.length > 0 && signals.every(({ item }) => item.evidenceClass === "ASPIRATIONAL");
    const signalValues = signals.map(({ value: signal }) => signal);
    const dispersion = signalValues.length >= 2 ? Math.max(...signalValues) - Math.min(...signalValues) : 0;
    const agreementBonus = signalValues.length >= 2 && dispersion < 2 ? 0.06 : 0;
    const confidence = unknown
      ? scoringConfig.inference.unknownDimensionConfidence
      : clamp(
          Math.min(
            sparse ? 0.5 : 0.94,
            0.3 +
              effectiveSignals * scoringConfig.inference.signalConfidenceStep * 1.6 +
              agreementBonus -
              contradictoryEvidenceIds.length * 0.14 -
              (aspirationalOnly ? 0.06 : 0) +
              (options.neutralPrior ? 0 : 0.12),
          ),
          0.2,
          0.94,
        );
    return {
      dimensionId: definition.id,
      value,
      confidence,
      supportingEvidenceIds,
      contradictoryEvidenceIds,
      inferenceMethod: "HeuristicTaskDNAProvider",
      inferenceVersion: scoringConfig.inference.version,
      interpretation: unknown
        ? "Unknown: no evidence observed for this dimension yet."
        : value >= 6 ? `Leans toward ${definition.high}.` : `Leans away from ${definition.high}; ${definition.low} may be more natural or less aversive.`,
    };
  });
}

function evidenceReliability(sentence: string, index: number) {
  const words = sentence.trim().split(/\s+/).length;
  const vague = /some projects|not sure|things|stuff|maybe/i.test(sentence);
  const specific = /\d|python|c\+\+|sql|matlab|logs|protocol|customers|experiments|root cause|stakeholder/i.test(sentence);
  return clamp(0.5 + Math.min(0.24, words * 0.015) + (specific ? 0.08 : 0) - (vague ? 0.18 : 0) + index * 0.01, 0.35, 0.92);
}

export function inferCapabilities(persona: (typeof personas)[number], evidence: UserEvidence[]): Capability[] {
  const fromText = skillLexicon.filter((skill) => persona.careerText.toLowerCase().includes(skill) || evidence.some((item) => item.originalText.toLowerCase().includes(skill)));
  const keywords = Array.from(new Set([...persona.capabilityKeywords, ...fromText]));
  const career = persona.careerText.toLowerCase();
  return keywords.map((keyword, index) => {
    const evidenceIds = evidence.filter((item) => item.originalText.toLowerCase().includes(keyword.toLowerCase()) || item.capabilitySignals.some((signal) => signal.toLowerCase() === keyword.toLowerCase())).map((item) => item.id);
    const interestOnly = new RegExp(`(coursework|hobby|no professional|not yet).{0,32}${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.{0,32}(coursework|hobby|no professional|not yet)`, "i").test(career);
    const direct = evidenceIds.length > 0 && !interestOnly;
    return {
      id: `cap-${persona.id}-${index + 1}`,
      name: keyword,
      category: keyword.match(/python|typescript|sql|matlab|c\+\+|react/i) ? "technical tool" : "work capability",
      evidenceLevel: direct ? "DIRECT_PROFESSIONAL" : interestOnly ? "INTEREST_ONLY" : "ADJACENT_TRANSFERABLE",
      directExperience: direct ? [`Mentioned in ${evidenceIds.length} evidence item(s)`] : [],
      adjacentExperience: direct ? [] : ["Related but not directly demonstrated in the supplied evidence"],
      demonstratedOutcomes: direct ? ["Evidence-supported history exists"] : [],
      recency: direct ? 0.8 : 0.45,
      recruiterLegibility: direct ? 0.82 : 0.42,
      confidence: direct ? 0.78 : 0.45,
      evidenceIds,
    };
  });
}

export function functionsForProfile(profile: UserProfile): CareerFunction[] {
  const isDemoPersona = personas.some((persona) => persona.id === profile.persona.id);
  return isDemoPersona ? careerFunctions : allCareerFunctions;
}

export function scoreFunctions(profile: UserProfile, functionSet = functionsForProfile(profile)) {
  return functionSet
    .map((fn) => {
      const fit = vectorFit(profileVector(profile), fn.taskDnaVector);
      const confidence = profile.confidence;
      const capabilityAlignment = capabilityAlignmentFor(profile, fn.typicalRequirements);
      const hireability = clamp((capabilityAlignment * 0.75 + requirementsLegibility(profile, fn.typicalRequirements) * 0.25) * 10, 1, 10);
      const careerDirection = clamp((fit * 0.7 + noveltyFromFunction(profile, fn) * 0.3), 1, 10);
      return {
        function: fn,
        predictedFit: fit,
        confidence,
        confidenceAdjustedFit: confidenceAdjustedFit(fit, confidence),
        capabilityAlignment: capabilityAlignment * 10,
        hireability,
        careerDirection,
        negativeFitRisk: negativeFit(profile, fn.commonRepellents),
        overallPriority: overallScore({ hireability, confidenceAdjustedFit: confidenceAdjustedFit(fit, confidence), careerDirection, technicalGrowth: 7.2, durability: 7.1 }),
      };
    })
    .sort((a, b) => b.overallPriority - a.overallPriority);
}

export function analyzeJob(job: JobPosting, functionSet: CareerFunction[] = careerFunctions): JobAnalysis {
  const jobVector = inferJobVector(job);
  const structure = jobStructureCoverage(job);
  const text = `${job.title} ${job.description} ${job.responsibilities.join(" ")} ${job.requirements.join(" ")}`.toLowerCase();
  const primary = pickPrimaryFunction(job, jobVector, functionSet);
  const secondary = functionSet
    .filter((fn) => fn.id !== primary.id)
    .map((fn) => ({ fn, fit: vectorFit(jobVector, fn.taskDnaVector) }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 2)
    .map((item) => item.fn.id);
  const frictionFactors = [
    ...(text.match(/documentation|traceability|qms|protocol|mbse|sysml/) ? ["documentation / traceability load"] : []),
    ...(text.match(/travel|customer|field/) ? ["customer or field exposure"] : []),
    ...(text.match(/manager|stakeholder|roadmap/) ? ["coordination-heavy workflow"] : []),
    ...(text.match(/c\+\+|embedded|ros/) ? ["specialized robotics or embedded skill requirement"] : []),
  ];
  const what = actualWorkSummary(job, primary, frictionFactors);
  return {
    whatThisJobIsReallyAbout: what,
    primaryFunctionId: primary.id,
    secondaryFunctionIds: secondary,
    jobTaskDnaVector: jobVector,
    strongMatchFactors: primary.commonAttractors.slice(0, 4),
    frictionFactors: frictionFactors.length ? frictionFactors : primary.commonRepellents.slice(0, 2),
    requiredCapabilities: job.requirements,
    hardGaps: hardGaps(job.requirements),
    // Fixture-matched demo jobs keep canonicalization confidence; generically read
    // jobs earn classification confidence from how much of their own language
    // actually supports a TaskDNA reading.
    classificationConfidence: structure.fixtureMatched
      ? job.canonicalizationConfidence
      : Math.min(job.canonicalizationConfidence, clamp(0.3 + structure.coverage * 0.75, 0.3, 0.9)),
    evidenceSnippets: [job.description, ...job.responsibilities.slice(0, 2)],
  };
}

export function scoreJobs(profile: UserProfile, jobs = createDemoDataset().jobs, functionSet = functionsForProfile(profile)): ScoredJob[] {
  return jobs
    .map((job) => {
      const analysis = analyzeJob(job, functionSet);
      const rawPredictedFit = vectorFit(profileVector(profile), analysis.jobTaskDnaVector);
      const confidence = clamp((profile.confidence + analysis.classificationConfidence) / 2, 0.2, 0.95);
      const negativeFitRisk = negativeFit(profile, analysis.frictionFactors);
      const predictedFit = clamp(rawPredictedFit - negativeFitRisk * scoringConfig.inference.negativeFitPenalty, 1, 10);
      const caf = confidenceAdjustedFit(predictedFit, confidence);
      const matrix = buildRequirementMatrix(profile, job);
      const capabilityAlignment = clamp(matrix.coreCoverage * 8 + matrix.professionalShare * 2, 1, 10);
      const hireability = clamp(matrix.hireability - seniorityPenalty(job) * 0.35, 1, 10);
      const careerDirection = clamp(predictedFit * 0.62 + capabilityAlignment * 0.18 + (10 - negativeFitRisk) * 0.2, 1, 10);
      const technicalGrowth = clamp(6 + analysis.hardGaps.length * 0.55 + analysis.requiredCapabilities.length * 0.05, 1, 10);
      const durability = clamp(job.domain.match(/software|analytics|robotics|medical|energy/) ? 7.9 : 6.8, 1, 10);
      const novelty = noveltyScore(profile, job, analysis, predictedFit);
      const overall = overallScore({ hireability, confidenceAdjustedFit: caf, careerDirection, technicalGrowth, durability }) - negativeFitRisk * 0.12;
      const actionTier = actionTierFor({ overall, hireability, predictedFit, confidence, hardGaps: analysis.hardGaps });
      const sellability = sellabilityFor(hireability, capabilityAlignment, analysis.hardGaps);
      return {
        job,
        analysis,
        score: {
          rawPredictedFit,
          predictedFit,
          confidence,
          confidenceAdjustedFit: caf,
          capabilityAlignment,
          hireability,
          careerDirection,
          technicalGrowth,
          durability,
          negativeFitRisk,
          novelty,
          overall: clamp(overall, 1, 10),
          actionTier,
          sellability,
          scoringVersion: scoringConfig.version,
          formulaInputs: {
            weights: scoringConfig.weights,
            confidenceAdjustedFitPenalty: scoringConfig.confidenceAdjustedFitPenalty,
          },
        },
        decisionTrace: [
          `Evidence profile ${profile.persona.name} produced ${profile.taskDna.length} Task-DNA dimensions at ${pct(profile.confidence)} confidence.`,
          `Job vector maps primarily to ${functionSet.find((fn) => fn.id === analysis.primaryFunctionId)?.name}.`,
          `Raw Work Fit ${formatScore(rawPredictedFit)} minus negative-fit penalty ${formatScore(negativeFitRisk * 0.5)} gives displayed Work Fit ${formatScore(predictedFit)}.`,
          `Confidence ${formatScore(confidence)} and CAF ${formatScore(caf)} use CAF = fit - ${scoringConfig.confidenceAdjustedFitPenalty} * (1 - confidence).`,
          `Hireability ${formatScore(hireability)} uses structured requirement-evidence matching (${matrix.version}): ${matrix.trace[1]} Gaps: ${analysis.hardGaps.join(", ") || "none"}.`,
          `Career Direction ${formatScore(careerDirection)}, Growth ${formatScore(technicalGrowth)}, Durability ${formatScore(durability)}, Novelty ${formatScore(novelty)}.`,
          `Overall ${formatScore(clamp(overall, 1, 10))} = 0.40*Hireability + 0.30*CAF + 0.15*Direction + 0.10*Growth + 0.05*Durability, with visible negative-fit adjustment.`,
          `Final tier is ${actionTier}; sellability is ${sellability}; scoring config ${scoringConfig.version}.`,
        ],
        noveltyExplanation: novelty >= scoringConfig.novelty.threshold ? "Non-obvious match: low title/domain obviousness plus strong Task-DNA similarity and plausible capability transfer." : "More obvious, lower-fit, or weaker-transfer recommendation.",
      };
    })
    .sort((a, b) => b.score.overall - a.score.overall);
}

export function applyFeedback(profile: UserProfile, scoredJobs: ScoredJob[], feedback: FeedbackEvent): FeedbackResult {
  const target = scoredJobs.find((item) => item.job.canonicalId === feedback.jobId);
  if (!target) {
    const snapshot = snapshotProfile(profile);
    return { updatedProfile: profile, beforeProfileSnapshot: snapshot, feedbackEvent: feedback, afterProfileSnapshot: snapshot, changedDimensions: [], explanation: "No matching job was found for the feedback event." };
  }
  const beforeProfileSnapshot = snapshotProfile(profile);
  const changedDimensions: { id: DimensionId; before: number; after: number }[] = [];
  const direction = feedback.reaction === "LOVE" || feedback.reaction === "INTERESTING" ? 1 : feedback.reaction === "DISLIKE" ? -1 : 0;
  const updatedTaskDna = profile.taskDna.map((dimension) => {
    const jobValue = target.analysis.jobTaskDnaVector[dimension.dimensionId];
    const before = dimension.value;
    const reasonBoost = reasonTouchesDimension(feedback.reasonTags, dimension.dimensionId) ? 0.55 : 0.25;
    const after = direction === 0 ? before : clamp(before + (jobValue - before) * reasonBoost * direction, 0, 10);
    if (Math.abs(after - before) > 0.05) changedDimensions.push({ id: dimension.dimensionId, before, after });
    return {
      ...dimension,
      value: after,
      confidence: clamp(dimension.confidence + Math.abs(after - before) * 0.03, 0.2, 0.96),
      supportingEvidenceIds: [...dimension.supportingEvidenceIds, `feedback-${feedback.jobId}`],
    };
  });
  const feedbackEvidence: UserEvidence = {
    id: `feedback-${feedback.jobId}`,
    sourceType: "USER_FEEDBACK",
    sourceReference: target.job.title,
    evidenceClass: feedback.reaction === "DISLIKE" ? "DISLIKE" : "PREFERENCE",
    sourceGroup: sourceGroupFor("USER_FEEDBACK", feedback.jobId),
    signalWeight: 1,
    originalText: `${feedback.reaction}: ${feedback.reasonTags.join(", ")}`,
    activity: "job reaction",
    context: "active learning",
    tools: [],
    problemType: "preference feedback",
    outcome: "Task DNA updated; capability evidence unchanged",
    demonstratedSkills: [],
    capabilitySignals: [],
    enjoymentSignals: feedback.reaction === "LOVE" || feedback.reaction === "INTERESTING" ? feedback.reasonTags : [],
    dislikeSignals: feedback.reaction === "DISLIKE" ? feedback.reasonTags : [],
    inferredTaskDimensions: target.analysis.jobTaskDnaVector,
    recency: 1,
    reliability: 0.7,
  };
  const updatedProfile: UserProfile = {
      ...profile,
      taskDna: updatedTaskDna,
      evidence: [...profile.evidence, feedbackEvidence],
      confidence: average(updatedTaskDna.map((dimension) => dimension.confidence)),
    };
  return {
    updatedProfile,
    beforeProfileSnapshot,
    feedbackEvent: feedback,
    afterProfileSnapshot: snapshotProfile(updatedProfile),
    changedDimensions,
    explanation: `Recommendations changed because ${feedback.reaction.toLowerCase()} feedback nudged Task-DNA preferences (${changedDimensions.slice(0, 4).map((item) => item.id).join(", ")}). Capability evidence was not changed.`,
  };
}

export function selectAdaptiveScenarios(profile: UserProfile, answeredScenarioIds: string[] = [], maxScenarios = 6): InterviewPlan {
  const answered = new Set(answeredScenarioIds);
  const lowConfidenceDimensions = profile.taskDna.filter((dimension) => dimension.confidence < 0.62).map((dimension) => dimension.dimensionId);
  const unknownDimensions = profile.taskDna.filter((dimension) => dimension.supportingEvidenceIds.length === 0 || dimension.confidence < 0.4).map((dimension) => dimension.dimensionId);
  const contradictionText = profile.contradictions.join(" ").toLowerCase();
  if (profile.confidence >= 0.74 && profile.contradictions.length === 0 && lowConfidenceDimensions.length <= 2) {
    return {
      scenarios: [],
      earlyStopped: true,
      rationale: [`Profile confidence ${pct(profile.confidence)} is high and contradictions are low, so the interview can stop early.`],
    };
  }
  const topTwo = scoreFunctions(profile).slice(0, 2);
  const ranked = scenarioBank
    .filter((scenario) => !answered.has(scenario.id))
    .map((scenario) => {
      const uncertaintyScore = scenario.targetDimensions.filter((dimension) => lowConfidenceDimensions.includes(dimension)).length * 1.1;
      const unknownScore = scenario.targetDimensions.filter((dimension) => unknownDimensions.includes(dimension)).length * 1.4;
      const leanScore = scenario.targetDimensions.reduce((sum, dimension) => {
        const current = profile.taskDna.find((item) => item.dimensionId === dimension);
        return sum + Math.abs((current?.value ?? 5) - 5) * (current?.confidence ?? 0.3) * 1.35;
      }, 0);
      const contradictionScore = scenario.clarifiesRepellents.some((repellent) => contradictionText.includes(repellent.replace("too much ", ""))) ? 2.4 : 0;
      const functionSeparationScore = topTwo.length === 2
        ? scenario.targetDimensions.reduce((sum, dimension) => sum + Math.abs(topTwo[0].function.taskDnaVector[dimension] - topTwo[1].function.taskDnaVector[dimension]) * 0.18, 0)
        : 0;
      return { scenario, score: scenario.informationValue + uncertaintyScore + unknownScore + leanScore + contradictionScore + functionSeparationScore };
    })
    .sort((a, b) => b.score - a.score || a.scenario.id.localeCompare(b.scenario.id));
  return {
    scenarios: ranked.slice(0, maxScenarios).map((item) => item.scenario),
    earlyStopped: false,
    rationale: [
      `Selected scenarios target ${lowConfidenceDimensions.length} low-confidence dimensions and ${unknownDimensions.length} unknown dimensions.`,
      profile.contradictions.length ? `Contradictions detected: ${profile.contradictions.slice(0, 2).join(" ")}` : "No major contradiction, so selection emphasizes preference lean, unknown coverage, and function separation.",
    ],
  };
}

export function applyScenarioResponses(profile: UserProfile, responses: ScenarioResponse[]) {
  const scenarioEvidence: UserEvidence[] = responses.flatMap((response, index) => {
    const scenario = scenarioBank.find((item) => item.id === response.scenarioId);
    if (!scenario) return [];
    const direction = response.answer === "LOVE" || response.answer === "INTERESTING" || response.answer === "BOTH" ? 1 : response.answer === "DISLIKE" || response.answer === "NEITHER" ? -1 : 0;
    const sourceVector = direction >= 0 ? scenario.positiveVector : invertPartialVector(scenario.negativeVector ?? scenario.positiveVector);
    return [{
      id: `scenario-${scenario.id}-${index + 1}`,
      sourceType: "SCENARIO_RESPONSE",
      sourceReference: scenario.title,
      evidenceClass: direction < 0 ? "DISLIKE" : "PREFERENCE",
      sourceGroup: sourceGroupFor("SCENARIO_RESPONSE", scenario.id),
      signalWeight: 1,
      originalText: `${response.answer}: ${scenario.prompt}${response.freeText ? ` ${response.freeText}` : ""}`,
      activity: "scenario response",
      context: "adaptive interview",
      tools: [],
      problemType: "preference elicitation",
      outcome: "Task-DNA evidence gathered",
      demonstratedSkills: [],
      capabilitySignals: [],
      enjoymentSignals: direction > 0 ? [scenario.title] : [],
      dislikeSignals: direction < 0 ? [scenario.title] : [],
      inferredTaskDimensions: sourceVector,
      recency: 1,
      reliability: clamp(response.confidence ?? 0.72, 0.35, 0.95),
    }];
  });
  const evidence = [...profile.evidence, ...scenarioEvidence];
  const taskDna = inferTaskDna(profile.persona, evidence);
  const updatedProfile: UserProfile = {
    ...profile,
    evidence,
    taskDna,
    contradictions: inferContradictions(profile.persona, evidence),
    confidence: average(taskDna.map((dimension) => dimension.confidence)),
  };
  return {
    updatedProfile,
    addedEvidence: scenarioEvidence,
    changedDimensions: taskDna
      .map((dimension) => {
        const before = profile.taskDna.find((item) => item.dimensionId === dimension.dimensionId)?.value ?? dimension.value;
        return { id: dimension.dimensionId, before, after: dimension.value };
      })
      .filter((item) => Math.abs(item.after - item.before) > 0.05),
  };
}

export function filterAndSortJobs(jobs: ScoredJob[], query: string, functionId: string, sortKey: string, noveltyOnly = false) {
  const normalized = query.trim().toLowerCase();
  return jobs
    .filter((item) => !functionId || item.analysis.primaryFunctionId === functionId)
    .filter((item) => !noveltyOnly || item.score.novelty >= scoringConfig.novelty.threshold)
    .filter((item) => {
      if (!normalized) return true;
      return [
        item.job.title,
        item.job.company,
        item.job.domain,
        item.analysis.whatThisJobIsReallyAbout,
        item.analysis.requiredCapabilities.join(" "),
        item.analysis.frictionFactors.join(" "),
        item.analysis.strongMatchFactors.join(" "),
      ].some((value) => value.toLowerCase().includes(normalized));
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "fit":
          return b.score.predictedFit - a.score.predictedFit;
        case "hireability":
          return b.score.hireability - a.score.hireability;
        case "direction":
          return b.score.careerDirection - a.score.careerDirection;
        case "confidence":
          return b.score.confidence - a.score.confidence;
        case "novelty":
          return b.score.novelty - a.score.novelty;
        case "company":
          return a.job.company.localeCompare(b.job.company);
        default:
          return b.score.overall - a.score.overall;
      }
    });
}

export function runEvaluation() {
  const dataset = createDemoDataset();
  const results = personas.map((persona) => {
    const profile = buildUserProfile(persona.id);
    const functions = scoreFunctions(profile);
    const jobs = scoreJobs(profile, dataset.jobs);
    return {
      personaId: persona.id,
      topFunctions: functions.slice(0, 3).map((item) => item.function.id),
      bottomFunctions: functions.slice(-3).map((item) => item.function.id),
      topJobs: jobs.slice(0, 5).map((item) => ({ id: item.job.canonicalId, title: item.job.title, fit: item.score.predictedFit, hireability: item.score.hireability })),
      confidence: profile.confidence,
      passesHighFunction: persona.expectedHighFunctions.length === 0 || persona.expectedHighFunctions.some((id) => functions.slice(0, 5).some((item) => item.function.id === id)),
    };
  });
  const failureAnalyst = scoreJobs(buildUserProfile("failure-analyst"), dataset.jobs);
  const roboticsNoCpp = failureAnalyst.find((item) => item.job.canonicalId === "job-high-fit-low-hireability-robotics");
  const complianceForQuality = scoreJobs(buildUserProfile("quality-dislikes-compliance"), dataset.jobs).find((item) => item.job.canonicalId === "job-high-hire-low-fit-compliance");
  const systemsDebug = failureAnalyst.find((item) => item.job.canonicalId === "job-title-bias-systems-debug");
  const systemsMbse = failureAnalyst.find((item) => item.job.canonicalId === "job-title-bias-systems-mbse");
  const fa1 = failureAnalyst.find((item) => item.job.canonicalId === "job-diff-title-same-fa-1");
  const fa2 = failureAnalyst.find((item) => item.job.canonicalId === "job-diff-title-same-fa-2");
  const lowInfo = buildUserProfile("low-information");
  const checks = [
    { id: "persona-high-functions", pass: results.filter((item) => item.passesHighFunction).length >= 13 },
    { id: "high-fit-low-hireability", pass: !!roboticsNoCpp && roboticsNoCpp.score.predictedFit > 8 && roboticsNoCpp.score.hireability < 7.2 },
    { id: "high-hireability-low-fit", pass: !!complianceForQuality && complianceForQuality.score.hireability > complianceForQuality.score.predictedFit },
    { id: "same-title-different-tasks", pass: !!systemsDebug && !!systemsMbse && systemsDebug.score.predictedFit - systemsMbse.score.predictedFit > 1.5 },
    { id: "different-title-same-tasks", pass: !!fa1 && !!fa2 && Math.abs(fa1.score.predictedFit - fa2.score.predictedFit) < 0.7 },
    { id: "sparse-evidence-lower-confidence", pass: lowInfo.confidence < 0.55 },
  ];
  return { results, checks, passed: checks.every((check) => check.pass), searchRun: dataset.searchRun };
}

export function profileVector(profile: UserProfile): Vector {
  return Object.fromEntries(profile.taskDna.map((item) => [item.dimensionId, item.value])) as Vector;
}

export function vectorFit(a: Vector, b: Vector) {
  const distance = dimensions.reduce((sum, definition) => sum + Math.abs(a[definition.id] - b[definition.id]), 0) / dimensions.length;
  return clamp(10 - distance, 1, 10);
}

export function calculateConfidenceAdjustedFit(predictedFit: number, confidence: number) {
  return clamp(predictedFit - scoringConfig.confidenceAdjustedFitPenalty * (1 - confidence), 1, 10);
}

function confidenceAdjustedFit(predictedFit: number, confidence: number) {
  return calculateConfidenceAdjustedFit(predictedFit, confidence);
}

function capabilityAlignmentFor(profile: UserProfile, requirements: string[]) {
  if (!requirements.length) return 0.55;
  const capabilityText = profile.capabilities.map((capability) => capability.name.toLowerCase()).join(" ");
  const matched = requirements.filter((requirement) => capabilityText.includes(requirement.toLowerCase()) || profile.persona.capabilityKeywords.some((keyword) => requirement.toLowerCase().includes(keyword.toLowerCase())));
  return clamp(matched.length / requirements.length + 0.18, 0.05, 1);
}

function requirementsLegibility(profile: UserProfile, requirements: string[]) {
  return capabilityAlignmentFor(profile, requirements) * average(profile.capabilities.map((capability) => capability.recruiterLegibility || 0.35));
}

function negativeFit(profile: UserProfile, frictionFactors: string[]) {
  const text = frictionFactors.join(" ").toLowerCase();
  const repellents = profile.persona.repellents.filter((repellent) => text.includes(repellent.toLowerCase()) || repellent.toLowerCase().split(" ").some((word) => word.length > 4 && text.includes(word)));
  return clamp(repellents.length * 2.2 + (text.includes("documentation") && profile.persona.repellents.includes("documentation") ? 2 : 0), 0, 10);
}

function noveltyScore(profile: UserProfile, job: JobPosting, analysis: JobAnalysis, predictedFit: number) {
  const titleDistance = profile.persona.currentField && !job.domain.includes(profile.persona.currentField) ? 2.4 : 1.0;
  const titleObvious = profile.persona.careerText.toLowerCase().includes(job.title.toLowerCase().split(" ")[0]) ? -1.1 : 1.8;
  const transferRatio = capabilityAlignmentFor(profile, analysis.requiredCapabilities);
  if (predictedFit < scoringConfig.novelty.minimumRelevantFit || transferRatio < scoringConfig.novelty.minimumCapabilityTransfer) {
    return clamp(4.5 + predictedFit * 0.2 + transferRatio, 1, scoringConfig.novelty.threshold - 0.1);
  }
  const transfer = transferRatio * 2.6;
  const fit = predictedFit * 0.46;
  return clamp(titleDistance + titleObvious + transfer + fit, 1, 10);
}

function noveltyFromFunction(profile: UserProfile, fn: CareerFunction) {
  const field = profile.persona.currentField.toLowerCase();
  const obvious = Boolean(field) && field !== "unknown" && fn.typicalDomains.some((domain) => domain.includes(field) || field.includes(domain));
  return obvious ? 6.5 : 8.2;
}

export function calculateOverallScore(input: { hireability: number; confidenceAdjustedFit: number; careerDirection: number; technicalGrowth: number; durability: number }) {
  return clamp(
    scoringConfig.weights.hireability * input.hireability +
      scoringConfig.weights.confidenceAdjustedFit * input.confidenceAdjustedFit +
      scoringConfig.weights.careerDirection * input.careerDirection +
      scoringConfig.weights.technicalGrowth * input.technicalGrowth +
      scoringConfig.weights.durability * input.durability,
    1,
    10,
  );
}

function overallScore(input: { hireability: number; confidenceAdjustedFit: number; careerDirection: number; technicalGrowth: number; durability: number }) {
  return calculateOverallScore(input);
}

export function determineActionTier(input: { overall: number; hireability: number; predictedFit: number; confidence: number; hardGaps: string[] }): ActionTier {
  if (input.overall >= scoringConfig.tiers.attackFirst.overall && input.hireability >= scoringConfig.tiers.attackFirst.hireability && input.predictedFit >= scoringConfig.tiers.attackFirst.fit) return "ATTACK_FIRST";
  if (input.hireability >= scoringConfig.tiers.coreApply.hireability) return "CORE_APPLY";
  if (input.hireability >= scoringConfig.tiers.highFitStretch.hireabilityMin && input.hireability <= scoringConfig.tiers.highFitStretch.hireabilityMax && input.predictedFit >= scoringConfig.tiers.highFitStretch.fit && input.confidence >= scoringConfig.tiers.highFitStretch.confidence && input.hardGaps.length < 2) return "HIGH_FIT_STRETCH";
  if (input.predictedFit >= 8.2) return "FUTURE_EXEMPLAR";
  return "LOWER_PRIORITY";
}

function actionTierFor(input: { overall: number; hireability: number; predictedFit: number; confidence: number; hardGaps: string[] }): ActionTier {
  return determineActionTier(input);
}

export function determineSellability(hireability: number, capabilityAlignment: number, hardGaps: string[]): Sellability {
  if (hardGaps.length >= 3) return "REAL_SKILL_GAP";
  if (hireability >= 8) return "DIRECT_SELL";
  if (capabilityAlignment >= 5.5) return "SELL_HARDER";
  return "STRATEGIC_STRETCH";
}

function sellabilityFor(hireability: number, capabilityAlignment: number, hardGaps: string[]): Sellability {
  return determineSellability(hireability, capabilityAlignment, hardGaps);
}

function pickPrimaryFunction(job: JobPosting, jobVector: Vector, functionSet: CareerFunction[] = careerFunctions) {
  const match = matchFunctionByTasks(job);
  if (match.source === "task-content") {
    const taskMatched = functionSet.find((fn) => fn.id === match.functionId);
    if (taskMatched) return taskMatched;
  }
  // Unmatched and title-only jobs fall back to nearest work-structure vector, never raw title.
  return functionSet.map((fn) => ({ fn, fit: vectorFit(jobVector, fn.taskDnaVector) })).sort((a, b) => b.fit - a.fit)[0].fn;
}

function actualWorkSummary(job: JobPosting, primary: CareerFunction, frictionFactors: string[]) {
  const text = `${job.title} ${job.description} ${job.responsibilities.join(" ")}`.toLowerCase();
  if (primary.id === "verification-validation" && frictionFactors.includes("documentation / traceability load")) return "Produce documented verification evidence through protocols, traceability, deviations, and release-ready validation records.";
  if (text.includes("integration troubleshooting") || text.includes("cross-layer")) return "Use logs, targeted system tests, and hardware/software evidence to diagnose integration failures and drive fixes across subsystem boundaries.";
  if (text.includes("product failures") || text.includes("field failures")) return "Investigate real product failures with telemetry, bench evidence, experiments, and corrective-action verification.";
  if (primary.id === "engineering-tools") return "Build internal tools that connect engineering data streams and remove manual reconciliation from technical workflows.";
  if (primary.id === "sensor-algorithm-performance") return "Measure sensor or algorithm behavior across cohorts and edge cases, then isolate data, model, or signal-quality mechanisms.";
  if (primary.id === "robotics-field-performance") return "Analyze robot field behavior from logs and sensor data, then design autonomy experiments that expose edge-case failures.";
  if (primary.id === "field-applications") return "Resolve customer technical failures in real settings, capture evidence, teach recovery, and feed patterns back to product teams.";
  if (primary.id === "product-systems-engineering") return "Translate ambiguous customer and product needs into system tradeoffs, interfaces, requirements, and cross-team decisions.";
  return primary.oneSentenceTaskLoop;
}

function hardGaps(requirements: string[]) {
  return requirements.filter((requirement) => /c\+\+|ros|embedded|sysml|iso 13485|plc|high-voltage|clinical credential/i.test(requirement));
}

function seniorityPenalty(job: JobPosting) {
  return job.seniority === "Manager" ? 1.3 : job.seniority === "Staff" ? 0.8 : job.seniority === "Senior" ? 0.35 : 0;
}

function inferContradictions(persona: (typeof personas)[number], evidence: UserEvidence[]) {
  const contradictions: string[] = [];
  for (const definition of dimensions) {
    const highEvidence = evidence.filter((item) => (item.inferredTaskDimensions[definition.id] ?? 5) >= 6.5);
    const lowEvidence = evidence.filter((item) => (item.inferredTaskDimensions[definition.id] ?? 5) <= 3.5);
    if (highEvidence.length > 0 && lowEvidence.length > 0) {
      contradictions.push(`${definition.consumerLabel} has both positive and negative evidence (${highEvidence[0].id} vs ${lowEvidence[0].id}).`);
    }
  }
  if (persona.repellents.some((repellent) => repellent.includes("customer")) && evidence.some((item) => item.originalText.toLowerCase().includes("field"))) contradictions.push("User dislikes customer-facing work but has field troubleshooting evidence.");
  if (evidence.length < scoringConfig.inference.sparseEvidenceThreshold) contradictions.push("Sparse evidence: recommendations are deliberately lower-confidence and more exploratory.");
  return Array.from(new Set(contradictions));
}

function classifyActivity(sentence: string) {
  const lower = sentence.toLowerCase();
  if (lower.includes("built") || lower.includes("developed")) return "built tools or systems";
  if (lower.includes("investigat") || lower.includes("debug") || lower.includes("root")) return "investigated technical behavior";
  if (lower.includes("coordinat") || lower.includes("stakeholder")) return "coordinated people or requirements";
  return "reported career evidence";
}

function classifyProblem(sentence: string) {
  const lower = sentence.toLowerCase();
  if (lower.includes("failure") || lower.includes("debug")) return "root-cause investigation";
  if (lower.includes("model") || lower.includes("simulation")) return "modeling and abstraction";
  if (lower.includes("customer") || lower.includes("field")) return "field/customer troubleshooting";
  if (lower.includes("document") || lower.includes("traceability")) return "documentation and compliance";
  return "knowledge work";
}

function keywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

function reasonTouchesDimension(tags: string[], dimension: DimensionId) {
  const text = tags.join(" ").toLowerCase();
  const map: Record<DimensionId, RegExp> = {
    problem_structure: /ambiguous|defined|scope/,
    measurable_feedback: /data|signals|feedback/,
    investigation_orientation: /troubleshooting|diagnose|investigation/,
    evidence_density: /data|signals|logs|evidence/,
    experimentation_preference: /experiment|testing/,
    scope_preference: /ambiguous|bounded/,
    software_as_tool: /tool|coding|software/,
    reasoning_style: /why|causal|diagnose/,
    creation_style: /build|creation/,
    real_system_grounding: /physical|systems|field/,
    closure_preference: /closure|resolve/,
    causal_reasoning: /root|why|causal/,
    integration_preference: /integration|systems/,
    customer_interaction_preference: /customer|field/,
    coordination_preference: /coordination|stakeholder/,
    theory_vs_application: /theoretical|applied/,
    repetition_tolerance: /repetitive|routine/,
  };
  return map[dimension].test(text);
}

function isExtremeMismatch(job: JobPosting) {
  return job.seniority === "Manager" || job.requirements.some((requirement) => /clinical credential|10\+/.test(requirement));
}

export function hardFilterJobs(jobs: JobPosting[]) {
  return jobs.map((job) => {
    const reasons = [
      ...((scoringConfig.hardFilters.extremeSeniority as readonly string[]).includes(job.seniority) ? ["extreme seniority mismatch"] : []),
      ...job.requirements.filter((requirement) => scoringConfig.hardFilters.specializedGapKeywords.some((keyword) => requirement.toLowerCase().includes(keyword.toLowerCase()))).map((requirement) => `specialized hard gap: ${requirement}`),
    ];
    return { job, pass: reasons.length === 0, reasons };
  });
}

export function canonicalizeObservations(observations: JobSourceObservation[]) {
  const grouped = new Map<string, JobSourceObservation[]>();
  for (const observation of observations) {
    const key = [observation.externalId, observation.companyRaw.toLowerCase().trim(), observation.titleRaw.toLowerCase().trim(), observation.locationRaw.toLowerCase().trim()].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }
  return Array.from(grouped.entries()).map(([key, items]) => ({
    canonicalKey: key,
    sourceObservationIds: items.map((item) => item.id),
    company: items[0].companyRaw,
    title: items[0].titleRaw,
    location: items[0].locationRaw,
    canonicalizationConfidence: clamp(0.78 + Math.min(items.length, 4) * 0.04, 0.78, 0.94),
  }));
}

export function transitionFreshnessState(current: FreshnessState, event: keyof typeof scoringConfig.freshnessTransitions): FreshnessState {
  if (event === "reverify_failed" && current === "CONFIRMED_CLOSED") return "CONFIRMED_CLOSED";
  return scoringConfig.freshnessTransitions[event] as FreshnessState;
}

export function estimateSimulatedCommute(job: Pick<JobPosting, "location" | "workMode">, homeRegion = scoringConfig.commuteRules.defaultHomeRegion, toleranceMinutes = 60) {
  if (job.workMode === "Remote") return { minutes: 0, penalty: 0, label: "Remote" };
  const sameRegion = job.location.toLowerCase().includes(homeRegion.split(",")[0].toLowerCase());
  const base = sameRegion ? 38 : job.workMode === "Hybrid" ? 58 : 76;
  const minutes = Math.max(0, base - (job.workMode === "Hybrid" ? 8 : 0));
  const penalty =
    minutes <= scoringConfig.commuteRules.noPenaltyMinutes ? 0 :
    minutes <= scoringConfig.commuteRules.acceptableMinutes ? 0.4 :
    minutes <= scoringConfig.commuteRules.mildPenaltyMinutes ? 0.8 :
    minutes <= scoringConfig.commuteRules.stretchMinutes ? 1.6 : 2.8;
  return { minutes, penalty: minutes > toleranceMinutes ? penalty + 0.8 : penalty, label: `${minutes} min simulated ${job.workMode.toLowerCase()} commute` };
}

function snapshotProfile(profile: UserProfile): ProfileSnapshot {
  return {
    profileId: profile.persona.id,
    taskDna: Object.fromEntries(profile.taskDna.map((dimension) => [dimension.dimensionId, { value: dimension.value, confidence: dimension.confidence }])) as ProfileSnapshot["taskDna"],
    capabilityIds: profile.capabilities.map((capability) => capability.id),
  };
}

function invertPartialVector(input: Partial<Vector>): Partial<Vector> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, 10 - (value ?? 5)])) as Partial<Vector>;
}

function sameSide(a: number, b: number) {
  return (a >= 5 && b >= 5) || (a < 5 && b < 5);
}

function weightedAverage(values: { value: number; weight: number }[]) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : 5;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatScore(score: number) {
  return score.toFixed(1);
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
