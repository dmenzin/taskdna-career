import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoringConfig } from "@/config/model";
import { buildProfileFromCareerInput, createDemoDataset, scoreJobs } from "@/domain/engine";
import { analogInvestigationJobs } from "@/lab/analogJobs";
import { evaluateSubject, evaluateTwins, evaluateZeroOrigin, observationsToProfile } from "@/lab/evaluate";
import { DEFAULT_SUBJECT_SEED, generateTwins, generateVirtualSubjects, LAB_VERSION, SUBJECT_COUNT } from "@/lab/generate";
import { runLogicInvariants, spearman } from "@/lab/invariants";
import { scanPersonalizationLeakage } from "@/lab/leakage";
import { OCCUPATION_SOURCE, families } from "@/lab/occupations";
import { inventoryParameters } from "@/lab/parameters";
import type { OccupationalFamily, SubjectCohort, VirtualSubject } from "@/lab/types";

export interface AuditOptions {
  seed?: number;
  outDir?: string;
  modes?: string[];
}

export function runLogicAudit(options: AuditOptions = {}) {
  const seed = options.seed ?? DEFAULT_SUBJECT_SEED;
  const outDir = options.outDir ?? join(process.cwd(), "artifacts/logic_audit");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "failures"), { recursive: true });

  const subjects = generateVirtualSubjects(seed, SUBJECT_COUNT);
  const twins = generateTwins(subjects, seed);
  const invariants = runLogicInvariants();
  const leakage = scanPersonalizationLeakage();
  const subjectEvals = subjects.map(evaluateSubject);
  const twinEvals = evaluateTwins(twins);
  const zeroOrigin = evaluateZeroOrigin(subjects);
  const domainHoldout = evaluateDomainHoldout(subjects);
  const sensitivity = runSensitivity();
  const stability = runStability();
  const parameters = inventoryParameters();
  const unseen = runUnseen(subjects);

  const propertyPassRate = rate(subjectEvals.flatMap((item) => item.propertyResults));
  const twinPassRate = rate(twinEvals);
  const holdoutPassRate = rate(subjectEvals.filter((item) => item.cohort === "holdout").flatMap((item) => item.propertyResults));
  const oodPassRate = rate(subjectEvals.filter((item) => item.cohort === "adversarial").flatMap((item) => item.propertyResults));

  const failures = [
    ...invariants.checks.filter((check) => !check.pass).map((check) => ({ id: check.id, expected: "pass", observed: check.detail, rootCause: "logic invariant failed" })),
    ...twinEvals.filter((item) => !item.pass).slice(0, 12).map((item) => ({ id: item.id, expected: item.kind, observed: item.detail, rootCause: "twin metamorphic failure" })),
    ...zeroOrigin.filter((item) => !item.pass).map((item) => ({ id: item.id, expected: "generic engine initializes", observed: item.detail, rootCause: "zero-origin gap" })),
  ];
  failures.forEach((failure) => {
    writeFileSync(join(outDir, "failures", `${failure.id.replaceAll("/", "-")}.json`), JSON.stringify({ ...failure, fixVersion: LAB_VERSION }, null, 2));
  });

  const meanMae = mean(subjectEvals.map((item) => item.taskDnaMae));
  const scorecard = buildScorecard({
    invariants,
    leakage,
    propertyPassRate,
    twinPassRate,
    holdoutPassRate,
    oodPassRate,
    zeroOrigin,
    domainHoldout,
    stability,
    sensitivity,
    meanMae,
  });

  const latest = {
    generatedAt: new Date().toISOString(),
    seed,
    labVersion: LAB_VERSION,
    occupationSource: OCCUPATION_SOURCE,
    counts: countCohorts(subjects),
    occupationFamilies: families,
    invariants,
    leakage: { mustFix: leakage.mustFix, hits: leakage.hits.slice(0, 40) },
    subjects: {
      count: subjects.length,
      meanMae,
      propertyPassRate,
      byCohort: Object.fromEntries((["design", "validation", "holdout", "adversarial"] as SubjectCohort[]).map((cohort) => [cohort, rate(subjectEvals.filter((item) => item.cohort === cohort).flatMap((item) => item.propertyResults))])),
    },
    twins: { count: twinEvals.length, passRate: twinPassRate, sample: twinEvals.slice(0, 12) },
    zeroOrigin: { passRate: rate(zeroOrigin), cases: zeroOrigin },
    domainHoldout,
    unseen,
    sensitivity,
    stability,
    parameters: { count: parameters.count, version: parameters.version },
    scorecard,
    failures: failures.slice(0, 20),
  };

  writeFileSync(join(outDir, "latest.json"), JSON.stringify(latest, null, 2));
  writeFileSync(join(outDir, "latest.md"), renderLatestMarkdown(latest));
  writeFileSync(join(outDir, "sensitivity.json"), JSON.stringify(sensitivity, null, 2));
  writeFileSync(join(outDir, "stability.json"), JSON.stringify(stability, null, 2));
  writeFileSync(join(outDir, "parameters.json"), JSON.stringify(parameters, null, 2));
  writeFileSync(join(outDir, "generalization.json"), JSON.stringify({
    propertyPassRate,
    twinPassRate,
    holdoutPassRate,
    oodPassRate,
    titleRemoval: twinEvals.filter((item) => item.kind === "title_removed"),
    networkInvariance: twinEvals.filter((item) => item.kind === "same_user_different_network"),
    leakageCount: leakage.mustFix,
    domainHoldout,
  }, null, 2));
  writeFileSync(join(outDir, "subjects-manifest.json"), JSON.stringify({
    version: LAB_VERSION,
    seed,
    generatedAt: latest.generatedAt,
    occupationSource: OCCUPATION_SOURCE,
    counts: latest.counts,
    occupationFamilies: families,
  }, null, 2));

  const passed = invariants.passed && leakage.mustFix === 0 && rate(zeroOrigin) >= 0.95 && propertyPassRate >= 0.7 && twinPassRate >= 0.7;
  return { passed, outDir, latest, subjects, twins };
}

