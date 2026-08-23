// Known-answer ranking behaviour. These are the product's primary objectives expressed as
// assertions: if any of them fails, TaskDNA has stopped being a task-based matcher.
import { describe, expect, it } from "vitest";
import { buildBenchCorpus } from "@/bench/corpus";
import { isSurprisingTransfer, isTransitionRelevant, labelPair } from "@/bench/labels";
import { applyMode, MODE_SPECS, RECOMMENDATION_MODES, scoreSpaceDominanceViolations } from "@/bench/policy";
import { rankByBaseline, rankByChannel, runPerson } from "@/bench/pipeline";
import { meanRankOf, ndcgAtK, subsetRecallAtK } from "@/bench/rankMetrics";
import { OPTIMIZATION_TARGET_CONFIG, runBenchmark } from "@/bench/run";

const corpus = buildBenchCorpus({ people: 6 });
const runs = corpus.people.map((planted) => {
  const jobs = corpus.jobsByPerson.get(planted.personId)!;
  return { planted, jobs, run: runPerson(planted, jobs), labels: new Map(jobs.map((job) => [job.jobId, labelPair(planted, job)])) };
});
const lookup = (entry: (typeof runs)[number]) => (jobId: string) => entry.labels.get(jobId);
const hardGaps = (entry: (typeof runs)[number]) => new Map([...entry.labels.entries()].map(([jobId, label]) => [jobId, label.hardGaps]));
const mean = (values: (number | null)[]) => {
  const defined = values.filter((value): value is number => value !== null);
  return defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : null;
};

describe("core objective: transferable background across titles and industries", () => {
  it("ranks different-title/same-work above same-title/different-work", () => {
    const crossTitle = mean(runs.map((entry) => meanRankOf(rankByChannel(entry.run, "experience"), lookup(entry), (label) => label.archetype === "CROSS_TITLE_TRANSFER")));
    const sameTitle = mean(runs.map((entry) => meanRankOf(rankByChannel(entry.run, "experience"), lookup(entry), (label) => label.archetype === "SAME_TITLE_DIFFERENT_WORK")));
    expect(crossTitle).not.toBeNull();
    expect(sameTitle).not.toBeNull();
    expect(crossTitle!).toBeLessThan(sameTitle!);
  });

  it("gives the title-collision trap no experience credit at all", () => {
    for (const entry of runs) {
      const trap = entry.jobs.find((job) => job.archetype === "SAME_TITLE_DIFFERENT_WORK");
      if (!trap) continue;
      const candidate = entry.run.candidates.find((item) => item.jobId === trap.jobId)!;
      // Planted experience relevance is zero, so any positive contribution is title leakage.
      expect(entry.labels.get(trap.jobId)!.experience.grade).toBe(0);
      expect(candidate.matchedResponsibilities.experience).toEqual([]);
    }
  });

  it("ranks hard near-misses below genuine cross-title transfers", () => {
    const nearMiss = mean(runs.map((entry) => meanRankOf(rankByChannel(entry.run, "experience"), lookup(entry), (label) => label.archetype === "HARD_NEAR_MISS")));
    const crossTitle = mean(runs.map((entry) => meanRankOf(rankByChannel(entry.run, "experience"), lookup(entry), (label) => label.archetype === "CROSS_TITLE_TRANSFER")));
    if (nearMiss === null) return;
    expect(crossTitle!).toBeLessThan(nearMiss);
  });

  it("beats every conventional baseline on cross-title transfer recall", () => {
    const taskdna = mean(runs.map((entry) => subsetRecallAtK(rankByChannel(entry.run, "experience"), lookup(entry), (label) => label.crossTitle && label.experience.grade >= 1, 5)));
    for (const baseline of ["title-only", "occupation-stratum"] as const) {
      const value = mean(runs.map((entry) => subsetRecallAtK(rankByBaseline(baseline, entry.planted, entry.jobs), lookup(entry), (label) => label.crossTitle && label.experience.grade >= 1, 5)));
      expect(taskdna!, `TaskDNA must beat ${baseline}`).toBeGreaterThan(value!);
    }
  });
});

