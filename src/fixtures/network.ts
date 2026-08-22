import { careerFunctions } from "@/config/model";
import { networkingPrinciples } from "@/config/network";
import { personas } from "@/fixtures/personas";
import type { HumanOpportunityGraph, InteractionEvent, Organization, Person, Relationship, Team } from "@/domain/networkTypes";
import type { ScoredJob } from "@/domain/types";

const firstNames = ["Mira", "Jon", "Priya", "Theo", "Nadia", "Sam", "Elena", "Marco", "Asha", "Noah", "Iris", "Victor", "Leah", "Owen", "Talia", "Ben"];
const lastNames = ["Chen", "Patel", "Rivera", "Morgan", "Singh", "Klein", "Sato", "Nguyen", "Brooks", "Ibrahim", "Carter", "Rossi", "Okafor", "Kim", "Hayes", "Bennett"];
const orgNames = ["Northstar Instruments", "Helio Robotics", "Aster Medical", "SignalForge", "Kinetic Labs", "VectorWell", "OrbitWorks", "Reliant Devices", "Mesa Automation", "Cobalt Analytics", "Civic BioSystems", "Lattice Mobility"];
const relationshipTypes: Relationship["relationshipType"][] = ["FORMER_MANAGER", "FORMER_COWORKER", "PROFESSOR", "MENTOR", "ALUM", "INDUSTRY_CONTACT", "RECRUITER", "DORMANT_FORMER_STRONG_TIE", "SECOND_DEGREE", "BRIEF_ACQUAINTANCE", "COLD_CONTEXTUAL_CONTACT", "FORMER_COWORKER", "ALUM", "INDUSTRY_CONTACT", "RECRUITER", "MENTOR"];

export interface SyntheticNetworkUniverse {
  organizations: Organization[];
  teams: Team[];
  people: Person[];
  relationships: Relationship[];
  interactions: InteractionEvent[];
}

