import { DIMENSION_IDS } from "@/config/model";
import { observationsToProfile } from "@/lab/evaluate";
import type { DimensionId, UserEvidence } from "@/domain/types";
import type { VirtualSubject } from "@/lab/types";
import { AUTONOMOUS_PREFERENCE_DIMENSIONS_V1, PRIMARY_PREFERENCE_DECODER_METRIC } from "@/lab/preferenceTarget";

export const ITERATION_EVALUATOR_VERSION = "iteration-readiness.v1";
export type EvaluationMode = "DEVELOPMENT" | "VALIDATION" | "LOCKED_CONFIRMATION";

export function selectEvaluationSplit(subjects: VirtualSubject[], mode: EvaluationMode, unlock = false) {
  if (mode === "LOCKED_CONFIRMATION" && !unlock) {
    throw new Error("LOCKED_CONFIRMATION is guarded. Re-run with --confirm-locked; never use it during ordinary iteration.");
  }
  const cohort = mode === "DEVELOPMENT" ? "design" : mode === "VALIDATION" ? "validation" : "holdout";
  return subjects.filter((subject) => subject.truth.cohort === cohort);
}

function preferenceEvidence(evidence: UserEvidence) {
  return evidence.evidenceClass === "PREFERENCE" || evidence.evidenceClass === "DISLIKE";
}

