// Pass-2 Virtual Subject Laboratory backed by the real O*NET 30.3 corpus.
//
// HARD INVARIANT: O*NET occupational descriptors define WORK EXPOSURE, never whether
// the person likes the work. Hidden preference truth is generated independently of the
// occupation; a controlled minority is nudged toward it (capable-and-happy people exist),
// and the majority keeps fully independent preferences (capable-and-unhappy, burned out,
// career changers, indifferent, mixed).
import { DIMENSION_IDS, vector } from "@/config/model";
import type { InteractionEvent, Person, Relationship } from "@/domain/networkTypes";
import type { DimensionId, Vector } from "@/domain/types";
import { occupationToLabSkeleton } from "@/onet/adapter";
import { loadOnetCorpus } from "@/onet/corpus";
import { ONET_STRATA, isKnowledgeWorkScope, stratumFor, type OnetStratum } from "@/onet/strata";
import type { OnetOccupationSkeleton } from "@/onet/types";
import {
  genericPhrase,
  ONET_PREFERENCE_PHRASES,
  planPreferenceStatements,
  statementsForConstruction,
  statementsForSource,
  type PreferenceSourceBudget,
} from "@/lab/preferencePhrases";
import { between, chance, hashSeed, mulberry32, pick, pickN, type Rng } from "@/lab/rng";
import type { SubjectCohortV2, TwinPair, VirtualSubject, VirtualSubjectObservations, VirtualSubjectTruth } from "@/lab/types";

export const ONET_LAB_VERSION = "subject-lab.v2-onet-semantic-polarity";
export const ONET_LAB_SEED = 20260823;
export const COHORT_SIZES: Record<SubjectCohortV2, number> = {
  development: 150,
  validation: 100,
  holdout: 100,
  adversarial: 100,
};
export const TOTAL_SUBJECTS = Object.values(COHORT_SIZES).reduce((sum, count) => sum + count, 0);

const FIRST = ["Amina", "Blake", "Cara", "Dev", "Ellis", "Farah", "Gabe", "Hana", "Ivan", "Jules", "Keiko", "Luis", "Maya", "Nico", "Orla", "Pavel"];
const LAST = ["Okoye", "Diaz", "Shah", "Berg", "Wahl", "Costa", "Ng", "Ali", "Novak", "Park", "Silva", "Hughes", "Khan", "Frost", "Abebe", "Quinn"];

/**
 * Preference phrase catalog. Re-exported from src/lab/preferencePhrases.ts, which also
 * owns the statement planner that pairs a phrase's behaviour SIDE with a LIKE/DISLIKE
 * STANCE so the generated sentence means what the hidden truth says.
 */
export const PREFERENCE_PHRASES: Record<DimensionId, [string[], string[]]> = ONET_PREFERENCE_PHRASES;

export interface OnetLabContext {
  occupations: OnetOccupationSkeleton[];
  usingFallback: boolean;
}

/** Load the O*NET occupation pool for subject generation. Falls back LOUDLY, never silently. */
export function onetLabContext(): OnetLabContext {
  const corpus = loadOnetCorpus();
  if (!corpus) return { occupations: [], usingFallback: true };
  const usable = corpus.occupations.filter((occupation) => occupation.taskStatements.length >= 3 && occupation.workActivities.length > 0);
  return { occupations: usable, usingFallback: false };
}

