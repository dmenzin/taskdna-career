import { scoringConfig } from "@/config/model";
import { askRules, networkModelConfig } from "@/config/network";

export function inventoryParameters() {
  const inference = Object.entries(scoringConfig.inference).map(([key, value]) => ({
    id: `inference.${key}`,
    value,
    kind: typeof value === "number" ? "coefficient" : "version",
    owner: "TaskDNA inference",
    justification: "Versioned heuristic; not a calibrated probability.",
  }));
  const weights = Object.entries(scoringConfig.weights).map(([key, value]) => ({
    id: `overall.weight.${key}`,
    value,
    kind: "weight",
    owner: "Overall priority",
    justification: "Explicit overall mix; hireability currently dominates.",
  }));
  const tiers = flatten("tier", scoringConfig.tiers);
  const novelty = Object.entries(scoringConfig.novelty).map(([key, value]) => ({
    id: `novelty.${key}`,
    value,
    kind: "threshold",
    owner: "Novelty",
    justification: "Gates non-obvious discovery on fit and transfer.",
  }));
  const network = [
    ...Object.entries(networkModelConfig.accessWeights ?? {}).map(([key, value]) => ({ id: `network.access.${key}`, value, kind: "weight", owner: "Network access", justification: "Heuristic access mix." })),
    ...Object.entries(networkModelConfig.pathWeights ?? {}).map(([key, value]) => ({ id: `network.path.${key}`, value, kind: "weight", owner: "Pathfinding", justification: "Hop and certainty penalties." })),
    ...Object.entries(networkModelConfig.actionWeights ?? {}).map(([key, value]) => ({ id: `network.action.${key}`, value, kind: "weight", owner: "Next best action", justification: "Daily planner mix." })),
  ];
  const asks = Object.entries(askRules).map(([ask, rule]) => ({
    id: `ask.${ask}.socialCost`,
    value: rule.socialCost,
    kind: "cost",
    owner: "Ask ontology",
    justification: "Social-cost prior, not an observed outcome probability.",
  }));
  return {
    version: scoringConfig.version,
    count: inference.length + weights.length + tiers.length + novelty.length + network.length + asks.length,
    parameters: [...inference, ...weights, ...tiers, ...novelty, ...network, ...asks],
  };
}

function flatten(prefix: string, value: unknown, path = prefix): { id: string; value: unknown; kind: string; owner: string; justification: string }[] {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(prefix, child, `${path}.${key}`));
  }
  return [{ id: path, value, kind: "threshold", owner: "Action tiers", justification: "Configured cliff; small input changes can change labels." }];
}
