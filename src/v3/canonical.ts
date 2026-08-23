import { requireOnetCorpus } from "@/onet/corpus";
import { ONET_TRANSFORM_VERSION, ONET_VERSION, type OnetOccupationSkeleton, type OnetTaskStatement } from "@/onet/types";
import type { CanonicalTask, TaskType } from "@/v3/types";

export function canonicalTask(occupation: OnetOccupationSkeleton, task: OnetTaskStatement): CanonicalTask {
  const statement=task.statement.trim(); const dwas=[...new Set(task.dwaIds.filter(Boolean))];
  if (!statement && !dwas.length) throw new Error("Canonical work must have a usable Task statement/ID or DWA identity");
  const type:TaskType=/^core$/i.test(task.taskType)?"core":/^supplemental$/i.test(task.taskType)?"supplemental":"unknown";
  return { onetVersion:ONET_VERSION, taskId:Number.isFinite(task.taskId)?String(task.taskId):null, statement:statement||null,
    sourceOccupation:{code:occupation.onetSocCode,title:occupation.title}, taskType:type,
    importance:task.importance===undefined?undefined:{value:task.importance,scale:"IM_1_5",source:"O*NET task_ratings"},
    dwas:dwas.map(id=>({id,label:`O*NET DWA ${id}`})),
    broaderActivities:occupation.workActivities.map(a=>({id:a.elementId,label:a.name,importance:a.importance})),
    provenance:{source:"O*NET Database",version:ONET_VERSION,recordId:`${occupation.onetSocCode}:${task.taskId}`},
  };
}
let cached:ReturnType<typeof buildIndex>|undefined;
function buildIndex(){const corpus=requireOnetCorpus();return {version:`${ONET_TRANSFORM_VERSION}:${corpus.version}`,tasks:corpus.occupations.flatMap(o=>o.taskStatements.map(t=>canonicalTask(o,t)))};}
export function canonicalTaskIndex() { return cached??=buildIndex(); }
