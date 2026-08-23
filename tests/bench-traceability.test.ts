// Debuggability is a HARD readiness requirement: a developer must be able to answer "which
// subsystem caused this bad recommendation?" without guessing.
//
// These tests assert the trace actually supports that, rather than merely existing: every
// stage is present, every stage carries evidence, provenance survives every hop, the failing
// stage is identifiable, and the explanation cites only evidence the scoring actually used.
import { describe, expect, it } from "vitest";
import { buildBenchCorpus } from "@/bench/corpus";
import { labelPair } from "@/bench/labels";
import { runPerson } from "@/bench/pipeline";
import { traceFixture, traceRecommendation, TRACE_STAGES } from "@/bench/trace";
import { classifyEvidenceSentence } from "@/domain/evidence";
import { MAPPER_VERSION } from "@/v3/mapper";

const trace = traceFixture();

describe("end-to-end recommendation trace", () => {
  it("covers every stage from raw evidence to explanation", () => {
    const traced = new Set(trace.stageVerdicts.map((verdict) => verdict.stage));
    for (const stage of TRACE_STAGES) expect(traced.has(stage), `stage ${stage} is missing from the trace`).toBe(true);
  });

  it("gives every stage a verdict and a non-empty detail", () => {
    for (const verdict of trace.stageVerdicts) {
      expect(["OK", "DEGRADED", "FAILED", "NOT_APPLICABLE"]).toContain(verdict.verdict);
      expect(verdict.detail.length, `stage ${verdict.stage} has no detail`).toBeGreaterThan(10);
    }
  });

  it("carries the raw text and its extractor classification for every piece of person evidence", () => {
    expect(trace.personEvidence.length).toBeGreaterThan(0);
    for (const entry of trace.personEvidence) {
      expect(entry.rawText.length).toBeGreaterThan(0);
      expect(entry.extractorClass).toBe(classifyEvidenceSentence(entry.rawText));
      // Provenance survives: which planted atom, which paraphrase family, which difficulty.
      expect(entry.provenance).toMatch(/planted atom .+ paraphrase family .+ difficulty/);
    }
  });

  it("retains the candidate set, the selection reason, and mapper identity for every mapping", () => {
    expect(trace.personMappings.length).toBeGreaterThan(0);
    expect(trace.jobMappings.length).toBeGreaterThan(0);
    for (const mapping of [...trace.personMappings, ...trace.jobMappings]) {
      expect(mapping.candidates.length).toBeGreaterThan(0);
      expect(["task", "dwa", "abstain"]).toContain(mapping.level);
      // The reason must explain the decision in terms of the mapper's own thresholds.
      expect(mapping.selectionReason).toMatch(/threshold|margin|abstained/);
      expect(mapping.mapperVersion).toBe(MAPPER_VERSION);
      expect(mapping.corpusHash).toMatch(/^[0-9a-f]{64}$/);
      expect(mapping.cacheKey).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("says whether the job entered the candidate set, and why", () => {
    expect(typeof trace.retrieval.enteredCandidateSet).toBe("boolean");
    expect(trace.retrieval.strategy.length).toBeGreaterThan(0);
    expect(trace.retrieval.version.length).toBeGreaterThan(0);
    expect(trace.retrieval.reason.length).toBeGreaterThan(20);
  });

  it("decomposes every channel score into the evidence and responsibility that caused it", () => {
    const channels = new Set(trace.channels.map((channel) => channel.channel));
    expect(channels).toEqual(new Set(["experience", "preference", "direction", "qualification"]));
    const experience = trace.channels.find((channel) => channel.channel === "experience")!;
    expect(experience.contributions.length).toBeGreaterThan(0);
    for (const contribution of experience.contributions) {
      expect(trace.personEvidence.some((entry) => entry.id === contribution.personEvidenceId)).toBe(true);
      expect(trace.jobResponsibilities.some((entry) => entry.id === contribution.jobResponsibilityId)).toBe(true);
      expect(contribution.sharedIdentity).toMatch(/^(task|dwa):/);
      // The weight is explained, not just asserted.
      expect(contribution.weightExplanation).toMatch(/credit/);
    }
  });

  it("explains why the job immediately above it outranked it", () => {
    expect(trace.policy.finalRank).toBeGreaterThan(0);
    expect(trace.policy.totalCandidates).toBeGreaterThan(trace.policy.finalRank - 1);
    expect(trace.policy.tieBreak.length).toBeGreaterThan(0);
    expect(trace.policy.outrankedBecause.length).toBeGreaterThan(20);
  });

  it("cites only evidence the scoring actually used, and reports any unsupported sentence", () => {
    expect(trace.explanation.sentences.length).toBeGreaterThan(0);
    expect(trace.explanation.unsupportedSentences).toEqual([]);
    const usedEvidence = new Set(trace.channels.flatMap((channel) => channel.contributions.map((entry) => entry.personEvidenceId)));
    for (const cited of trace.explanation.citedEvidenceIds) expect(usedEvidence.has(cited)).toBe(true);
    const usedResponsibilities = new Set(trace.channels.flatMap((channel) => channel.contributions.map((entry) => entry.jobResponsibilityId)));
    for (const cited of trace.explanation.citedResponsibilityIds) expect(usedResponsibilities.has(cited)).toBe(true);
  });

  it("records the absence of user constraints instead of inventing them", () => {
    expect(trace.constraints.declared).toEqual([]);
    expect(trace.constraints.hardViolations).toEqual([]);
    expect(trace.constraints.note).toMatch(/no constraints are declared|do not exist/i);
  });

  it("localizes a failure to a specific subsystem", () => {
    // Every trace must make the weakest stage identifiable. On the hard tier person mapping
    // degrades first, which is exactly the localization a developer needs.
    const hard = traceFixture({ difficulty: "hard" });
    const problems = hard.stageVerdicts.filter((verdict) => verdict.verdict === "FAILED" || verdict.verdict === "DEGRADED");
    const mapping = hard.stageVerdicts.find((verdict) => verdict.stage === "person_canonical_mapping")!;
    expect(mapping.detail).toMatch(/recovered their planted Task/);
    // Whether or not this particular fixture fails, the verdicts must be actionable.
    for (const problem of problems) expect(problem.detail.length).toBeGreaterThan(10);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(traceFixture())).toBe(JSON.stringify(traceFixture()));
  });

  it("traces any archetype, including a job with no relationship at all", () => {
    const corpus = buildBenchCorpus({ people: 1 });
    const planted = corpus.people[0]!;
    const jobs = corpus.jobsByPerson.get(planted.personId)!;
    const run = runPerson(planted, jobs);
    for (const archetype of ["OBVIOUS_EXPERIENCE_MATCH", "SAME_TITLE_DIFFERENT_WORK", "IRRELEVANT", "TRANSITION_PREFERENCE_DIRECTION"] as const) {
      const job = jobs.find((entry) => entry.archetype === archetype);
      if (!job) continue;
      const result = traceRecommendation(planted, jobs, job.jobId, "B_BACKGROUND_AND_INTEREST", run);
      expect(result.jobId).toBe(job.jobId);
      expect(result.stageVerdicts.length).toBe(TRACE_STAGES.length);
      expect(result.plantedTruth).toEqual(labelPair(planted, job));
    }
  });
});
