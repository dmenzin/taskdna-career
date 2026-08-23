import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, ELIGIBILITY_COVERAGE_FLOOR_POLICY, PREFERENCE_DIMENSION_DECISIONS, PRIMARY_PREFERENCE_DECODER_METRIC } from "../src/lab/preferenceTarget";
import { V3_COEFFICIENT_GOVERNANCE } from "../src/v3/coefficientGovernance";
import { assertLockedGuardRefusal } from "../src/lab/lockedGuard";

type Check={name:string;pass:boolean;detail:string};const checks:Check[]=[];
// On win32 pnpm/npx resolve to .cmd shims, which spawnSync cannot execute without a shell;
// without this every delegated check returned undefined stdout and the gate crashed rather
// than reporting a result. The shell is used ONLY for those shims: routing `git grep` through
// cmd would let it reinterpret the regex arguments.
const NEEDS_SHELL=new Set(["pnpm","npx","npm"]);
const run=(command:string,args:string[])=>{
 const result=spawnSync(command,args,{encoding:"utf8",env:{...process.env,NO_COLOR:"1"},shell:process.platform==="win32"&&NEEDS_SHELL.has(command)});
 // `error` is surfaced so guard assertions can tell "the process refused" from "the process
 // never started". Dropping it is what let the LOCKED gate pass on a missing executable.
 return {status:result.status,stdout:result.stdout??"",stderr:result.stderr??"",error:result.error??null};
};
const add=(name:string,pass:boolean,detail:string)=>checks.push({name,pass,detail});
const sha=(path:string)=>createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest=JSON.parse(readFileSync("config/baseline-manifest.json","utf8"));const frozen=manifest.records.find((r:{classification:string})=>r.classification==="VERIFIED_FROZEN_BASELINE");
add("readiness-lab provenance",run("git",["merge-base","--is-ancestor",manifest.authorizedCheckout.readinessLabBase,"HEAD"]).status===0,`descends from ${manifest.authorizedCheckout.readinessLabBase}`);
add("frozen baseline identity",sha(frozen.artifact)===frozen.sha256,sha(frozen.artifact));
add("frozen baseline unchanged",run("git",["diff","--exit-code",frozen.commit,"--",frozen.artifact]).status===0,"compared with creator commit");
try{const registry=JSON.parse(readFileSync("config/metric-registry.json","utf8"));add("metric registry",registry.metrics.some((m:{name:string})=>m.name===PRIMARY_PREFERENCE_DECODER_METRIC)&&registry.metrics.some((m:{name:string})=>m.name==="AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1"),`${registry.metrics.length} contracts`);}catch(e){add("metric registry",false,String(e));}
add("autonomous preference target",PREFERENCE_DIMENSION_DECISIONS.length===17&&AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.length>0&&PREFERENCE_DIMENSION_DECISIONS.filter(x=>x.maeEligible).every(x=>x.classification==="VALID_BIPOLAR_CONTINUOUS"),AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.join(", "));
const mono=run("pnpm",["exec","tsx","scripts/generator-monotonicity.ts"]);add("eligible generator monotonicity",mono.status===0,mono.status===0?createHash("sha256").update(mono.stdout).digest("hex"):(mono.stderr||mono.stdout).slice(-400));

// [ ] every generated preference statement MEANS what the hidden truth says
// The pre-fix generator paired a LOW hidden truth with a dislike of LOW-side behaviour, which
// means HIGH. scripts/generator-monotonicity.ts recovers each statement's meaning from the
// RENDERED TEXT (never from generator metadata) and exits nonzero on any backwards statement,
// so this is a hard gate rather than a correlation nudge.
try{const monoReport=JSON.parse(mono.stdout);add("generator semantic polarity",monoReport.semanticPolarityPass===true,`semanticPolarityPass=${monoReport.semanticPolarityPass}, backwards placements=${monoReport.semanticPolarity.reduce((sum:number,row:{backwardsPlacements:number})=>sum+row.backwardsPlacements,0)}`);}catch(e){add("generator semantic polarity",false,String(e));}

