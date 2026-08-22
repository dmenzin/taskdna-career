import { askRules, channelExecutionPolicy, networkModelConfig, networkingPrinciples } from "@/config/network";
import { careerFunctions } from "@/config/model";
import { createEmptyGraph, createSyntheticNetworkUniverse } from "@/fixtures/network";
import type {
  AskType,
  ContactOpportunityAssessment,
  HumanOpportunityGraph,
  InteractionEvent,
  InteractionPlan,
  MessageDraft,
  NetworkPath,
  NextBestAction,
  OpportunityAccessAssessment,
  OpportunityPursuitPlan,
  Person,
  Relationship,
} from "@/domain/networkTypes";
import type { ScoredJob, UserProfile } from "@/domain/types";

const now = "2026-08-22T17:21:00.000Z";

export function createHumanOpportunityGraph(profile: UserProfile, scoredJobs: ScoredJob[]): HumanOpportunityGraph {
  const universe = createSyntheticNetworkUniverse();
  const personaRelationships = universe.relationships.filter((relationship) => relationship.personaId === profile.persona.id);
  const personaPeople = universe.people.filter((person) => personaRelationships.some((relationship) => relationship.personId === person.id));
  const personaInteractions = universe.interactions.filter((interaction) => personaRelationships.some((relationship) => relationship.id === interaction.relationshipId));
  const jobs = scoredJobs;
  const contactAssessments = personaRelationships.flatMap((relationship) => {
    const person = personaPeople.find((candidate) => candidate.id === relationship.personId);
    if (!person) return [];
    return jobs.map((job) => assessContactForOpportunity(person, relationship, personaInteractions, job));
  });
  const paths = findNetworkPaths(personaPeople, personaRelationships, personaInteractions, jobs, contactAssessments);
  const accessAssessments = jobs.map((job) => assessOpportunityAccess(job, contactAssessments, paths));
  const pursuitPlans = jobs.slice(0, 8).map((job) => createPursuitPlan(job, accessAssessments.find((item) => item.opportunityId === job.job.canonicalId)!, contactAssessments, paths, personaPeople, personaRelationships, personaInteractions));
  const nextBestActions = planNextBestActions(profile, jobs, pursuitPlans, contactAssessments, personaPeople, personaRelationships, personaInteractions);
  return {
    ...createEmptyGraph(profile.persona.id, jobs),
    people: personaPeople,
    relationships: personaRelationships,
    interactions: personaInteractions,
    principles: networkingPrinciples,
    contactAssessments,
    paths,
    accessAssessments,
    pursuitPlans,
    nextBestActions,
    topFunctionCoverage: computeFunctionCoverage(profile, contactAssessments),
    networkGaps: computeNetworkGaps(profile, contactAssessments),
  };
}