/** Deterministic stratified occupation sampler over knowledge-work scope. */
export function sampleOccupationsForCohorts(occupations: OnetOccupationSkeleton[], seed: number) {
  const rng = mulberry32(hashSeed(`onet-sample:${seed}`));
  const inScope = occupations.filter((occupation) => isKnowledgeWorkScope(occupation));
  const outOfScope = occupations.filter((occupation) => !isKnowledgeWorkScope(occupation));
  const byStratum = new Map<OnetStratum, OnetOccupationSkeleton[]>();
  for (const occupation of inScope) {
    const stratum = stratumFor(occupation);
    byStratum.set(stratum, [...(byStratum.get(stratum) ?? []), occupation]);
  }
  // Round-robin across strata so every represented work structure appears in every cohort.
  const strataWithMembers = ONET_STRATA.filter((stratum) => (byStratum.get(stratum) ?? []).length > 0);
  const cursors = new Map<OnetStratum, number>();
  const shuffled = new Map<OnetStratum, OnetOccupationSkeleton[]>();
  for (const stratum of strataWithMembers) {
    const members = [...(byStratum.get(stratum) ?? [])];
    for (let i = members.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [members[i], members[j]] = [members[j]!, members[i]!];
    }
    shuffled.set(stratum, members);
    cursors.set(stratum, 0);
  }
  const draw = (): OnetOccupationSkeleton => {
    for (let attempt = 0; attempt < strataWithMembers.length; attempt += 1) {
      const stratum = strataWithMembers[drawIndex % strataWithMembers.length]!;
      drawIndex += 1;
      const members = shuffled.get(stratum)!;
      const cursor = cursors.get(stratum)!;
      cursors.set(stratum, cursor + 1);
      if (members.length) return members[cursor % members.length]!;
    }
    return inScope[Math.floor(rng() * inScope.length)]!;
  };
  let drawIndex = 0;
  const development = Array.from({ length: COHORT_SIZES.development }, draw);
  const validation = Array.from({ length: COHORT_SIZES.validation }, draw);
  const holdout = Array.from({ length: COHORT_SIZES.holdout }, draw);
  // Adversarial/OOD: 60% in-scope (harder observation regimes), 40% out-of-scope occupations.
  const adversarial = Array.from({ length: COHORT_SIZES.adversarial }, (_, index) =>
    index % 5 < 3 || outOfScope.length === 0 ? draw() : outOfScope[Math.floor(rng() * outOfScope.length)]!,
  );
  return { development, validation, holdout, adversarial };
}

export function generateOnetSubjects(seed = ONET_LAB_SEED): VirtualSubject[] {
  const context = onetLabContext();
  if (context.usingFallback) {
    throw new Error(
      "O*NET corpus unavailable: the v2 lab refuses to silently substitute the O*NET-inspired snapshot. " +
        "Run `pnpm onet:fetch && pnpm onet:verify && pnpm onet:build`, or use the legacy v1 lab explicitly.",
    );
  }
  const sampled = sampleOccupationsForCohorts(context.occupations, seed);
  const subjects: VirtualSubject[] = [];
  let index = 0;
  for (const cohort of ["development", "validation", "holdout", "adversarial"] as SubjectCohortV2[]) {
    for (const occupation of sampled[cohort]) {
      subjects.push(generateOnetSubject(seed, index, cohort, occupation));
      index += 1;
    }
  }
  return subjects;
}

export function generateOnetSubject(baseSeed: number, index: number, cohort: SubjectCohortV2, onetOccupation: OnetOccupationSkeleton): VirtualSubject {
  const seed = hashSeed(`${baseSeed}:v2:${index}`);
  const rng = mulberry32(seed);
  const occupation = occupationToLabSkeleton(onetOccupation);
  const independentPreference = randomVector(rng);
  // A controlled minority genuinely likes work resembling their occupation.
  const occupationFitsPreference = chance(rng, cohort === "adversarial" ? 0.2 : 0.35);
  const taskDnaTruth = occupationFitsPreference ? nudgeTowardOccupation(independentPreference, onetOccupation, rng) : independentPreference;
  const accidentalCareer = !occupationFitsPreference && chance(rng, 0.45);
  const careerChanger = chance(rng, cohort === "adversarial" ? 0.4 : 0.18);
  const burnedOut = chance(rng, 0.16);
  const capabilityTruth = pickN(rng, dedupe([...occupation.skills, ...occupation.knowledge, "communication", "writing"]), Math.min(4, occupation.skills.length + 2));
  const truth: VirtualSubjectTruth = {
    subjectId: `v2-subject-${String(index + 1).padStart(3, "0")}`,
    seed,
    cohort: cohort === "development" ? "design" : cohort,
    occupationalSkeleton: occupation,
    careerHistoryTruth: {
      years: Math.round(between(rng, 2, 16)),
      accidentalCareer,
      careerChanger,
      burnedOut,
      occupationFitsPreference,
    },
    taskDnaTruth,
    capabilityTruth,
    capabilityConfidenceTruth: Object.fromEntries(capabilityTruth.map((skill) => [skill, clamp(between(rng, 0.35, 0.92), 0, 1)])),
    attractorsTruth: dimensionsFromVector(taskDnaTruth, true),
    repellentsTruth: dimensionsFromVector(taskDnaTruth, false),
    goalsTruth: occupationFitsPreference ? ["Stay near current task structure"] : ["Move toward preferred task structure"],
    constraintsTruth: chance(rng, 0.4) ? ["remote preferred"] : ["open to hybrid"],
    interpersonalStyleTruth: pick(rng, ["brief", "warm", "formal"] as const),
    networkingComfortTruth: between(rng, 2, 9),
    expectedGeneralProperties: expectedProperties(taskDnaTruth, capabilityTruth, occupationFitsPreference),
    invariantExpectations: ["work_fit_independent_of_network", "preference_not_equal_capability"],
    generationVersion: ONET_LAB_VERSION,
  };
  return { truth, observations: observeOnetSubject(truth, rng, index, cohort) };
}

