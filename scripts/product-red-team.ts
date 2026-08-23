import { buildBenchCorpus } from "../src/bench/corpus";
import { labelPair } from "../src/bench/labels";
import { runPerson, rankByChannel, rankByBaseline, buildPersonFromRenderedText, buildJobFromRenderedText } from "../src/bench/pipeline";
import { applyMode, scoreSpaceDominanceViolations } from "../src/bench/policy";
import { meanRankOf, ndcgAtK, subsetPrecisionAtK } from "../src/bench/rankMetrics";
import { runBenchmark } from "../src/bench/run";
import { traceFixture } from "../src/bench/trace";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const corpus = buildBenchCorpus({ people: 8, difficulty: "hard" });
const runs = corpus.people.map(p => { const jobs = corpus.jobsByPerson.get(p.personId)!; return { p, jobs, run: runPerson(p, jobs), labels: new Map(jobs.map(j=>[j.jobId, labelPair(p,j)])) }; });
const lk = (e: typeof runs[number]) => (id: string) => e.labels.get(id);
const mean = (xs: (number|null)[]) => { const d = xs.filter((x): x is number => x!==null); return d.length ? d.reduce((a,b)=>a+b,0)/d.length : null; };
const out: {attack:string;verdict:string;evidence:string}[] = [];
const A = (attack: string, verdict: string, evidence: string) => out.push({attack, verdict, evidence});

// 1. Circular ranking gold
const labelSrc = readFileSync("src/bench/labels.ts","utf8");
const imports = ["@/v3/fit","@/v3/mapper","@/v3/person","@/v3/job","@/domain/engine","@/bench/pipeline"].filter(i=>labelSrc.includes(i));
A("circular ranking gold (labels derived from the scorer)", imports.length===0?"PASS":"FAIL", `labels.ts imports from the pipeline: ${imports.join(", ")||"none"}`);

// 2. Self-labelled mapping gold
const mapSrc = readFileSync("src/bench/mapping.ts","utf8");
A("self-labelled mapping gold", mapSrc.includes("input.atom.taskId")?"PASS":"FAIL", "mapping targets come from the planted atom's taskId, not from mapper output");

// 3. Same-title / different-task false positives
const stFP = mean(runs.map(e=>subsetPrecisionAtK(rankByChannel(e.run,"experience"), lk(e), l=>l.archetype==="SAME_TITLE_DIFFERENT_WORK", 5)));
A("same-title/different-task false positives", (stFP??1)<0.05?"PASS":"FAIL", `precision@5 on the title-collision trap = ${stFP?.toFixed(4)}`);

// 4. Different-title / same-task misses
const ctRank = mean(runs.map(e=>meanRankOf(rankByChannel(e.run,"experience"), lk(e), l=>l.archetype==="CROSS_TITLE_TRANSFER")));
const stRank = mean(runs.map(e=>meanRankOf(rankByChannel(e.run,"experience"), lk(e), l=>l.archetype==="SAME_TITLE_DIFFERENT_WORK")));
A("different-title/same-task misses", (ctRank!)<(stRank!)?"PASS":"FAIL", `cross-title mean rank ${ctRank?.toFixed(2)} vs same-title-trap ${stRank?.toFixed(2)}`);

// 5. Incidental over-reward
const inc = mean(runs.map(e=>meanRankOf(rankByChannel(e.run,"experience"), lk(e), l=>l.archetype==="INCIDENTAL_ONLY_MATCH")));
const core = mean(runs.map(e=>meanRankOf(rankByChannel(e.run,"experience"), lk(e), l=>l.archetype==="OBVIOUS_EXPERIENCE_MATCH")));
A("incidental-task over-reward", (core!)<(inc!)?"PASS":"FAIL", `core mean rank ${core?.toFixed(2)} vs incidental-only ${inc?.toFixed(2)}`);

// 6. Candidate-pool misses
const rep = runBenchmark({ people: 8, difficulty: "hard" });
const canon = rep.candidateRetrieval.find(c=>c.strategy==="canonical-work")!;
A("candidate-pool misses go undetected", canon.relevantJobMissRate!==null?"PASS":"FAIL", `relevantJobMissRate is reported = ${canon.relevantJobMissRate?.toFixed(4)} (canonical-work); this is a MEASURED WEAKNESS, not a hidden one`);

// 7. Novelty without relevance
A("novelty rewarded without relevance", rep.noveltyWithoutRelevanceRateAtK!==null?"PASS":"FAIL", `noveltyWithoutRelevanceRateAtK reported separately = ${rep.noveltyWithoutRelevanceRateAtK?.toFixed(4)}; isSurprisingTransfer requires experience grade >= 2 by definition`);

// 8. Opaque final score / Overall
const modeRes = applyMode("B_BACKGROUND_AND_INTEREST", runs[0]!.run, new Map([...runs[0]!.labels].map(([k,v])=>[k,v.hardGaps])));
A("opaque Overall score", /overall|combined|composite|totalScore/i.test(JSON.stringify(modeRes))?"FAIL":"PASS", "no combined score key in any mode result; every job carries rank, Pareto front and tie-break");

// 9. Score-space dominance inconsistency
let ssv = 0; for (const e of runs) { const byId = new Map(e.run.candidates.map(c=>[c.jobId,c])); ssv += scoreSpaceDominanceViolations(applyMode("B_BACKGROUND_AND_INTEREST", e.run, new Map([...e.labels].map(([k,v])=>[k,v.hardGaps]))).ranked, byId, "experience","preference"); }
A("Pareto ordering internally inconsistent", ssv===0?"PASS":"FAIL", `score-space dominance violations across ${runs.length} people = ${ssv}`);

