import { careerFunctions, vector } from "@/config/model";
import { emphasizeWorkStructure, readWorkStructure } from "@/domain/workStructure";
import type { FreshnessState, JobPosting, JobSourceObservation, Vector } from "@/domain/types";

const domains = [
  "medical devices",
  "robotics",
  "automation",
  "software",
  "scientific instrumentation",
  "semiconductors",
  "aerospace",
  "energy",
  "manufacturing",
  "healthcare",
  "analytics",
  "controls",
  "reliability",
  "quality",
  "product development",
];

const companies = [
  "Northstar Instruments",
  "Helio Robotics",
  "Aster Medical",
  "SignalForge",
  "Kinetic Labs",
  "VectorWell",
  "OrbitWorks",
  "Reliant Devices",
  "Mesa Automation",
  "Cobalt Analytics",
];

const locations = ["Boston, MA", "San Diego, CA", "Pittsburgh, PA", "Minneapolis, MN", "Remote - US", "Austin, TX", "Seattle, WA", "Raleigh, NC"];
const modes: JobPosting["workMode"][] = ["Remote", "Hybrid", "Onsite"];
const freshnessStates: FreshnessState[] = ["VERIFIED_LIVE", "REVERIFIED_LIVE", "PREVIOUSLY_FOUND_NOT_RECHECKED", "POSSIBLY_STALE", "CONFIRMED_CLOSED"];

const titleByFunction: Record<string, string[]> = {
  "failure-analysis": ["Failure Analysis Engineer", "Reliability Investigation Engineer", "Sustaining R&D Engineer"],
  "sensor-algorithm-performance": ["Algorithm Performance Engineer", "Sensor Data Scientist", "Perception Quality Analyst"],
  "test-development": ["Test Development Engineer", "Performance Characterization Engineer", "Instrumentation Test Engineer"],
  "systems-integration-debug": ["Systems Integration Engineer", "Field Performance Engineer", "Integration Debug Engineer"],
  "engineering-tools": ["Engineering Tools Engineer", "Data Automation Engineer", "Workflow Platform Engineer"],
  "clinical-real-world-performance": ["Clinical Algorithm Analyst", "Real-World Performance Scientist", "Digital Health Evaluation Engineer"],
  "field-applications": ["Applications Engineer", "Field Service Engineer", "Technical Solutions Engineer"],
  "robotics-field-performance": ["Robotics Field Performance Engineer", "Autonomy Test Engineer", "Robot Reliability Engineer"],
  "controls-characterization": ["Controls Characterization Engineer", "Dynamics Test Engineer", "Controls Validation Engineer"],
  "scientific-software": ["Scientific Software Engineer", "Research Software Engineer", "Computational Tools Developer"],
  "verification-validation": ["Verification Engineer", "Software Test Engineer", "Design Validation Engineer"],
  "modeling-simulation": ["Simulation Engineer", "Digital Twin Engineer", "Modeling Scientist"],
  "product-systems-engineering": ["Systems Engineer", "Product Systems Engineer", "Technical Product Manager"],
};

