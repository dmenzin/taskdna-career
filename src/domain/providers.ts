import type {
  Capability,
  InterviewPlan,
  JobAnalysis,
  JobPosting,
  JobSourceObservation,
  ScenarioResponse,
  SearchRun,
  UserEvidence,
  UserProfile,
} from "@/domain/types";

export interface ResumeParserProvider {
  parse(input: string): string[];
}

export interface EvidenceExtractionProvider {
  extract(input: string): UserEvidence[];
}

export interface TaskDNAInferenceProvider {
  infer(evidence: UserEvidence[]): UserProfile["taskDna"];
}

export interface CapabilityInferenceProvider {
  infer(evidence: UserEvidence[]): Capability[];
}

export interface JobSearchProvider {
  search(): { observations: JobSourceObservation[]; jobs: JobPosting[]; searchRun: SearchRun };
}

export interface JobInterpretationProvider {
  interpret(job: JobPosting): JobAnalysis;
}

export interface FreshnessProvider {
  transition(current: JobPosting["freshnessState"], event: "reverify_success" | "reverify_failed" | "closure_evidence"): JobPosting["freshnessState"];
}

export interface CommuteProvider {
  estimate(job: Pick<JobPosting, "location" | "workMode">, homeRegion: string, toleranceMinutes: number): { minutes: number; penalty: number; label: string };
}

export interface LLMProvider {
  complete(prompt: string): Promise<string>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface AnalyticsProvider {
  track(eventName: string, payload: Record<string, unknown>): void;
}

export interface ScenarioInterviewProvider {
  plan(profile: UserProfile, answeredScenarioIds?: string[]): InterviewPlan;
  apply(profile: UserProfile, responses: ScenarioResponse[]): UserProfile;
}