export interface ObservationRegime {
  sparse?: boolean;
  contradictory?: boolean;
  keywordStuffed?: boolean;
  misleadingTitle?: boolean;
}

function observeOnetSubject(truth: VirtualSubjectTruth, rng: Rng, index: number, cohort: SubjectCohortV2, regime: ObservationRegime = {}): VirtualSubjectObservations {
  const adversarial = cohort === "adversarial";
  const sparse = regime.sparse ?? (adversarial ? chance(rng, 0.45) : chance(rng, 0.12));
  const contradictory = regime.contradictory ?? (adversarial ? chance(rng, 0.55) : chance(rng, 0.18));
  const keywordStuffed = regime.keywordStuffed ?? (adversarial && chance(rng, 0.25));
  const misleadingTitle = regime.misleadingTitle ?? (adversarial || truth.careerHistoryTruth.accidentalCareer);
  const stale = chance(rng, 0.2);
  const occupation = truth.occupationalSkeleton;
  const title = misleadingTitle ? pick(rng, ["Coordinator", "Specialist", "Associate", "Analyst", "Program Lead"]) : shortTitle(occupation.title);
  // EXPOSURE ONLY: verbatim O*NET task statements describe what the person did,
  // never what they enjoyed.
  const exposureTasks = pickN(rng, occupation.tasks, Math.min(sparse ? 1 : 3, occupation.tasks.length)).map(lowerFirst);
  // Every preference statement is planned once with explicit (dimension, behaviour side,
  // stance, meaning) semantics and assigned to exactly ONE observable source, so no
  // statement reaches the inference system through two plumbing paths. Sparse subjects
  // expose no narrative or list preference language at all.
  const sources: PreferenceSourceBudget = {
    resumeNarrative: !sparse,
    explicitPreferenceList: !sparse,
    explicitDislikeList: !sparse,
    contradictoryStatement: contradictory,
  };
  const plan = planPreferenceStatements(truth.taskDnaTruth, rng, {
    catalog: ONET_PREFERENCE_PHRASES,
    sources,
    includeAspiration: !truth.careerHistoryTruth.occupationFitsPreference,
    burnedOut: truth.careerHistoryTruth.burnedOut,
    workContext: occupation.workContext.length ? pick(rng, occupation.workContext) : "the daily grind",
  });
  const achievement = exposureTasks[0]
    ? `Delivered results when I had to ${exposureTasks[0].replace(/\.$/, "")}, using ${pick(rng, truth.capabilityTruth)}.`
    : `Used ${pick(rng, truth.capabilityTruth)} on the team's core workflow.`;
  const hobby = chance(rng, 0.35) ? " Outside work I tinker with side projects that are more interesting than my title suggests." : "";
  const stuffing = keywordStuffed
    ? ` Skills: ${[...occupation.skills, ...occupation.knowledge, ...occupation.generalizedWorkActivities.slice(0, 6)].join(", ")}.`
    : "";
  const vague = sparse ? "I have done some projects and like solving problems but I am not sure what kind." : "";
  const workHistorySentences = exposureTasks.map((task) => `In this role I would ${task.replace(/\.$/, "")}.`);
  const narrative = statementsForSource(plan, "RESUME_NARRATIVE").map((statement) => statement.text);
  const struggleStatements = [...statementsForConstruction(plan, "STRUGGLE"), ...statementsForConstruction(plan, "BURNOUT")];
  const struggle = struggleStatements[0]?.text ?? `Struggled with ${genericPhrase("DISLIKE")} even when the team called it a success.`;
  const resumeText = sparse
    ? `${title}. ${vague} ${workHistorySentences[0] ?? ""} ${hobby}${stuffing}`
    : `${title} working in ${occupation.industry}. ${workHistorySentences.join(" ")} ${achievement} ${narrative.join(" ")}${hobby}${stuffing} ${stale ? "Most of this is from an older role." : ""}`;

  return {
    subjectId: truth.subjectId,
    apparentField: misleadingTitle ? "unknown" : occupation.industry,
    resumeText: resumeText.replace(/\s+/g, " ").trim(),
    workHistory: exposureTasks,
    projects: sparse ? [] : [achievement],
    achievements: sparse ? [] : [achievement],
    failuresOrStruggles: [struggle],
    scenarioResponses: [],
    explicitPreferences: statementsForSource(plan, "EXPLICIT_PREFERENCE_LIST").map((statement) => statement.text),
    explicitDislikes: statementsForSource(plan, "EXPLICIT_DISLIKE_LIST").map((statement) => statement.text),
    incompleteInformation: sparse ? ["career goals unspecified", "skills underspecified"] : [],
    contradictoryStatements: statementsForSource(plan, "CONTRADICTORY_STATEMENT").map((statement) => statement.text),
    statedSkills: sparse ? truth.capabilityTruth.slice(0, 1) : truth.capabilityTruth,
    networkIntake: createSubjectNetwork(truth, rng, index),
    evidenceQualityMetadata: { sparse, contradictory, misleadingTitle, stale },
    preferenceStatementPlan: plan,
  };
}