// [ ] dimension selection carries no positional bias
const bias=run("pnpm",["exec","tsx","scripts/generator-bias.ts"]);
try{const biasReport=JSON.parse(bias.stdout);add("generator positional sampling bias",bias.status===0&&biasReport.pass===true,`samplerChiSquare=${biasReport.samplerUniformity.chiSquare.toFixed(2)} (df=${biasReport.samplerUniformity.degreesOfFreedom}, critical=${biasReport.samplerUniformity.chiSquareCriticalValue}), positionSpearman=${biasReport.samplerUniformity.positionVersusRateSpearman.toFixed(3)}, corpusSelectionRateSpread=${biasReport.corpusSelectionBias.selectionRateSpread.toFixed(3)}`);}catch(e){add("generator positional sampling bias",false,`${String(e)} ${(bias.stderr||bias.stdout||"").slice(-300)}`);}

// [ ] late preference evidence and duplicate evidence paths stay fixed
const observability=run("pnpm",["exec","vitest","run","tests/evidence-observability.test.ts","tests/generator-semantics.test.ts"]);add("late-sentence and duplicate-evidence regressions",observability.status===0,observability.status===0?"tests/evidence-observability.test.ts and tests/generator-semantics.test.ts pass":(observability.stdout+observability.stderr).slice(-800));

// [ ] the four channels stay parallel and independent, and no model authors a channel score
const channels=run("pnpm",["exec","vitest","run","tests/four-channel-parallel.test.ts","tests/hybrid-readiness.test.ts"]);add("four parallel channels and hybrid-readiness contract",channels.status===0,channels.status===0?"channel isolation, strategy boundaries, learned-component contract, and mapper cache identity pass":(channels.stdout+channels.stderr).slice(-800));

// [ ] every product-critical subsystem has an evaluator and an improvement path
const coverage=run("pnpm",["exec","vitest","run","tests/subsystem-coverage.test.ts"]);add("product-critical subsystem coverage",coverage.status===0,coverage.status===0?`${JSON.parse(readFileSync("config/product-critical-subsystems.json","utf8")).subsystems.length} subsystems registered with construct, evaluator, baseline, known-answer tests, failure cases, alternative strategy path, and human-validation boundary`:(coverage.stdout+coverage.stderr).slice(-800));

// [ ] the research portfolio and the anti-micro-tuning guard are in place
const guard=run("pnpm",["exec","tsx","scripts/experiment-guard.ts"]);
try{
  const guardReport=JSON.parse(guard.stdout);
  const portfolio=JSON.parse(readFileSync("config/research-portfolio.json","utf8"));
  // The product contract requires twelve workstreams spanning measurement through model
  // capacity, plus explicit exclusions for every subsystem with no runnable evaluator.
  const requiredAreas=["measurement","preference","experience","task/dwa","job responsibility","direction","qualification","candidate retrieval","robustness","architecture"];
  const names=portfolio.workstreams.map((w:{name:string})=>w.name.toLowerCase()).join(" | ");
  const missingAreas=requiredAreas.filter(area=>!names.includes(area));
  const excluded=(portfolio.excludedFromLoop??[]).map((e:{row:number})=>e.row);
  const missingExclusions=[4,8,19,31].filter(row=>!excluded.includes(row));
  add("research portfolio and micro-tuning guard",
    guard.status===0&&guardReport.passed===true&&portfolio.workstreams.length>=12&&missingAreas.length===0&&missingExclusions.length===0,
    `${portfolio.workstreams.length} workstreams, ${guardReport.recordsAudited} experiment records audited, max ${guardReport.maxConsecutiveExperimentsPerMechanism} consecutive experiments per mechanism, ${excluded.length} subsystems excluded from the loop${missingAreas.length?`; MISSING AREAS: ${missingAreas.join(", ")}`:""}${missingExclusions.length?`; MISSING EXCLUSIONS: rows ${missingExclusions.join(", ")}`:""}`);
}catch(e){add("research portfolio and micro-tuning guard",false,String(e));}
const guardTests=run("pnpm",["exec","vitest","run","tests/experiment-guard.test.ts"]);add("micro-tuning guard rejects hill climbing",guardTests.status===0,guardTests.status===0?"tests/experiment-guard.test.ts pass: unpreregistered threshold/coefficient/regex/prompt nudging and a third consecutive same-mechanism experiment are both rejected":(guardTests.stdout+guardTests.stderr).slice(-800));

