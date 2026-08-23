import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PREFERENCE_DIMENSION_DECISIONS, AUTONOMOUS_PREFERENCE_DIMENSIONS_V1 } from "../src/lab/preferenceTarget";

type Check={name:string;pass:boolean;detail:string};const checks:Check[]=[];
const run=(command:string,args:string[])=>spawnSync(command,args,{encoding:"utf8",env:{...process.env,NO_COLOR:"1"}});
const add=(name:string,pass:boolean,detail:string)=>checks.push({name,pass,detail});
const sha=(path:string)=>createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest=JSON.parse(readFileSync("config/baseline-manifest.json","utf8"));const frozen=manifest.records.find((r:{classification:string})=>r.classification==="VERIFIED_FROZEN_BASELINE");
add("readiness-lab provenance",run("git",["merge-base","--is-ancestor",manifest.authorizedCheckout.readinessLabBase,"HEAD"]).status===0,`descends from ${manifest.authorizedCheckout.readinessLabBase}`);
add("frozen baseline identity",sha(frozen.artifact)===frozen.sha256,sha(frozen.artifact));
add("frozen baseline unchanged",run("git",["diff","--exit-code",frozen.commit,"--",frozen.artifact]).status===0,"compared with creator commit");
try{const registry=JSON.parse(readFileSync("config/metric-registry.json","utf8"));add("metric registry",registry.metrics.some((m:{name:string})=>m.name==="AUTONOMOUS_OBSERVED_PREFERENCE_MACRO_MAE_V1"),`${registry.metrics.length} contracts`);}catch(e){add("metric registry",false,String(e));}
add("autonomous preference target",PREFERENCE_DIMENSION_DECISIONS.length===17&&AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.length>0&&PREFERENCE_DIMENSION_DECISIONS.filter(x=>x.maeEligible).every(x=>x.classification==="VALID_BIPOLAR_CONTINUOUS"),AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.join(", "));
const mono=run("pnpm",["exec","tsx","scripts/generator-monotonicity.ts"]);add("eligible generator monotonicity",mono.status===0,mono.status===0?createHash("sha256").update(mono.stdout).digest("hex"):(mono.stderr||mono.stdout).slice(-400));
for(const mode of ["DEVELOPMENT","VALIDATION"]){const a=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts",`--mode=${mode}`]),b=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts",`--mode=${mode}`]);add(`${mode} metrics deterministic`,a.status===0&&a.stdout===b.stdout,a.status===0?createHash("sha256").update(a.stdout).digest("hex"):(a.stderr||"").slice(-300));}
const locked=run("pnpm",["exec","tsx","scripts/iteration-diagnostics.ts","--mode=LOCKED_CONFIRMATION"]);add("locked confirmation guarded",locked.status!==0&&!locked.stdout,"not executed by readiness");
const v3=run("pnpm",["exec","vitest","run","tests/v3/bridge.test.ts"]);add("V3 canonical/mapper/four-channel invariants",v3.status===0,v3.status===0?"known answers and separation pass":(v3.stdout+v3.stderr).slice(-800));
for(const [name,args] of [["unit tests",["test"]],["typecheck",["typecheck"]],["lint",["lint"]],["build",["build"]]] as [string,string[]][]){const result=run("pnpm",args);add(name,result.status===0,result.status===0?"pass":(result.stdout+result.stderr).slice(-800));}
const secretPattern=["(AK","IA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|s","k-[A-Za-z0-9_-]{20,})"].join("");
const secrets=run("git",["grep","-IlE",secretPattern,"--",":!pnpm-lock.yaml"]);add("tracked secret-pattern scan",secrets.status===1,"filename-only scan; no candidates");
console.log(JSON.stringify({readinessVersion:"iteration-readiness.v2",lockedConfirmationExecuted:false,checks,passed:checks.every(c=>c.pass)},null,2));process.exit(checks.every(c=>c.pass)?0:1);
