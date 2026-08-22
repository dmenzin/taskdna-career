import { describe, expect, it } from "vitest";
import { buildUserProfile, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { assessContactForOpportunity, composeDeterministicDraft, createHumanOpportunityGraph, createInteractionPlan, evaluateNetworkStrategy } from "../src/domain/networkEngine";
import { createSyntheticNetworkUniverse } from "../src/fixtures/network";

describe("Human Opportunity Graph V2", () => {
  const dataset = createDemoDataset();
  const profile = buildUserProfile("failure-analyst");
  const scoredJobs = scoreJobs(profile, dataset.jobs);
  const graph = createHumanOpportunityGraph(profile, scoredJobs);

  it("creates a substantial synthetic network without real contact data", () => {
    const universe = createSyntheticNetworkUniverse();
    expect(universe.people.length).toBeGreaterThanOrEqual(150);
    expect(universe.relationships.length).toBeGreaterThanOrEqual(150);
    expect(universe.interactions.length).toBeGreaterThanOrEqual(50);
    expect(universe.people.every((person) => person.synthetic)).toBe(true);
  });

  it("keeps network access separate from intrinsic Work Fit", () => {
    const job = graph.scoredJobs[0];
    const beforeFit = job.score.predictedFit;
    const access = graph.accessAssessments.find((item) => item.opportunityId === job.job.canonicalId)!;
    expect(access.informationAccess + access.routingAccess + access.credibilityAccess).toBeGreaterThan(0);
    expect(job.score.predictedFit).toBe(beforeFit);
  });

  it("does not treat strongest tie as universally best", () => {
    const weakInfo = graph.contactAssessments.find((assessment) => {
      const rel = graph.relationships.find((relationship) => relationship.personId === assessment.personId);
      return rel?.relationshipType === "ALUM" && assessment.informationValue > assessment.credibilityValue;
    });
    const strongCred = graph.contactAssessments.find((assessment) => {
      const rel = graph.relationships.find((relationship) => relationship.personId === assessment.personId);
      return rel?.relationshipType === "FORMER_MANAGER" && assessment.credibilityValue > assessment.informationValue;
    });
    expect(weakInfo).toBeTruthy();
    expect(strongCred).toBeTruthy();
  });

  it("respects explicit offers and boundaries", () => {
    const offerRelationship = graph.relationships.find((relationship) => graph.interactions.some((event) => event.relationshipId === relationship.id && event.explicitOffer === "SEND_REQUESTED_MATERIAL"))!;
    const offerPerson = graph.people.find((person) => person.id === offerRelationship.personId)!;
    const job = graph.scoredJobs[0];
    const offerAssessment = assessContactForOpportunity(offerPerson, offerRelationship, graph.interactions, job);
    const offerPlan = createInteractionPlan(offerPerson, offerRelationship, offerAssessment, job, graph.interactions);
    expect(offerPlan.recommendedAskType).toBe("SEND_REQUESTED_MATERIAL");

    const boundaryRelationship = graph.relationships.find((relationship) => graph.interactions.some((event) => event.relationshipId === relationship.id && event.explicitBoundary === "REFERRAL_REQUEST"))!;
    const boundaryPerson = graph.people.find((person) => person.id === boundaryRelationship.personId)!;
    const boundaryAssessment = assessContactForOpportunity(boundaryPerson, boundaryRelationship, graph.interactions, job);
    const boundaryPlan = createInteractionPlan(boundaryPerson, boundaryRelationship, boundaryAssessment, job, graph.interactions);
    expect(boundaryPlan.recommendedAskType).not.toBe("REFERRAL_REQUEST");
    expect(boundaryPlan.thingsNotToAskYet).toContain("REFERRAL_REQUEST");
  });

  it("creates second-degree paths with exposed certainty", () => {
    const path = graph.paths.find((item) => item.pathType === "SECOND_DEGREE");
    expect(path).toBeTruthy();
    expect(path?.edgeCertainty).toMatch(/USER_REPORTED|INFERRED|HYPOTHESIZED/);
    expect(path?.hopCount).toBe(2);
  });

  it("produces grounded drafts from interaction plans only", () => {
    const action = graph.nextBestActions.find((item) => item.interactionPlan && item.draft)!;
    const person = graph.people.find((item) => item.id === action.relatedPersonId)!;
    const draft = composeDeterministicDraft(action.interactionPlan!, person, graph.scoredJobs.find((job) => job.job.canonicalId === action.relatedOpportunityId));
    expect(draft.body).toContain(person.name.split(" ")[0]);
    expect(draft.groundedFields).toContain("recommended ask");
    expect(draft.body).not.toMatch(/just thinking about you/i);
  });

  it("passes network strategy sanity checks", () => {
    const evaluation = evaluateNetworkStrategy(graph);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.counts.paths).toBeGreaterThan(0);
    expect(evaluation.counts.actions).toBeGreaterThanOrEqual(6);
  });
});