// --- Available-vs-recognized evidence hardening checks (readiness-hardening audit) ---

// [ ] available evidence is defined independently of extractor output
const availabilitySource=readFileSync("src/lab/evidenceAvailability.ts","utf8");
const extractorImportPattern=/@\/domain\/(evidence|engine|workStructure)/;
add("available evidence is defined independently of extractor output",!extractorImportPattern.test(availabilitySource),extractorImportPattern.test(availabilitySource)?"evidenceAvailability.ts imports an extractor module":"src/lab/evidenceAvailability.ts imports no production extractor module (src/domain/evidence.ts, engine.ts, workStructure.ts)");

// [ ] primary preference MAE uses available evidence, not recognized evidence
add("primary preference MAE uses available evidence",PRIMARY_PREFERENCE_DECODER_METRIC==="AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1",PRIMARY_PREFERENCE_DECODER_METRIC);

const modeReports:Record<string,{stdout:string;status:number|null}>={};
for(const mode of ["DEVELOPMENT","VALIDATION"]){const a=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts",`--mode=${mode}`]),b=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts",`--mode=${mode}`]);modeReports[mode]={stdout:a.stdout,status:a.status};add(`${mode} metrics deterministic`,a.status===0&&a.stdout===b.stdout,a.status===0?createHash("sha256").update(a.stdout).digest("hex"):(a.stderr||"").slice(-300));}

let developmentReport:Record<string,unknown>|null=null;
try{developmentReport=JSON.parse(modeReports.DEVELOPMENT!.stdout);}catch{developmentReport=null;}

// [ ] recognized-evidence metrics are reported separately
add("recognized-evidence metrics reported separately",Boolean(developmentReport&&typeof developmentReport.RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE==="number"&&typeof developmentReport.RECOGNIZED_EVIDENCE_PREFERENCE_MICRO_MAE==="number"&&developmentReport.RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE!==developmentReport.AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1),developmentReport?`RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE=${developmentReport.RECOGNIZED_EVIDENCE_PREFERENCE_MACRO_MAE} (primary ${developmentReport.AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1})`:"development report unparseable");

// [ ] available-to-recognized recall is reported
add("available-to-recognized recall reported",Boolean(developmentReport&&"AVAILABLE_TO_RECOGNIZED_RECALL" in developmentReport&&developmentReport.AVAILABLE_TO_RECOGNIZED_RECALL!==undefined),developmentReport?`AVAILABLE_TO_RECOGNIZED_RECALL=${developmentReport.AVAILABLE_TO_RECOGNIZED_RECALL}`:"development report unparseable");

// [ ] a missed extractor example cannot disappear from the primary denominator
const missedExtractorRegression=run("pnpm",["exec","vitest","run","tests/available-evidence.test.ts"]);add("missed-extractor example cannot disappear from the primary denominator",missedExtractorRegression.status===0,missedExtractorRegression.status===0?"tests/available-evidence.test.ts pass":(missedExtractorRegression.stdout+missedExtractorRegression.stderr).slice(-800));

// [ ] eligibility coverage thresholds are documented as policy assumptions
let sensitivityDocExists=true;try{readFileSync("docs/ELIGIBILITY_COVERAGE_SENSITIVITY.md","utf8");}catch{sensitivityDocExists=false;}
add("eligibility coverage thresholds documented as policy assumptions",ELIGIBILITY_COVERAGE_FLOOR_POLICY.status==="POLICY_PARAMETER_NOT_SCIENTIFIC_FACT"&&sensitivityDocExists,`floor=${ELIGIBILITY_COVERAGE_FLOOR_POLICY.value}, status=${ELIGIBILITY_COVERAGE_FLOOR_POLICY.status}, sensitivityDoc=${sensitivityDocExists}`);

