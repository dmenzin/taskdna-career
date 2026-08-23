// Deterministic provenance-threshold sensitivity (T-01).
//
// The 0.6 floor and 0.1 margin are hand-set. Before those numbers become a KEEP/REJECT gate,
// this sweep asks whether the architectural conclusion flips when they move. Thresholds are
// never selected post-hoc to flatter an architecture.
import {
  AMBIGUITY_MARGIN,
  ATTRIBUTION_FLOOR,
  evidenceIndex,
  provenanceFor,
  summarizeProvenance,
  type EvidenceChannel,
  type OutputChannel,
  type ProvenanceSummary,
} from "@/agent/provenance";
import type { CareerBlueprintV2 } from "@/agent/agentArchitecture";
import type { PlantedFramePerson } from "@/bench/frameCorpus";

export const SENSITIVITY_FLOORS = [0.4, 0.5, 0.6, 0.7, 0.8] as const;
export const SENSITIVITY_MARGINS = [0.05, 0.075, 0.1, 0.15, 0.2] as const;
export const CONTAMINATION_KEEP_CEILING = 0.05;

const SHARED_VISIBLE: EvidenceChannel[] = ["EXPERIENCE", "PREFERENCE_LIKE", "PREFERENCE_DISLIKE", "ASPIRATION"];

export interface ChannelPair {
  key: "experience" | "liked" | "disliked" | "desired";
  output: OutputChannel;
}

export const PROVENANCE_CHANNELS: ChannelPair[] = [
  { key: "experience", output: "EXPERIENCE" },
  { key: "liked", output: "PREFERENCE" },
  { key: "disliked", output: "PREFERENCE" },
  { key: "desired", output: "DIRECTION" },
];

export function provenanceForBlueprint(
  person: PlantedFramePerson,
  blueprint: CareerBlueprintV2,
  options: { floor?: number; margin?: number } = {},
): Record<string, ProvenanceSummary> {
  const index = evidenceIndex(person);
  const out: Record<string, ProvenanceSummary> = {};
  for (const channel of PROVENANCE_CHANNELS) {
    out[channel.key] = summarizeProvenance(
      provenanceFor(blueprint[channel.key], channel.output, index, SHARED_VISIBLE, options),
    );
  }
  return out;
}

export interface ThresholdCell {
  floor: number;
  margin: number;
  isDefault: boolean;
  byChannel: Record<string, { contaminationRate: number; unsupportedClaimRate: number; keep: boolean }>;
}

export function sweepProvenanceThresholds(
  people: PlantedFramePerson[],
  blueprints: Map<string, CareerBlueprintV2>,
): { cells: ThresholdCell[]; defaultKeeps: Record<string, boolean>; conclusionFlips: boolean } {
  const cells: ThresholdCell[] = [];
  let defaultKeeps: Record<string, boolean> = {};
  for (const floor of SENSITIVITY_FLOORS) {
    for (const margin of SENSITIVITY_MARGINS) {
      const totals: Record<string, { contamination: number; unsupported: number; claims: number }> = {};
      for (const person of people) {
        const blueprint = blueprints.get(person.personId);
        if (!blueprint) continue;
        const summary = provenanceForBlueprint(person, blueprint, { floor, margin });
        for (const [channel, row] of Object.entries(summary)) {
          const bucket = totals[channel] ?? { contamination: 0, unsupported: 0, claims: 0 };
          bucket.contamination += row.evidenceContamination;
          bucket.unsupported += row.unsupportedClaims;
          bucket.claims += row.claims;
          totals[channel] = bucket;
        }
      }
      const byChannel: ThresholdCell["byChannel"] = {};
      for (const [channel, bucket] of Object.entries(totals)) {
        const contaminationRate = bucket.claims ? bucket.contamination / bucket.claims : 0;
        byChannel[channel] = {
          contaminationRate,
          unsupportedClaimRate: bucket.claims ? bucket.unsupported / bucket.claims : 0,
          keep: contaminationRate <= CONTAMINATION_KEEP_CEILING,
        };
      }
      const isDefault = floor === ATTRIBUTION_FLOOR && margin === AMBIGUITY_MARGIN;
      if (isDefault) defaultKeeps = Object.fromEntries(Object.entries(byChannel).map(([k, v]) => [k, v.keep]));
      cells.push({ floor, margin, isDefault, byChannel });
    }
  }
  const conclusionFlips = cells.some((cell) =>
    Object.entries(defaultKeeps).some(([channel, keep]) => cell.byChannel[channel]?.keep !== keep),
  );
  return { cells, defaultKeeps, conclusionFlips };
}
