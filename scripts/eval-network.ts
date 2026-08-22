import { buildUserProfile, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { createHumanOpportunityGraph, evaluateNetworkStrategy } from "../src/domain/networkEngine";

const dataset = createDemoDataset();
const personas = ["failure-analyst", "greenfield-software", "quality-dislikes-compliance", "robotics-no-cpp", "field-troubleshooter"];

const results = personas.map((personaId) => {
  const profile = buildUserProfile(personaId);
  const graph = createHumanOpportunityGraph(profile, scoreJobs(profile, dataset.jobs));
  return {
    personaId,
    ...evaluateNetworkStrategy(graph),
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