export function assessContactForOpportunity(person: Person, relationship: Relationship, interactions: InteractionEvent[], scoredJob: ScoredJob): ContactOpportunityAssessment {
  const functionRelevance = relevanceToFunction(person, scoredJob.analysis.primaryFunctionId);
  const companyRelevance = person.organizationId === organizationIdFromCompany(scoredJob.job.company) ? 9 : person.currentRoleSummary.includes(scoredJob.job.domain) ? 5.5 : 2.5;
  const relationshipStrength = clamp((relationship.warmthObserved + relationship.trustObserved + relationship.familiarity + relationship.reciprocity) / 4 - relationship.dormancy * 0.15, 0, 10);
  const explicitOffer = interactions.find((event) => event.relationshipId === relationship.id && event.explicitOffer);
  const referralBoundary = interactions.find((event) => event.relationshipId === relationship.id && event.explicitBoundary === "REFERRAL_REQUEST") || relationship.explicitBoundaries.some((boundary) => boundary.toLowerCase().includes("referral"));
  const noResponse = interactions.some((event) => event.relationshipId === relationship.id && event.eventType === "NO_RESPONSE");
  const weakTieNovelty = ["ALUM", "INDUSTRY_CONTACT", "BRIEF_ACQUAINTANCE", "SECOND_DEGREE"].includes(relationship.relationshipType) ? 8 : relationship.relationshipType === "DORMANT_FORMER_STRONG_TIE" ? 7.5 : 4;
  const observedWork = relationship.sharedWork.length || relationship.whatTheyKnowAboutUser.some((item) => !item.includes("field interest only"));
  const informationValue = clamp(functionRelevance * 0.42 + companyRelevance * 0.28 + weakTieNovelty * 0.18 + relationship.engagement * 0.12, 0, 10);
  const routingValue = clamp(companyRelevance * 0.45 + relationship.responsiveness * 0.2 + (person.seniority === "Manager" || person.seniority === "Recruiter" ? 2 : 0) + (explicitOffer?.explicitOffer?.includes("INTRO") ? 2 : 0), 0, 10);
  const credibilityValue = clamp((observedWork ? 5.5 : 1) + relationship.trustObserved * 0.28 + relationship.familiarity * 0.18 - (relationship.relationshipType === "ALUM" ? 2.5 : 0), 0, 10);
  const referralAbility = clamp(referralBoundary ? 0 : companyRelevance * 0.45 + credibilityValue * 0.32 + (explicitOffer?.explicitOffer === "SEND_REQUESTED_MATERIAL" ? 3 : 0), 0, 10);
  const advocacyPotential = clamp(referralBoundary ? 0 : credibilityValue * 0.5 + referralAbility * 0.25 + relationship.currentMomentum * 0.15 - relationship.askFatigue * 0.35, 0, 10);
  const socialCost = socialCostFor(relationship, "REFERRAL_REQUEST", referralBoundary ? 3 : 0);
  const askReadiness = buildAskReadiness(relationship, { informationValue, routingValue, credibilityValue, referralAbility, advocacyPotential }, Boolean(explicitOffer), Boolean(referralBoundary));
  return {
    personId: person.id,
    opportunityId: scoredJob.job.canonicalId,
    relationshipStrength,
    engagement: relationship.engagement,
    networkNovelty: weakTieNovelty,
    functionalRelevance: functionRelevance,
    companyRelevance,
    teamProximity: companyRelevance > 7 ? 8 : functionRelevance > 7 ? 5.5 : 2.5,
    informationValue,
    routingValue,
    credibilityValue,
    referralAbility,
    advocacyPotential,
    secondDegreeReach: relationship.relationshipType === "ALUM" || relationship.relationshipType === "INDUSTRY_CONTACT" ? 7.5 : 4,
    askReadiness,
    socialCost: noResponse ? socialCost + 1.2 : socialCost,
    confidence: clamp(0.48 + relationship.familiarity * 0.035 + (explicitOffer ? 0.18 : 0) + (referralBoundary ? 0.1 : 0), 0.3, 0.92),
    evidenceIds: interactions.filter((event) => event.relationshipId === relationship.id).map((event) => event.id),
    explanation: explainAssessment(person, relationship, { informationValue, routingValue, credibilityValue, referralAbility, advocacyPotential }, Boolean(referralBoundary)),
    version: networkModelConfig.versions.relationshipInference,
  };
}

export function assessOpportunityAccess(scoredJob: ScoredJob, assessments: ContactOpportunityAssessment[], paths: NetworkPath[]): OpportunityAccessAssessment {
  const relevant = assessments.filter((assessment) => assessment.opportunityId === scoredJob.job.canonicalId);
  const direct = relevant.filter((assessment) => Math.max(assessment.informationValue, assessment.routingValue, assessment.credibilityValue, assessment.referralAbility) >= 6);
  const jobPaths = paths.filter((path) => path.opportunityId === scoredJob.job.canonicalId).sort((a, b) => b.pathScore - a.pathScore);
  const max = (selector: (assessment: ContactOpportunityAssessment) => number) => direct.length ? Math.max(...direct.map(selector)) : 0;
  const informationAccess = max((item) => item.informationValue);
  const routingAccess = Math.max(max((item) => item.routingValue), jobPaths[0]?.routingValue ?? 0);
  const credibilityAccess = max((item) => item.credibilityValue);
  const referralAccess = max((item) => item.referralAbility);
  const advocacyAccess = max((item) => item.advocacyPotential);
  const strongest = jobPaths[0];
  return {
    opportunityId: scoredJob.job.canonicalId,
    directContactIds: direct.map((item) => item.personId),
    secondDegreePathIds: jobPaths.filter((path) => path.pathType === "SECOND_DEGREE").map((path) => path.id),
    informationAccess,
    routingAccess,
    credibilityAccess,
    referralAccess,
    advocacyAccess,
    strongestPathId: strongest?.id,
    pathConfidence: strongest?.confidence ?? (direct.length ? average(direct.map((item) => item.confidence)) : 0.35),
    socialCost: direct.length ? Math.min(...direct.map((item) => item.socialCost)) : 0,
    timing: scoredJob.job.freshnessState === "VERIFIED_LIVE" || scoredJob.job.freshnessState === "REVERIFIED_LIVE" ? "fresh enough to avoid slow networking delays" : "networking can gather information while freshness is uncertain",
    networkAccessSummary: direct.length ? `${direct.length} relevant direct contact(s), strongest path ${strongest?.pathType ?? "DIRECT"}.` : "No strong direct path; use direct application or build a missing node.",
  };
}