// [ ] AGENTS.md contains persistent TaskDNA experiment rules
const agentsMd=readFileSync("AGENTS.md","utf8");
add("AGENTS.md contains persistent TaskDNA experiment rules",agentsMd.includes("<!-- BEGIN:taskdna-experiment-rules -->")&&agentsMd.includes("<!-- END:taskdna-experiment-rules -->")&&agentsMd.includes("<!-- BEGIN:nextjs-agent-rules -->"),"taskdna-experiment-rules block present alongside preserved nextjs-agent-rules block");

// [ ] active V3 coefficients have explicit governance status
const allowedGovernanceStatuses=new Set(["STRUCTURAL","PROVISIONAL_BASELINE","EMPIRICALLY_JUSTIFIED","UNJUSTIFIED","EXPERIMENTAL_DISABLED"]);
add("active V3 coefficients have explicit governance status",V3_COEFFICIENT_GOVERNANCE.length>0&&V3_COEFFICIENT_GOVERNANCE.every(r=>allowedGovernanceStatuses.has(r.status)&&r.rationale.length>0),`${V3_COEFFICIENT_GOVERNANCE.length} coefficients: ${V3_COEFFICIENT_GOVERNANCE.map(r=>`${r.id}=${r.status}`).join(", ")}`);

// [ ] agentic research program stays machine-checked
const agenticGov=run("pnpm",["exec","vitest","run","tests/prompt-render-freeze.test.ts","tests/research-program.test.ts","tests/experiment-registry.test.ts"]);
add("agentic research program governance",agenticGov.status===0,agenticGov.status===0?"rendered prompts frozen, research-program consistent, paid scripts preregistered":(agenticGov.stdout+agenticGov.stderr).slice(-800));

// --- product-level metric readiness checks ---

// [ ] every optimizable product-critical subsystem has a complete contract AND a runnable evaluator
//
// The bound is >=31, not ==31. Rows 1-31 are the required subsystem coverage; later rows are
// decision metrics added by ongoing work. Pinning the exact total made this gate fail the
// moment a legitimate new decision metric was contracted, which trains people to edit the
// assertion rather than read it. `audit:metric-contracts` still fails on any row that claims a
// runnable benchmark whose command does not resolve, which is the property that matters.
const contracts=run("pnpm",["exec","tsx","scripts/audit-metric-contracts.ts"]);
try{const c=JSON.parse(contracts.stdout);add("metric contracts have runnable evaluators",contracts.status===0&&c.passed===true&&c.contracts>=31&&c.blockingGaps.length===0,`${c.contracts} contracts, ${c.runnable} runnable, ${c.notRunnable} explicitly excluded (${c.excluded.map((e:{row:number})=>`row ${e.row}`).join(", ")}), ${c.blockingGaps.length} blocking gaps`);}catch(e){add("metric contracts have runnable evaluators",false,`${String(e)} ${(contracts.stderr||contracts.stdout||"").slice(-300)}`);}

// [ ] planted-truth benchmark is non-circular, leak-free and deterministic
const planted=run("pnpm",["exec","vitest","run","tests/bench-planted-truth.test.ts","tests/metric-contracts.test.ts"]);add("planted-truth benchmark validity",planted.status===0,planted.status===0?"labels are computed from planted atom identity with no scoring/mapping import; no atom id, planted label or corpus metadata reaches pipeline input; corpus is byte-identical across runs":(planted.stdout+planted.stderr).slice(-800));

// [ ] job ranking has runnable known-answer evaluators on all three channels
const ranking=run("pnpm",["exec","vitest","run","tests/bench-ranking.test.ts"]);add("job ranking known answers",ranking.status===0,ranking.status===0?"cross-title transfer outranks same-title/different-work; hard near-misses are demoted; burned-out-expert keeps high experience with low preference; transitions stay reachable; surprise requires relevance; no Overall score in any policy mode":(ranking.stdout+ranking.stderr).slice(-800));

// [ ] a bad recommendation can be localized to a subsystem without guessing
const traceability=run("pnpm",["exec","vitest","run","tests/bench-traceability.test.ts"]);add("end-to-end recommendation traceability",traceability.status===0,traceability.status===0?"all 12 stages traced with per-stage verdicts, candidate sets, selection reasons, mapper/corpus/cache identity, channel decomposition, and explanations citing only used evidence":(traceability.stdout+traceability.stderr).slice(-800));

