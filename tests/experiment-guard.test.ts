// The micro-tuning guard must actually reject the patterns it claims to prevent. These tests
// exercise its detection logic on synthetic records so the protection is verified rather than
// merely asserted in prose.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditRecords, mechanismKey, type RecordFields } from "../scripts/experiment-guard";

const portfolio = JSON.parse(readFileSync("config/research-portfolio.json", "utf8"));

function record(overrides: Partial<RecordFields> & { id: string }): RecordFields {
  return {
    path: `experiments/records/${overrides.id}/record.md`,
    timestamp: "2026-08-23T00:00:00.000Z",
    workstream: "preference representation + extraction",
    informationValue: "HIGH",
    scope: "SUBSYSTEM",
    mechanism: "whether embedding retrieval recovers preference language the lexicon misses",
    parameterSearchPreregistered: false,
    repeatJustification: null,
    decision: null,
    ...overrides,
  };
}

describe("research portfolio structure", () => {
  it("declares all eight workstreams with every required field", () => {
    expect(portfolio.workstreams).toHaveLength(8);
    expect(portfolio.workstreams.map((entry: { id: number }) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const workstream of portfolio.workstreams) {
      for (const key of ["largestUncertainty", "currentHypothesis", "currentBestStrategy", "strongestFailedAlternative", "highestValueNextExperiment", "diminishingReturnsEvidence"]) {
        expect(typeof workstream[key], `${workstream.name}.${key}`).toBe("string");
        expect(workstream[key].length, `${workstream.name}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("requires a global portfolio review every 60 to 90 minutes", () => {
    expect(portfolio.reviewCadenceMinutes).toEqual({ min: 60, max: 90 });
  });
});

describe("declaration rule", () => {
  it("accepts a fully declared experiment", () => {
    expect(auditRecords([record({ id: "good" })], portfolio)).toEqual([]);
  });

  it("rejects a missing workstream, information value, scope, or mechanism", () => {
    for (const missing of ["workstream", "informationValue", "scope", "mechanism"] as const) {
      const findings = auditRecords([record({ id: `missing-${missing}`, [missing]: null })], portfolio);
      expect(findings.some((finding) => finding.rule === "DECLARATION"), missing).toBe(true);
    }
  });

  it("rejects a workstream that is not in the portfolio", () => {
    const findings = auditRecords([record({ id: "bogus", workstream: "vibes-based refactoring" })], portfolio);
    expect(findings.map((finding) => finding.rule)).toContain("DECLARATION");
  });

  it("rejects an information value or scope outside the declared vocabulary", () => {
    expect(auditRecords([record({ id: "iv", informationValue: "ENORMOUS" })], portfolio).some((f) => f.rule === "DECLARATION")).toBe(true);
    expect(auditRecords([record({ id: "sc", scope: "GLOBAL" })], portfolio).some((f) => f.rule === "DECLARATION")).toBe(true);
  });
});

describe("anti-repetition rule", () => {
  const mechanism = "whether DWA-level partial credit carries any signal";
  const consecutive = (count: number, lastJustification: string | null = null) =>
    Array.from({ length: count }, (_, index) =>
      record({
        id: `rep-${index + 1}`,
        timestamp: `2026-08-23T0${index}:00:00.000Z`,
        workstream: "Preference Fit",
        mechanism,
        repeatJustification: index === count - 1 ? lastJustification : null,
      }),
    );

  it("allows two consecutive experiments on the same mechanism", () => {
    expect(auditRecords(consecutive(2), portfolio).filter((finding) => finding.rule === "ANTI_REPETITION")).toEqual([]);
  });

  it("rejects an unjustified third consecutive experiment on the same mechanism", () => {
    const findings = auditRecords(consecutive(3), portfolio).filter((finding) => finding.rule === "ANTI_REPETITION");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.record).toBe("rep-3");
  });

  it("allows a third when the repeat is justified in writing", () => {
    const findings = auditRecords(consecutive(3, "The first two isolated the mechanism to DWA breadth; a third separates breadth from importance weighting, which no other workstream can answer."), portfolio);
    expect(findings.filter((finding) => finding.rule === "ANTI_REPETITION")).toEqual([]);
  });

  it("treats a reworded restatement of the same mechanism as the same mechanism", () => {
    expect(mechanismKey("Nudging the task threshold up")).toBe(mechanismKey("nudge up the threshold task"));
    expect(mechanismKey("tune the DWA partial credit coefficient to 0.55")).toBe(mechanismKey("Coefficient credit DWA partial"));
  });

  it("does not collapse genuinely different mechanisms", () => {
    expect(mechanismKey("whether embedding retrieval improves extraction recall")).not.toBe(mechanismKey("whether DWA partial credit carries signal"));
  });

  it("switching workstreams resets the run", () => {
    const records = [
      record({ id: "a", timestamp: "2026-08-23T00:00:00.000Z", mechanism: "mechanism one" }),
      record({ id: "b", timestamp: "2026-08-23T01:00:00.000Z", mechanism: "mechanism one" }),
      record({ id: "c", timestamp: "2026-08-23T02:00:00.000Z", mechanism: "a completely different question about retrieval" }),
      record({ id: "d", timestamp: "2026-08-23T03:00:00.000Z", mechanism: "mechanism one" }),
    ];
    expect(auditRecords(records, portfolio).filter((finding) => finding.rule === "ANTI_REPETITION")).toEqual([]);
  });
});

describe("preregistered parameter-search rule", () => {
  it("rejects threshold nudging without a preregistered parameter search", () => {
    const findings = auditRecords([record({ id: "nudge", mechanism: "raise the task threshold from 0.46 to 0.48" })], portfolio);
    expect(findings.some((finding) => finding.rule === "PARAMETER_SEARCH")).toBe(true);
  });

  it("rejects additive regex and keyword accumulation and prompt variant sweeps", () => {
    for (const mechanism of ["add three more regex patterns for dislike verbs", "extend the keyword lexicon with routine synonyms", "try four prompt variants for the reranker"]) {
      expect(auditRecords([record({ id: "m", mechanism })], portfolio).some((finding) => finding.rule === "PARAMETER_SEARCH"), mechanism).toBe(true);
    }
  });

  it("accepts the same work once an explicit parameter search is preregistered", () => {
    const findings = auditRecords([record({ id: "sweep", mechanism: "sweep the task threshold across 0.30-0.60", parameterSearchPreregistered: true })], portfolio);
    expect(findings.filter((finding) => finding.rule === "PARAMETER_SEARCH")).toEqual([]);
  });

  it("does not flag a mechanism-level question as parameter nudging", () => {
    expect(auditRecords([record({ id: "family", mechanism: "whether embedding retrieval finds preference language the lexical extractor misses" })], portfolio)).toEqual([]);
  });
});
