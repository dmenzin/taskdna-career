import { DIMENSION_IDS, vector } from "@/config/model";
import type { InteractionEvent, Person, Relationship } from "@/domain/networkTypes";
import type { Vector } from "@/domain/types";
import { occupationSkeletons } from "@/lab/occupations";
import { genericPhrase, LEGACY_PREFERENCE_PHRASES, planPreferenceStatements, statementsForConstruction, statementsForSource } from "@/lab/preferencePhrases";
import { between, chance, hashSeed, mulberry32, pick, pickN, type Rng } from "@/lab/rng";
import type { SubjectCohort, TwinPair, VirtualSubject, VirtualSubjectObservations, VirtualSubjectTruth } from "@/lab/types";

export const LAB_VERSION = "subject-lab.v1";
export const DEFAULT_SUBJECT_SEED = 20260822;
export const SUBJECT_COUNT = 200;

const FIRST = ["Amina", "Blake", "Cara", "Dev", "Ellis", "Farah", "Gabe", "Hana", "Ivan", "Jules", "Keiko", "Luis", "Maya", "Nico", "Orla", "Pavel"];
const LAST = ["Okoye", "Diaz", "Shah", "Berg", "Wahl", "Costa", "Ng", "Ali", "Novak", "Park", "Silva", "Hughes", "Khan", "Frost", "Abebe", "Quinn"];

export function generateVirtualSubjects(seed = DEFAULT_SUBJECT_SEED, count = SUBJECT_COUNT): VirtualSubject[] {
  return Array.from({ length: count }, (_, index) => generateOneSubject(seed, index));
}

export function generateOneSubject(baseSeed: number, index: number): VirtualSubject {
  const seed = hashSeed(`${baseSeed}:${index}`);
  const rng = mulberry32(seed);
  const cohort = cohortFor(index);
  const occupation = occupationSkeletons[index % occupationSkeletons.length]!;
  const independentPreference = randomVector(rng);
  const occupationFitsPreference = chance(rng, cohort === "adversarial" ? 0.2 : 0.35);
  const taskDnaTruth = occupationFitsPreference ? nudgeTowardOccupation(independentPreference, rng) : independentPreference;
  const accidentalCareer = !occupationFitsPreference && chance(rng, 0.45);
  const careerChanger = chance(rng, cohort === "adversarial" ? 0.4 : 0.18);
  const burnedOut = chance(rng, 0.16);
  const capabilityTruth = pickN(rng, [...occupation.skills, ...occupation.knowledge, "communication", "excel", "python", "writing"], 4);
  const capabilityConfidenceTruth = Object.fromEntries(capabilityTruth.map((skill) => [skill, clamp(between(rng, 0.35, 0.92), 0, 1)]));
  const attractors = dimensionsFromVector(taskDnaTruth, true);
  const repellents = dimensionsFromVector(taskDnaTruth, false);
  const expected = expectedProperties(taskDnaTruth, capabilityTruth, occupationFitsPreference);
  const truth: VirtualSubjectTruth = {
    subjectId: `subject-${String(index + 1).padStart(3, "0")}`,
    seed,
    cohort,
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
    capabilityConfidenceTruth,
    attractorsTruth: attractors,
    repellentsTruth: repellents,
    goalsTruth: occupationFitsPreference ? ["Stay near current task structure"] : ["Move toward preferred task structure"],
    constraintsTruth: chance(rng, 0.4) ? ["remote preferred"] : ["open to hybrid"],
    interpersonalStyleTruth: pick(rng, ["brief", "warm", "formal"] as const),
    networkingComfortTruth: between(rng, 2, 9),
    expectedGeneralProperties: expected,
    invariantExpectations: ["work_fit_independent_of_network", "preference_not_equal_capability"],
    generationVersion: LAB_VERSION,
  };
  return { truth, observations: observe(truth, rng, index) };
}

export function generateTwins(subjects: VirtualSubject[], seed = DEFAULT_SUBJECT_SEED): TwinPair[] {
  const design = subjects.filter((subject) => subject.truth.cohort === "design");
  const pairs: TwinPair[] = [];
  for (const subject of design.slice(0, 16)) {
    const rng = mulberry32(hashSeed(`twin:${seed}:${subject.truth.subjectId}`));
    pairs.push({
      id: `${subject.truth.subjectId}-pref`,
      kind: "same_experience_different_preference",
      a: subject,
      b: retargetPreference(subject, invertLean(subject.truth.taskDnaTruth), rng),
    });
    pairs.push({
      id: `${subject.truth.subjectId}-exp`,
      kind: "same_preference_different_experience",
      a: subject,
      b: retargetExperience(subject, rng),
    });
    pairs.push({
      id: `${subject.truth.subjectId}-net`,
      kind: "same_user_different_network",
      a: subject,
      b: retargetNetwork(subject, rng),
    });
    pairs.push({
      id: `${subject.truth.subjectId}-title`,
      kind: "title_removed",
      a: subject,
      b: stripTitles(subject),
    });
  }
  return pairs;
}

