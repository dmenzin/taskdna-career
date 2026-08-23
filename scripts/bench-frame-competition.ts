// Re-baseline every architecture on the frame corpus.
//
// This is the Phase 2 deliverable: what the existing systems actually do once wording stops
// giving the answer away. Reported per family and per channel, with paired bootstrap intervals
// and an explicit oracle ceiling.
import { mkdirSync, writeFileSync } from "node:fs";
import {
  charNgramArchitecture,
  constantScoreArchitecture,
  experienceLexicalArchitecture,
  onetCanonicalArchitecture,
  oracleArchitecture,
  oracleNormalizerArchitecture,
  randomArchitecture,
  resumeLexicalArchitecture,
  titleOnlyArchitecture,
  type RankingArchitecture,
} from "../src/bench/architectures";
import { CHANNELS, evaluateArchitecture, pairedDifference, FRAME_EVALUATION_VERSION } from "../src/bench/frameEvaluation";
import { buildFrameCorpus, FRAME_CORPUS_VERSION } from "../src/bench/frameCorpus";
import { CONCEPTS_BY_ID, IDENTITY_ROLES, RENDER_FAMILIES, SEMANTIC_FRAME_VERSION, type RenderFamily } from "../src/bench/semanticFrame";
import type { Channel } from "../src/bench/labels";

const people = Number(process.argv.find((a) => a.startsWith("--people="))?.split("=")[1] ?? 48);
const splitArg = process.argv.find((a) => a.startsWith("--split="))?.split("=")[1] ?? "DEVELOPMENT";
if (!["DEVELOPMENT", "VALIDATION", "LOCKED_CONFIRMATION"].includes(splitArg)) throw new Error(`Unknown split: ${splitArg}`);
if (splitArg === "LOCKED_CONFIRMATION" && !process.argv.includes("--confirm-locked")) {
  throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
}
const split = splitArg as "DEVELOPMENT" | "VALIDATION";

// The O*NET mapper is loaded lazily: it needs the built corpus, and a missing O*NET build must
// degrade to "this competitor could not run" rather than taking the whole comparison down.
let onet: RankingArchitecture<never> | null = null;
try {
  const { mapWork } = await import("../src/v3/mapper");
  onet = onetCanonicalArchitecture(mapWork as never) as unknown as RankingArchitecture<never>;
} catch (error) {
  process.stderr.write(`onet-canonical unavailable: ${String(error).slice(0, 160)}\n`);
}

const candidates = [
  randomArchitecture,
  constantScoreArchitecture,
  titleOnlyArchitecture,
  charNgramArchitecture,
  resumeLexicalArchitecture,
  experienceLexicalArchitecture,
  ...(onet ? [onet] : []),
] as unknown as RankingArchitecture<never>[];
// The oracle is a CEILING, never a competitor. Kept in a separate list so it cannot be
// accidentally reported as if it had beaten anything.
const ceiling = oracleArchitecture as unknown as RankingArchitecture<never>;
// CONTROL, not a competitor: perfect normalisation through the corpus's own neutral register.
// Establishes the ceiling of the normalise-then-token-match strategy, which is NOT 1.000.
const normalizerControl = oracleNormalizerArchitecture(
  (id) => CONCEPTS_BY_ID.get(id)?.neutralForms ?? [],
  IDENTITY_ROLES,
) as unknown as RankingArchitecture<never>;

const rows: Record<string, unknown>[] = [];
process.stdout.write(`\nFRAME COMPETITION — ${FRAME_CORPUS_VERSION} / ${SEMANTIC_FRAME_VERSION} / ${FRAME_EVALUATION_VERSION}\n`);
process.stdout.write(`split=${split}  people=${people}  metric=NDCG@10 (mean over persons)\n`);

for (const family of RENDER_FAMILIES as readonly RenderFamily[]) {
  const corpus = buildFrameCorpus({ people, split, family });
  process.stdout.write(`\n================ ${family} ================\n`);
  process.stdout.write(`${"architecture".padEnd(22)}${CHANNELS.map((c) => c.padStart(14)).join("")}\n`);

  const byChannel = new Map<Channel, Map<string, ReturnType<typeof evaluateArchitecture>>>();
  for (const channel of CHANNELS) byChannel.set(channel, new Map());

  for (const architecture of [...candidates, normalizerControl, ceiling]) {
    const cells: string[] = [];
    for (const channel of CHANNELS) {
      const result = evaluateArchitecture(architecture, corpus, channel, 10);
      byChannel.get(channel)!.set(architecture.id, result);
      cells.push((result.meanNdcg10 ?? NaN).toFixed(3).padStart(14));
      rows.push({
        family, channel, architecture: architecture.id,
        ndcg10: result.meanNdcg10, recall10: result.meanRecall10,
        surprisingRecall10: result.meanSurprisingRecall10,
        transitionRecall10: result.meanTransitionRecall10,
        isCeiling: architecture.id === ceiling.id,
      });
    }
    const label = architecture.id === ceiling.id ? `${architecture.id} (ceiling)` : architecture.id;
    process.stdout.write(`${label.padEnd(22)}${cells.join("")}\n`);
  }

  // Paired comparison against the strongest simple reference, on the experience channel.
  const reference = byChannel.get("experience")!.get("experience-lexical");
  if (reference) {
    process.stdout.write(`\n  paired vs experience-lexical (experience channel, NDCG@10):\n`);
    for (const architecture of candidates) {
      if (architecture.id === "experience-lexical") continue;
      const system = byChannel.get("experience")!.get(architecture.id)!;
      const diff = pairedDifference(system, reference);
      const verdict = diff.significant ? (diff.meanDifference > 0 ? "BETTER" : "WORSE") : "unresolved";
      process.stdout.write(
        `    ${architecture.id.padEnd(20)} Δ=${diff.meanDifference >= 0 ? "+" : ""}${diff.meanDifference.toFixed(3)}` +
        `  95% CI [${diff.ci95.low.toFixed(3)}, ${diff.ci95.high.toFixed(3)}]  n=${diff.pairedN}` +
        `  resolves ±${diff.resolvableDifference.toFixed(3)}  ${verdict}\n`,
      );
      rows.push({ comparison: `${architecture.id} vs experience-lexical`, ...diff });
    }
  }
}

mkdirSync("artifacts/frame_competition", { recursive: true });
const artifact = {
  version: FRAME_EVALUATION_VERSION,
  corpusVersion: FRAME_CORPUS_VERSION,
  frameVersion: SEMANTIC_FRAME_VERSION,
  split, people, k: 10,
  lockedConfirmationExecuted: false,
  rows,
};
writeFileSync(`artifacts/frame_competition/${split.toLowerCase()}_latest.json`, JSON.stringify(artifact, null, 2) + "\n");
process.stdout.write(`\nwrote artifacts/frame_competition/${split.toLowerCase()}_latest.json\n`);
