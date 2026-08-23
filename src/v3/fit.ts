// V3 four-channel fit coefficients.
//
// Every named constant below is inventoried with an explicit governance status
// (STRUCTURAL / PROVISIONAL_BASELINE / EMPIRICALLY_JUSTIFIED / UNJUSTIFIED /
// EXPERIMENTAL_DISABLED) in src/v3/coefficientGovernance.ts and docs/V3_COEFFICIENT_INVENTORY.md.
// None of these values were tuned against any MAE, holdout, or validation metric.
// Do not change a value here without updating the governance registry and re-running
// tests/v3/bridge.test.ts and tests/v3/coefficientGovernance.test.ts.
import type { AspirationEvidence, ChannelScore, ExperienceEvidence, JobResponsibility, QualificationEvidence, V3Fit, V3Job, V3Person } from "@/v3/types";

/** Partial credit for a DWA-level (non-exact-Task) match. STRUCTURAL/PROVISIONAL_BASELINE: see coefficientGovernance.ts. */
export const DWA_PARTIAL_CREDIT = 0.6;
/** Center of the [0,1] preference-fit output range. STRUCTURAL: required so mean bipolar contribution 0 maps to a neutral 0.5 score. */
export const PREFERENCE_SCORE_CENTER = 0.5;
/** Span divisor mapping a mean contribution in [-1,1] onto the [0,1] score range. STRUCTURAL: the affine rescale, not a tunable weight. */
export const PREFERENCE_SCORE_SPAN = 2;
/** Experience-evidence strength weights by self-reported depth. PROVISIONAL_BASELINE ordinal weights: see coefficientGovernance.ts. */
export const EXPERIENCE_STRENGTH_WEIGHTS = { deep: 1, demonstrated: 0.75, weak: 0.4 } as const;
/** Experience-evidence ownership weights. PROVISIONAL_BASELINE: see coefficientGovernance.ts for the documented led>performed>unknown>assisted ordering anomaly. */
export const EXPERIENCE_OWNERSHIP_WEIGHTS = { led: 1, performed: 0.85, assisted: 0.55, unknown: 0.65 } as const;
/** Weight applied to a "preferred" (non-required) job requirement relative to a required one. PROVISIONAL_BASELINE: see coefficientGovernance.ts. */
export const PREFERRED_REQUIREMENT_WEIGHT = 0.25;

