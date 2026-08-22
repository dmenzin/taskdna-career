// Stratification of O*NET occupations into materially different work-structure domains.
// Strata describe where the occupation sits in the labor market, NOT what a person prefers.
import type { OnetOccupationSkeleton } from "@/onet/types";

export const ONET_STRATA = [
  "engineering",
  "manufacturing_technical_operations",
  "software",
  "cybersecurity",
  "data_analytics",
  "science_research",
  "healthcare_professional",
  "healthcare_operations",
  "finance",
  "accounting_audit",
  "insurance_risk",
  "consulting",
  "product",
  "project_program",
  "operations",
  "supply_chain",
  "procurement",
  "sales",
  "business_development",
  "customer_success",
  "marketing",
  "communications",
  "hr",
  "recruiting",
  "learning_education",
  "ux_design",
  "research",
  "legal",
  "compliance",
  "policy",
  "public_administration",
  "field_technical",
  "other",
] as const;

export type OnetStratum = (typeof ONET_STRATA)[number];

interface StratumRule {
  stratum: OnetStratum;
  codes?: string[];
  prefixes?: string[];
  titlePattern?: RegExp;
}

// Specific-code and title rules run before broad SOC-prefix rules.
const RULES: StratumRule[] = [
  { stratum: "cybersecurity", codes: ["15-1212.00", "15-1299.05", "15-1299.04", "33-3021.06"], titlePattern: /security analyst|penetration|information security|digital forensics/i },
  { stratum: "data_analytics", codes: ["15-2051.00", "15-2041.00", "15-2051.01", "15-2051.02", "13-1161.01"], titlePattern: /data scientist|statistician|business intelligence/i },
  { stratum: "software", prefixes: ["15-125", "15-124", "15-113"], titlePattern: /software|web developer|database|programmer/i },
  { stratum: "ux_design", codes: ["15-1255.00", "15-1255.01", "27-1021.00", "27-1024.00", "27-1025.00"], titlePattern: /interface designer|graphic designer|industrial designer/i },
  { stratum: "recruiting", titlePattern: /recruiter|talent acquisition/i },
  { stratum: "hr", prefixes: ["13-107", "11-312", "13-114"], titlePattern: /human resources|compensation|benefits/i },
  { stratum: "compliance", codes: ["13-1041.00", "13-1041.01", "13-1041.03", "13-1041.06", "13-1041.07", "13-1041.08", "29-9012.00"], titlePattern: /compliance/i },
  { stratum: "policy", titlePattern: /policy|urban and regional planner|legislat/i, codes: ["19-3051.00"] },
  { stratum: "legal", prefixes: ["23-"], titlePattern: /lawyer|paralegal|judge|title examiner/i },
  { stratum: "insurance_risk", codes: ["13-2054.00", "15-2011.00", "13-1031.00", "13-1032.00", "13-2053.00", "41-3021.00"], titlePattern: /actuar|insurance|claims adjuster|risk manage/i },
  { stratum: "accounting_audit", prefixes: ["13-201", "43-3031"], titlePattern: /accountant|auditor|bookkeep|tax preparer/i },
  { stratum: "finance", prefixes: ["13-205", "13-207", "11-303"], titlePattern: /financial|treasurer|budget analyst|credit analyst|investment/i },
  { stratum: "consulting", codes: ["13-1111.00"], titlePattern: /management analyst/i },
  { stratum: "product", codes: ["11-2021.00", "13-1161.00"], titlePattern: /product manager/i },
  { stratum: "project_program", codes: ["13-1082.00", "11-9199.09", "15-1299.09"], titlePattern: /project management|program manag/i },
  { stratum: "supply_chain", codes: ["13-1081.00", "13-1081.01", "13-1081.02", "11-3071.00", "11-3071.04"], titlePattern: /logistic|supply chain|distribution manager/i },
  { stratum: "procurement", prefixes: ["13-102"], codes: ["11-3061.00"], titlePattern: /purchasing|buyer|procurement/i },
  { stratum: "business_development", codes: ["41-9031.00", "13-1199.99"], titlePattern: /business development|fundrais/i },
  { stratum: "sales", prefixes: ["41-3", "41-4", "41-9"], codes: ["11-2022.00"], titlePattern: /sales/i },
  { stratum: "customer_success", prefixes: ["43-405"], titlePattern: /customer service|customer success/i },
  { stratum: "marketing", codes: ["11-2011.00", "13-1161.00", "11-2021.00"], titlePattern: /marketing|market research|advertising|promotions/i },
  { stratum: "communications", prefixes: ["27-303", "27-309"], codes: ["11-2032.00", "27-3031.00", "27-3042.00", "27-3043.00"], titlePattern: /public relations|editor|writer|communications|technical writer/i },
  { stratum: "learning_education", prefixes: ["25-"], codes: ["11-9032.00", "11-9033.00", "13-1151.00"], titlePattern: /teacher|instruct|training and development|curriculum/i },
  { stratum: "healthcare_operations", codes: ["11-9111.00", "29-2072.00", "43-6013.00", "29-9021.00"], titlePattern: /health services manager|health information|medical records/i },
  { stratum: "healthcare_professional", prefixes: ["29-1", "29-2", "31-"], titlePattern: /nurse|physician|therapist|pharmacist|dietitian/i },
  { stratum: "science_research", prefixes: ["19-1", "19-2"], titlePattern: /scientist|chemist|biologist|physicist|geoscientist/i },
  { stratum: "research", prefixes: ["19-3"], titlePattern: /sociologist|economist|psychologist|historian|anthropolog/i },
  { stratum: "public_administration", prefixes: ["11-1031", "13-2081", "21-2", "33-3051", "43-4031", "43-4061"], titlePattern: /government|tax examiner|court|municipal|urban planner|eligibility interviewer/i },
  { stratum: "field_technical", prefixes: ["49-2", "49-3", "49-9", "17-302"], titlePattern: /repairer|installer|technician.*field|maintenance/i },
  { stratum: "manufacturing_technical_operations", prefixes: ["17-3", "51-", "11-305"], titlePattern: /production|manufacturing|industrial engineering technolog|quality control/i },
  { stratum: "engineering", prefixes: ["17-1", "17-2"], titlePattern: /engineer/i },
  { stratum: "operations", prefixes: ["11-", "13-1"], titlePattern: /operations|administrative services|facilities|management/i },
];

export function stratumFor(occupation: Pick<OnetOccupationSkeleton, "onetSocCode" | "title">): OnetStratum {
  for (const rule of RULES) {
    if (rule.codes?.includes(occupation.onetSocCode)) return rule.stratum;
  }
  for (const rule of RULES) {
    if (rule.prefixes?.some((prefix) => occupation.onetSocCode.startsWith(prefix))) return rule.stratum;
  }
  for (const rule of RULES) {
    if (rule.titlePattern?.test(occupation.title)) return rule.stratum;
  }
  return "other";
}

/**
 * Product scope: US skilled knowledge work. Job zones 3-5 cover occupations
 * needing medium-to-extensive preparation; zone filtering is scope, not preference.
 */
export function isKnowledgeWorkScope(occupation: Pick<OnetOccupationSkeleton, "jobZone">): boolean {
  return occupation.jobZone !== null && occupation.jobZone >= 3;
}