export function createSyntheticNetworkUniverse(): SyntheticNetworkUniverse {
  const organizations = orgNames.map((name, index): Organization => ({
    id: `org-${index + 1}`,
    name,
    domain: ["medical devices", "robotics", "software", "analytics", "scientific instrumentation", "automation"][index % 6],
    synthetic: true,
  }));

  const teams = organizations.flatMap((org, index): Team[] => [
    { id: `team-${org.id}-performance`, organizationId: org.id, name: "Performance and Reliability", functionIds: ["failure-analysis", "sensor-algorithm-performance", "test-development"], synthetic: true },
    { id: `team-${org.id}-systems`, organizationId: org.id, name: "Systems Integration", functionIds: ["systems-integration-debug", "robotics-field-performance", "controls-characterization"], synthetic: true },
    { id: `team-${org.id}-tools`, organizationId: org.id, name: index % 2 === 0 ? "Engineering Tools" : "Product Systems", functionIds: index % 2 === 0 ? ["engineering-tools", "scientific-software"] : ["product-systems-engineering", "verification-validation"], synthetic: true },
  ]);

  const coveredPersonas = personas.slice(0, 10);
  const people: Person[] = [];
  const relationships: Relationship[] = [];
  const interactions: InteractionEvent[] = [];

  coveredPersonas.forEach((persona, personaIndex) => {
    relationshipTypes.forEach((relationshipType, relIndex) => {
      const org = organizations[(personaIndex + relIndex) % organizations.length];
      const fn = careerFunctions[(personaIndex * 3 + relIndex) % careerFunctions.length];
      const id = `${persona.id}-contact-${String(relIndex + 1).padStart(2, "0")}`;
      const person: Person = {
        id,
        name: `${firstNames[(personaIndex + relIndex) % firstNames.length]} ${lastNames[(personaIndex * 2 + relIndex) % lastNames.length]}`,
        title: relationshipType === "RECRUITER" ? "Technical Recruiter" : relationshipType === "PROFESSOR" ? "Professor of Engineering" : `${fn.shortName} Lead`,
        organizationId: org.id,
        location: ["Boston, MA", "San Diego, CA", "Remote - US", "Pittsburgh, PA"][relIndex % 4],
        currentRoleSummary: `Synthetic ${fn.shortName.toLowerCase()} contact at ${org.name}.`,
        functionalAreas: [fn.id, careerFunctions[(relIndex + 2) % careerFunctions.length].id],
        seniority: relationshipType === "RECRUITER" ? "Recruiter" : relationshipType === "PROFESSOR" ? "Professor" : relIndex % 5 === 0 ? "Manager" : relIndex % 3 === 0 ? "Lead" : "IC",
        synthetic: true,
      };
      people.push(person);

      const explicitBoundary = relIndex % 13 === 6 ? ["Does not do referrals for people they have not directly managed"] : [];
      const relationship: Relationship = {
        id: `rel-${id}`,
        userId: `user-${persona.id}`,
        personId: person.id,
        personaId: persona.id,
        relationshipType,
        howMet: relationshipType === "ALUM" ? "same alumni network" : relationshipType === "PROFESSOR" ? "course and research project" : relationshipType === "RECRUITER" ? "prior recruiting screen" : "shared professional work",
        relationshipContext: `${relationshipType.replaceAll("_", " ").toLowerCase()} connected to ${fn.name}.`,
        sharedWork: relationshipType.includes("MANAGER") || relationshipType.includes("COWORKER") ? [`Observed ${persona.name} on evidence-heavy technical work`] : [],
        whatTheyKnowAboutUser: relationshipType === "ALUM" || relationshipType === "COLD_CONTEXTUAL_CONTACT" ? ["Knows field interest only"] : [`Knows ${persona.capabilityKeywords.slice(0, 3).join(", ")}`],
        memorableContext: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? "Worked intensely together years ago and ended on good terms." : "Has a concrete professional context, not a fake pretext.",
        lastMeaningfulContactDays: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? 900 : relIndex * 22 + personaIndex * 3,
        contactFrequency: relationshipType === "FORMER_MANAGER" ? "quarterly" : relationshipType === "DORMANT_FORMER_STRONG_TIE" ? "rare" : relIndex % 3 === 0 ? "monthly" : "yearly",
        responsePattern: relIndex % 11 === 0 ? "no_response_recently" : relIndex % 5 === 0 ? "slow" : "reliable",
        warmthObserved: clamp(relationshipType === "FORMER_MANAGER" ? 8.8 : relationshipType === "COLD_CONTEXTUAL_CONTACT" ? 2.2 : 4.8 + (relIndex % 5), 0, 10),
        trustObserved: clamp(relationshipType === "FORMER_MANAGER" ? 9 : relationshipType === "ALUM" ? 3 : 4.2 + (relIndex % 5), 0, 10),
        familiarity: clamp(relationshipType.includes("COWORKER") || relationshipType.includes("MANAGER") ? 8 : relationshipType === "COLD_CONTEXTUAL_CONTACT" ? 1.5 : 3.5 + (relIndex % 4), 0, 10),
        reciprocity: clamp(relationshipType === "MENTOR" ? 7 : 3 + (relIndex % 5), 0, 10),
        responsiveness: relIndex % 11 === 0 ? 2 : 5 + (relIndex % 4),
        engagement: relIndex % 11 === 0 ? 2 : 4.5 + (relIndex % 5),
        currentMomentum: relIndex % 7 === 0 ? 7 : 3.5,
        askFatigue: relIndex % 9 === 0 ? 6 : 1 + (relIndex % 3),
        dormancy: relationshipType === "DORMANT_FORMER_STRONG_TIE" ? 8.5 : Math.min(7, relIndex * 0.35),
        userComfortAdvice: 4 + (relIndex % 6),
        userComfortIntro: 3 + (relIndex % 5),
        userComfortReferral: relationshipType === "FORMER_MANAGER" ? 7 : relationshipType === "ALUM" ? 2 : 3 + (relIndex % 4),
        communicationStyle: relIndex % 3 === 0 ? "BRIEF_DIRECT" : relIndex % 3 === 1 ? "WARM_CONVERSATIONAL" : "PROFESSIONAL_CONCISE",
        preferredChannel: relationshipType === "ALUM" || relationshipType === "COLD_CONTEXTUAL_CONTACT" ? "LINKEDIN_MANUAL" : "EMAIL",
        userRead: explicitBoundary.length ? explicitBoundary[0] : "Synthetic user read: professionally appropriate with context.",
        explicitBoundaries: explicitBoundary,
      };
      relationships.push(relationship);

      if (relIndex % 3 === 0) {
        interactions.push(makeInteraction(relationship, "MESSAGE_RECEIVED", "Recent useful reply with role context.", undefined, undefined));
      }
      if (relIndex % 8 === 4) {
        interactions.push(makeInteraction(relationship, "REFERRAL_OFFERED", "Send me the job and your resume; happy to refer you.", "SEND_REQUESTED_MATERIAL", undefined));
      }
      if (explicitBoundary.length) {
        interactions.push(makeInteraction(relationship, "BOUNDARY_EXPRESSED", explicitBoundary[0], undefined, "REFERRAL_REQUEST"));
      }
      if (relIndex % 10 === 2) {
        interactions.push(makeInteraction(relationship, "INTRO_OFFERED", "I can introduce you to someone on that team if useful.", "INTRODUCTION_REQUEST", undefined));
      }
      if (relIndex % 11 === 0) {
        interactions.push(makeInteraction(relationship, "NO_RESPONSE", "No response to a prior low-burden note.", undefined, undefined));
      }
    });
  });

  return { organizations, teams, people, relationships, interactions };
}

