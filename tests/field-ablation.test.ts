import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createAgentFieldMatchArchitecture,
  type CareerBlueprint,
  type StructuredWork,
} from "@/agent/agentArchitecture";
import { createFieldSubsetArchitecture, productionMatcherAgrees, ROLE_FIELDS, runFieldAblation } from "@/agent/fieldAblation";
import { buildFrameCorpus } from "@/bench/frameCorpus";

const work = (action: string, object: string, purpose: string, method: string, domain: string): StructuredWork =>
  ({ action, object, purpose, method, domain });

describe("R-01 is diagnostic and cannot retune the matcher", () => {
  it("scores identically to production agent-field-match when all five fields are kept", () => {
    const corpus = buildFrameCorpus({ people: 2, split: "DEVELOPMENT", family: "LEXICAL_TRAP" });
    const blueprints = new Map<string, CareerBlueprint>();
    const jobWork = new Map<string, StructuredWork[]>();
    for (const person of corpus.people) {
      blueprints.set(person.personId, {
        personId: person.personId,
        experience: [work("investigate", "failures", "reduce risk", "review", "healthcare")],
        liked: [work("train", "staff", "raise skill", "coaching", "healthcare")],
        disliked: [work("reconcile", "accounts", "improve accuracy", "audit", "finance")],
        desired: [work("forecast", "demand", "cut cost", "statistics", "retail")],
      });
    }
    for (const jobs of corpus.jobsByPerson.values()) {
      for (const job of jobs) jobWork.set(job.jobId, [work("investigate", "failures", "reduce risk", "review", "healthcare")]);
    }
    expect(productionMatcherAgrees(corpus, blueprints, jobWork)).toBe(true);
    const production = createAgentFieldMatchArchitecture(blueprints, jobWork);
    const diagnostic = createFieldSubsetArchitecture(blueprints, jobWork, ROLE_FIELDS, "full");
    const person = corpus.people[0]!;
    const job = corpus.jobsByPerson.get(person.personId)![0]!;
    expect(diagnostic.score(diagnostic.prepare(person), job, "experience")).toBe(
      production.score(production.prepare(person), job, "experience"),
    );
  });

  it("does not edit the production matcher source", () => {
    const source = readFileSync("src/agent/agentArchitecture.ts", "utf8");
    expect(source).toContain('id = "agent-field-match"');
    expect(source).toContain('const ROLE_FIELDS = ["action", "object", "purpose", "method", "domain"]');
    expect(source).not.toContain("leave-one-out");
  });

  it("labels a leave-one-out run as diagnostic", () => {
    const corpus = buildFrameCorpus({ people: 2, split: "DEVELOPMENT", family: "LEXICAL_TRAP" });
    const blueprints = new Map<string, CareerBlueprint>();
    const jobWork = new Map<string, StructuredWork[]>();
    for (const person of corpus.people) {
      blueprints.set(person.personId, {
        personId: person.personId,
        experience: [work("investigate", "failures", "reduce risk", "review", "healthcare")],
        liked: [],
        disliked: [],
        desired: [],
      });
    }
    for (const jobs of corpus.jobsByPerson.values()) {
      for (const job of jobs) jobWork.set(job.jobId, [work("investigate", "failures", "reduce risk", "review", "healthcare")]);
    }
    const report = runFieldAblation(corpus, blueprints, jobWork);
    expect(report.note).toMatch(/Diagnostic only/);
    expect(report.leaveOneOut).toHaveLength(5);
    expect(report.full.fields).toEqual([...ROLE_FIELDS]);
  });
});
