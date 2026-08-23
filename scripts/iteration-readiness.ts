import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, ELIGIBILITY_COVERAGE_FLOOR_POLICY, PREFERENCE_DIMENSION_DECISIONS, PRIMARY_PREFERENCE_DECODER_METRIC } from "../src/lab/preferenceTarget";
import { V3_COEFFICIENT_GOVERNANCE } from "../src/v3/coefficientGovernance";

type Check={name:string;pass:boolean;detail:string};const checks:Check[]=[];
const run=(command:string,args:string[])=>spawnSync(command,args,{encoding:"utf8",env:{...process.env,NO_COLOR:"1"}});
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
try{const guardReport=JSON.parse(guard.stdout);const portfolio=JSON.parse(readFileSync("config/research-portfolio.json","utf8"));add("research portfolio and micro-tuning guard",guard.status===0&&guardReport.passed===true&&portfolio.workstreams.length===8,`${portfolio.workstreams.length} workstreams, ${guardReport.recordsAudited} experiment records audited, max ${guardReport.maxConsecutiveExperimentsPerMechanism} consecutive experiments per mechanism`);}catch(e){add("research portfolio and micro-tuning guard",false,String(e));}
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

// --- product-level metric readiness checks ---

// [ ] every optimizable product-critical subsystem has a complete contract AND a runnable evaluator
const contracts=run("pnpm",["exec","tsx","scripts/audit-metric-contracts.ts"]);
try{const c=JSON.parse(contracts.stdout);add("metric contracts have runnable evaluators",contracts.status===0&&c.passed===true&&c.contracts===31&&c.blockingGaps.length===0,`${c.contracts} contracts, ${c.runnable} runnable, ${c.notRunnable} explicitly excluded (${c.excluded.map((e:{row:number})=>`row ${e.row}`).join(", ")}), ${c.blockingGaps.length} blocking gaps`);}catch(e){add("metric contracts have runnable evaluators",false,`${String(e)} ${(contracts.stderr||contracts.stdout||"").slice(-300)}`);}

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

// --- end hardening checks ---

const locked=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts","--mode=LOCKED_CONFIRMATION"]);add("locked confirmation guarded",locked.status!==0&&!locked.stdout,"not executed by readiness");
const v3=run("pnpm",["exec","vitest","run","tests/v3/bridge.test.ts","tests/v3/coefficientGovernance.test.ts"]);add("V3 canonical/mapper/four-channel invariants",v3.status===0,v3.status===0?"known answers and separation pass":(v3.stdout+v3.stderr).slice(-800));
for(const [name,args] of [["unit tests",["test"]],["typecheck",["typecheck"]],["lint",["lint"]],["build",["build"]]] as [string,string[]][]){const result=run("pnpm",args);add(name,result.status===0,result.status===0?"pass":(result.stdout+result.stderr).slice(-800));}
const secretPattern=["(AK","IA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|s","k-[A-Za-z0-9_-]{20,})"].join("");
const secrets=run("git",["grep","-IlE",secretPattern,"--",":!pnpm-lock.yaml"]);add("tracked secret-pattern scan",secrets.status===1,"filename-only scan; no candidates");
console.log(JSON.stringify({readinessVersion:"iteration-readiness.v5-product",lockedConfirmationExecuted:false,checks,passed:checks.every(c=>c.pass)},null,2));process.exit(checks.every(c=>c.pass)?0:1);
