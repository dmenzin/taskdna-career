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

// --- end hardening checks ---

const locked=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts","--mode=LOCKED_CONFIRMATION"]);add("locked confirmation guarded",locked.status!==0&&!locked.stdout,"not executed by readiness");
const v3=run("pnpm",["exec","vitest","run","tests/v3/bridge.test.ts","tests/v3/coefficientGovernance.test.ts"]);add("V3 canonical/mapper/four-channel invariants",v3.status===0,v3.status===0?"known answers and separation pass":(v3.stdout+v3.stderr).slice(-800));
for(const [name,args] of [["unit tests",["test"]],["typecheck",["typecheck"]],["lint",["lint"]],["build",["build"]]] as [string,string[]][]){const result=run("pnpm",args);add(name,result.status===0,result.status===0?"pass":(result.stdout+result.stderr).slice(-800));}
const secretPattern=["(AK","IA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|s","k-[A-Za-z0-9_-]{20,})"].join("");
const secrets=run("git",["grep","-IlE",secretPattern,"--",":!pnpm-lock.yaml"]);add("tracked secret-pattern scan",secrets.status===1,"filename-only scan; no candidates");
console.log(JSON.stringify({readinessVersion:"iteration-readiness.v3",lockedConfirmationExecuted:false,checks,passed:checks.every(c=>c.pass)},null,2));process.exit(checks.every(c=>c.pass)?0:1);