/**
 * Regenerate one subject's observations with deliberately backwards polarity (a LOW truth
 * expressed as a dislike of LOW-side behaviour). Used only to prove the semantic-consistency
 * audit fails on malformed language; never part of a graded corpus.
 */
export function observeWithInvertedPolarity(subject: VirtualSubject, seed = ONET_LAB_SEED): VirtualSubject {
  const rng = mulberry32(hashSeed(`inverted:${seed}:${subject.truth.subjectId}`));
  const truth = { ...subject.truth, subjectId: `${subject.truth.subjectId}-inverted` };
  const plan = planPreferenceStatements(truth.taskDnaTruth, rng, {
    catalog: ONET_PREFERENCE_PHRASES,
    sources: { resumeNarrative: true, explicitPreferenceList: true, explicitDislikeList: true, contradictoryStatement: false },
    adversarialPolarityInversion: true,
  });
  return {
    truth,
    observations: {
      ...subject.observations,
      subjectId: truth.subjectId,
      resumeText: `${subject.observations.apparentField} role. ${statementsForSource(plan, "RESUME_NARRATIVE").map((s) => s.text).join(" ")}`.trim(),
      explicitPreferences: statementsForSource(plan, "EXPLICIT_PREFERENCE_LIST").map((s) => s.text),
      explicitDislikes: statementsForSource(plan, "EXPLICIT_DISLIKE_LIST").map((s) => s.text),
      contradictoryStatements: [],
      preferenceStatementPlan: plan,
    },
  };
}