export function diagnosePreference(subjects: VirtualSubject[], developmentSubjects: VirtualSubject[]) {
  const devPrior = Object.fromEntries(DIMENSION_IDS.map((id) => [id, mean(developmentSubjects.map((s) => s.truth.taskDnaTruth[id]))])) as Record<DimensionId, number>;
  const records = subjects.flatMap((subject) => {
    const profile = observationsToProfile(subject);
    const dimensions = new Map(profile.taskDna.map((item) => [item.dimensionId, item]));
    const supported = new Set(profile.evidence.filter(preferenceEvidence).flatMap((item) => Object.keys(item.inferredTaskDimensions) as DimensionId[]));
    return DIMENSION_IDS.map((id) => {
      const dimension = dimensions.get(id)!;
      return {
        subjectId: subject.truth.subjectId, cohort: subject.truth.cohort, id,
        truth: subject.truth.taskDnaTruth[id], prediction: dimension.value,
        confidence: dimension.confidence, supported: supported.has(id),
        evidenceCount: profile.evidence.filter((e) => preferenceEvidence(e) && id in e.inferredTaskDimensions).length,
        prior: devPrior[id],
      };
    });
  });
  const observed = records.filter((r) => r.supported);
  const autonomousObserved = observed.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id));
  const zero = records.filter((r) => !r.supported);
  const subjectObserved = [...new Set(observed.map((r) => r.subjectId))].map((id) => mean(observed.filter((r) => r.subjectId === id).map(error)));
  const autonomousSubjectObserved = [...new Set(autonomousObserved.map((r) => r.subjectId))].map((id) => mean(autonomousObserved.filter((r) => r.subjectId === id).map(error)));
  const predictionVariance = variance(records.map((r) => r.prediction));
  const truthVariance = variance(records.map((r) => r.truth));
  const constant = (slice: typeof records) => mae(slice.map((r) => ({ ...r, prediction: 5 })));
  const prior = (slice: typeof records) => mae(slice.map((r) => ({ ...r, prediction: r.prior })));
  const shrinkage = [0, .25, .5, .75, 1].map((lambda) => {
    const shrunk = records.map((r) => ({ ...r, prediction: lambda * r.prediction + (1 - lambda) * 5 }));
    const obs = shrunk.filter((r) => r.supported); const no = shrunk.filter((r) => !r.supported);
    const autonomous = obs.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id));
    const macro = [...new Set(obs.map((r) => r.subjectId))].map((id) => mean(obs.filter((r) => r.subjectId === id).map(error)));
    const autonomousMacro = [...new Set(autonomous.map((r) => r.subjectId))].map((id) => mean(autonomous.filter((r) => r.subjectId === id).map(error)));
    return { lambda, allDimensionMae: mae(shrunk), observedMacroMae: mean(macro), observedMicroMae: mae(obs), autonomousObservedMacroMae:mean(autonomousMacro), autonomousObservedMicroMae:mae(autonomous), zeroEvidenceMae: mae(no), predictionVariance: variance(shrunk.map((r) => r.prediction)) };
  });
  const byDimension = DIMENSION_IDS.map((id) => {
    const slice = records.filter((r) => r.id === id), obs = slice.filter((r) => r.supported);
    return { id, coverage: obs.length / slice.length, observedMae: mae(obs), allMae: mae(slice), predictionVariance: variance(slice.map((r) => r.prediction)), truthVariance: variance(slice.map((r) => r.truth)) };
  });
  const confidencePairs = records.map((r) => [r.confidence, error(r)] as [number, number]);
  const subjectPairs = subjects.map((s) => {
    const slice = records.filter((r) => r.subjectId === s.truth.subjectId);
    return [mean(slice.map((r) => r.confidence)), mae(slice)] as [number, number];
  });
  const warnings = [
    ...(Math.abs(mean(records.map((r) => r.prediction)) - 5) < .1 ? ["PREDICTION_TO_5_RISK"] : []),
    ...(predictionVariance / truthVariance < .1 ? ["VARIANCE_COLLAPSE"] : []),
    ...(observed.length / records.length < .1 ? ["LOW_EVIDENCE_COVERAGE"] : []),
    ...(new Set(observed.map((r) => `${r.subjectId}:${r.id}:${r.evidenceCount}`)).size !== observed.length ? ["DUPLICATED_EVIDENCE_RECORD"] : []),
  ];
  return {
    metricVersion: ITERATION_EVALUATOR_VERSION,
    subjects: subjects.length, dimensionRecords: records.length,
    primaryPreferenceDecoderMetric: PRIMARY_PREFERENCE_DECODER_METRIC,
    autonomousPreferenceDimensions: AUTONOMOUS_PREFERENCE_DIMENSIONS_V1,
    autonomousObservedPreferenceMacroMae: mean(autonomousSubjectObserved),
    autonomousObservedPreferenceMicroMae: mae(autonomousObserved),
    autonomousEvidenceCoverage: autonomousObserved.length / records.filter((r) => AUTONOMOUS_PREFERENCE_DIMENSIONS_V1.includes(r.id)).length,
    legacyAllDimensionMae: mae(records), observedPreferenceMacroMae: mean(subjectObserved), observedPreferenceMicroMae: mae(observed), zeroEvidenceMae: mae(zero),
    evidenceCoverage: observed.length / records.length,
    constant5: { allDimensionMae: constant(records), observedMicroMae: constant(observed), zeroEvidenceMae: constant(zero) },
    developmentPopulationPrior: { allDimensionMae: prior(records), observedMicroMae: prior(observed), zeroEvidenceMae: prior(zero), warning: "Prior estimated on DEVELOPMENT truth; diagnostic only." },
    pairedDecoderVsConstant: { meanErrorDelta: mean(records.map((r) => error(r) - Math.abs(5 - r.truth))), decoderWins: records.filter((r) => error(r) < Math.abs(5-r.truth)).length, constantWins: records.filter((r) => error(r) > Math.abs(5-r.truth)).length, ties: records.filter((r) => error(r) === Math.abs(5-r.truth)).length },
    distribution: { predictionMean: mean(records.map((r) => r.prediction)), predictionVariance, truthMean: mean(records.map((r) => r.truth)), truthVariance, varianceRatio: predictionVariance / truthVariance },
    byCohort: [...new Set(records.map((r) => r.cohort))].map((cohort) => ({ cohort, n: new Set(records.filter((r) => r.cohort === cohort).map((r) => r.subjectId)).size, mae: mae(records.filter((r) => r.cohort === cohort)) })),
    byDimension,
    byEvidenceCount: [...new Set(records.map((r) => r.evidenceCount))].sort((a,b)=>a-b).map((count) => ({ count, n: records.filter((r)=>r.evidenceCount===count).length, mae: mae(records.filter((r)=>r.evidenceCount===count)) })),
    confidence: { dimensionPearsonError: pearson(confidencePairs), dimensionSpearmanError: spearman(confidencePairs), subjectPearsonMae: pearson(subjectPairs), subjectSpearmanMae: spearman(subjectPairs), buckets: confidenceBuckets(records), monotonicErrorDecrease: false, governance: "UNVALIDATED: must not modify V3 scoring without an explicit experiment and metric contract" },
    complementary: complementaryDiagnostics(autonomousObserved),
    antiGoodhart: { meanCollapse: Math.abs(mean(records.map(r=>r.prediction))-5)<.1, varianceCollapse: predictionVariance/truthVariance<.1, predictionTo5Gaming: mae(records)>=constant(records)&&predictionVariance<truthVariance*.2, improvementOnlyZeroEvidence: mae(observed)>=constant(observed)&&mae(zero)<constant(zero), reducedCoverage: "compare against preregistered before value", excessiveAbstention: "not applicable to preference decoder; required for mapper evaluation", duplicatedEvidence: "support counted once per extracted preference evidence record and dimension" },
    shrinkage, shrinkageGovernance: "DIAGNOSTIC ONLY: never automatically select or adopt the minimum-MAE lambda", warnings,
  };
}

