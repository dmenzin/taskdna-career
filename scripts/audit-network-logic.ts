import { mkdirSync, writeFileSync } from "node:fs";
import { askIsEligible } from "../src/domain/networkEngine";
import type { ContactOpportunityAssessment, InteractionEvent, Relationship } from "../src/domain/networkTypes";
import type { ScoredJob } from "../src/domain/types";

function rel(partial: Partial<Relationship> = {}): Relationship {
  return {
    id: "rel",
    userId: "u",
    personId: "p",
    personaId: "u",
    relationshipType: "INDUSTRY_CONTACT",
    howMet: "work",
    relationshipContext: "x",
    sharedWork: [],
    whatTheyKnowAboutUser: ["Knows field only"],
    memorableContext: "",
    lastMeaningfulContactDays: 40,
    contactFrequency: "yearly",
    responsePattern: "reliable",
    warmthObserved: 5,
    trustObserved: 5,
    familiarity: 4,
    reciprocity: 4,
    responsiveness: 5,
    engagement: 5,
    currentMomentum: 4,
    askFatigue: 1,
    dormancy: 2,
    userComfortAdvice: 5,
    userComfortIntro: 4,
    userComfortReferral: 3,
    communicationStyle: "PROFESSIONAL_CONCISE",
    preferredChannel: "EMAIL",
    userRead: "x",
    explicitBoundaries: [],
    ...partial,
  };
}

function ass(partial: Partial<ContactOpportunityAssessment> = {}): ContactOpportunityAssessment {
  return {
    personId: "p",
    opportunityId: "j",
    relationshipStrength: 5,
    engagement: 5,
    networkNovelty: 5,
    functionalRelevance: 5,
    companyRelevance: 5,
    teamProximity: 5,
    informationValue: 5,
    routingValue: 5,
    credibilityValue: 5,
    referralAbility: 5,
    advocacyPotential: 5,
    secondDegreeReach: 5,
    askReadiness: { REFERRAL_REQUEST: 5 } as ContactOpportunityAssessment["askReadiness"],
    socialCost: 3,
    confidence: 0.5,
    evidenceIds: [],
    explanation: "x",
    version: "x",
    ...partial,
  };
}

const job = (overall: number) => ({ score: { overall } }) as ScoredJob;

const cases = [
  { id: "high-warmth-low-credibility", pass: !askIsEligible("REFERRAL_REQUEST", rel({ warmthObserved: 9, sharedWork: [] }), ass({ credibilityValue: 2, referralAbility: 8 }), [], job(8)) },
  { id: "low-warmth-high-credibility", pass: askIsEligible("REFERRAL_REQUEST", rel({ warmthObserved: 3, relationshipType: "FORMER_MANAGER", sharedWork: ["work"] }), ass({ credibilityValue: 8, referralAbility: 8 }), [], job(8)) },
  { id: "high-routing-no-credibility", pass: !askIsEligible("REFERRAL_REQUEST", rel({ sharedWork: [] }), ass({ routingValue: 9, credibilityValue: 2, referralAbility: 8 }), [], job(8)) },
  { id: "former-manager-outside-company", pass: askIsEligible("REFERENCE_REQUEST", rel({ relationshipType: "FORMER_MANAGER", sharedWork: ["work"] }), ass({ credibilityValue: 8 }), [], job(7)) },
  { id: "explicit-referral-refusal", pass: !askIsEligible("REFERRAL_REQUEST", rel({ sharedWork: ["work"] }), ass({ credibilityValue: 8, referralAbility: 8 }), [{ relationshipId: "rel", eventType: "BOUNDARY_EXPRESSED", explicitBoundary: "REFERRAL_REQUEST" } as InteractionEvent], job(8)) },
  { id: "repeated-submission", pass: !askIsEligible("REFERRAL_REQUEST", rel({ sharedWork: ["work"] }), ass({ credibilityValue: 8, referralAbility: 8 }), [{ relationshipId: "rel", eventType: "REFERRAL_SUBMITTED" } as InteractionEvent], job(8)) },
  { id: "do-not-contact", pass: !askIsEligible("CAREER_PERSPECTIVE", rel(), ass(), [{ relationshipId: "rel", eventType: "DO_NOT_CONTACT" } as InteractionEvent], job(8)) },
  { id: "weak-job-still-eligible-if-credible", pass: askIsEligible("REFERRAL_REQUEST", rel({ relationshipType: "FORMER_MANAGER", sharedWork: ["work"] }), ass({ credibilityValue: 9, referralAbility: 9 }), [], job(5)) },
];

const summary = { generatedAt: new Date().toISOString(), passed: cases.every((item) => item.pass), cases };
mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync("artifacts/logic_audit/network_logic.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exit(1);
