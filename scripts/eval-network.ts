import { buildUserProfile, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { createHumanOpportunityGraph, evaluateNetworkStrategy } from "../src/domain/networkEngine";

const dataset = createDemoDataset();
const personas = ["failure-analyst", "greenfield-software", "quality-dislikes-compliance", "robotics-no-cpp", "programmer-no-physical"];

const results = personas.map((personaId) => {
  const profile = buildUserProfile(personaId);
  const graph = createHumanOpportunityGraph(profile, scoreJobs(profile, dataset.jobs));
  const strategyEval = evaluateNetworkStrategy(graph);
  const genericCases = [
    { id: "has-network", pass: graph.people.length >= 16 },
    { id: "has-actions", pass: graph.nextBestActions.length >= 5 },
    { id: "work-fit-separated", pass: graph.scoredJobs.every((job) => typeof job.score.predictedFit === "number") },
    { id: "has-access-assessments", pass: graph.accessAssessments.length > 0 },
  ];
  const isGolden = personaId === "failure-analyst";
  const cases = isGolden ? strategyEval.cases : genericCases;
  const passed = cases.every((item) => item.pass);
  return {
    personaId,
    passed,
    cases,
    counts: strategyEval.counts,
    topActions: graph.nextBestActions.slice(0, 5).map((action) => ({
      type: action.actionType,
      title: action.title,
      priority: Number(action.priority.toFixed(2)),
      socialCost: Number(action.socialCost.toFixed(2)),
    })),
  };
});

const passed = results.every((result) => result.passed);
console.log(JSON.stringify({ passed, results }, null, 2));

if (!passed) {
  console.error("Network strategy evaluation failed.");
  process.exit(1);
}
