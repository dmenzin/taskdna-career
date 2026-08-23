// End-to-end semantic-polarity regression coverage for the synthetic preference generator.
//
// Every test here traces the FULL chain on the COMPLETE generated statement:
//
//   hidden truth -> generated natural-language sentence -> extractor interpretation
//                -> predicted direction
//
// Generator metadata is never used to establish that a sentence means the right thing. The
// tests read the rendered text (or hand-write it) and assert on the extractor's numeric
// output, so a generator that emits malformed language while asserting correct metadata
// still fails.
import { describe, expect, it } from "vitest";
import { DIMENSION_IDS, vector } from "@/config/model";
import { buildProfileFromCareerInput } from "@/domain/engine";
import type { DimensionId } from "@/domain/types";
import { availabilityForObservations } from "@/lab/evidenceAvailability";
import { assessSamplerUniformity } from "@/lab/generatorBias";
import { assessSemanticPolarity, assessGeneratorMonotonicity, eligibleMonotonicityPass, semanticPolarityPass } from "@/lab/generatorMonotonicity";
import { selectEvaluationSplit } from "@/lab/iterationMetrics";
import { generateOnetSubjects, observeWithInvertedPolarity, ONET_LAB_SEED } from "@/lab/onetLab";
import { generateVirtualSubjects } from "@/lab/generate";
import { planPreferenceStatements } from "@/lab/preferencePhrases";
import { intendedDirection, truthDirection } from "@/lab/preferenceSemantics";
import { hashSeed, mulberry32 } from "@/lab/rng";
import type { VirtualSubject } from "@/lab/types";

const allSubjects = generateOnetSubjects(ONET_LAB_SEED);
const development = selectEvaluationSplit(allSubjects, "DEVELOPMENT");

/** Read the decoder's value for one dimension out of the complete generated statement. */
function predictFromStatement(statement: string, dimensionId: DimensionId) {
  const profile = buildProfileFromCareerInput({ id: "semantics-probe", careerText: statement });
  return profile.taskDna.find((entry) => entry.dimensionId === dimensionId)!.value;
}

describe("the semantic rule itself", () => {
  it("maps behaviour side x stance onto the four valid preference directions", () => {
    expect(intendedDirection("HIGH", "LIKE")).toBe("HIGH");
    expect(intendedDirection("LOW", "DISLIKE")).toBe("HIGH");
    expect(intendedDirection("LOW", "LIKE")).toBe("LOW");
    expect(intendedDirection("HIGH", "DISLIKE")).toBe("LOW");
  });
});

describe("hidden truth -> generated sentence -> extractor -> predicted direction", () => {
  // "solo deep work" is the LOW-side behaviour for coordination_preference and IS in the
  // extractor's lexicon (workStructureLexicon "solo-deep-work"), so the whole chain is
  // observable end to end for this dimension.
  it("a LOW truth expressed as a dislike of the HIGH-side behaviour predicts LOW", () => {
    const statement = "I avoid stakeholder orchestration.";
    expect(predictFromStatement(statement, "coordination_preference")).toBeLessThan(5);
  });

  it("a LOW truth expressed as a like of the LOW-side behaviour predicts LOW", () => {
    const statement = "I enjoy solo deep work.";
    expect(predictFromStatement(statement, "coordination_preference")).toBeLessThan(5);
  });

  it("a HIGH truth expressed as a like of the HIGH-side behaviour predicts HIGH", () => {
    const statement = "I enjoy stakeholder orchestration.";
    expect(predictFromStatement(statement, "coordination_preference")).toBeGreaterThan(5);
  });

  it("a HIGH truth expressed as a dislike of the LOW-side behaviour predicts HIGH", () => {
    const statement = "I avoid solo deep work.";
    expect(predictFromStatement(statement, "coordination_preference")).toBeGreaterThan(5);
  });

  it("THE ORIGINAL DEFECT: dislike of the LOW-side behaviour must NOT be used to express a LOW truth", () => {
    // This is the exact backwards pairing the pre-fix generator produced. The sentence is
    // perfectly good English; it just means the OPPOSITE of a low hidden truth. Asserting
    // the extractor's behaviour here documents WHY the generator must not emit it, rather
    // than blaming the extractor.
    const backwards = "I avoid solo deep work.";
    expect(predictFromStatement(backwards, "coordination_preference")).toBeGreaterThan(5);
    expect(intendedDirection("LOW", "DISLIKE")).toBe("HIGH");
  });
});

