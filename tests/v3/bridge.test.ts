import { describe,expect,it } from "vitest";
import { generateOnetSubjects } from "@/lab/onetLab";
import { assessGeneratorMonotonicity,eligibleMonotonicityPass } from "@/lab/generatorMonotonicity";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1,PREFERENCE_DIMENSION_DECISIONS } from "@/lab/preferenceTarget";
import { canonicalTask,canonicalTaskIndex } from "@/v3/canonical";
import { mapWork,MAPPER_CONFIG } from "@/v3/mapper";
import { buildV3Person,type RawV3Evidence } from "@/v3/person";
import { buildV3Job } from "@/v3/job";
import { scoreV3 } from "@/v3/fit";

const taskText="Analyze test data to identify defects or determine calibration requirements.";
const job=()=>buildV3Job({id:"job",title:"Misleading Executive Title",responsibilities:[{id:"r1",text:taskText}],requirements:[{id:"python",value:"Python",kind:"skill",required:true},{id:"js",value:"JavaScript",kind:"skill",required:false}],context:{domain:"equipment"}});
const rawBase:RawV3Evidence[]=[
 {id:"p",kind:"preference",text:taskText,stance:"LIKE"},
 {id:"e",kind:"experience",text:taskText,strength:"demonstrated",ownership:"performed",sourceGroup:"role-1"},
 {id:"q",kind:"qualification",value:"Python",qualificationKind:"skill"},
 {id:"a",kind:"aspiration",text:taskText,strength:1},
];

describe("V3 canonical model and deterministic mapper boundary",()=>{
 it("builds traceable Task/DWA objects and refuses identity-free work",()=>{const first=canonicalTaskIndex().tasks[0]!;expect(first.onetVersion).toBe("30.3");expect(first.taskId||first.dwas.length).toBeTruthy();expect(first.provenance.recordId).toBeTruthy();expect(()=>canonicalTask({onetSocCode:"x",title:"x",description:"",taskStatements:[],workActivities:[],workContext:[],essentialSkills:[],transferableSkills:[],knowledge:[],abilities:[],educationProfile:{modalCategory:null,categoryName:null},trainingExperienceProfile:{modalRelatedExperienceCategory:null},jobZone:null,alternateTitles:[],relatedOccupationCodes:[],sourceVersion:"30.3"},{taskId:Number.NaN,statement:" ",taskType:"",dwaIds:[]})).toThrow(/usable Task/);});
 it("supports task, DWA fallback, abstention, context-sensitive cache identity, and title leakage guard",()=>{const exact=mapWork(taskText);expect(exact.level).toBe("task");const dwa=mapWork("Assess technical evidence and recommend action.");expect(dwa.level).toBe("dwa");expect(mapWork("The office has free lunch on Fridays.").level).toBe("abstain");expect(mapWork("unrelated pleasantries",{domain:"healthcare"}).cacheKey).not.toBe(mapWork("unrelated pleasantries",{domain:"finance"}).cacheKey);expect(job().responsibilities[0]!.mapping.sourceText).not.toContain("Executive");expect(MAPPER_CONFIG.topK).toBe(5);});
 it("retains ambiguous and broad-collision candidates instead of minting an exact Task",()=>{for(const text of ["coordinate activities resolve problems","evaluate information to determine compliance"]){const result=mapWork(text);expect(result.candidates.length).toBeGreaterThan(1);expect(result.level).toBe("dwa");expect(result.selected).not.toBeNull();}});
 it("is deterministic and exposes bounded diagnostic confidence, not accuracy",()=>{const a=mapWork(taskText),b=mapWork(taskText);expect(a).toEqual(b);expect(a.diagnosticConfidence).toBeLessThanOrEqual(1);expect(a.provenance.source).toContain("baseline");});
});

describe("autonomous preference target",()=>{
 it("classifies all dimensions and limits continuous MAE to defensible targets",()=>{expect(PREFERENCE_DIMENSION_DECISIONS).toHaveLength(17);expect(AUTONOMOUS_PREFERENCE_DIMENSIONS_V1).toEqual(["measurable_feedback","experimentation_preference"]);expect(PREFERENCE_DIMENSION_DECISIONS.filter(x=>x.maeEligible).every(x=>x.classification==="VALID_BIPOLAR_CONTINUOUS")).toBe(true);});
 it("empirically passes generator monotonicity for every eligible dimension",()=>{const results=assessGeneratorMonotonicity(generateOnetSubjects());expect(eligibleMonotonicityPass(results)).toBe(true);for(const r of results.filter(x=>x.eligible)){expect(r.coverage).toBeGreaterThan(0);expect(r.observableSignalAssociation).toBeGreaterThan(0);expect(r.failures).toEqual([]);}});
});