export function generateOnetTwins(subjects: VirtualSubject[], seed = ONET_LAB_SEED, perSubjectKinds: TwinPair["kind"][] = [
  "same_experience_different_preference",
  "same_preference_different_experience",
  "same_user_different_network",
  "title_removed",
]): TwinPair[] {
  const context = onetLabContext();
  const pool = context.occupations;
  const development = subjects.filter((subject) => subject.truth.cohort === "design");
  const pairs: TwinPair[] = [];
  for (const subject of development) {
    const rng = mulberry32(hashSeed(`onet-twin:${seed}:${subject.truth.subjectId}`));
    for (const kind of perSubjectKinds) {
      if (kind === "same_experience_different_preference") {
        pairs.push({ id: `${subject.truth.subjectId}-pref`, kind, a: subject, b: retargetPreference(subject, invertLean(subject.truth.taskDnaTruth), rng) });
      } else if (kind === "same_preference_different_experience" && pool.length) {
        pairs.push({ id: `${subject.truth.subjectId}-exp`, kind, a: subject, b: retargetExperience(subject, pool, rng) });
      } else if (kind === "same_user_different_network") {
        pairs.push({ id: `${subject.truth.subjectId}-net`, kind, a: subject, b: retargetNetwork(subject, rng) });
      } else if (kind === "title_removed") {
        pairs.push({ id: `${subject.truth.subjectId}-title`, kind, a: subject, b: stripTitles(subject) });
      }
    }
  }
  return pairs;
}

/**
 * Observation-regime counterfactuals: same hidden truth, different observation quality.
 * Combined with the four twin kinds this yields thousands of counterfactual variants.
 */
export function generateObservationVariants(subject: VirtualSubject, seed = ONET_LAB_SEED): VirtualSubject[] {
  const regimes: { suffix: string; regime: ObservationRegime }[] = [
    { suffix: "sparse", regime: { sparse: true } },
    { suffix: "contra", regime: { contradictory: true } },
    { suffix: "stuffed", regime: { keywordStuffed: true, sparse: false } },
    { suffix: "misleading", regime: { misleadingTitle: true } },
  ];
  return regimes.map(({ suffix, regime }) => {
    const rng = mulberry32(hashSeed(`variant:${seed}:${subject.truth.subjectId}:${suffix}`));
    const truth = { ...subject.truth, subjectId: `${subject.truth.subjectId}-${suffix}` };
    return { truth, observations: observeOnetSubject(truth, rng, 0, "development", regime) };
  });
}

function retargetPreference(subject: VirtualSubject, nextVector: Vector, rng: Rng): VirtualSubject {
  const truth: VirtualSubjectTruth = {
    ...subject.truth,
    subjectId: `${subject.truth.subjectId}-pref`,
    taskDnaTruth: nextVector,
    attractorsTruth: dimensionsFromVector(nextVector, true),
    repellentsTruth: dimensionsFromVector(nextVector, false),
    careerHistoryTruth: { ...subject.truth.careerHistoryTruth, occupationFitsPreference: false },
  };
  const cohort: SubjectCohortV2 = "development";
  return { truth, observations: { ...observeOnetSubject(truth, rng, 0, cohort), statedSkills: subject.observations.statedSkills, networkIntake: subject.observations.networkIntake } };
}

function retargetExperience(subject: VirtualSubject, pool: OnetOccupationSkeleton[], rng: Rng): VirtualSubject {
  const currentStratum = subject.truth.occupationalSkeleton.family;
  const candidates = pool.filter((occupation) => stratumFor(occupation) !== currentStratum && isKnowledgeWorkScope(occupation) && occupation.taskStatements.length >= 3);
  const other = candidates.length ? candidates[Math.floor(rng() * candidates.length)]! : pool[0]!;
  const skeleton = occupationToLabSkeleton(other);
  const truth: VirtualSubjectTruth = {
    ...subject.truth,
    subjectId: `${subject.truth.subjectId}-exp`,
    occupationalSkeleton: skeleton,
    capabilityTruth: pickN(rng, dedupe([...skeleton.skills, "communication"]), Math.min(4, skeleton.skills.length + 1)),
  };
  return { truth, observations: observeOnetSubject(truth, rng, 1, "development") };
}

function retargetNetwork(subject: VirtualSubject, rng: Rng): VirtualSubject {
  const truth = { ...subject.truth, subjectId: `${subject.truth.subjectId}-net` };
  return { truth, observations: { ...subject.observations, subjectId: truth.subjectId, networkIntake: createSubjectNetwork(truth, rng, 99) } };
}

