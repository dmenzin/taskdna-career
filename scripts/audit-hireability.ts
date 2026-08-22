import { mkdirSync, writeFileSync } from "node:fs";
import { buildProfileFromCareerInput, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { buildRequirementMatrix } from "../src/domain/hireability";

const dataset = createDemoDataset();
const robotics = dataset.jobs.find((job) => job.canonicalId === "job-high-fit-low-hireability-robotics")!;
const compliance = dataset.jobs.find((job) => job.canonicalId === "job-high-hire-low-fit-compliance")!;

const cases = [
  {
    id: "high-fit-low-hireability",
    profile: buildProfileFromCareerInput({ id: "a", careerText: "I enjoy robot field logs and experiments. Professional Python only.", skills: ["python"] }),
    job: robotics,
  },
  {
    id: "low-fit-high-hireability",
    profile: buildProfileFromCareerInput({ id: "b", careerText: "Owned CAPA, validation, and quality systems packages. I dislike compliance administration.", skills: ["quality systems", "validation", "documentation"] }),
    job: compliance,
  },
  {
    id: "direct-professional",
    profile: buildProfileFromCareerInput({ id: "c", careerText: "Delivered Python analysis in production for years.", skills: ["python"] }),
    job: { ...robotics, canonicalId: "py", requirements: ["Python"], preferredRequirements: [] },
  },
  {
    id: "academic-only",
    profile: buildProfileFromCareerInput({ id: "d", careerText: "Coursework in Python and no professional experience yet.", skills: ["python"] }),
    job: { ...robotics, canonicalId: "py2", requirements: ["Python"], preferredRequirements: [] },
  },
  {
    id: "license-gap",
    profile: buildProfileFromCareerInput({ id: "e", careerText: "Clinical coursework only.", skills: ["clinical workflow"] }),
    job: { ...compliance, canonicalId: "rn", requirements: ["RN license"], preferredRequirements: [] },
  },
  {
    id: "optional-tool-gap",
    profile: buildProfileFromCareerInput({ id: "f", careerText: "Excel forecasts delivered to finance partners.", skills: ["excel"] }),
    job: { ...compliance, canonicalId: "opt", requirements: ["excel"], preferredRequirements: ["tableau"] },
  },
  {
    id: "career-changer",
    profile: buildProfileFromCareerInput({ id: "g", careerText: "Delivered Python analysis in finance for five years. Now targeting robotics field logs. No ROS.", skills: ["python", "statistics"] }),
    job: robotics,
  },
  {
    id: "seniority-mismatch",
    profile: buildProfileFromCareerInput({ id: "h", careerText: "Two years of Excel analysis. I enjoy building forecasts.", skills: ["excel"] }),
    job: { ...compliance, canonicalId: "staff", title: "Staff Quality Engineer", seniority: "Staff" as const, requirements: ["excel", "quality systems"], preferredRequirements: [] },
  },
  {
    id: "same-title-different-requirements",
    profile: buildProfileFromCareerInput({ id: "i", careerText: "Professional Python and statistics. No C++.", skills: ["python", "statistics"] }),
    job: { ...robotics, canonicalId: "same-title-soft", title: robotics.title, requirements: ["Python", "statistics"], preferredRequirements: [] },
  },
  {
    id: "keyword-stuffed-resume",
    profile: buildProfileFromCareerInput({ id: "j", careerText: "Keywords: C++ ROS embedded systems SysML ISO 13485. I have no professional C++.", skills: ["python"] }),
    job: robotics,
  },
];

const results = cases.map((item) => {
  const scored = scoreJobs(item.profile, [item.job])[0]!;
  const matrix = buildRequirementMatrix(item.profile, item.job);
  return {
    id: item.id,
    fit: scored.score.predictedFit,
    hireability: scored.score.hireability,
    hardDisqualifiers: matrix.hardDisqualifiers,
    coreCoverage: matrix.coreCoverage,
    professionalShare: matrix.professionalShare,
    trace: matrix.trace,
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  stillMostlyLexical: false,
  notes: "Hireability now uses a requirement-evidence matrix with gap classes. Residual weakness: recency/duration are still coarse heuristics.",
  results,
};

mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync("artifacts/logic_audit/hireability.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ cases: results.map((item) => ({ id: item.id, fit: item.fit, hireability: item.hireability, fatal: item.hardDisqualifiers.length })) }, null, 2));