// [ ] the extractor-side polarity defect the product benchmark found stays fixed
const negation=run("pnpm",["exec","vitest","run","tests/evidence-negation.test.ts"]);add("extractor negation polarity",negation.status===0,negation.status===0?"negated preference verbs classify as DISLIKE and move the predicted dimension to the LOW pole; zero preference polarity inversions on the planted corpus":(negation.stdout+negation.stderr).slice(-800));

// [ ] the ranking benchmark has headroom at its declared optimization target
const bench=run("pnpm",["exec","tsx","scripts/bench-product.ts","--difficulty=hard","--people=12","--no-write"]);
try{const b=JSON.parse(bench.stdout);const saturated=b.headroom.filter((h:{saturated:boolean})=>h.saturated);add("ranking benchmark has headroom at the optimization target",bench.status===0&&saturated.length===0&&b.scoreSpaceDominanceViolations===0,`${b.channelRanking.map((r:{channel:string;ndcgAtK:number})=>`${r.channel} NDCG=${r.ndcgAtK?.toFixed(4)}`).join(", ")}; saturated=[${saturated.map((h:{channel:string})=>h.channel).join(", ")}]; score-space dominance violations=${b.scoreSpaceDominanceViolations}`);}catch(e){add("ranking benchmark has headroom at the optimization target",false,`${String(e)} ${(bench.stderr||bench.stdout||"").slice(-300)}`);}

// [ ] the product-level red team finds no failure
const productRedTeam=run("pnpm",["exec","tsx","scripts/product-red-team.ts","--no-write"]);
try{const rt=JSON.parse(productRedTeam.stdout);add("product red team",productRedTeam.status===0&&rt.summary.fail===0,`${rt.summary.pass} pass, ${rt.summary.limitation} limitation, ${rt.summary.fail} fail across ${rt.attacks.length} attacks (circular gold, self-labelled mapping gold, title-collision false positives, cross-title misses, incidental over-reward, candidate-pool misses, novelty without relevance, Overall score, Pareto inconsistency, channel leakage, qualification mutation, duplicate recommendations, dev-only improvement, untraceability, unsupported explanation, metadata leakage, saturated benchmark, weakened baseline, metric without evaluator)`);}catch(e){add("product red team",false,`${String(e)} ${(productRedTeam.stderr||productRedTeam.stdout||"").slice(-300)}`);}

// --- end hardening checks ---

// The gate must require the SPECIFIC guard refusal. `status!==0&&!stdout` also accepted a
// missing pnpm, a spawn error and a syntax error as proof the holdout was protected.
const locked=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts","--mode=LOCKED_CONFIRMATION"]);
const lockedVerdict=assertLockedGuardRefusal(locked);add("locked confirmation guarded",lockedVerdict.pass,`${lockedVerdict.reason}: ${lockedVerdict.detail}`);
const v3=run("pnpm",["exec","vitest","run","tests/v3/bridge.test.ts","tests/v3/coefficientGovernance.test.ts"]);add("V3 canonical/mapper/four-channel invariants",v3.status===0,v3.status===0?"known answers and separation pass":(v3.stdout+v3.stderr).slice(-800));
for(const [name,args] of [["unit tests",["test"]],["typecheck",["typecheck"]],["lint",["lint"]],["build",["build"]]] as [string,string[]][]){const result=run("pnpm",args);add(name,result.status===0,result.status===0?"pass":(result.stdout+result.stderr).slice(-800));}
const secretPattern=["(AK","IA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|s","k-[A-Za-z0-9_-]{20,})"].join("");
const secrets=run("git",["grep","-IlE",secretPattern,"--",":!pnpm-lock.yaml"]);add("tracked secret-pattern scan",secrets.status===1,"filename-only scan; no candidates");
console.log(JSON.stringify({readinessVersion:"iteration-readiness.v5-product",lockedConfirmationExecuted:false,checks,passed:checks.every(c=>c.pass)},null,2));process.exit(checks.every(c=>c.pass)?0:1);