function identity(mapping:{level:string;selected:{taskId?:string|null;id?:string}|null}) { if(!mapping.selected)return null; return mapping.level==="task"?`task:${mapping.selected.taskId}`:mapping.level==="dwa"?`dwa:${mapping.selected.id}`:null; }
function identities(r:JobResponsibility){const set=new Set<string>(); const m=r.mapping;if(m.level==="task"&&m.selected&&"taskId" in m.selected)set.add(`task:${m.selected.taskId}`);for(const c of m.candidates.slice(0,1))for(const d of c.task.dwas)set.add(`dwa:${d.id}`);if(m.level==="dwa"&&m.selected&&"id" in m.selected)set.add(`dwa:${m.selected.id}`);return set;}
function match(mapping:{level:string;selected:object|null;candidates:{task:{dwas:{id:string}[]}}[]}, job:JobResponsibility){const id=identity(mapping as never);if(id&&identities(job).has(id))return id.startsWith("task:")?1:DWA_PARTIAL_CREDIT;return 0;}
export function preferenceFit(person:V3Person,job:V3Job):ChannelScore {const known=person.preferences.filter(p=>p.stance!=="UNKNOWN");const contributions=known.flatMap(p=>job.responsibilities.map(r=>{const m=match(p.mapping,r);if(!m)return null;const s=p.strength??1;return p.stance==="LIKE"?m*s:p.stance==="DISLIKE"?-m*s:0;})).filter((x):x is number=>x!==null);return {channel:"preference",score:contributions.length?clamp(PREFERENCE_SCORE_CENTER+sum(contributions)/(PREFERENCE_SCORE_SPAN*contributions.length)):null,coverage:job.responsibilities.length?new Set(known.flatMap(p=>job.responsibilities.filter(r=>match(p.mapping,r)>0).map(r=>r.id))).size/job.responsibilities.length:0,evidenceCount:known.length,diagnostics:["UNKNOWN excluded; NEUTRAL contributes zero; absence of LIKE is not DISLIKE"]};}
export function experienceFit(person:V3Person,job:V3Job):ChannelScore {const dedup=dedupeExperience(person.experience);const covered=job.responsibilities.map(r=>Math.max(0,...dedup.map(e=>match(e.mapping,r)*strength(e)*ownership(e))));return {channel:"experience",score:covered.length&&dedup.length?mean(covered):null,coverage:covered.length?covered.filter(x=>x>0).length/covered.length:0,evidenceCount:dedup.length,diagnostics:["common-source evidence deduplicated",`DWA partial credit=${DWA_PARTIAL_CREDIT}`]};}
export function qualificationFit(person:V3Person,job:V3Job,aliases:AliasProvider=DEFAULT_ALIASES):ChannelScore {const active=person.qualifications.filter(q=>!q.negated);const reqs=job.requirements.filter(r=>!r.negated);const results=reqs.map(r=>active.some(q=>equivalent(q,r.value,r.kind,aliases)));const required=reqs.map((r,i)=>({r,ok:results[i]!})).filter(x=>x.r.required),preferred=reqs.map((r,i)=>({r,ok:results[i]!})).filter(x=>!x.r.required);const hardGaps=required.filter(x=>!x.ok).length;const denominator=required.length+preferred.length*PREFERRED_REQUIREMENT_WEIGHT;const positive=required.filter(x=>x.ok).length+preferred.filter(x=>x.ok).length*PREFERRED_REQUIREMENT_WEIGHT;return {channel:"qualification",score:denominator?positive/denominator:null,coverage:reqs.length?results.filter(Boolean).length/reqs.length:0,evidenceCount:active.length,diagnostics:[`hardGaps=${hardGaps}`,`preferred requirement weight=${PREFERRED_REQUIREMENT_WEIGHT}`,"negated evidence does not satisfy requirements"]};}
export function directionFit(person:V3Person,job:V3Job):ChannelScore {return mappedAlignment("direction",person.aspirations,job);}
function mappedAlignment(channel:"direction",evidence:AspirationEvidence[],job:V3Job):ChannelScore{const matches=job.responsibilities.map(r=>Math.max(0,...evidence.map(e=>match(e.mapping,r)*(e.strength??1))));return {channel,score:matches.length&&evidence.length?mean(matches):null,coverage:matches.length?matches.filter(x=>x>0).length/matches.length:0,evidenceCount:evidence.length,diagnostics:["aspiration is not capability or experience"]};}
export function scoreV3(person:V3Person,job:V3Job):V3Fit{return {preference:preferenceFit(person,job),experience:experienceFit(person,job),qualification:qualificationFit(person,job),direction:directionFit(person,job)};}
export interface AliasProvider{version:string;canonical(value:string):string}
const GROUPS=[["js","javascript"],["ts","typescript"],["python programming","python"],["bachelors degree","bachelor degree","bachelor's degree","bs"],["masters degree","master degree","master's degree","ms"]];
export const DEFAULT_ALIASES:AliasProvider={version:"qualification-aliases.v1",canonical(value){const n=normalize(value);return GROUPS.find(g=>g.includes(n))?.[0]??n;}};
export function normalize(value:string){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9+#]+/g," ").trim().replace(/\s+/g," ");}
function equivalent(q:QualificationEvidence,value:string,kind:string,a:AliasProvider){return q.kind===kind&&a.canonical(q.value)===a.canonical(value);}
function dedupeExperience(xs:ExperienceEvidence[]){const seen=new Set<string>();return xs.filter(x=>{const key=`${x.sourceGroup}:${identity(x.mapping)}`;if(seen.has(key))return false;seen.add(key);return true;});}
const strength=(x:ExperienceEvidence)=>EXPERIENCE_STRENGTH_WEIGHTS[x.strength];
const ownership=(x:ExperienceEvidence)=>EXPERIENCE_OWNERSHIP_WEIGHTS[x.ownership];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));const sum=(x:number[])=>x.reduce((a,b)=>a+b,0);const mean=(x:number[])=>x.length?sum(x)/x.length:0;
