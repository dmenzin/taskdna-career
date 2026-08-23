import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { corpusPath } from "@/onet/corpus";
import { ONET_TRANSFORM_VERSION, ONET_VERSION } from "@/onet/types";
import { canonicalTaskIndex } from "@/v3/canonical";
import type { CanonicalDwa, MappingCandidate, TaskMapping, WorkContext } from "@/v3/types";
export const MAPPER_VERSION="taskdna.mapper.lexical.v1";
export const MAPPER_CONFIG={topK:5,taskThreshold:.46,dwaThreshold:.25,taskMargin:.06,tokenizer:"lowercase-alphanumeric-stopwords.v1",contextWeight:.08} as const;
export interface CandidateReranker { version:string; rerank(input:{sourceText:string;context:WorkContext;candidates:MappingCandidate[]}):MappingCandidate[] }
const STOP=new Set("a an and are as at be by for from in into is it of on or that the their this to use using with".split(" "));
const tokens=(s:string)=>new Set((s.toLowerCase().match(/[a-z0-9+#.]+/g)??[]).filter(x=>x.length>1&&!STOP.has(x)));
function overlap(a:Set<string>,b:Set<string>){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/Math.sqrt(a.size*b.size);}
const stable=(x:unknown)=>JSON.stringify(x,(_k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
let corpusHash:string|undefined; const hashCorpus=()=>corpusHash??=createHash("sha256").update(readFileSync(corpusPath())).digest("hex");
export function mapWork(sourceText:string, context:WorkContext={}, reranker?:CandidateReranker):TaskMapping {
 const clean=sourceText.trim(); const query=tokens(clean); const contextTokens=tokens([context.domain,context.systemType,context.environment].filter(Boolean).join(" "));
 let candidates=canonicalTaskIndex().tasks.map(task=>{const lexicalScore=overlap(query,tokens(task.statement??"")); const contextScore=overlap(contextTokens,tokens(`${task.sourceOccupation.title} ${task.broaderActivities.map(a=>a.label).join(" ")}`));return {task,lexicalScore,contextScore,similarity:lexicalScore+MAPPER_CONFIG.contextWeight*contextScore};}).filter(c=>c.similarity>0).sort((a,b)=>b.similarity-a.similarity||String(a.task.taskId).localeCompare(String(b.task.taskId))).slice(0,MAPPER_CONFIG.topK);
 if(reranker)candidates=reranker.rerank({sourceText:clean,context,candidates});
 const top=candidates[0],next=candidates[1]; let level:"task"|"dwa"|"abstain"="abstain"; let selected:null|MappingCandidate["task"]|CanonicalDwa=null;
 if(top&&top.similarity>=MAPPER_CONFIG.taskThreshold&&top.similarity-(next?.similarity??0)>=MAPPER_CONFIG.taskMargin){level="task";selected=top.task;}
 else if(top&&top.similarity>=MAPPER_CONFIG.dwaThreshold&&top.task.dwas[0]){level="dwa";selected=top.task.dwas[0];}
 const behavior={sourceText:clean,context,config:MAPPER_CONFIG,mapper:MAPPER_VERSION,reranker:reranker?.version??null,corpusHash:hashCorpus()};
 return {candidates,selected,level,similarity:top?.similarity??0,diagnosticConfidence:level==="task"?Math.min(1,(top?.similarity??0)):level==="dwa"?Math.min(.6,(top?.similarity??0)):0,sourceText:clean,context,mapperVersion:MAPPER_VERSION,onetVersion:ONET_VERSION,corpusVersion:ONET_TRANSFORM_VERSION,corpusHash:hashCorpus(),provenance:{source:"deterministic lexical retrieval baseline",version:MAPPER_VERSION,hash:hashCorpus()},cacheKey:createHash("sha256").update(stable(behavior)).digest("hex")};
}
