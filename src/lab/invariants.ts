import { scoringConfig } from "@/config/model";
import {
  applyFeedback,
  buildProfileFromCareerInput,
  calculateConfidenceAdjustedFit,
  calculateOverallScore,
  createDemoDataset,
  determineActionTier,
  scoreJobs,
} from "@/domain/engine";
import { analogCoordinationJobs, analogInvestigationJobs } from "@/lab/analogJobs";

export function runLogicInvariants() {
  const checks: { id: string; pass: boolean; detail: string }[] = [];
  const investigator = buildProfileFromCareerInput({
    id: "inv-a",
    careerText: "I love investigating product failures with logs, experiments, and root-cause closure. I dislike stakeholder roadmaps and ambiguous coordination.",
    explicitDislikes: ["stakeholder coordination"],
    skills: ["python", "root cause"],
  });
  const coordinator = buildProfileFromCareerInput({
    id: "coord-b",
    careerText: "I love stakeholder coordination, customer discovery, ambiguous product strategy and roadmap workshops. I dislike logs, root cause debugging and isolated investigation.",
    explicitPreferences: ["stakeholder coordination"],
    skills: ["roadmaps", "customer interviews"],
  });
  const contrastJobs = [...analogInvestigationJobs, ...analogCoordinationJobs];
  const jobsA = scoreJobs(investigator, contrastJobs);
  const jobsB = scoreJobs(coordinator, contrastJobs);
  const cyberA = jobsA.find((item) => item.job.canonicalId === "analog-cyber-incident")!;
  const cyberB = jobsB.find((item) => item.job.canonicalId === "analog-cyber-incident")!;
  const reqA = jobsA.find((item) => item.job.canonicalId === "analog-product-requirements")!;
  const reqB = jobsB.find((item) => item.job.canonicalId === "analog-product-requirements")!;
  const investigatorGap = cyberA.score.predictedFit - reqA.score.predictedFit;
  const coordinatorGap = cyberB.score.predictedFit - reqB.score.predictedFit;
  checks.push({
    id: "evidence_changes_fit",
    pass: investigatorGap > coordinatorGap + 0.45,
    detail: `investigator cyber-req gap ${investigatorGap.toFixed(2)} vs coordinator ${coordinatorGap.toFixed(2)} (cyber ${cyberA.score.predictedFit.toFixed(2)}/${cyberB.score.predictedFit.toFixed(2)})`,
  });

  const sameSkillsDifferentPref = buildProfileFromCareerInput({
    id: "same-skills-coord",
    careerText: coordinator.persona.careerText,
    skills: ["python", "root cause"],
  });
  const hireA = scoreJobs(investigator, analogInvestigationJobs)[0]!.score;
  const hireB = scoreJobs(sameSkillsDifferentPref, analogInvestigationJobs)[0]!.score;
  checks.push({
    id: "preference_capability_not_collapsed",
    pass: Math.abs(hireA.predictedFit - hireB.predictedFit) > 0.3 || Math.abs(hireA.hireability - hireB.hireability) < 2.5,
    detail: `fit ${hireA.predictedFit.toFixed(2)}/${hireB.predictedFit.toFixed(2)} hire ${hireA.hireability.toFixed(2)}/${hireB.hireability.toFixed(2)}`,
  });

  const sparse = buildProfileFromCareerInput({ id: "sparse", careerText: "Some projects. Not sure." });
  const rich = investigator;
  checks.push({
    id: "sparse_lower_confidence",
    pass: sparse.confidence < rich.confidence && sparse.confidence < 0.55,
    detail: `sparse ${sparse.confidence.toFixed(2)} rich ${rich.confidence.toFixed(2)}`,
  });

  const caf = calculateConfidenceAdjustedFit(8, 0.5);
  checks.push({
    id: "caf_formula",
    pass: Math.abs(caf - (8 - scoringConfig.confidenceAdjustedFitPenalty * 0.5)) < 1e-6,
    detail: `CAF ${caf}`,
  });

  const overall = calculateOverallScore({ hireability: 10, confidenceAdjustedFit: 0, careerDirection: 0, technicalGrowth: 0, durability: 0 });
  checks.push({
    id: "overall_hireability_weight",
    pass: Math.abs(overall - 4) < 0.05,
    detail: `overall from hireability-only ${overall.toFixed(2)}`,
  });

  checks.push({
    id: "tier_monotonic_overall",
    pass: determineActionTier({ overall: 9, hireability: 8, predictedFit: 8.5, confidence: 0.8, hardGaps: [] }) !== "LOWER_PRIORITY",
    detail: "high overall is not lower priority",
  });

  const demo = createDemoDataset();
  const scored = scoreJobs(investigator, demo.jobs.slice(0, 20));
  const again = scoreJobs(investigator, demo.jobs.slice(0, 20));
  checks.push({
    id: "determinism",
    pass: scored.map((item) => item.score.overall).join(",") === again.map((item) => item.score.overall).join(","),
    detail: "identical rerun rankings",
  });

  const feedback = applyFeedback(investigator, scored, {
    jobId: scored[0]!.job.canonicalId,
    reaction: "DISLIKE",
    reasonTags: ["too much coordination"],
  });
  checks.push({
    id: "feedback_does_not_fabricate_capability",
    pass: feedback.updatedProfile.capabilities.map((capability) => capability.name).join("|") === investigator.capabilities.map((capability) => capability.name).join("|"),
    detail: feedback.explanation,
  });

  return { passed: checks.every((check) => check.pass), checks };
}

export function spearman(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 1;
  const rank = (values: number[]) => {
    const sorted = [...values].map((value, index) => ({ value, index })).sort((left, right) => right.value - left.value);
    const ranks = Array(values.length).fill(0);
    sorted.forEach((item, rankIndex) => {
      ranks[item.index] = rankIndex;
    });
    return ranks;
  };
  const ra = rank(a.slice(0, n));
  const rb = rank(b.slice(0, n));
  const mean = (n - 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let index = 0; index < n; index += 1) {
    const xa = ra[index]! - mean;
    const xb = rb[index]! - mean;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da && db ? num / Math.sqrt(da * db) : 1;
}