const responsibilitiesByFunction: Record<string, string[]> = {
  "failure-analysis": ["Analyze field failures using logs, teardown evidence, and bench experiments", "Write concise root-cause summaries and verify corrective actions", "Partner with sustaining engineering on fixes"],
  "sensor-algorithm-performance": ["Measure algorithm performance across cohorts and edge cases", "Design experiments that isolate data quality, sensor, and model issues", "Build dashboards for performance drift"],
  "test-development": ["Design test methods and fixtures for performance characterization", "Automate data capture and analysis pipelines", "Translate noisy measurements into decision-ready evidence"],
  "systems-integration-debug": ["Debug cross-layer hardware, software, sensor, and interface failures", "Use logs and targeted experiments to isolate mechanisms", "Coordinate fixes across subsystem owners"],
  "engineering-tools": ["Build tools that automate engineering data reconciliation", "Model workflow data and integrate internal systems", "Deliver usable interfaces for technical teams"],
  "clinical-real-world-performance": ["Evaluate real-world performance across workflows and populations", "Separate data quality effects from algorithm behavior", "Communicate limitations without overstating certainty"],
  "field-applications": ["Resolve escalated customer technical issues", "Collect field evidence and reproduce failures", "Teach customers and feed product patterns back to engineering"],
  "robotics-field-performance": ["Analyze robot behavior in field runs using logs and sensor data", "Design autonomy experiments and failure reviews", "Partner with embedded, controls, and operations teams"],
  "controls-characterization": ["Characterize dynamic behavior from test data", "Tune and validate controller performance", "Connect models to measured system behavior"],
  "scientific-software": ["Build analysis software for scientific workflows", "Make instrument data reproducible and explainable", "Create visualization and simulation utilities"],
  "verification-validation": ["Execute and author verification protocols", "Maintain requirements traceability and release evidence", "Document deviations and validation conclusions"],
  "modeling-simulation": ["Create simulations and digital twins for system behavior", "Calibrate models using available data", "Explore tradeoffs before hardware tests are available"],
  "product-systems-engineering": ["Frame ambiguous requirements and cross-functional tradeoffs", "Translate customer needs into system direction", "Manage interfaces, risks, and decision records"],
};

const requirementPool = {
  software: ["Python", "TypeScript", "SQL", "API integration"],
  robotics: ["C++", "ROS", "robotics logs", "controls basics"],
  regulated: ["medical device documentation", "ISO 13485", "validation protocols"],
  analysis: ["statistics", "data visualization", "root-cause analysis", "experiment design"],
  field: ["customer communication", "travel readiness", "onsite troubleshooting"],
  systems: ["systems thinking", "interfaces", "test planning", "technical writing"],
};

export function createJobSourceObservations(count = 180): JobSourceObservation[] {
  return Array.from({ length: count }, (_, index) => {
    const fn = careerFunctions[index % careerFunctions.length];
    const title = titleByFunction[fn.id][index % titleByFunction[fn.id].length];
    const company = companies[index % companies.length];
    const domain = domains[index % domains.length];
    return {
      id: `raw-${String(index + 1).padStart(3, "0")}`,
      provider: "SyntheticJobProvider",
      externalId: `demo-${domain.replaceAll(" ", "-")}-${index % 120}`,
      companyRaw: company,
      titleRaw: title,
      locationRaw: locations[index % locations.length],
      urlRaw: `https://example.invalid/jobs/${index + 1}`,
      descriptionRaw: `${title} at ${company}: ${responsibilitiesByFunction[fn.id].join("; ")}. Domain: ${domain}. Synthetic demo data.`,
      observedAt: new Date(Date.UTC(2026, 7, 1 + (index % 20))).toISOString(),
    };
  });
}

