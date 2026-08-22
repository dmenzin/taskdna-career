import { describe, expect, it } from "vitest";
import { askIsEligible } from "../src/domain/networkEngine";
import type { ContactOpportunityAssessment, InteractionEvent, Relationship } from "../src/domain/networkTypes";
import type { ScoredJob } from "../src/domain/types";

function relationship(partial: Partial<Relationship>): Relationship {
  return {
    id: "rel-1",
    userId: "user",
    personId: "p1",
    personaId: "user",
    relationshipType: "ALUM",
    howMet: "alumni",
    relationshipContext: "test",
    sharedWork: [],
    whatTheyKnowAboutUser: ["Knows field only"],
    memorableContext: "",
    lastMeaningfulContactDays: 100,
    contactFrequency: "rare",
    responsePattern: "reliable",
    warmthObserved: 8,
    trustObserved: 3,
    familiarity: 3,
    reciprocity: 3,
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
    userRead: "test",
    explicitBoundaries: [],
    ...partial,
  };
}

function assessment(partial: Partial<ContactOpportunityAssessment> = {}): ContactOpportunityAssessment {
  return {
    personId: "p1",
    opportunityId: "job-1",
    relationshipStrength: 5,
    engagement: 5,
    networkNovelty: 7,
    functionalRelevance: 5,
    companyRelevance: 5,
    teamProximity: 4,
    informationValue: 8,
    routingValue: 8,
    credibilityValue: 2,
    referralAbility: 8,
    advocacyPotential: 1,
    secondDegreeReach: 6,
    askReadiness: { REFERRAL_REQUEST: 8 } as ContactOpportunityAssessment["askReadiness"],
    socialCost: 3,
    confidence: 0.5,
    evidenceIds: [],
    explanation: "test",
    version: "test",
    ...partial,
  };
}

describe("network ask gates", () => {
  it("does not allow a referral from high aggregate access when credibility is low", () => {
    const rel = relationship({ warmthObserved: 9, trustObserved: 3, sharedWork: [] });
    expect(askIsEligible("REFERRAL_REQUEST", rel, assessment({ referralAbility: 9, credibilityValue: 2, routingValue: 9 }), [], { score: { overall: 8 } } as ScoredJob)).toBe(false);
  });

  it("allows a referral when credibility, observed work, and a strong job line up", () => {
    const rel = relationship({ relationshipType: "FORMER_MANAGER", sharedWork: ["Observed actual work"], whatTheyKnowAboutUser: ["Knows delivered work"] });
    expect(askIsEligible("REFERRAL_REQUEST", rel, assessment({ referralAbility: 8, credibilityValue: 8 }), [], { score: { overall: 8 } } as ScoredJob)).toBe(true);
  });

  it("blocks referral after an explicit refusal or prior submission", () => {
    const rel = relationship({ relationshipType: "FORMER_COWORKER", sharedWork: ["work"] });
    const boundary: InteractionEvent[] = [{ relationshipId: rel.id, eventType: "BOUNDARY_EXPRESSED", explicitBoundary: "REFERRAL_REQUEST" } as InteractionEvent];
    const submitted: InteractionEvent[] = [{ relationshipId: rel.id, eventType: "REFERRAL_SUBMITTED" } as InteractionEvent];
    const values = assessment({ referralAbility: 8, credibilityValue: 8 });
    const job = { score: { overall: 8 } } as ScoredJob;
    expect(askIsEligible("REFERRAL_REQUEST", rel, values, boundary, job)).toBe(false);
    expect(askIsEligible("REFERRAL_REQUEST", rel, values, submitted, job)).toBe(false);
  });

  it("does not treat a weak job as an ask-gate failure when credibility is real", () => {
    const rel = relationship({ relationshipType: "FORMER_MANAGER", sharedWork: ["work"] });
    expect(askIsEligible("REFERRAL_REQUEST", rel, assessment({ referralAbility: 8, credibilityValue: 8 }), [], { score: { overall: 5 } } as ScoredJob)).toBe(true);
  });
});
