// PHASE A — EXTERNAL SHOCK: run the CURRENT engine, unchanged, against the real
// O*NET-backed Virtual Subject Lab and record how it fails.
//
// The first successful run freezes artifacts/logic_audit/onet_external_shock_baseline.json.
// The baseline is NEVER overwritten; later runs write onet_shock_latest.json for comparison.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoringConfig } from "../src/config/model";
import { evaluateTwins } from "../src/lab/evaluate";
import { runLogicInvariants } from "../src/lab/invariants";
import { COHORT_SIZES, ONET_LAB_SEED, ONET_LAB_VERSION, generateObservationVariants, generateOnetSubjects, generateOnetTwins } from "../src/lab/onetLab";
import { aggregate, evaluateOnetSubject, evaluateRankStability, evaluateStrategySample, sharedEvalJobs } from "../src/lab/onetEvaluate";
import { loadOnetCorpus } from "../src/onet/corpus";

const outDir = join(process.cwd(), "artifacts/logic_audit");
const baselinePath = join(outDir, "onet_external_shock_baseline.json");
const latestPath = join(outDir, "onet_shock_latest.json");

const corpus = loadOnetCorpus();
if (!corpus) {
  console.error(JSON.stringify({ status: "BLOCKED", reason: "O*NET corpus not built. Run pnpm onet:fetch && pnpm onet:verify && pnpm onet:build." }, null, 2));
  process.exit(1);
}

const startedAt = Date.now();
const subjects = generateOnetSubjects(ONET_LAB_SEED);
const jobs = sharedEvalJobs();
if (jobs.length < 15) throw new Error(`shared eval job set too small (${jobs.length})`);

const evaluations = subjects.map((subject) => evaluateOnetSubject(subject, jobs));
const byCohort = {
  development: aggregate(evaluations.filter((item) => item.cohort === "design")),
  validation: aggregate(evaluations.filter((item) => item.cohort === "validation")),
  holdout: aggregate(evaluations.filter((item) => item.cohort === "holdout")),
  adversarial: aggregate(evaluations.filter((item) => item.cohort === "adversarial")),
};
const overall = aggregate(evaluations);

// Counterfactual twins (development cohort) + observation-regime variants.
const twins = generateOnetTwins(subjects, ONET_LAB_SEED);
const twinEvals = evaluateTwins(twins);
const twinPassByKind = Object.fromEntries(
  Array.from(new Set(twinEvals.map((item) => item.kind))).map((kind) => {
    const slice = twinEvals.filter((item) => item.kind === kind);
    return [kind, { n: slice.length, passRate: slice.filter((item) => item.pass).length / slice.length }];
  }),
);
const variantSources = subjects.filter((subject) => subject.truth.cohort === "design" || subject.truth.cohort === "validation");
const variants = variantSources.flatMap((subject) => generateObservationVariants(subject, ONET_LAB_SEED));
const variantEvaluations = variants.map((variant) => evaluateOnetSubject(variant, []));
const variantAggregate = {
  n: variantEvaluations.length,
  meanMae: mean(variantEvaluations.map((item) => item.mae)),
  sparseConfidence: mean(variantEvaluations.filter((item) => item.subjectId.endsWith("-sparse")).map((item) => item.confidence)),
  stuffedConfidence: mean(variantEvaluations.filter((item) => item.subjectId.endsWith("-stuffed")).map((item) => item.confidence)),
};

// Hireability pathology probe: keyword stuffing should not buy hireability.
const stuffedHireability = mean(evaluations.filter((item) => item.keywordStuffed).flatMap((item) => item.jobScores.map((score) => score.hireability)));
const unstuffedHireability = mean(evaluations.filter((item) => !item.keywordStuffed && item.cohort === "adversarial").flatMap((item) => item.jobScores.map((score) => score.hireability)));

// Score distributions over all subject × shared-job pairs.
const allScores = evaluations.flatMap((item) => item.jobScores);
const distribution = {
  pairs: allScores.length,
  fit: describe(allScores.map((score) => score.fit)),
  hireability: describe(allScores.map((score) => score.hireability)),
  overall: describe(allScores.map((score) => score.overall)),
};

const invariants = runLogicInvariants();
const stability = evaluateRankStability(subjects, jobs);
const strategy = evaluateStrategySample(subjects, jobs);

const report = {
  kind: "onet-external-shock",
  engineVersion: { scoring: scoringConfig.version, inference: scoringConfig.inference.version },
  labVersion: ONET_LAB_VERSION,
  seed: ONET_LAB_SEED,
  corpusVersion: corpus.version,
  generatedAt: new Date().toISOString(),
  runtimeMs: 0,
  cohortSizes: COHORT_SIZES,
  sharedEvalJobs: jobs.map((job) => job.canonicalId),
  overall,
  byCohort,
  twins: { total: twinEvals.length, passRate: twinEvals.filter((item) => item.pass).length / twinEvals.length, byKind: twinPassByKind },
  observationVariants: variantAggregate,
  counterfactualVariantCount: twins.length + variants.length,
  hireabilityPathologies: {
    stuffedMeanHireability: stuffedHireability,
    unstuffedAdversarialMeanHireability: unstuffedHireability,
    stuffingBuysHireability: stuffedHireability > unstuffedHireability + 0.5,
  },
  scoreDistribution: distribution,
  invariants: { passed: invariants.passed, failing: invariants.checks.filter((check) => !check.pass).map((check) => check.id) },
  rankStability: stability,
  networkAndNba: strategy,
  worstDimensions: [...overall.perDimension].sort((a, b) => b.mae - a.mae).slice(0, 6),
  bestDimensions: [...overall.perDimension].sort((a, b) => a.mae - b.mae).slice(0, 4),
  worstStrata: overall.byStratum.filter((item) => item.n >= 4).slice(0, 8),
};
report.runtimeMs = Date.now() - startedAt;

mkdirSync(outDir, { recursive: true });
if (!existsSync(baselinePath)) {
  writeFileSync(baselinePath, JSON.stringify(report, null, 2));
  console.log(`FROZE external-shock baseline at ${baselinePath}`);
} else {
  console.log("External-shock baseline already exists; NOT overwritten.");
}
writeFileSync(latestPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  meanMae: overall.meanMae,
  byCohort: { development: byCohort.development.meanMae, validation: byCohort.validation.meanMae, holdout: byCohort.holdout.meanMae, adversarial: byCohort.adversarial.meanMae },
  propertyPassRate: overall.propertyPassRate,
  technicalDemoTopFunctionShare: overall.technicalDemoTopFunctionShare,
  meanFitSpread: overall.meanFitSpread,
  meanHireabilitySpread: overall.meanHireabilitySpread,
  twins: report.twins.passRate,
  counterfactualVariantCount: report.counterfactualVariantCount,
  invariantsPassed: invariants.passed,
  rankStability: stability.meanSpearman,
  nbaFeasibleRate: strategy.nbaFeasibleRate,
  runtimeMs: report.runtimeMs,
}, null, 2));

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function describe(values: number[]) {
  if (!values.length) return { n: 0, mean: 0, sd: 0, min: 0, p10: 0, median: 0, p90: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = mean(values);
  const sd = Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return { n: values.length, mean: round(avg), sd: round(sd), min: round(sorted[0]!), p10: round(q(0.1)), median: round(q(0.5)), p90: round(q(0.9)), max: round(sorted[sorted.length - 1]!) };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
