// Types for the real O*NET 30.3 ingestion pipeline.
// O*NET occupational descriptors define WORK EXPOSURE, never personal preference ground truth.

export const ONET_VERSION = "30.3";
export const ONET_TRANSFORM_VERSION = "onet-corpus.v1";
export const ONET_SOURCE_URL = "https://www.onetcenter.org/dl_files/database/db_30_3_csv.zip";
export const ONET_LICENSE = {
  name: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  url: "https://www.onetcenter.org/license_db.html",
  attribution:
    "This product includes information from the O*NET 30.3 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. TaskDNA's derived interpretations do not represent the official position of USDOL/ETA and are not endorsed by USDOL/ETA.",
} as const;

// Tables the pipeline downloads and consumes. Others in the archive are retained but unused.
export const ONET_CONSUMED_TABLES = [
  "occupation_data",
  "task_statements",
  "task_ratings",
  "work_activities",
  "work_context",
  "essential_skills",
  "transferable_skills",
  "knowledge",
  "abilities",
  "education",
  "education_categories",
  "training_and_experience",
  "job_zones",
  "sample_of_reported_titles",
  "related_occupations",
  "tasks_to_dwas",
  "scales_reference",
] as const;

export type OnetConsumedTable = (typeof ONET_CONSUMED_TABLES)[number];

export interface OnetManifest {
  version: string;
  sourceUrl: string;
  fetchedAt: string;
  license: typeof ONET_LICENSE;
  archive: { file: string; sha256: string; bytes: number };
  tables: { table: string; file: string; sha256: string; bytes: number; rows: number }[];
  transformVersion: string;
}

export interface RatedElement {
  elementId: string;
  name: string;
  /** Importance (IM scale, 1-5) unless noted otherwise. */
  importance: number;
  /** Level (LV scale) when available. */
  level?: number;
}

export interface WorkContextElement {
  elementId: string;
  name: string;
  /** Context rating (CX/CT scales, 1-5). */
  value: number;
}

export interface OnetTaskStatement {
  taskId: number;
  statement: string;
  taskType: string;
  /** Mean task importance (IM scale, 1-5) from task_ratings when available. */
  importance?: number;
  dwaIds: string[];
}

export interface OnetOccupationSkeleton {
  onetSocCode: string;
  title: string;
  description: string;
  taskStatements: OnetTaskStatement[];
  workActivities: RatedElement[];
  workContext: WorkContextElement[];
  essentialSkills: RatedElement[];
  transferableSkills: RatedElement[];
  knowledge: RatedElement[];
  abilities: RatedElement[];
  educationProfile: {
    /** Modal required education category (1-12) or null when suppressed/missing. */
    modalCategory: number | null;
    categoryName: string | null;
  };
  trainingExperienceProfile: {
    /** Modal related work experience category (1-11) or null. */
    modalRelatedExperienceCategory: number | null;
  };
  jobZone: number | null;
  alternateTitles: string[];
  relatedOccupationCodes: string[];
  sourceVersion: string;
}

export interface OnetCorpus {
  version: string;
  transformVersion: string;
  builtAt: string;
  license: typeof ONET_LICENSE;
  occupationCount: number;
  occupations: OnetOccupationSkeleton[];
}

export interface OnetCoverageSummary {
  version: string;
  transformVersion: string;
  builtAt: string;
  occupationsLoaded: number;
  occupationsMissingTasks: number;
  occupationsMissingWorkActivities: number;
  occupationsMissingSkills: number;
  jobZoneDistribution: Record<string, number>;
  taskCountDistribution: { min: number; p25: number; median: number; p75: number; max: number };
  majorGroupCounts: Record<string, number>;
}
