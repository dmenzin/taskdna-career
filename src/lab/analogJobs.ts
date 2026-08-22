import type { JobPosting } from "@/domain/types";

function job(partial: Partial<JobPosting> & Pick<JobPosting, "canonicalId" | "title" | "description" | "responsibilities" | "requirements" | "domain">): JobPosting {
  return {
    company: "Analog Labs",
    location: "Remote - US",
    workMode: "Remote",
    compensation: "$110k-$145k",
    seniority: "Mid",
    preferredRequirements: [],
    requisitionId: partial.canonicalId,
    sourceObservationIds: [partial.canonicalId],
    canonicalizationConfidence: 0.9,
    freshnessState: "VERIFIED_LIVE",
    firstSeen: "2026-08-01T00:00:00.000Z",
    lastSeen: "2026-08-20T00:00:00.000Z",
    lastVerified: "2026-08-21T00:00:00.000Z",
    ...partial,
  };
}

// Same investigative task structure, different industries. Used only by unseen/generalization audits.
export const analogInvestigationJobs: JobPosting[] = [
  job({
    canonicalId: "analog-medical-failure",
    title: "Product Performance Engineer",
    description: "Investigate product failures with telemetry, bench tests, and corrective-action verification.",
    responsibilities: ["Analyze field failures using logs and bench experiments", "Write root-cause summaries", "Verify corrective actions"],
    requirements: ["root cause", "data analysis", "technical writing"],
    domain: "medical devices",
  }),
  job({
    canonicalId: "analog-cyber-incident",
    title: "Security Incident Analyst",
    description: "Investigate security incidents from logs, isolate mechanisms, and close the loop with containment evidence.",
    responsibilities: ["Review alerts and logs to reconstruct attack paths", "Test hypotheses about the failure mechanism", "Document verified containment"],
    requirements: ["incident response", "log analysis", "written conclusions"],
    domain: "cybersecurity",
  }),
  job({
    canonicalId: "analog-forensic-accounting",
    title: "Forensic Accounting Investigator",
    description: "Investigate financial anomalies with transaction evidence, test exceptions, and close cases with documented findings.",
    responsibilities: ["Trace exceptions across ledgers and source documents", "Test hypotheses about how the anomaly occurred", "Write evidence-backed conclusions"],
    requirements: ["audit", "excel", "investigation"],
    domain: "accounting",
  }),
  job({
    canonicalId: "analog-industrial-reliability",
    title: "Plant Reliability Investigator",
    description: "Investigate equipment failures using sensor data, inspections, and experiments that confirm the mechanism.",
    responsibilities: ["Collect sensor and inspection evidence", "Run targeted tests to isolate root cause", "Verify the fix in production"],
    requirements: ["root cause", "instrumentation", "statistics"],
    domain: "manufacturing",
  }),
  job({
    canonicalId: "analog-fraud-investigation",
    title: "Fraud Investigation Analyst",
    description: "Investigate suspected fraud using case files, data traces, and interviews, then close with a defensible finding.",
    responsibilities: ["Gather case evidence and timeline", "Test competing explanations", "Document the verified mechanism"],
    requirements: ["investigation", "data analysis", "communication"],
    domain: "finance",
  }),
];

export const analogCoordinationJobs: JobPosting[] = [
  job({
    canonicalId: "analog-product-requirements",
    title: "Systems Engineer",
    description: "Frame ambiguous requirements, run stakeholder reviews, and maintain decision records across teams.",
    responsibilities: ["Align stakeholders on tradeoffs", "Write requirements and interface notes", "Facilitate roadmap decisions"],
    requirements: ["requirements", "stakeholder communication", "systems thinking"],
    domain: "software",
  }),
  job({
    canonicalId: "analog-compliance-admin",
    title: "Design Verification Quality Engineer",
    description: "Execute predefined protocols, maintain traceability, and produce release documentation.",
    responsibilities: ["Author verification protocols", "Maintain traceability matrices", "Document deviations"],
    requirements: ["documentation", "quality systems", "validation"],
    domain: "quality",
  }),
];
