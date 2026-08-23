// Acceptance gate for the semantic-frame corpus: is the lexical giveaway actually gone?
//
// Same measurement as `pnpm diag:generator-lexical-leak`, applied to frame-rendered text.
// The old corpus scores ROC AUC 0.981 at `hard`. Chance is 0.500. A high score here would be
// evidence that the lexicon still leaks, not evidence of a good corpus.
import { mulberry32, hashSeed } from "../src/lab/rng";
import { contentTokens } from "../src/bench/render";
import { frameIdentity, renderJobFrame, renderPersonFrame, sampleFrame, verifyLexiconDisjointness, verifyNoStemCorrelation } from "../src/bench/semanticFrame";

const disjoint = verifyLexiconDisjointness();
const stems = verifyNoStemCorrelation();
process.stdout.write(`lexicon disjointness violations: ${disjoint.length}\n`);
for (const v of disjoint.slice(0, 10)) process.stdout.write(`  ${v.conceptId}: shares ${v.sharedTokens.join(",")}\n`);
process.stdout.write(`stem-correlation violations: ${stems.length}\n`);
for (const v of stems.slice(0, 10)) process.stdout.write(`  ${v.conceptId}: ${v.sharedTokens.slice(0, 4).join(",")}\n`);

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}
function auc(pos: number[], neg: number[]): number {
  if (!pos.length || !neg.length) return 0.5;
  const all = [...pos.map((v) => ({ v, p: 1 })), ...neg.map((v) => ({ v, p: 0 }))].sort((a, b) => a.v - b.v);
  let i = 0, rankSum = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1]!.v === all[i]!.v) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t += 1) if (all[t]!.p === 1) rankSum += avg;
    i = j + 1;
  }
  return (rankSum - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

const rng = mulberry32(hashSeed("frame-leak:1"));
const frames = Array.from({ length: 300 }, (_, i) => sampleFrame(rng, ["core"], i));
const person = frames.map((f) => ({ id: frameIdentity(f), tokens: contentTokens(renderPersonFrame(f, rng)) }));
const job = frames.map((f) => ({ id: frameIdentity(f), tokens: contentTokens(renderJobFrame(f, rng)) }));

const same: number[] = [], diff: number[] = [];
for (const p of person) for (const j of job) (p.id === j.id ? same : diff).push(jaccard(p.tokens, j.tokens));

process.stdout.write(`\nsame-frame      n=${same.length}  mean=${mean(same).toFixed(4)}\n`);
process.stdout.write(`different-frame n=${diff.length}  mean=${mean(diff).toFixed(4)}\n`);
process.stdout.write(`ROC AUC (token overlap as a work-identity detector) = ${auc(same, diff).toFixed(4)}\n`);
process.stdout.write(`  old corpus at hard = 0.9814   chance = 0.5000\n`);

process.stdout.write(`\n--- example: the SAME work, both sides ---\n`);
const demo = frames[0]!;
process.stdout.write(`  person: ${renderPersonFrame(demo, mulberry32(1))}\n`);
process.stdout.write(`  job   : ${renderJobFrame(demo, mulberry32(1))}\n`);

// --- Consequence check: can the production canonical mapper still recover identity? ---
//
// On the old corpus, person-side and job-side text for one atom both map to the same O*NET
// Task at 0.917 / 0.850 (`pnpm diag:mapping-asymmetry`). That worked because both sides
// contained the same distinctive nouns as the O*NET statement itself. With disjoint
// vocabulary the mapper has no mechanism left. A collapse here is the EXPECTED result and is
// what makes the corpus able to discriminate architectures.
const { mapWork } = await import("../src/v3/mapper");
const identity = (text: string) => {
  const m = mapWork(text);
  if (!m.selected) return null;
  const sel = m.selected as { taskId?: string | null; id?: string };
  if (m.level === "task" && sel.taskId) return `task:${sel.taskId}`;
  if (m.level === "dwa" && sel.id) return `dwa:${sel.id}`;
  return null;
};
let agree = 0, personAbstain = 0, jobAbstain = 0;
const sample = frames.slice(0, 120);
for (const f of sample) {
  const p = identity(renderPersonFrame(f, mulberry32(7)));
  const j = identity(renderJobFrame(f, mulberry32(7)));
  if (p === null) personAbstain += 1;
  if (j === null) jobAbstain += 1;
  if (p !== null && j !== null && p === j) agree += 1;
}
process.stdout.write(`\n--- production mapper on frame text (n=${sample.length}) ---\n`);
process.stdout.write(`  person/job canonical identity AGREEMENT: ${(agree / sample.length).toFixed(3)}\n`);
process.stdout.write(`  person abstained: ${(personAbstain / sample.length).toFixed(3)}   job abstained: ${(jobAbstain / sample.length).toFixed(3)}\n`);
process.stdout.write(`  old corpus person-side mapping Top-1 at standard = 0.917\n`);