describe("four independent V3 fit channels",()=>{
 it("keeps LIKE, DISLIKE, NEUTRAL and UNKNOWN distinct",()=>{const j=job();const like=scoreV3(buildV3Person("x",[{id:"p",kind:"preference",text:taskText,stance:"LIKE"}]),j).preference;const dislike=scoreV3(buildV3Person("x",[{id:"p",kind:"preference",text:taskText,stance:"DISLIKE"}]),j).preference;const neutral=scoreV3(buildV3Person("x",[{id:"p",kind:"preference",text:taskText,stance:"NEUTRAL"}]),j).preference;const unknown=scoreV3(buildV3Person("x",[{id:"p",kind:"preference",text:taskText,stance:"UNKNOWN"}]),j).preference;expect(like.score!).toBeGreaterThan(neutral.score!);expect(dislike.score!).toBeLessThan(neutral.score!);expect(unknown.score).toBeNull();});
 it("supports independent simultaneous preferences and conflicts",()=>{const p=buildV3Person("x",[{id:"a",kind:"preference",text:taskText,stance:"LIKE"},{id:"b",kind:"preference",text:"Confer with customers to resolve complaints.",stance:"LIKE"},{id:"c",kind:"preference",text:taskText,stance:"DISLIKE"}]);expect(p.preferences).toHaveLength(3);expect(p.preferences.map(x=>x.stance)).toEqual(["LIKE","LIKE","DISLIKE"]);});
 it("uses exact/DWA evidence, ownership and source deduplication without creating preference",()=>{const p=buildV3Person("x",[{id:"e1",kind:"experience",text:taskText,strength:"demonstrated",ownership:"assisted",sourceGroup:"same"},{id:"e2",kind:"experience",text:taskText,strength:"deep",ownership:"led",sourceGroup:"same"}]);const fit=scoreV3(p,job());expect(fit.experience.score).toBeGreaterThan(0);expect(fit.experience.evidenceCount).toBe(1);expect(p.preferences).toEqual([]);});
 it("normalizes aliases, rejects substring collisions, identifies hard gaps, and downweights preferred-only",()=>{const alias=scoreV3(buildV3Person("x",[{id:"q",kind:"qualification",value:"python programming",qualificationKind:"skill"}]),job()).qualification;const collision=scoreV3(buildV3Person("x",[{id:"q",kind:"qualification",value:"Java",qualificationKind:"skill"}]),job()).qualification;const missing=scoreV3(buildV3Person("x",[]),job()).qualification;expect(alias.score!).toBeGreaterThan(collision.score!);expect(collision.diagnostics).toContain("hardGaps=1");expect(missing.score).toBe(0);});
 it("never rewards additional hard gaps and does not let negated evidence satisfy one",()=>{const person=buildV3Person("x",[{id:"q",kind:"qualification",value:"Python",qualificationKind:"skill"},{id:"n",kind:"qualification",value:"SQL",qualificationKind:"skill",negated:true}]);const one=scoreV3(person,job()).qualification;const two=scoreV3(person,buildV3Job({id:"j2",title:"",responsibilities:[{id:"r",text:taskText}],requirements:[{id:"p",value:"Python",kind:"skill",required:true},{id:"s",value:"SQL",kind:"skill",required:true}]})).qualification;expect(two.score!).toBeLessThan(one.score!);expect(two.diagnostics).toContain("hardGaps=1");});
 it("does not convert aspiration into experience",()=>{const p=buildV3Person("x",[{id:"a",kind:"aspiration",text:taskText}]);const fit=scoreV3(p,job());expect(fit.direction.score).toBeGreaterThan(0);expect(fit.experience.score).toBeNull();expect(p.experience).toEqual([]);});
 it.each(["preference","experience","qualification","aspiration"] as const)("changing only %s changes only its channel",kind=>{const base=scoreV3(buildV3Person("x",rawBase),job());const changed=scoreV3(buildV3Person("x",rawBase.filter(x=>x.kind!==kind)),job());const channel=kind==="aspiration"?"direction":kind;for(const key of ["preference","experience","qualification","direction"] as const){if(key===channel)expect(changed[key]).not.toEqual(base[key]);else expect(changed[key]).toEqual(base[key]);}});
 it("occupation/title context creates no preference or other person-side signal",()=>{const p=buildV3Person("x",[{id:"o",kind:"occupation_context",text:"Senior Reliability Engineer"}]);expect(p).toEqual({id:"x",preferences:[],experience:[],qualifications:[],aspirations:[]});});
});