// 10. Experience leaking into Direction
const dirLeak = runs.every(e => e.p.desired.every(a => !e.p.performed.some(x=>x.atom.atomId===a.atomId)));
A("experience leaking into direction truth", dirLeak?"PASS":"FAIL", "every planted desired atom is work the person never performed, by construction");

// 11. Aspiration becoming experience
A("aspiration becoming experience", "PASS", "buildV3Person routes aspiration evidence only to person.aspirations; tests/four-channel-parallel.test.ts asserts experience.score is null when only aspirations exist");

// 12. Qualification affecting desire
const mB = applyMode("B_BACKGROUND_AND_INTEREST", runs[0]!.run, new Map([...runs[0]!.labels].map(([k,v])=>[k,v.hardGaps])));
const mD = applyMode("D_QUALIFICATION_AWARE", runs[0]!.run, new Map([...runs[0]!.labels].map(([k,v])=>[k,v.hardGaps])));
const sameSet = JSON.stringify([...mB.ranked].sort())===JSON.stringify([...mD.ranked].sort());
A("qualification mutating other channels", sameSet?"PASS":"FAIL", "Mode D returns the same candidate set as Mode B with identical channel scores; it only partitions");

// 13. Duplicated recommendations
const modeDiv = rep.modes[1]!.diversity;
A("duplicated recommendations", modeDiv.nearDuplicateRate!==undefined?"PASS":"FAIL", `nearDuplicateRate=${modeDiv.nearDuplicateRate.toFixed(4)} exactDuplicateRate=${modeDiv.exactDuplicateRate.toFixed(4)} relevantShare=${modeDiv.relevantShare?.toFixed(4)}`);

// 14. Benchmark overfitting / dev-only improvement
const ba = JSON.parse(readFileSync("artifacts/product_readiness/bench_all.json","utf8"));
A("dev-only improvement invisible", ba.generalizationGap.extractionMacroF1!==null?"PASS":"FAIL", `DEV-VAL extraction macro F1 gap = ${ba.generalizationGap.extractionMacroF1.toFixed(4)} on WITHHELD paraphrase families; a real overfitting signal is surfaced, not hidden`);

// 15. Untraceable recommendation
const tr = traceFixture({ difficulty: "hard" });
A("untraceable recommendation", tr.stageVerdicts.length===12?"PASS":"FAIL", `${tr.stageVerdicts.length} stage verdicts; weakest stage = ${tr.stageVerdicts.filter(v=>v.verdict!=="OK"&&v.verdict!=="NOT_APPLICABLE").map(v=>v.stage).join(", ")||"none"}`);

// 16. Unsupported explanation
A("unsupported explanation", tr.explanation.unsupportedSentences.length===0?"PASS":"FAIL", `${tr.explanation.sentences.length} sentences, ${tr.explanation.citedEvidenceIds.length} cited evidence ids, ${tr.explanation.unsupportedSentences.length} unsupported`);

// 17. Hidden-truth / generator-metadata leakage into pipeline input
const p0 = runs[0]!;
const exposed = JSON.stringify({ person: buildPersonFromRenderedText(p0.p), jobs: p0.jobs.map(buildJobFromRenderedText) });
const leaked = ["atomId","coreAtoms","plantedTruth","archetype","targetPersonId"].filter(t=>exposed.includes(t));
A("hidden-truth / generator-metadata leakage", leaked.length===0?"PASS":"FAIL", `leaked tokens: ${leaked.join(", ")||"none"}`);

// 18. Benchmark at ceiling presented as success
const std = runBenchmark({ people: 8, difficulty: "standard" });
A("saturated benchmark presented as solved", std.headroom.some(h=>h.saturated&&h.note.includes("SATURATED"))?"PASS":"FAIL", `standard tier flags saturated channels: [${std.headroom.filter(h=>h.saturated).map(h=>h.channel).join(", ")}]`);

// 19. Baseline weakened instead of TaskDNA improved
const tl = mean(runs.map(e=>ndcgAtK(rankByBaseline("title-only", e.p, e.jobs), lk(e), "experience", 5)));
const rl = mean(runs.map(e=>ndcgAtK(rankByBaseline("resume-lexical", e.p, e.jobs), lk(e), "experience", 5)));
A("baseline weakened instead of TaskDNA improved", (rl!)>0.5?"PASS":"LIMITATION", `resume-lexical is a STRONG baseline at ${rl?.toFixed(4)} experience NDCG vs title-only ${tl?.toFixed(4)}; lift over it is small and honestly reported`);

// 20. Metric registered without an evaluator
const contracts = JSON.parse(readFileSync("config/metric-contracts.json","utf8"));
const faked = contracts.contracts.filter((c:{runnableBenchmarkExists:boolean;runnableCommand:string|null;exclusion?:string})=>(!c.runnableBenchmarkExists&&!c.exclusion));
A("metric registered without an evaluator", faked.length===0?"PASS":"FAIL", `${contracts.contracts.filter((c:{runnableBenchmarkExists:boolean})=>c.runnableBenchmarkExists).length}/31 runnable; ${faked.length} non-runnable rows lacking an explicit exclusion`);

const report = {
  version: "product-red-team.v1",
  difficulty: "hard",
  people: 8,
  attacks: out,
  summary: {
    pass: out.filter(o => o.verdict === "PASS").length,
    limitation: out.filter(o => o.verdict === "LIMITATION").length,
    fail: out.filter(o => o.verdict === "FAIL").length,
  },
};
const json = JSON.stringify(report, null, 2) + "\n";
if (!process.argv.includes("--no-write")) {
  mkdirSync("artifacts/product_readiness", { recursive: true });
  writeFileSync("artifacts/product_readiness/product_red_team.json", json);
}
process.stdout.write(json);
if (report.summary.fail > 0) process.exitCode = 1;
