export type TaskType = "core" | "supplemental" | "unknown";
export interface Provenance { source: string; version: string; recordId?: string; hash?: string }
export interface CanonicalDwa { id: string; label: string }
export interface CanonicalTask {
  onetVersion: string;
  taskId: string | null;
  statement: string | null;
  sourceOccupation: { code: string; title: string };
  taskType: TaskType;
  importance?: { value: number; scale: "IM_1_5"; source: string };
  dwas: CanonicalDwa[];
  broaderActivities: { id: string; label: string; importance?: number }[];
  provenance: Provenance;
}
export interface WorkContext { domain?: string; seniority?: string; ownership?: "assisted"|"performed"|"led"|"unknown"; systemType?: string; environment?: string }
export type MappingLevel = "task"|"dwa"|"abstain";
export interface MappingCandidate { task: CanonicalTask; similarity: number; lexicalScore: number; contextScore: number }
export interface TaskMapping { candidates: MappingCandidate[]; selected: CanonicalTask | CanonicalDwa | null; level: MappingLevel; similarity: number; diagnosticConfidence: number; sourceText: string; context: WorkContext; mapperVersion: string; onetVersion: string; corpusVersion: string; corpusHash: string; provenance: Provenance; cacheKey: string }
export type PreferenceStance = "LIKE"|"DISLIKE"|"NEUTRAL"|"UNKNOWN";
export interface PreferenceEvidence { id:string; stance:PreferenceStance; strength?:number; mapping:TaskMapping; provenance:Provenance }
export interface ExperienceEvidence { id:string; mapping:TaskMapping; strength:"weak"|"demonstrated"|"deep"; ownership:"assisted"|"performed"|"led"|"unknown"; sourceGroup:string; provenance:Provenance }
export type QualificationKind = "skill"|"education"|"credential"|"capability";
export interface QualificationEvidence { id:string; kind:QualificationKind; value:string; negated?:boolean; provenance:Provenance }
export interface AspirationEvidence { id:string; mapping:TaskMapping; strength:number|null; provenance:Provenance }
export interface V3Person { id:string; preferences:PreferenceEvidence[]; experience:ExperienceEvidence[]; qualifications:QualificationEvidence[]; aspirations:AspirationEvidence[] }
export interface JobRequirement { id:string; value:string; kind:QualificationKind; required:boolean; negated?:boolean }
export interface JobResponsibility { id:string; sourceText:string; mapping:TaskMapping; importance:number|null }
export interface V3Job { id:string; title:string; responsibilities:JobResponsibility[]; requirements:JobRequirement[]; context:WorkContext; provenance:Provenance }
export interface ChannelScore { channel:"preference"|"experience"|"qualification"|"direction"; score:number|null; coverage:number; evidenceCount:number; diagnostics:string[] }
export interface V3Fit { preference:ChannelScore; experience:ChannelScore; qualification:ChannelScore; direction:ChannelScore }