export function createGoldenTechnicalInvestigatorNetwork(): SyntheticNetworkUniverse {
  const universe = createSyntheticNetworkUniverse();
  return {
    ...universe,
    people: universe.people.filter((person) => person.id.startsWith("failure-analyst-contact")),
    relationships: universe.relationships.filter((relationship) => relationship.personaId === "failure-analyst"),
    interactions: universe.interactions.filter((interaction) => interaction.relationshipId.includes("failure-analyst-contact")),
  };
}

export function createEmptyGraph(personaId: string, scoredJobs: ScoredJob[]): HumanOpportunityGraph {
  const universe = createSyntheticNetworkUniverse();
  return {
    personaId,
    ...universe,
    principles: networkingPrinciples,
    contactAssessments: [],
    paths: [],
    accessAssessments: [],
    pursuitPlans: [],
    nextBestActions: [],
    topFunctionCoverage: {},
    networkGaps: [],
    scoredJobs,
  };
}

function makeInteraction(relationship: Relationship, eventType: InteractionEvent["eventType"], structuredSummary: string, explicitOffer?: InteractionEvent["explicitOffer"], explicitBoundary?: InteractionEvent["explicitBoundary"]): InteractionEvent {
  return {
    id: `int-${relationship.id}-${eventType.toLowerCase()}`,
    relationshipId: relationship.id,
    timestamp: "2026-08-15T12:00:00.000Z",
    channel: relationship.preferredChannel,
    direction: eventType === "MESSAGE_RECEIVED" || eventType === "REFERRAL_OFFERED" || eventType === "INTRO_OFFERED" ? "INBOUND" : "SYSTEM",
    eventType,
    rawText: structuredSummary,
    structuredSummary,
    warmthSignal: eventType === "NO_RESPONSE" ? -1 : explicitOffer ? 2 : 1,
    engagementSignal: eventType === "NO_RESPONSE" ? -2 : 1,
    explicitOffer,
    explicitBoundary,
    inferredStateChanges: explicitOffer ? [`${explicitOffer} readiness increased`] : explicitBoundary ? [`${explicitBoundary} boundary recorded`] : [],
    userConfirmed: true,
    synthetic: true,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