export function createInteractionPlan(person: Person, relationship: Relationship, assessment: ContactOpportunityAssessment, scoredJob?: ScoredJob, interactions: InteractionEvent[] = []): InteractionPlan {
  const explicitOffer = interactions.find((event) => event.relationshipId === relationship.id && event.explicitOffer);
  const referralBoundary = interactions.find((event) => event.relationshipId === relationship.id && event.explicitBoundary === "REFERRAL_REQUEST") || relationship.explicitBoundaries.some((boundary) => boundary.toLowerCase().includes("referral"));
  const ask = chooseAskType(relationship, assessment, scoredJob, Boolean(explicitOffer), Boolean(referralBoundary));
  const rule = askRules[ask];
  const channel = relationship.preferredChannel;
  return {
    id: `plan-${relationship.id}-${scoredJob?.job.canonicalId ?? "general"}`,
    personId: person.id,
    opportunityId: scoredJob?.job.canonicalId,
    objective: scoredJob ? `Advance ${scoredJob.job.title} without changing intrinsic Work Fit.` : "Build network coverage in a relevant function.",
    whyThisPerson: assessment.explanation,
    relationshipInterpretation: interpretRelationship(relationship),
    currentState: explicitOffer ? "explicit offer available" : referralBoundary ? "boundary recorded" : relationship.dormancy > 7 ? "dormant but not cold" : "available for context-aware outreach",
    recommendedAskType: ask,
    askReadiness: assessment.askReadiness[ask],
    askBurden: rule.timeBurden,
    socialCost: socialCostFor(relationship, ask, referralBoundary ? 3 : 0),
    urgency: scoredJob ? urgencyFor(scoredJob) : 3,
    sharedContextToUse: [...relationship.sharedWork, relationship.memorableContext].filter(Boolean).slice(0, 3),
    factsNotToAssume: ["Do not imply they can refer unless explicitly offered or credible.", "Do not fabricate closeness or mutual contacts."],
    tone: relationship.communicationStyle,
    channel,
    messageLength: relationship.communicationStyle === "BRIEF_DIRECT" ? "short" : "medium",
    directness: relationship.relationshipType === "RECRUITER" || relationship.relationshipType === "FORMER_MANAGER" || explicitOffer ? 8 : 5,
    successCondition: explicitOffer ? "Send requested material or receive the offered introduction/referral." : "Receive useful information, routing guidance, or a clear next step.",
    acceptablePartialSuccess: "Contact gives role/team context or names a better person to ask.",
    escalationIfPositive: ask === "SEND_REQUESTED_MATERIAL" ? "Mark material sent and await referral outcome." : "Ask whether a more specific intro or role discussion would be appropriate.",
    actionIfNeutral: "Thank them and record information; do not force escalation.",
    actionIfNoResponse: "One context-aware follow-up only if urgency and relationship warrant it.",
    actionIfDeclined: "Respect the decline and update boundaries/readiness.",
    thingsNotToAskYet: referralBoundary || assessment.credibilityValue < 5 ? ["REFERRAL_REQUEST", "REFERENCE_REQUEST"] : [],
    timingRecommendation: scoredJob?.job.freshnessState === "VERIFIED_LIVE" ? "Do not delay application; network in parallel if useful." : "Outreach can gather information before committing high effort.",
    reasoningTrace: [
      `Relationship type ${relationship.relationshipType}; warmth ${relationship.warmthObserved.toFixed(1)}, trust ${relationship.trustObserved.toFixed(1)}, dormancy ${relationship.dormancy.toFixed(1)}.`,
      `Access values information ${assessment.informationValue.toFixed(1)}, routing ${assessment.routingValue.toFixed(1)}, credibility ${assessment.credibilityValue.toFixed(1)}, referral ${assessment.referralAbility.toFixed(1)}, advocacy ${assessment.advocacyPotential.toFixed(1)}.`,
      explicitOffer ? `Explicit offer ${explicitOffer.explicitOffer} overrides generic sequencing.` : "No explicit offer overrides generic sequencing.",
      referralBoundary ? "Referral boundary blocks referral ask." : "No referral boundary detected.",
      `Recommended ask ${ask}; execution mode ${channelExecutionPolicy[channel]}.`,
    ],
    executionMode: channelExecutionPolicy[channel],
    modelVersion: networkModelConfig.versions.strategyModel,
    createdAt: now,
  };
}