type RecordRow = { prediction:number; truth:number; confidence:number };
const error = (r: RecordRow) => Math.abs(r.prediction-r.truth);
const mean = (x:number[]) => x.length ? x.reduce((a,b)=>a+b,0)/x.length : 0;
const mae = <T extends RecordRow>(x:T[]) => mean(x.map(error));
const variance = (x:number[]) => { const m=mean(x); return mean(x.map(v=>(v-m)**2)); };
function pearson(pairs:[number,number][]) { const x=pairs.map(p=>p[0]),y=pairs.map(p=>p[1]),mx=mean(x),my=mean(y); const den=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)*y.reduce((s,v)=>s+(v-my)**2,0)); return den ? pairs.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/den : 0; }
function spearman(pairs:[number,number][]) { const rank=(xs:number[])=>xs.map(v=>xs.filter(x=>x<v).length+xs.filter(x=>x===v).length/2); const x=rank(pairs.map(p=>p[0])),y=rank(pairs.map(p=>p[1])); return pearson(x.map((v,i)=>[v,y[i]!])); }
function confidenceBuckets(records: (RecordRow & {supported:boolean})[]) { return [[0,.35],[.35,.5],[.5,.65],[.65,1.01]].map(([min,max])=>{const s=records.filter(r=>r.confidence>=min!&&r.confidence<max!);return {bucket:`${min}-${max}`,n:s.length,mae:mae(s)};}); }
function complementaryDiagnostics(records: (RecordRow & {id:DimensionId})[]) {
  const directional = records.filter(r=>Math.abs(r.truth-5)>=1);
  const extreme = records.filter(r=>Math.abs(r.truth-5)>=3);
  const slopeDen = records.reduce((s,r)=>s+(r.prediction-mean(records.map(x=>x.prediction)))**2,0);
  return {
    directionalAccuracy: directional.length ? directional.filter(r=>Math.sign(r.prediction-5)===Math.sign(r.truth-5)).length/directional.length : 0,
    withinDimensionRankSpearman: mean(DIMENSION_IDS.map(id=>spearman(records.filter(r=>r.id===id).map(r=>[r.prediction,r.truth])))),
    extremePreferenceRecall: extreme.length ? extreme.filter(r=>Math.sign(r.prediction-5)===Math.sign(r.truth-5)&&Math.abs(r.prediction-5)>=1).length/extreme.length : 0,
    calibrationSlopeTruthOnPrediction: slopeDen ? records.reduce((s,r)=>s+(r.prediction-mean(records.map(x=>x.prediction)))*(r.truth-mean(records.map(x=>x.truth))),0)/slopeDen : 0,
  };
}