function observe(truth: VirtualSubjectTruth, rng: Rng, index: number): VirtualSubjectObservations {
  const sparse = truth.cohort === "adversarial" ? chance(rng, 0.45) : chance(rng, 0.12);
  const contradictory = truth.cohort === "adversarial" ? chance(rng, 0.55) : chance(rng, 0.18);
  const misleadingTitle = truth.cohort === "adversarial" || truth.careerHistoryTruth.accidentalCareer;
  const stale = chance(rng, 0.2);
  const title = misleadingTitle ? pick(rng, ["Coordinator", "Specialist", "Associate", "Analyst", "Program Lead"]) : truth.occupationalSkeleton.title.replace(/s$/, "");
  const occupationTasks = pickN(rng, truth.occupationalSkeleton.tasks, sparse ? 1 : 2);
  // Same semantic-polarity and single-source rules as the v2 O*NET lab: see
  // src/lab/preferencePhrases.ts and src/lab/preferenceSemantics.ts.
  const plan = planPreferenceStatements(truth.taskDnaTruth, rng, {
    catalog: LEGACY_PREFERENCE_PHRASES,
    sources: {
      resumeNarrative: !sparse,
      explicitPreferenceList: !sparse,
      explicitDislikeList: !sparse,
      contradictoryStatement: contradictory,
    },
    burnedOut: truth.careerHistoryTruth.burnedOut,
    workContext: truth.occupationalSkeleton.workContext.length ? pick(rng, truth.occupationalSkeleton.workContext) : "the daily grind",
  });
  const struggleStatements = [...statementsForConstruction(plan, "STRUGGLE"), ...statementsForConstruction(plan, "BURNOUT")];
  const struggle = struggleStatements[0]?.text ?? `Struggled with ${genericPhrase("DISLIKE")} even when the team called it a success.`;
  const achievement = `Improved a messy workflow around ${pick(rng, occupationTasks).toLowerCase()} using ${pick(rng, truth.capabilityTruth)}.`;
  const hobby = chance(rng, 0.35) ? " Outside work I tinker with side projects that are more interesting than my title suggests." : "";
  const vague = sparse ? "I have done some projects and like solving problems but I am not sure what kind." : "";
  const narrative = statementsForSource(plan, "RESUME_NARRATIVE").map((statement) => statement.text);
  const resumeText = sparse
    ? `${title}. ${vague} ${occupationTasks[0] ?? ""} ${hobby}`
    : `${title} working in ${truth.occupationalSkeleton.industry}. ${occupationTasks.join(". ")}. ${achievement} ${narrative.join(" ")}${hobby} ${stale ? "Most of this is from an older role." : ""}`;

  return {
    subjectId: truth.subjectId,
    apparentField: misleadingTitle ? "unknown" : truth.occupationalSkeleton.industry,
    resumeText: resumeText.replace(/\s+/g, " ").trim(),
    workHistory: occupationTasks,
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
      organizationId: `org-${(index + relIndex) % 8 + 1}`,
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

function retargetPreference(subject: VirtualSubject, nextVector: Vector, rng: Rng): VirtualSubject {
  const truth: VirtualSubjectTruth = {
    ...subject.truth,
    subjectId: `${subject.truth.subjectId}-pref`,
    taskDnaTruth: nextVector,
    attractorsTruth: dimensionsFromVector(nextVector, true),
    repellentsTruth: dimensionsFromVector(nextVector, false),
    careerHistoryTruth: { ...subject.truth.careerHistoryTruth, occupationFitsPreference: false },
  };
  return { truth, observations: { ...observe(truth, rng, 0), statedSkills: subject.observations.statedSkills, networkIntake: subject.observations.networkIntake } };
}

function retargetExperience(subject: VirtualSubject, rng: Rng): VirtualSubject {
  const other = pick(rng, occupationSkeletons.filter((occupation) => occupation.family !== subject.truth.occupationalSkeleton.family));
  const truth: VirtualSubjectTruth = {
    ...subject.truth,
    subjectId: `${subject.truth.subjectId}-exp`,
    occupationalSkeleton: other,
    capabilityTruth: pickN(rng, other.skills, 4),
  };
  return { truth, observations: observe(truth, rng, 1) };
}

function retargetNetwork(subject: VirtualSubject, rng: Rng): VirtualSubject {
  const truth = { ...subject.truth, subjectId: `${subject.truth.subjectId}-net` };
  return { truth, observations: { ...subject.observations, subjectId: truth.subjectId, networkIntake: createSubjectNetwork(truth, rng, 99) } };
}

function stripTitles(subject: VirtualSubject): VirtualSubject {
  const resumeText = subject.observations.resumeText
    .replace(subject.truth.occupationalSkeleton.title, "this role")
    .replace(/\b(engineer|analyst|manager|nurse|teacher|lawyer|developer|designer|coordinator|specialist)\b/gi, "role");
  return {
    truth: { ...subject.truth, subjectId: `${subject.truth.subjectId}-title` },
    observations: { ...subject.observations, subjectId: `${subject.truth.subjectId}-title`, apparentField: "unknown", resumeText },
  };
}

function cohortFor(index: number): SubjectCohort {
  if (index < 80) return "design";
  if (index < 120) return "validation";
  if (index < 160) return "holdout";
  return "adversarial";
}

function randomVector(rng: Rng): Vector {
  return vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, clamp(between(rng, 1.5, 8.8), 0, 10)])));
}

function invertLean(input: Vector): Vector {
  return vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, clamp(10 - input[id], 0, 10)])));
}

function nudgeTowardOccupation(input: Vector, rng: Rng): Vector {
  const investigative = chance(rng, 0.5);
  return vector({
    ...input,
    investigation_orientation: investigative ? 8.6 : input.investigation_orientation,
    evidence_density: investigative ? 8.2 : input.evidence_density,
    coordination_preference: investigative ? 3.2 : 8.4,
  });
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