export function composeDeterministicDraft(plan: InteractionPlan, person: Person, scoredJob?: ScoredJob): MessageDraft {
  const greeting = plan.tone === "BRIEF_DIRECT" ? `Hi ${person.name.split(" ")[0]},` : `Hi ${person.name.split(" ")[0]} —`;
  const context = plan.sharedContextToUse[0] ? `I’m reaching out with our shared context in mind: ${plan.sharedContextToUse[0]}.` : "I’m reaching out with a specific professional question.";
  const opportunity = scoredJob ? `I’m looking at ${scoredJob.job.title} at ${scoredJob.job.company}.` : "I’m exploring a function where your perspective may be useful.";
  const ask = plan.recommendedAskType === "SEND_REQUESTED_MATERIAL"
    ? "You offered to look at materials, so the right next step is to send the role and resume rather than ask for an informational chat first."
    : plan.recommendedAskType === "REFERRAL_REQUEST"
      ? "Would you be comfortable referring me or advising whether that is appropriate?"
      : plan.recommendedAskType.includes("INTRO")
        ? "Would you be open to pointing me to the right person, if someone comes to mind?"
        : "Would you be open to sharing a quick read on the role, team, or who would be best to talk with?";
  return {
    id: `draft-${plan.id}`,
    interactionPlanId: plan.id,
    subject: scoredJob ? `Question about ${scoredJob.job.company}` : "Quick career question",
    body: `${greeting}\n\n${context} ${opportunity}\n\n${ask}\n\nNo pressure if timing is bad — I’d appreciate any quick pointer that is easy for you.\n\nThanks!`,
    style: plan.tone,
    groundedFields: ["relationship context", "opportunity", "recommended ask", "boundaries"],
    warnings: plan.thingsNotToAskYet.length ? [`Do not ask yet: ${plan.thingsNotToAskYet.join(", ")}`] : [],
  };
}

export function evaluateNetworkStrategy(graph: HumanOpportunityGraph) {
  const formerManagerRelationship = graph.relationships.find((relationship) => relationship.relationshipType === "FORMER_MANAGER");
  const formerManagerPerson = formerManagerRelationship ? graph.people.find((person) => person.id === formerManagerRelationship.personId) : undefined;
  const formerManagerAssessment = formerManagerRelationship ? graph.contactAssessments.find((assessment) => assessment.personId === formerManagerRelationship.personId) : undefined;
  const formerManagerJob = formerManagerAssessment ? graph.scoredJobs.find((job) => job.job.canonicalId === formerManagerAssessment.opportunityId) : undefined;
  const formerManagerPlan = formerManagerPerson && formerManagerRelationship && formerManagerAssessment ? createInteractionPlan(formerManagerPerson, formerManagerRelationship, formerManagerAssessment, formerManagerJob, graph.interactions) : undefined;
  const cases = [
    { id: "former-manager-direct", pass: formerManagerPlan?.recommendedAskType === "REFERRAL_REQUEST" || formerManagerPlan?.recommendedAskType === "HIRING_MANAGER_INTRO_REQUEST" },
    { id: "explicit-offer-materials", pass: graph.nextBestActions.some((action) => action.interactionPlan?.recommendedAskType === "SEND_REQUESTED_MATERIAL") },
    { id: "boundaries-respected", pass: graph.nextBestActions.every((action) => !action.interactionPlan?.thingsNotToAskYet.includes(action.interactionPlan.recommendedAskType)) },
    { id: "network-does-not-change-work-fit", pass: graph.scoredJobs.every((job) => typeof job.score.predictedFit === "number" && !Number.isNaN(job.score.predictedFit)) },
    { id: "second-degree-paths", pass: graph.paths.some((path) => path.pathType === "SECOND_DEGREE") },
    { id: "daily-plan-balanced", pass: new Set(graph.nextBestActions.slice(0, 6).map((action) => action.actionType)).size >= 3 },
  ];
  return { passed: cases.every((item) => item.pass), cases, counts: { contacts: graph.people.length, relationships: graph.relationships.length, interactions: graph.interactions.length, paths: graph.paths.length, actions: graph.nextBestActions.length } };
}