function stripTitles(subject: VirtualSubject): VirtualSubject {
  const titleWords = subject.truth.occupationalSkeleton.title.split(/[\s,]+/).filter((word) => word.length > 3);
  let resumeText = subject.observations.resumeText;
  for (const word of titleWords) {
    resumeText = resumeText.replaceAll(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), "role");
  }
  resumeText = resumeText.replace(/\b(engineer|analyst|manager|nurse|teacher|lawyer|developer|designer|coordinator|specialist|technician|scientist|consultant|administrator|director)s?\b/gi, "role");
  return {
    truth: { ...subject.truth, subjectId: `${subject.truth.subjectId}-title` },
    observations: { ...subject.observations, subjectId: `${subject.truth.subjectId}-title`, apparentField: "unknown", resumeText },
  };
}

function createSubjectNetwork(truth: VirtualSubjectTruth, rng: Rng, index: number) {
  const people: Person[] = [];
  const relationships: Relationship[] = [];
  const interactions: InteractionEvent[] = [];
  const types: Relationship["relationshipType"][] = ["FORMER_MANAGER", "FORMER_COWORKER", "ALUM", "RECRUITER", "DORMANT_FORMER_STRONG_TIE", "INDUSTRY_CONTACT"];
  types.forEach((relationshipType, relIndex) => {
    const personId = `${truth.subjectId}-contact-${relIndex + 1}`;
    people.push({
      id: personId,
      name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      title: relationshipType === "RECRUITER" ? "Recruiter" : `${truth.occupationalSkeleton.title} contact`,
      organizationId: `org-${((index + relIndex) % 8) + 1}`,
      location: pick(rng, ["Remote - US", "Chicago, IL", "Austin, TX", "Denver, CO"]),
      currentRoleSummary: `Synthetic ${relationshipType.toLowerCase()} in ${truth.occupationalSkeleton.industry}.`,
      functionalAreas: [pick(rng, ["investigative-analysis", "financial-analysis-audit", "consultative-selling", "operations-coordination", "product-discovery"])],
      seniority: relationshipType === "RECRUITER" ? "Recruiter" : relIndex === 0 ? "Manager" : "IC",
      synthetic: true,
    });
    const relationshipId = `rel-${personId}`;
    relationships.push({
      id: relationshipId,
      userId: `user-${truth.subjectId}`,
      personId,
      personaId: truth.subjectId,
      relationshipType,
      howMet: relationshipType === "ALUM" ? "alumni event" : "shared work",
      relationshipContext: `${relationshipType} in ${truth.occupationalSkeleton.industry}`,
      sharedWork: relationshipType.includes("MANAGER") || relationshipType.includes("COWORKER") ? ["Observed actual work"] : [],
      whatTheyKnowAboutUser: relationshipType === "ALUM" ? ["Knows field only"] : ["Knows some delivered work"],
      memorableContext: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? "Strong past collaboration, long silence." : "Real shared context.",
      lastMeaningfulContactDays: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? 800 : 40 + relIndex * 30,
      contactFrequency: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? "rare" : "yearly",
      responsePattern: relIndex === 3 ? "no_response_recently" : "reliable",
      warmthObserved: relationshipType === "FORMER_MANAGER" ? 8.6 : 4 + relIndex,
      trustObserved: relationshipType === "FORMER_MANAGER" ? 8.8 : 3.5 + relIndex,
      familiarity: relationshipType.includes("COWORKER") || relationshipType.includes("MANAGER") ? 8 : 3,
      reciprocity: 4 + relIndex,
      responsiveness: 6,
      engagement: 5,
      currentMomentum: 4,
      askFatigue: relIndex === 2 ? 6 : 1,
      dormancy: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? 8.4 : 2,
      userComfortAdvice: truth.networkingComfortTruth,
      userComfortIntro: Math.max(1, truth.networkingComfortTruth - 2),
      userComfortReferral: Math.max(1, truth.networkingComfortTruth - 3),
      communicationStyle: truth.interpersonalStyleTruth === "warm" ? "WARM_CONVERSATIONAL" : truth.interpersonalStyleTruth === "brief" ? "BRIEF_DIRECT" : "PROFESSIONAL_CONCISE",
      preferredChannel: "EMAIL",
      userRead: "Synthetic lab relationship.",
      explicitBoundaries: relIndex === 4 ? ["Does not do referrals"] : [],
    });
    if (relIndex === 1) {
      interactions.push({
        id: `evt-${personId}-offer`,
        relationshipId,
        timestamp: "2026-08-10T00:00:00.000Z",
        channel: "EMAIL",
        direction: "INBOUND",
        eventType: "RESUME_REQUESTED",
        structuredSummary: "Asked for the resume or a one-pager.",
        explicitOffer: "SEND_REQUESTED_MATERIAL",
        inferredStateChanges: ["explicit-offer"],
        userConfirmed: true,
        synthetic: true,
      });
    }
    if (relIndex === 4) {
      interactions.push({
        id: `evt-${personId}-boundary`,
        relationshipId,
        timestamp: "2026-07-01T00:00:00.000Z",
        channel: "EMAIL",
        direction: "INBOUND",
        eventType: "BOUNDARY_EXPRESSED",
        structuredSummary: "Will not make referrals.",
        explicitBoundary: "REFERRAL_REQUEST",
        inferredStateChanges: ["boundary"],
        userConfirmed: true,
        synthetic: true,
      });
    }
  });
  return { people, relationships, interactions };
}