describe("the generator only emits semantically coherent statements", () => {
  it("every statement's rendered text means what the hidden truth says, read back from the text", () => {
    const results = assessSemanticPolarity(allSubjects);
    const failures = results.filter((result) => !result.pass);
    expect(failures.map((result) => ({ id: result.id, backwards: result.backwardsPlacements, example: result.examples[0] }))).toEqual([]);
    expect(semanticPolarityPass(results)).toBe(true);
    // The audit must actually be looking at something.
    expect(results.reduce((sum, result) => sum + result.checkedPlacements, 0)).toBeGreaterThan(100);
  });

  it("exposes every valid (behaviour side x stance) combination, not just one", () => {
    const combinations = new Set<string>();
    for (const subject of development) {
      const availability = availabilityForObservations(subject.observations);
      for (const id of DIMENSION_IDS) {
        for (const placement of availability[id].placements) combinations.add(`${placement.behaviorSide}/${placement.stance}`);
      }
    }
    expect([...combinations].sort()).toEqual(["HIGH/DISLIKE", "HIGH/LIKE", "LOW/DISLIKE", "LOW/LIKE"]);
  });

  it("holds for the legacy v1 lab generator too", () => {
    const results = assessSemanticPolarity(generateVirtualSubjects());
    expect(results.filter((result) => !result.pass).map((result) => result.id)).toEqual([]);
  });
});

describe("the audit fails on a deliberately backwards generator", () => {
  const inverted = development.map((subject) => observeWithInvertedPolarity(subject));

  it("semantic polarity rejects a corpus of backwards sentences", () => {
    const results = assessSemanticPolarity(inverted);
    expect(semanticPolarityPass(results)).toBe(false);
    const failing = results.filter((result) => !result.pass);
    expect(failing.length).toBeGreaterThan(5);
    expect(failing[0]!.examples[0]).toBeTruthy();
  });

  it("a single hand-written malformed statement fails semantic consistency", () => {
    // LOW truth + DISLIKE of LOW-side behaviour: exactly the prohibited pairing.
    const subject: VirtualSubject = {
      truth: { ...development[0]!.truth, taskDnaTruth: vector({ ...development[0]!.truth.taskDnaTruth, coordination_preference: 1.5 }) },
      observations: {
        ...development[0]!.observations,
        resumeText: "Analyst working in operations.",
        explicitPreferences: [],
        explicitDislikes: ["solo deep work"],
        contradictoryStatements: [],
      },
    };
    expect(truthDirection(1.5)).toBe("LOW");
    const coordination = assessSemanticPolarity([subject]).find((result) => result.id === "coordination_preference")!;
    expect(coordination.checkedPlacements).toBe(1);
    expect(coordination.backwardsPlacements).toBe(1);
    expect(coordination.pass).toBe(false);
    expect(semanticPolarityPass(assessSemanticPolarity([subject]))).toBe(false);
  });

  it("distributional monotonicity also flips sign on the backwards corpus", () => {
    expect(eligibleMonotonicityPass(assessGeneratorMonotonicity(development))).toBe(true);
    const invertedResults = assessGeneratorMonotonicity(inverted);
    expect(eligibleMonotonicityPass(invertedResults)).toBe(false);
    for (const result of invertedResults.filter((row) => row.eligible)) {
      expect(result.observableSignalAssociation).toBeLessThan(0);
    }
  });
});

describe("dimension selection carries no positional bias", () => {
  it("selects every dimension at an indistinguishable rate when all are equally expressible", () => {
    const uniformTruth = vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, 8.5])));
    const report = assessSamplerUniformity((trial) => {
      const rng = mulberry32(hashSeed(`sampler-uniformity-test:${trial}`));
      return planPreferenceStatements(uniformTruth, rng, {
        sources: { resumeNarrative: true, explicitPreferenceList: true, explicitDislikeList: true, contradictoryStatement: true },
        includeAspiration: true,
      }).selected.map((entry) => entry.dimensionId);
    }, 8000);
    // chi-square against uniform, 16 df, alpha=0.001
    expect(report.chiSquare).toBeLessThan(report.chiSquareCriticalValue);
    expect(Math.abs(report.positionVersusRateSpearman)).toBeLessThan(0.4);
    expect(report.maxRate - report.minRate).toBeLessThan(0.05);
  });

  it("the pre-fix filter-then-slice procedure fails the same test", () => {
    // Documents the defect this replaced: order-preserving truncation always keeps the
    // dimensions nearest the front of DIMENSION_IDS.
    const report = assessSamplerUniformity(() => DIMENSION_IDS.slice(0, 3), 8000);
    expect(report.chiSquare).toBeGreaterThan(report.chiSquareCriticalValue);
    expect(report.maxRate - report.minRate).toBe(1);
  });
});