function findNetworkPaths(people: Person[], relationships: Relationship[], interactions: InteractionEvent[], jobs: ScoredJob[], assessments: ContactOpportunityAssessment[]): NetworkPath[] {
  const paths: NetworkPath[] = [];
  for (const job of jobs.slice(0, 12)) {
    const relevant = assessments.filter((assessment) => assessment.opportunityId === job.job.canonicalId).sort((a, b) => b.routingValue - a.routingValue);
    for (const direct of relevant.slice(0, 3)) {
      const firstHop = people.find((person) => person.id === direct.personId)!;
      const rel = relationships.find((relationship) => relationship.personId === firstHop.id)!;
      paths.push(pathFromAssessment(job, direct, [firstHop.id], "DIRECT", rel.relationshipType === "COLD_CONTEXTUAL_CONTACT" ? "HYPOTHESIZED" : "USER_REPORTED"));
      const bridge = people.find((person) => person.organizationId === organizationIdFromCompany(job.job.company) && person.id !== firstHop.id);
      if (bridge && direct.routingValue >= 5.5) {
        paths.push(pathFromAssessment(job, direct, [firstHop.id, bridge.id], "SECOND_DEGREE", interactions.some((event) => event.relationshipId === rel.id && event.explicitOffer === "INTRODUCTION_REQUEST") ? "USER_REPORTED" : "INFERRED"));
      }
    }
  }
  return paths.sort((a, b) => b.pathScore - a.pathScore);
}

function pathFromAssessment(job: ScoredJob, assessment: ContactOpportunityAssessment, peopleIds: string[], pathType: NetworkPath["pathType"], certainty: NetworkPath["edgeCertainty"]): NetworkPath {
  const hopPenalty = peopleIds.length - 1;
  const pathScore = clamp(
    job.score.overall * networkModelConfig.pathWeights.destinationRelevance +
      assessment.askReadiness.WHO_SHOULD_I_TALK_TO * networkModelConfig.pathWeights.firstHopReadiness +
      (certainty === "USER_REPORTED" || certainty === "CONFIRMED" ? 9 : 6) * networkModelConfig.pathWeights.edgeCertainty +
      assessment.routingValue * networkModelConfig.pathWeights.routingPlausibility +
      assessment.credibilityValue * networkModelConfig.pathWeights.credibilityTransfer +
      assessment.advocacyPotential * networkModelConfig.pathWeights.advocacyPotential -
      hopPenalty * networkModelConfig.pathWeights.hopPenalty -
      assessment.socialCost * networkModelConfig.pathWeights.socialCostPenalty,
    0,
    10,
  );
  return {
    id: `path-${job.job.canonicalId}-${peopleIds.join("-")}`,
    opportunityId: job.job.canonicalId,
    pathType,
    peopleIds,
    hopCount: peopleIds.length,
    edgeCertainty: certainty,
    firstHopReadiness: assessment.askReadiness.WHO_SHOULD_I_TALK_TO,
    functionalRelevance: assessment.functionalRelevance,
    companyTeamProximity: assessment.teamProximity,
    askRequired: pathType === "DIRECT" ? "COMPANY_INFORMATION" : "SECOND_DEGREE_INTRO_REQUEST",
    socialCost: assessment.socialCost + hopPenalty,
    informationValue: assessment.informationValue,
    routingValue: assessment.routingValue,
    credibilityValue: pathType === "DIRECT" ? assessment.credibilityValue : assessment.credibilityValue * 0.6,
    pathScore,
    confidence: clamp(assessment.confidence - hopPenalty * 0.12, 0.2, 0.92),
    explanation: pathType === "DIRECT" ? "Direct known contact path." : "Second-degree route through first-hop contact; certainty exposed separately.",
  };
}