export function inspectSubject(subjectId: string, seed = DEFAULT_SUBJECT_SEED) {
  const subject = generateVirtualSubjects(seed, SUBJECT_COUNT).find((item) => item.truth.subjectId === subjectId);
  if (!subject) throw new Error(`Unknown subject ${subjectId}`);
  return { subject, evaluation: evaluateSubject(subject), profile: observationsToProfile(subject) };
}

function evaluateDomainHoldout(subjects: VirtualSubject[]) {
  const holdFamilies: OccupationalFamily[] = ["finance", "sales", "operations_supply", "ux_design", "software_it", "engineering_hardware"];
  return holdFamilies.map((family) => {
    const slice = subjects.filter((subject) => subject.truth.occupationalSkeleton.family === family && (subject.truth.cohort === "holdout" || subject.truth.cohort === "validation"));
    const evals = slice.map(evaluateSubject);
    return { family, n: slice.length, passRate: rate(evals.flatMap((item) => item.propertyResults)), meanMae: mean(evals.map((item) => item.taskDnaMae)) };
  });
}

function runUnseen(subjects: VirtualSubject[]) {
  const unseen = subjects.filter((subject) => subject.truth.cohort === "holdout" || subject.truth.cohort === "adversarial").slice(0, 24);
  const evals = unseen.map(evaluateSubject);
  return {
    n: unseen.length,
    passRate: rate(evals.flatMap((item) => item.propertyResults)),
    meanMae: mean(evals.map((item) => item.taskDnaMae)),
    cases: evals.slice(0, 8),
  };
}

function runSensitivity() {
  const base = buildProfileFromCareerInput({
    id: "sens",
    careerText: "I investigate failures with logs and experiments and dislike coordination-heavy roadmaps.",
    skills: ["python", "root cause"],
  });
  const jobs = createDemoDataset().jobs.slice(0, 30);
  const baseline = scoreJobs(base, jobs).map((item) => item.job.canonicalId);
  const dimensions = ["investigation_orientation", "coordination_preference"] as const;
  const results = dimensions.map((dimension) => {
    const bumped = {
      ...base,
      taskDna: base.taskDna.map((item) => item.dimensionId === dimension ? { ...item, value: Math.min(10, item.value + 2) } : item),
    };
    const next = scoreJobs(bumped, jobs).map((item) => item.job.canonicalId);
    const moved = baseline.filter((id, index) => next[index] !== id).length;
    return { dimension, topMoved: moved, spearman: spearman(baseline.map((id) => baseline.indexOf(id)), next.map((id) => baseline.indexOf(id))) };
  });
  return { scoringVersion: scoringConfig.version, results };
}

function runStability() {
  const profile = buildProfileFromCareerInput({
    id: "stab",
    careerText: "Built tools in Python, investigated data quality issues, and disliked rote documentation.",
    skills: ["python", "data analysis"],
  });
  const jobs = [...analogInvestigationJobs, ...createDemoDataset().jobs.slice(0, 20)];
  const a = scoreJobs(profile, jobs);
  const noisy = {
    ...profile,
    taskDna: profile.taskDna.map((dimension, index) => ({ ...dimension, value: Math.min(10, Math.max(0, dimension.value + (index % 2 === 0 ? 0.05 : -0.05))) })),
  };
  const b = scoreJobs(noisy, jobs);
  const rho = spearman(a.map((item) => item.score.overall), b.map((item) => item.score.overall));
  const topChanged = a.slice(0, 5).filter((item, index) => item.job.canonicalId !== b[index]?.job.canonicalId).length;
  return { spearman: rho, top5Changed: topChanged, stable: rho >= 0.85 };
}