export function createSyntheticJobs(count = 120): JobPosting[] {
  const deliberate: Partial<JobPosting>[] = [
    {
      canonicalId: "job-title-bias-systems-debug",
      title: "Systems Engineer",
      description: "Logs, integration troubleshooting, targeted experiments, and root-cause closure for connected devices.",
      responsibilities: responsibilitiesByFunction["systems-integration-debug"],
      requirements: ["Python", "systems thinking", "test planning", "root-cause analysis"],
      domain: "medical devices",
    },
    {
      canonicalId: "job-title-bias-systems-mbse",
      title: "Systems Engineer",
      description: "Requirements hierarchy, MBSE/SysML traceability, stakeholder reviews, and documentation-heavy compliance evidence.",
      responsibilities: ["Maintain requirements hierarchy", "Run stakeholder reviews", "Own traceability matrices"],
      requirements: ["SysML", "requirements management", "documentation", "stakeholder communication"],
      domain: "aerospace",
    },
    {
      canonicalId: "job-diff-title-same-fa-1",
      title: "Product Performance Engineer",
      description: "Investigate product failures with telemetry, bench tests, and corrective-action verification.",
      responsibilities: responsibilitiesByFunction["failure-analysis"],
      requirements: ["Python", "root-cause analysis", "statistics", "technical writing"],
      domain: "reliability",
    },
    {
      canonicalId: "job-diff-title-same-fa-2",
      title: "Reliability Investigation Engineer",
      description: "Investigate field failures using evidence, experiments, and sustaining R&D fixes.",
      responsibilities: responsibilitiesByFunction["failure-analysis"],
      requirements: ["Python", "root-cause analysis", "test design", "technical writing"],
      domain: "medical devices",
    },
    {
      canonicalId: "job-high-fit-low-hireability-robotics",
      title: "Autonomy Field Performance Engineer",
      description: "Analyze robot behavior in real environments, but requires production C++, ROS, and embedded debugging.",
      responsibilities: responsibilitiesByFunction["robotics-field-performance"],
      requirements: ["C++", "ROS", "embedded systems", "controls basics"],
      domain: "robotics",
    },
    {
      canonicalId: "job-high-hire-low-fit-compliance",
      title: "Design Verification Quality Engineer",
      description: "Documentation-heavy validation, traceability, QMS records, and routine protocol execution.",
      responsibilities: responsibilitiesByFunction["verification-validation"],
      requirements: ["quality systems", "validation protocols", "documentation", "requirements"],
      domain: "quality",
    },
  ];

  const generated = Array.from({ length: count - deliberate.length }, (_, index): JobPosting => {
    const fn = careerFunctions[index % careerFunctions.length];
    const title = titleByFunction[fn.id][index % titleByFunction[fn.id].length];
    const domain = domains[(index * 3) % domains.length];
    const needs = [
      ...requirementPool.analysis.slice(0, 2 + (index % 2)),
      ...(fn.id.includes("robotics") ? requirementPool.robotics.slice(0, 2 + (index % 2)) : []),
      ...(fn.id.includes("software") || fn.id.includes("tools") ? requirementPool.software.slice(0, 2) : []),
      ...(domain.includes("medical") || domain.includes("quality") ? requirementPool.regulated.slice(0, 1 + (index % 2)) : []),
      ...(fn.id.includes("field") ? requirementPool.field.slice(0, 2) : []),
      ...requirementPool.systems.slice(0, 1),
    ];
    return {
      canonicalId: `job-${String(index + 1).padStart(3, "0")}`,
      company: companies[(index * 7) % companies.length],
      title,
      location: locations[(index * 5) % locations.length],
      workMode: modes[index % modes.length],
      compensation: `$${95 + (index % 7) * 10}k-${130 + (index % 8) * 12}k`,
      seniority: index % 17 === 0 ? "Staff" : index % 13 === 0 ? "Senior" : index % 19 === 0 ? "Manager" : "Mid",
      description: `${title} focused on ${fn.oneSentenceTaskLoop.toLowerCase()} This is synthetic demo data, not a live posting.`,
      responsibilities: responsibilitiesByFunction[fn.id],
      requirements: Array.from(new Set(needs)),
      preferredRequirements: fn.commonSkillGaps,
      domain,
      requisitionId: `REQ-${String(1000 + index)}`,
      sourceObservationIds: [`raw-${String((index % 180) + 1).padStart(3, "0")}`, `raw-${String(((index + 60) % 180) + 1).padStart(3, "0")}`],
      canonicalizationConfidence: 0.82 + (index % 12) / 100,
      freshnessState: freshnessStates[index % freshnessStates.length],
      firstSeen: "2026-08-01T00:00:00.000Z",
      lastSeen: new Date(Date.UTC(2026, 7, 5 + (index % 15))).toISOString(),
      lastVerified: new Date(Date.UTC(2026, 7, 10 + (index % 10))).toISOString(),
    };
  });

  return [
    ...deliberate.map((job, index) => ({
      company: companies[index],
      location: locations[index],
      workMode: modes[index % modes.length],
      compensation: `$${110 + index * 5}k-${155 + index * 6}k`,
      seniority: index === 4 ? "Senior" : "Mid",
      preferredRequirements: [],
      requisitionId: `REQ-SPECIAL-${index + 1}`,
      sourceObservationIds: [`raw-${String(index + 1).padStart(3, "0")}`],
      canonicalizationConfidence: 0.94,
      freshnessState: freshnessStates[index % freshnessStates.length],
      firstSeen: "2026-08-01T00:00:00.000Z",
      lastSeen: "2026-08-20T00:00:00.000Z",
      lastVerified: "2026-08-21T00:00:00.000Z",
      ...job,
    })) as JobPosting[],
    ...generated,
  ];
}