// ---- helpers ----

function randomVector(rng: Rng): Vector {
  return vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, clamp(between(rng, 1.5, 8.8), 0, 10)])));
}

function invertLean(input: Vector): Vector {
  return vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, clamp(10 - input[id], 0, 10)])));
}

/**
 * Nudge a minority of preference vectors toward the shape of the occupation's work,
 * using O*NET work-activity structure as a weak exposure prior. This models
 * "some people genuinely like their jobs" without asserting occupation => preference.
 */
function nudgeTowardOccupation(input: Vector, occupation: OnetOccupationSkeleton, rng: Rng): Vector {
  const text = [
    ...occupation.workActivities.slice(0, 10).map((activity) => activity.name),
    ...occupation.taskStatements.slice(0, 6).map((task) => task.statement),
  ].join(" ").toLowerCase();
  const next = { ...input };
  const nudge = (id: DimensionId, target: number) => {
    next[id] = clamp(input[id] * 0.4 + target * 0.6, 0, 10);
  };
  if (/analyz|inspect|diagnos|investigat|examin|troubleshoot/.test(text)) {
    nudge("investigation_orientation", between(rng, 7, 9.2));
    nudge("causal_reasoning", between(rng, 6.8, 9));
  }
  if (/coordinat|supervis|direct|schedul|organiz|liaison/.test(text)) nudge("coordination_preference", between(rng, 7, 9));
  if (/customer|client|patient|student|public/.test(text)) nudge("customer_interaction_preference", between(rng, 6.5, 9));
  if (/record|document|report|file|maintain records|log/.test(text)) nudge("repetition_tolerance", between(rng, 6, 8.6));
  if (/equipment|machin|physical|repair|install|operate/.test(text)) nudge("real_system_grounding", between(rng, 6.8, 9.2));
  if (/computer|software|program|data process/.test(text)) nudge("software_as_tool", between(rng, 6.5, 9));
  if (/research|study|experiment|test/.test(text)) nudge("experimentation_preference", between(rng, 6.2, 8.8));
  return vector(next);
}

function dimensionsFromVector(values: Vector, high: boolean) {
  return DIMENSION_IDS.filter((id) => (high ? values[id] >= 7.2 : values[id] <= 3.2)).slice(0, 4);
}

function expectedProperties(values: Vector, capabilities: string[], occupationFits: boolean) {
  const properties = ["preference_capability_independence"];
  if (values.investigation_orientation >= 8 && values.coordination_preference <= 3.5) properties.push("investigative_outranks_coordination");
  if (values.repetition_tolerance <= 3.2) properties.push("documentation_has_friction");
  if (!occupationFits) properties.push("occupation_does_not_define_preference");
  if (capabilities.length) properties.push("hireability_tracks_demonstrated_skills");
  return properties;
}

function shortTitle(title: string) {
  const first = title.split(",")[0]!.trim();
  return first.replace(/s$/, "");
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
