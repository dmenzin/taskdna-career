import { describe, expect, it } from "vitest";
import { classifyEvidenceSentence } from "../src/domain/evidence";
import { analyzeJob, buildProfileFromCareerInput, profileVector, scoreJobs } from "../src/domain/engine";
import { allCareerFunctions } from "../src/config/model";
import { generateOnetSubjects } from "../src/lab/onetLab";
import { occupationToJobPosting } from "../src/onet/adapter";
import { loadOnetCorpus } from "../src/onet/corpus";
import { readWorkStructure } from "../src/domain/workStructure";

describe("O*NET lab invariants", () => {
  it("classifies exposure separately from preference", () => {
    expect(classifyEvidenceSentence("In this role I would analyze financial statements and prepare reports.")).toBe("EXPOSURE");
    expect(classifyEvidenceSentence("I enjoy digging into why something failed.")).toBe("PREFERENCE");
    expect(classifyEvidenceSentence("I dislike stakeholder orchestration.")).toBe("DISLIKE");
    expect(classifyEvidenceSentence("Longer term I want more solo deep work.")).toBe("ASPIRATIONAL");
  });

  it("does not infer enjoyment from occupational exposure alone", () => {
    const profile = buildProfileFromCareerInput({
      id: "accountant-unhappy",
      careerText: "In this role I would analyze financial statements. In this role I would prepare audit evidence packages. I dislike repeatable protocols and administrative packets. I enjoy novel problem solving.",
      explicitDislikes: ["repeatable protocols"],
      explicitPreferences: ["novel problem solving"],
      skills: ["accounting", "audit"],
    });
    const vector = profileVector(profile);
    expect(vector.repetition_tolerance).toBeLessThan(5);
    expect(profile.evidence.some((item) => item.evidenceClass === "EXPOSURE" && item.signalWeight === 0)).toBe(true);
  });

  it("can represent capable-and-unhappy versus capable-and-happy without occupation shortcuts", () => {
    const corpus = loadOnetCorpus();
    if (!corpus) return;
    const subjects = generateOnetSubjects();
    const mismatched = subjects.filter((subject) => !subject.truth.careerHistoryTruth.occupationFitsPreference);
    const matched = subjects.filter((subject) => subject.truth.careerHistoryTruth.occupationFitsPreference);
    expect(mismatched.length).toBeGreaterThan(80);
    expect(matched.length).toBeGreaterThan(20);
    expect(subjects.some((subject) => subject.truth.careerHistoryTruth.burnedOut)).toBe(true);
    expect(subjects.some((subject) => subject.truth.careerHistoryTruth.careerChanger)).toBe(true);
    expect(subjects.every((subject) => subject.truth.occupationalSkeleton.source === "onet-30.3")).toBe(true);
  });

  it("reads real occupation task language into a non-neutral TaskDNA job vector", () => {
    const corpus = loadOnetCorpus();
    if (!corpus) return;
    const accountant = corpus.occupations.find((occupation) => occupation.onetSocCode === "13-2011.00")!;
    const job = occupationToJobPosting(accountant);
    const analysis = analyzeJob(job, allCareerFunctions);
    const reading = readWorkStructure(`${job.description} ${job.responsibilities.join(" ")}`);
    expect(reading.dimensionsCovered).toBeGreaterThanOrEqual(3);
    expect(analysis.jobTaskDnaVector.investigation_orientation !== 5 || analysis.jobTaskDnaVector.repetition_tolerance !== 5).toBe(true);
    expect(analysis.primaryFunctionId).not.toBe("modeling-simulation");
  });

  it("does not give every O*NET occupation the same Work Fit", () => {
    const corpus = loadOnetCorpus();
    if (!corpus) return;
    const investigator = buildProfileFromCareerInput({
      id: "inv",
      careerText: "I enjoy digging into why something failed and working from logs and measurements. I dislike stakeholder orchestration.",
      skills: ["investigation", "data analysis"],
    });
    const jobs = ["17-2141.00", "41-4012.00", "13-1041.00"].map((code) => occupationToJobPosting(corpus.occupations.find((occupation) => occupation.onetSocCode === code)!));
    const scored = scoreJobs(investigator, jobs, allCareerFunctions);
    const fits = scored.map((item) => item.score.predictedFit);
    expect(Math.max(...fits) - Math.min(...fits)).toBeGreaterThan(0.6);
  });
});