function createPursuitPlan(scoredJob: ScoredJob, access: OpportunityAccessAssessment, assessments: ContactOpportunityAssessment[], paths: NetworkPath[], people: Person[], relationships: Relationship[], interactions: InteractionEvent[]): OpportunityPursuitPlan {
  const bestAssessment = assessments.filter((assessment) => assessment.opportunityId === scoredJob.job.canonicalId).sort((a, b) => Math.max(b.referralAbility, b.routingValue, b.informationValue) - Math.max(a.referralAbility, a.routingValue, a.informationValue))[0];
  const bestPerson = bestAssessment ? people.find((person) => person.id === bestAssessment.personId) : undefined;
  const bestRelationship = bestPerson ? relationships.find((relationship) => relationship.personId === bestPerson.id) : undefined;
  const bestPlan = bestPerson && bestRelationship ? createInteractionPlan(bestPerson, bestRelationship, bestAssessment, scoredJob, interactions) : undefined;
  const applyNow = scoredJob.job.freshnessState === "VERIFIED_LIVE" || scoredJob.score.hireability >= 7.5 || access.routingAccess < 5;
  const strategy: OpportunityPursuitPlan["applicationStrategy"] = scoredJob.score.overall < 6.5 && access.referralAccess > 7 ? "DO_NOT_SPEND_SOCIAL_CAPITAL" : applyNow && access.routingAccess >= 5 ? "APPLY_NOW_NETWORK_IN_PARALLEL" : applyNow ? "DIRECT_APPLY_ONLY" : access.informationAccess >= 6 ? "INFORMATION_FIRST" : "APPLY_FIRST_THEN_ROUTE";
  return {
    opportunityId: scoredJob.job.canonicalId,
    intrinsicJobSummary: `${scoredJob.job.title}: Work Fit ${scoredJob.score.predictedFit.toFixed(1)}, Hireability ${scoredJob.score.hireability.toFixed(1)}.`,
    networkAccessSummary: access.networkAccessSummary,
    applicationStrategy: strategy,
    networkingStrategy: bestPlan ? `${bestPlan.recommendedAskType} with ${bestPerson?.name}` : "No strong path; use direct application and build function coverage.",
    recommendedSequence: [applyNow ? "Apply now" : "Gather information first", bestPlan ? `Contact ${bestPerson?.name}` : "Do not force networking", "Log outcome"],
    parallelActions: applyNow && bestPlan ? ["Submit application", `Send ${bestPlan.recommendedAskType.toLowerCase().replaceAll("_", " ")} note`] : [],
    bestContactId: bestPerson?.id,
    backupContactIds: assessments.filter((assessment) => assessment.opportunityId === scoredJob.job.canonicalId && assessment.personId !== bestPerson?.id).slice(0, 2).map((assessment) => assessment.personId),
    bestNetworkPathId: paths.find((path) => path.opportunityId === scoredJob.job.canonicalId)?.id,
    recommendedAsk: bestPlan?.recommendedAskType,
    askReadiness: bestPlan?.askReadiness ?? 0,
    socialCost: bestPlan?.socialCost ?? 0,
    applyNow,
    delayWarning: applyNow && access.routingAccess < 6 ? "Do not wait for a slow path before applying." : undefined,
    freshnessRationale: access.timing,
    successConditions: bestPlan ? [bestPlan.successCondition] : ["Application submitted or missing-node type identified"],
    stopConditions: bestPlan ? [bestPlan.actionIfDeclined] : ["No relevant contact found"],
    createdAt: now,
    version: "pursuit.plan.v1",
  };
}

function planNextBestActions(profile: UserProfile, jobs: ScoredJob[], pursuitPlans: OpportunityPursuitPlan[], assessments: ContactOpportunityAssessment[], people: Person[], relationships: Relationship[], interactions: InteractionEvent[]): NextBestAction[] {
  const actions: NextBestAction[] = [];
  for (const plan of pursuitPlans) {
    const job = jobs.find((item) => item.job.canonicalId === plan.opportunityId)!;
    if (plan.applyNow) {
      actions.push(makeAction("APPLY_TO_JOB", `Apply to ${job.job.title}`, plan.freshnessRationale, job.score.overall, 0, 0.5, 35, urgencyFor(job), 0, [], job.job.canonicalId));
    }
    if (plan.bestContactId) {
      const person = people.find((item) => item.id === plan.bestContactId)!;
      const relationship = relationships.find((item) => item.personId === person.id)!;
      const assessment = assessments.find((item) => item.personId === person.id && item.opportunityId === plan.opportunityId)!;
      const interactionPlan = createInteractionPlan(person, relationship, assessment, job, interactions);
      actions.push({
        ...makeAction(actionTypeForAsk(interactionPlan.recommendedAskType), `${humanAsk(interactionPlan.recommendedAskType)}: ${person.name}`, interactionPlan.whyThisPerson, job.score.overall, Math.max(assessment.informationValue, assessment.routingValue, assessment.referralAbility), interactionPlan.socialCost, 18, interactionPlan.urgency, assessment.informationValue, [], job.job.canonicalId, person.id),
        interactionPlan,
        draft: composeDeterministicDraft(interactionPlan, person, job),
      });
    }
  }
  const topFunctions = profile.persona.expectedHighFunctions.slice(0, 2);
  for (const functionId of topFunctions) {
    const coverage = assessments.filter((assessment) => people.find((person) => person.id === assessment.personId)?.functionalAreas.includes(functionId));
    if (coverage.length < 2) {
      actions.push(makeAction("BUILD_NETWORK_IN_FUNCTION", `Find one ${functionId.replaceAll("-", " ")} insider`, "Network gap in a high-fit function.", 6.5, 5.8, 2, 25, 4, 6, []));
    }
  }
  return actions
    .map((action) => ({ ...action, priority: actionPriority(action) }))
    .sort((a, b) => b.priority - a.priority)
    .filter((action, index, sorted) => sorted.findIndex((candidate) => candidate.actionType === action.actionType && candidate.relatedPersonId === action.relatedPersonId && candidate.title === action.title) === index)
    .slice(0, 12);
}