// Task-content-first function matching: titles are only a last-resort signal so
// title/keyword leakage cannot dominate actual-work interpretation.
export function matchFunctionByTasks(job: Pick<JobPosting, "title" | "description" | "responsibilities" | "requirements">) {
  const taskText = `${job.description} ${job.responsibilities.join(" ")} ${job.requirements.join(" ")}`.toLowerCase();
  if (taskText.includes("mbse") || taskText.includes("traceability") || taskText.includes("qms")) {
    return { functionId: "documentation-heavy-systems", source: "task-content" as const };
  }
  const byResponsibilities = careerFunctions
    .map((fn) => ({ fn, overlap: job.responsibilities.filter((responsibility) => responsibilitiesByFunction[fn.id]?.includes(responsibility)).length }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)[0];
  if (byResponsibilities) return { functionId: byResponsibilities.fn.id, source: "task-content" as const };
  if (taskText.includes("integration troubleshooting") || taskText.includes("cross-layer") || (taskText.includes("logs") && taskText.includes("root-cause"))) {
    return { functionId: "systems-integration-debug", source: "task-content" as const };
  }
  if (taskText.includes("product failures") || taskText.includes("field failures") || taskText.includes("failure analysis")) {
    return { functionId: "failure-analysis", source: "task-content" as const };
  }
  const byTaskLoop = careerFunctions.find((fn) => taskText.includes(fn.oneSentenceTaskLoop.toLowerCase().slice(0, 42)));
  if (byTaskLoop) return { functionId: byTaskLoop.id, source: "task-content" as const };
  const titleText = job.title.toLowerCase();
  const byTitle =
    careerFunctions.find((fn) => titleByFunction[fn.id]?.some((title) => titleText.includes(title.toLowerCase()))) ??
    careerFunctions.find((fn) => fn.typicalTitles.some((title) => titleText.includes(title.toLowerCase())));
  if (byTitle) return { functionId: byTitle.id, source: "title-fallback" as const };
  return { functionId: null, source: "none" as const };
}

function jobText(job: Pick<JobPosting, "title" | "description" | "responsibilities" | "requirements">) {
  return `${job.description} ${job.responsibilities.join(" ")} ${job.requirements.join(" ")}`;
}

export function inferJobVector(job: JobPosting): Vector {
  const match = matchFunctionByTasks(job);
  if (match.functionId === "documentation-heavy-systems") {
    return vector({ problem_structure: 8.8, repetition_tolerance: 8.9, coordination_preference: 8.2, investigation_orientation: 4.1, experimentation_preference: 3.8, closure_preference: 8.4 });
  }
  // Title fallback must not mint a TaskDNA vector. Demo fixtures match by task
  // content; generic/O*NET jobs are read from their own work language.
  if (match.source === "task-content") {
    const matched = careerFunctions.find((fn) => fn.id === match.functionId);
    if (matched) return matched.taskDnaVector;
  }
  const reading = readWorkStructure(jobText(job));
  return reading.dimensionsCovered >= 3 ? emphasizeWorkStructure(reading.vector) : vector({});
}

/** 0..1 share of TaskDNA dimensions the job's own language supports. */
export function jobStructureCoverage(job: JobPosting): { coverage: number; dimensionsCovered: number; fixtureMatched: boolean } {
  const match = matchFunctionByTasks(job);
  if (match.source === "task-content" && match.functionId) return { coverage: 1, dimensionsCovered: 17, fixtureMatched: true };
  const reading = readWorkStructure(jobText(job));
  return { coverage: reading.coverage, dimensionsCovered: reading.dimensionsCovered, fixtureMatched: false };
}
