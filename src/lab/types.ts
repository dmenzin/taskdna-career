import type { ScenarioAnswer, Vector } from "@/domain/types";
import type { InteractionEvent, Person, Relationship } from "@/domain/networkTypes";
import type { PreferenceStatementPlan } from "@/lab/preferencePhrases";

export type SubjectCohort = "design" | "validation" | "holdout" | "adversarial";
/** Pass-2 cohorts for the O*NET-backed lab. "development" replaces "design" naming. */
export type SubjectCohortV2 = "development" | "validation" | "holdout" | "adversarial";

export type OccupationalFamily =
  | "engineering_hardware"
  | "software_it"
  | "data_analytics"
  | "scientific_research"
  | "healthcare_professional"
  | "healthcare_operations"
  | "finance"
  | "accounting_audit"
  | "consulting"
  | "product"
  | "project_program"
  | "operations_supply"
  | "sales"
  | "marketing"
  | "hr_recruiting"
  | "legal_compliance"
  | "education"
  | "ux_design"
  | "customer_success"
  | "field_technical"
  | "public_sector";

export interface OccupationSkeleton {
  onetCode: string;
  title: string;
  /** Occupational family (legacy snapshot) or O*NET stratum (real corpus). */
  family: OccupationalFamily | string;
  industry: string;
  tasks: string[];
  generalizedWorkActivities: string[];
  skills: string[];
  knowledge: string[];
  workContext: string[];
  source: "onet-inspired-local-snapshot" | "onet-30.3";
}

export interface VirtualSubjectTruth {
  subjectId: string;
  seed: number;
  cohort: SubjectCohort;
  occupationalSkeleton: OccupationSkeleton;
  careerHistoryTruth: {
    years: number;
    accidentalCareer: boolean;
    careerChanger: boolean;
    burnedOut: boolean;
    occupationFitsPreference: boolean;
  };
  taskDnaTruth: Vector;
  capabilityTruth: string[];
  capabilityConfidenceTruth: Record<string, number>;
  attractorsTruth: string[];
  repellentsTruth: string[];
  goalsTruth: string[];
  constraintsTruth: string[];
  interpersonalStyleTruth: "brief" | "warm" | "formal";
  networkingComfortTruth: number;
  expectedGeneralProperties: string[];
  invariantExpectations: string[];
  generationVersion: string;
}

export interface VirtualSubjectObservations {
  subjectId: string;
  apparentField: string;
  resumeText: string;
  workHistory: string[];
  projects: string[];
  achievements: string[];
  failuresOrStruggles: string[];
  scenarioResponses: { scenarioId: string; answer: ScenarioAnswer; confidence: number }[];
  explicitPreferences: string[];
  explicitDislikes: string[];
  incompleteInformation: string[];
  contradictoryStatements: string[];
  statedSkills: string[];
  networkIntake: {
    people: Person[];
    relationships: Relationship[];
    interactions: InteractionEvent[];
  };
  evidenceQualityMetadata: {
    sparse: boolean;
    contradictory: boolean;
    misleadingTitle: boolean;
    stale: boolean;
  };
  /**
   * What the generator MEANT by each preference statement it emitted, and which single
   * observable source it was assigned to.
   *
   * This is generator bookkeeping for provenance, bias diagnostics, and duplicate-path
   * auditing. It is NOT inference-visible and it is NOT what availability is computed
   * from: src/lab/evidenceAvailability.ts recovers meaning by reading the rendered text,
   * so a generator that emits backwards language cannot assert its way to a correct
   * label. Do not read this from any evaluator that grades the decoder.
   */
  preferenceStatementPlan?: PreferenceStatementPlan;
}

export interface VirtualSubject {
  truth: VirtualSubjectTruth;
  observations: VirtualSubjectObservations;
}

export interface TwinPair {
  id: string;
  kind: "same_experience_different_preference" | "same_preference_different_experience" | "same_user_different_network" | "title_removed";
  a: VirtualSubject;
  b: VirtualSubject;
}

export interface SubjectEvaluation {
  subjectId: string;
  cohort: SubjectCohort;
  confidence: number;
  taskDnaMae: number;
  propertyResults: { id: string; pass: boolean; detail: string }[];
}

export interface LabManifest {
  version: string;
  seed: number;
  generatedAt: string;
  occupationSource: {
    name: string;
    version: string;
    licenseNote: string;
  };
  counts: Record<SubjectCohort, number>;
  occupationFamilies: OccupationalFamily[];
}