function buildScorecard(input: {
  invariants: ReturnType<typeof runLogicInvariants>;
  leakage: ReturnType<typeof scanPersonalizationLeakage>;
  propertyPassRate: number;
  twinPassRate: number;
  holdoutPassRate: number;
  oodPassRate: number;
  zeroOrigin: { pass: boolean }[];
  domainHoldout: { passRate: number }[];
  stability: { spearman: number };
  sensitivity: { results: { topMoved: number }[] };
  meanMae: number;
}) {
  const recoveryScore = input.meanMae <= 1 ? 0.95 : input.meanMae <= 1.4 ? 0.82 : input.meanMae <= 1.8 ? 0.7 : input.meanMae <= 2.2 ? 0.55 : 0.35;
  const grades = {
    evidenceDependence: grade(input.invariants.checks.find((check) => check.id === "evidence_changes_fit")?.pass ? 1 : 0),
    preferenceCapabilityIndependence: grade(input.invariants.checks.find((check) => check.id === "preference_capability_not_collapsed")?.pass ? 1 : 0.4),
    confidenceHonesty: grade(input.invariants.checks.find((check) => check.id === "sparse_lower_confidence")?.pass ? 0.9 : 0.3),
    determinism: grade(input.invariants.checks.find((check) => check.id === "determinism")?.pass ? 1 : 0),
    personalizationLeakage: grade(input.leakage.mustFix === 0 ? 0.95 : 0.2),
    generalizationHoldout: grade(input.holdoutPassRate),
    counterfactualTwins: grade(input.twinPassRate),
    zeroOrigin: grade(rate(input.zeroOrigin)),
    domainHoldout: grade(mean(input.domainHoldout.map((item) => item.passRate))),
    rankStability: grade(input.stability.spearman),
    hiddenTruthRecovery: grade(recoveryScore),
    overallTrust: "C" as string,
  };
  const numeric = [
    input.propertyPassRate,
    input.twinPassRate,
    input.holdoutPassRate,
    rate(input.zeroOrigin),
    input.stability.spearman,
    input.leakage.mustFix === 0 ? 1 : 0.3,
    recoveryScore,
  ];
  // Internal invariants can be strong while hidden-truth recovery stays coarse.
  // Do not let property-pass rates mint an A for career-truth claims.
  const raw = grade(mean(numeric));
  grades.overallTrust = recoveryScore < 0.65 && raw === "A" ? "B" : raw;
  return {
    grades,
    recommendation: "Sandbox-coherent, not production-calibrated. Rankings are inspectable hypotheses. Hidden Task DNA is only coarsely recovered from messy evidence (MAE ~2/10).",
    remainingArbitrary: [
      "Overall weights are product judgments, not learned.",
      "Social-cost and ask-readiness numbers are uncalibrated.",
      "Confidence is a heuristic, not a probability.",
      "Function ontology is still richer for technical work than for other knowledge work.",
    ],
  };
}

function renderLatestMarkdown(latest: ReturnType<typeof runLogicAudit>["latest"]) {
  return `# Logic audit results

Generated: ${latest.generatedAt}
Lab version: ${latest.labVersion}
Seed: ${latest.seed}

## Scorecard

${Object.entries(latest.scorecard.grades).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

Recommendation: ${latest.scorecard.recommendation}

## Pipeline checks

- Invariants: ${latest.invariants.passed ? "PASS" : "FAIL"} (${latest.invariants.checks.filter((check) => check.pass).length}/${latest.invariants.checks.length})
- Personalization must-fix leaks: ${latest.leakage.mustFix}
- Subject property pass rate: ${(latest.subjects.propertyPassRate * 100).toFixed(1)}%
- Twin pass rate: ${(latest.twins.passRate * 100).toFixed(1)}%
- Zero-origin pass rate: ${(latest.zeroOrigin.passRate * 100).toFixed(1)}%
- Holdout property pass rate: ${(latest.subjects.byCohort.holdout * 100).toFixed(1)}%
- Adversarial/OOD pass rate: ${(latest.subjects.byCohort.adversarial * 100).toFixed(1)}%
- Rank stability Spearman: ${latest.stability.spearman.toFixed(3)}

## What this does and does not prove

This audit can falsify fixture-only reasoning, title collapse, preference/capability collapse, and network contamination of Work Fit.
It cannot prove real labor-market usefulness, psychometric validity, or calibrated probabilities.
`;
}

function countCohorts(subjects: VirtualSubject[]) {
  return {
    design: subjects.filter((subject) => subject.truth.cohort === "design").length,
    validation: subjects.filter((subject) => subject.truth.cohort === "validation").length,
    holdout: subjects.filter((subject) => subject.truth.cohort === "holdout").length,
    adversarial: subjects.filter((subject) => subject.truth.cohort === "adversarial").length,
  };
}

function rate(items: { pass: boolean }[]) {
  return items.length ? items.filter((item) => item.pass).length / items.length : 0;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function grade(value: number) {
  if (value >= 0.9) return "A";
  if (value >= 0.8) return "B";
  if (value >= 0.65) return "C";
  if (value >= 0.5) return "D";
  return "F";
}