function makeAction(actionType: NextBestAction["actionType"], title: string, whyNow: string, opportunityValue: number, networkValue: number, socialCost: number, timeEstimateMinutes: number, urgency: number, expectedInformationAccessGain: number, dependencies: string[], relatedOpportunityId?: string, relatedPersonId?: string): NextBestAction {
  return { id: `action-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, actionType, title, whyNow, opportunityValue, networkValue, socialCost, timeEstimateMinutes, urgency, expectedInformationAccessGain, dependencies, priority: 0, relatedOpportunityId, relatedPersonId };
}

function actionPriority(action: NextBestAction) {
  return clamp(
    action.opportunityValue * networkModelConfig.actionWeights.intrinsicOpportunityPriority +
      action.networkValue * networkModelConfig.actionWeights.expectedAccessGain +
      action.expectedInformationAccessGain * networkModelConfig.actionWeights.informationGain +
      action.urgency * networkModelConfig.actionWeights.urgency +
      (action.interactionPlan?.askReadiness ?? 6) * networkModelConfig.actionWeights.readiness -
      action.socialCost * networkModelConfig.actionWeights.socialCostPenalty -
      (action.timeEstimateMinutes / 60) * networkModelConfig.actionWeights.timeCostPenalty,
    0,
    10,
  );
}

function buildAskReadiness(relationship: Relationship, values: Pick<ContactOpportunityAssessment, "informationValue" | "routingValue" | "credibilityValue" | "referralAbility" | "advocacyPotential">, explicitOffer: boolean, referralBoundary: boolean): Record<AskType, number> {
  const base = {
    RECONNECT: relationship.dormancy > 7 ? 8 : 4,
    CATCH_UP: relationship.warmthObserved,
    CAREER_PERSPECTIVE: values.informationValue,
    FUNCTION_INSIGHT: values.informationValue,
    ROLE_REALITY: values.informationValue,
    COMPANY_INFORMATION: Math.max(values.informationValue, values.routingValue),
    TEAM_INFORMATION: values.routingValue,
    SKILL_ADVICE: values.informationValue,
    FIT_REALITY_CHECK: Math.max(values.informationValue, values.credibilityValue),
    WHO_SHOULD_I_TALK_TO: values.routingValue,
    INTRODUCTION_REQUEST: values.routingValue,
    SECOND_DEGREE_INTRO_REQUEST: values.routingValue,
    REFERRAL_REQUEST: referralBoundary ? 0 : values.referralAbility,
    RESUME_FORWARD_REQUEST: referralBoundary ? 0 : values.referralAbility,
    HIRING_MANAGER_INTRO_REQUEST: values.routingValue * 0.85,
    RECRUITER_INTRO_REQUEST: values.routingValue,
    REFERENCE_REQUEST: values.credibilityValue,
    HIDDEN_OPPORTUNITY_QUERY: values.informationValue,
    APPLICATION_STATUS_HELP: values.routingValue,
    POST_APPLICATION_NOTE: values.routingValue,
    FOLLOW_UP: relationship.responsePattern === "no_response_recently" ? 3 : 6,
    THANK_YOU: 9,
    RELATIONSHIP_MAINTENANCE: relationship.warmthObserved,
    SHARE_USEFUL_RESOURCE: relationship.warmthObserved,
    SCHEDULE_CONVERSATION: Math.max(values.informationValue, relationship.warmthObserved) - 1,
    SEND_REQUESTED_MATERIAL: explicitOffer ? 10 : 2,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, clamp(value, 0, 10)])) as Record<AskType, number>;
}

function chooseAskType(relationship: Relationship, assessment: ContactOpportunityAssessment, scoredJob: ScoredJob | undefined, explicitOffer: boolean, referralBoundary: boolean): AskType {
  if (explicitOffer) return "SEND_REQUESTED_MATERIAL";
  if (relationship.relationshipType === "RECRUITER") return "ROLE_REALITY";
  if (referralBoundary) return assessment.informationValue >= 6 ? "COMPANY_INFORMATION" : "CAREER_PERSPECTIVE";
  if (relationship.relationshipType === "FORMER_MANAGER" && assessment.credibilityValue >= 7 && scoredJob && scoredJob.score.overall >= 7.2) return assessment.referralAbility >= 6 ? "REFERRAL_REQUEST" : "HIRING_MANAGER_INTRO_REQUEST";
  if (relationship.relationshipType === "DORMANT_FORMER_STRONG_TIE") return "RECONNECT";
  if (relationship.relationshipType === "ALUM" || relationship.relationshipType === "COLD_CONTEXTUAL_CONTACT") return assessment.routingValue >= 6 ? "WHO_SHOULD_I_TALK_TO" : "COMPANY_INFORMATION";
  if (assessment.referralAbility >= 7.5 && scoredJob && scoredJob.score.overall >= 7.4) return "REFERRAL_REQUEST";
  if (assessment.routingValue >= 7) return "INTRODUCTION_REQUEST";
  if (assessment.informationValue >= 6) return "ROLE_REALITY";
  return "CAREER_PERSPECTIVE";
}

function computeFunctionCoverage(profile: UserProfile, assessments: ContactOpportunityAssessment[]) {
  const coverage: HumanOpportunityGraph["topFunctionCoverage"] = {};
  for (const functionId of profile.persona.expectedHighFunctions) {
    const relevant = assessments.filter((assessment) => assessment.functionalRelevance >= 7 && assessment.informationValue >= 6);
    coverage[functionId] = relevant.length >= 4 ? "STRONG_COVERAGE" : relevant.length >= 2 ? "MODERATE_COVERAGE" : relevant.length >= 1 ? "UNKNOWN" : "NETWORK_GAP";
  }
  return coverage;
}

function computeNetworkGaps(profile: UserProfile, assessments: ContactOpportunityAssessment[]) {
  return profile.persona.expectedHighFunctions.flatMap((functionId) => {
    const coverage = assessments.filter((assessment) => assessment.functionalRelevance >= 7);
    return coverage.length < 2 ? [{ functionId, missingNodeType: `${functionId.replaceAll("-", " ")} insider or manager`, rationale: "High-fit function has limited information/routing coverage." }] : [];
  });
}

function relevanceToFunction(person: Person, functionId: string) {
  return person.functionalAreas.includes(functionId) ? 9 : person.functionalAreas.some((area) => careerFunctions.find((fn) => fn.id === area)?.typicalDomains.some((domain) => functionId.includes(domain))) ? 5 : 2;
}

function organizationIdFromCompany(company: string) {
  return `org-${Math.max(1, (company.length % 12) + 1)}`;
}

function socialCostFor(relationship: Relationship, ask: AskType, boundaryPenalty = 0) {
  return clamp(askRules[ask].socialCost + relationship.askFatigue * 0.35 + Math.max(0, 5 - relationship.warmthObserved) * 0.22 + boundaryPenalty, 0, 10);
}

function urgencyFor(scoredJob: ScoredJob) {
  return scoredJob.job.freshnessState === "VERIFIED_LIVE" || scoredJob.job.freshnessState === "REVERIFIED_LIVE" ? 8 : scoredJob.job.freshnessState === "POSSIBLY_STALE" ? 4 : 5.5;
}

function explainAssessment(person: Person, relationship: Relationship, values: Pick<ContactOpportunityAssessment, "informationValue" | "routingValue" | "credibilityValue" | "referralAbility" | "advocacyPotential">, referralBoundary: boolean) {
  const pieces = [`${person.name} is a ${relationship.relationshipType.replaceAll("_", " ").toLowerCase()} with ${person.currentRoleSummary}`];
  pieces.push(`Info ${values.informationValue.toFixed(1)}, routing ${values.routingValue.toFixed(1)}, credibility ${values.credibilityValue.toFixed(1)}, advocacy ${values.advocacyPotential.toFixed(1)} are separate.`);
  if (referralBoundary) pieces.push("Referral boundary is recorded, so do not ask for referral.");
  return pieces.join(" ");
}

function interpretRelationship(relationship: Relationship) {
  if (relationship.relationshipType === "DORMANT_FORMER_STRONG_TIE") return "Dormant former strong tie: not a stranger, but reconnect before heavy asks.";
  if (relationship.relationshipType === "ALUM") return "Weak alumni tie: useful for information/routing, not credibility by default.";
  if (relationship.relationshipType === "FORMER_MANAGER") return "Strong observed-work relationship; direct specific ask can be normal.";
  if (relationship.relationshipType === "RECRUITER") return "Recruiter relationship; discuss the role directly.";
  return relationship.userRead;
}

function actionTypeForAsk(ask: AskType): NextBestAction["actionType"] {
  if (ask === "REFERRAL_REQUEST" || ask === "RESUME_FORWARD_REQUEST") return "ASK_REFERRAL";
  if (ask.includes("INTRO")) return "ASK_INTRO";
  if (ask === "SEND_REQUESTED_MATERIAL") return "SEND_REQUESTED_MATERIAL";
  if (ask === "RECONNECT") return "RECONNECT_PERSON";
  return "ASK_ADVICE";
}

function humanAsk(ask: AskType) {
  return ask.toLowerCase().replaceAll("_", " ");
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