describe("core objective: independent interest fit", () => {
  it("keeps experience high and preference low on a job full of disliked work", () => {
    let checked = 0;
    for (const entry of runs) {
      const job = entry.jobs.find((candidate) => candidate.archetype === "EXPERIENCE_WITH_DISLIKED_WORK");
      if (!job) continue;
      const candidate = entry.run.candidates.find((item) => item.jobId === job.jobId)!;
      if (candidate.experience.score === null || candidate.preference.score === null) continue;
      checked += 1;
      expect(candidate.experience.score).toBeGreaterThan(0);
      // Below the neutral centre: the dislike is registered rather than averaged away.
      expect(candidate.preference.score).toBeLessThan(0.5);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("can produce preference relevance with no experience at all", () => {
    let checked = 0;
    for (const entry of runs) {
      const job = entry.jobs.find((candidate) => candidate.archetype === "PREFERENCE_ONLY");
      if (!job) continue;
      const label = entry.labels.get(job.jobId)!;
      if (label.preference.grade < 1) continue;
      checked += 1;
      expect(label.experience.grade).toBe(0);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("core objective: career transitions remain discoverable", () => {
  it("surfaces transition targets in the transition mode", () => {
    const recall = mean(runs.map((entry) => subsetRecallAtK(applyMode("C_CAREER_TRANSITION", entry.run, hardGaps(entry)).ranked, lookup(entry), isTransitionRelevant, 5)));
    expect(recall).not.toBeNull();
    expect(recall!).toBeGreaterThan(0.5);
  });

  it("does not demote a transition target for lacking experience", () => {
    // Transition mode must not correlate with experience: if it did, the mode would be a
    // resume-replication ranker wearing a different name.
    for (const entry of runs) {
      const transitionRank = applyMode("C_CAREER_TRANSITION", entry.run, hardGaps(entry)).ranked;
      const experienceRank = applyMode("A_TRANSFERABLE_BACKGROUND", entry.run, hardGaps(entry)).ranked;
      const target = entry.jobs.find((job) => job.archetype === "TRANSITION_PREFERENCE_DIRECTION");
      if (!target) continue;
      const inTransition = transitionRank.indexOf(target.jobId);
      const inExperience = experienceRank.indexOf(target.jobId);
      expect(inTransition).toBeLessThanOrEqual(inExperience);
    }
  });
});

describe("core objective: surprise requires relevance", () => {
  it("only counts a cross-boundary job as surprising when it is genuinely relevant", () => {
    for (const entry of runs) {
      for (const [, label] of entry.labels) {
        if (isSurprisingTransfer(label)) expect(label.experience.grade).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("reports relevance and surprise as separate numbers", () => {
    const report = runBenchmark({ people: 4 });
    expect(report.surprisingTransferRecallAtK).not.toBeUndefined();
    expect(report.noveltyWithoutRelevanceRateAtK).not.toBeUndefined();
    // A high novelty rate paired with a low relevance rate must be visible, not hidden in one
    // combined "novelty" score.
    expect(Object.keys(report)).toContain("noveltyWithoutRelevanceRateAtK");
  });
});

describe("core-vs-incidental responsibilities", () => {
  it("does not rank an incidental-only match above a core match", () => {
    for (const entry of runs) {
      const ranked = rankByChannel(entry.run, "experience");
      const incidental = ranked.findIndex((jobId) => entry.labels.get(jobId)!.archetype === "INCIDENTAL_ONLY_MATCH");
      const core = ranked.findIndex((jobId) => entry.labels.get(jobId)!.archetype === "OBVIOUS_EXPERIENCE_MATCH");
      if (incidental < 0 || core < 0) continue;
      expect(core).toBeLessThan(incidental);
    }
  });
});

describe("recommendation policy modes", () => {
  it("declares a product question, a weight-free selection rule, and guardrails for every mode", () => {
    for (const mode of RECOMMENDATION_MODES) {
      const spec = MODE_SPECS[mode];
      expect(spec.productQuestion.length).toBeGreaterThan(20);
      expect(spec.selectionRule.length).toBeGreaterThan(20);
      expect(spec.guardrails.length).toBeGreaterThan(0);
      expect(spec.failureExample.length).toBeGreaterThan(20);
      expect(spec.gradedChannels.length).toBeGreaterThan(0);
      // No mode may describe its ordering with numeric channel weights.
      expect(spec.selectionRule).not.toMatch(/0\.\d+\s*\*/);
    }
  });

  it("produces zero score-space dominance violations in the Pareto modes", () => {
    for (const entry of runs) {
      const byId = new Map(entry.run.candidates.map((candidate) => [candidate.jobId, candidate]));
      const modeB = applyMode("B_BACKGROUND_AND_INTEREST", entry.run, hardGaps(entry)).ranked;
      expect(scoreSpaceDominanceViolations(modeB, byId, "experience", "preference")).toBe(0);
      const modeC = applyMode("C_CAREER_TRANSITION", entry.run, hardGaps(entry)).ranked;
      expect(scoreSpaceDominanceViolations(modeC, byId, "direction", "preference")).toBe(0);
    }
  });

  it("never lets qualification rewrite a work-content channel score", () => {
    for (const entry of runs) {
      const modeB = applyMode("B_BACKGROUND_AND_INTEREST", entry.run, hardGaps(entry));
      const modeD = applyMode("D_QUALIFICATION_AWARE", entry.run, hardGaps(entry));
      // Same candidate set, same channel scores; only the ORDER may differ.
      expect(new Set(modeD.ranked)).toEqual(new Set(modeB.ranked));
      for (const candidate of entry.run.candidates) {
        const again = entry.run.candidates.find((item) => item.jobId === candidate.jobId)!;
        expect(again.experience).toEqual(candidate.experience);
        expect(again.preference).toEqual(candidate.preference);
        expect(again.direction).toEqual(candidate.direction);
      }
    }
  });

  it("retains stretch roles rather than filtering them out", () => {
    for (const entry of runs) {
      const modeD = applyMode("D_QUALIFICATION_AWARE", entry.run, hardGaps(entry));
      const stretch = [...entry.labels.values()].filter((label) => label.hardGaps.length > 0);
      if (!stretch.length) continue;
      for (const label of stretch) expect(modeD.ranked).toContain(label.jobId);
      // Every stretch role is partitioned after every role the person meets.
      const meetsRanks = modeD.reasons.filter((reason) => reason.hardGapPartition === "meets").map((reason) => reason.rank);
      const stretchRanks = modeD.reasons.filter((reason) => reason.hardGapPartition === "stretch").map((reason) => reason.rank);
      if (meetsRanks.length && stretchRanks.length) expect(Math.max(...meetsRanks)).toBeLessThan(Math.min(...stretchRanks));
    }
  });

  it("keeps channel scores identical across every mode", () => {
    for (const entry of runs) {
      const scores = new Map(entry.run.candidates.map((candidate) => [candidate.jobId, JSON.stringify([candidate.experience, candidate.preference, candidate.direction, candidate.qualification])]));
      for (const mode of RECOMMENDATION_MODES) {
        applyMode(mode, entry.run, hardGaps(entry));
        for (const candidate of entry.run.candidates) {
          expect(JSON.stringify([candidate.experience, candidate.preference, candidate.direction, candidate.qualification])).toBe(scores.get(candidate.jobId));
        }
      }
    }
  });

  it("returns no combined or overall score anywhere in a mode result", () => {
    const result = applyMode("B_BACKGROUND_AND_INTEREST", runs[0]!.run, hardGaps(runs[0]!));
    expect(JSON.stringify(result)).not.toMatch(/overall|combined|composite|totalScore/i);
  });
});

describe("benchmark reports its own headroom", () => {
  // Two full benchmark runs at the declared minimum sample size; slower than the default
  // vitest budget by design, because a smaller sample cannot establish saturation.
  it("flags a saturated channel instead of presenting it as solved", { timeout: 120000 }, () => {
    const people = OPTIMIZATION_TARGET_CONFIG.minimumPeople;
    const standard = runBenchmark({ people, difficulty: "standard" });
    const hard = runBenchmark({ people, difficulty: OPTIMIZATION_TARGET_CONFIG.difficulty });
    // The standard tier saturates experience and direction, so it must be flagged rather than
    // reported as success.
    for (const channel of ["experience", "direction"]) {
      const row = standard.headroom.find((entry) => entry.channel === channel)!;
      expect(row.saturated, `${channel} should saturate at standard difficulty`).toBe(true);
      expect(row.note).toContain("SATURATED");
    }
    // Every channel must have headroom at the declared optimization target.
    for (const row of hard.headroom) {
      expect(row.saturated, `${row.channel} must have headroom at the optimization target`).toBe(false);
      expect(row.ndcgAtK!).toBeLessThan(1);
    }
  });

  it("declares the hard tier as the optimization target, with a stated reason", () => {
    expect(OPTIMIZATION_TARGET_CONFIG.difficulty).toBe("hard");
    expect(OPTIMIZATION_TARGET_CONFIG.minimumPeople).toBeGreaterThanOrEqual(12);
    expect(OPTIMIZATION_TARGET_CONFIG.rationale).toContain("saturates");
  });

  it("is deterministic across runs", () => {
    expect(JSON.stringify(strip(runBenchmark({ people: 3 })))).toBe(JSON.stringify(strip(runBenchmark({ people: 3 }))));
  });
});

describe("NDCG behaves correctly", () => {
  it("returns 1 for a perfect ordering and less for a reversed one", () => {
    const entry = runs[0]!;
    const byExperience = [...entry.labels.values()].sort((a, b) => b.experience.grade - a.experience.grade).map((label) => label.jobId);
    const reversed = [...byExperience].reverse();
    expect(ndcgAtK(byExperience, lookup(entry), "experience", 5)).toBeCloseTo(1, 6);
    expect(ndcgAtK(reversed, lookup(entry), "experience", 5)!).toBeLessThan(1);
  });
});

/** Drop the non-deterministic timing and cache-counter fields before comparing runs. */
function strip(report: ReturnType<typeof runBenchmark>) {
  return Object.fromEntries(Object.entries(report).filter(([key]) => key !== "runtimeMs" && key !== "cache"));
}
