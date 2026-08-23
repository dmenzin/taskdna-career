// Preference, Experience, Qualification, and Direction are FOUR PARALLEL INDEPENDENT
// evidence channels about one person. They may share Task/DWA mapping infrastructure, but
// their semantics differ and no channel may be inferred from another:
//
//   Preference Fit    Does the job contain work the person likes or dislikes?
//   Experience Fit    Does the job contain work the person has actually performed?
//   Direction Fit     Does the job contain work the person explicitly wants to do next?
//   Qualification Fit Does the person's structured qualification evidence meet requirements?
//
// The four non-implications asserted below are the product-level invariant: a career tool
// that treats "has done" as "wants to do" recommends people back into work they are trying to
// leave, and one that treats "wants to do" as "has done" recommends work they cannot get.
import { describe, expect, it } from "vitest";
import { scoreV3 } from "@/v3/fit";
import { buildV3Job } from "@/v3/job";
import { buildV3Person, type RawV3Evidence } from "@/v3/person";
import { channelScoringIsDeterministic, modelAdmissibleBoundaries, STRATEGY_BOUNDARIES } from "@/v3/strategy";

const taskText = "Analyze test data to identify defects or determine calibration requirements.";
const otherTaskText = "Confer with customers to resolve complaints.";
const job = () =>
  buildV3Job({
    id: "job",
    title: "Misleading Executive Title",
    responsibilities: [{ id: "r1", text: taskText }],
    requirements: [{ id: "python", value: "Python", kind: "skill", required: true }],
    context: { domain: "equipment" },
  });

describe("the four channels are parallel and independent", () => {
  it("experience does not imply direction", () => {
    const person = buildV3Person("x", [
      { id: "e", kind: "experience", text: taskText, strength: "deep", ownership: "led", sourceGroup: "role-1" },
    ]);
    expect(person.aspirations).toEqual([]);
    const fit = scoreV3(person, job());
    expect(fit.experience.score).toBeGreaterThan(0);
    expect(fit.direction.score).toBeNull();
  });

  it("direction does not imply experience", () => {
    const person = buildV3Person("x", [{ id: "a", kind: "aspiration", text: taskText }]);
    expect(person.experience).toEqual([]);
    const fit = scoreV3(person, job());
    expect(fit.direction.score).toBeGreaterThan(0);
    expect(fit.experience.score).toBeNull();
  });

  it("experience does not imply preference", () => {
    const person = buildV3Person("x", [
      { id: "e", kind: "experience", text: taskText, strength: "deep", ownership: "led", sourceGroup: "role-1" },
    ]);
    expect(person.preferences).toEqual([]);
    const fit = scoreV3(person, job());
    expect(fit.experience.score).toBeGreaterThan(0);
    expect(fit.preference.score).toBeNull();
  });

  it("preference does not imply experience", () => {
    const person = buildV3Person("x", [{ id: "p", kind: "preference", text: taskText, stance: "LIKE" }]);
    expect(person.experience).toEqual([]);
    const fit = scoreV3(person, job());
    expect(fit.preference.score).toBeGreaterThan(0.5);
    expect(fit.experience.score).toBeNull();
  });

  it("a dislike of work the person has performed keeps both channels intact and opposed", () => {
    // The burned-out expert: deep experience, negative preference. Collapsing the channels
    // would recommend exactly the work this person is leaving.
    const person = buildV3Person("x", [
      { id: "e", kind: "experience", text: taskText, strength: "deep", ownership: "led", sourceGroup: "role-1" },
      { id: "p", kind: "preference", text: taskText, stance: "DISLIKE" },
    ]);
    const fit = scoreV3(person, job());
    expect(fit.experience.score).toBeGreaterThan(0);
    expect(fit.preference.score!).toBeLessThan(0.5);
  });

  it("direction pointing away from current experience is representable", () => {
    // The career changer: experience in one kind of work, aspiration toward another.
    const person = buildV3Person("x", [
      { id: "e", kind: "experience", text: otherTaskText, strength: "deep", ownership: "led", sourceGroup: "role-1" },
      { id: "a", kind: "aspiration", text: taskText },
    ]);
    const fit = scoreV3(person, job());
    expect(fit.direction.score!).toBeGreaterThan(fit.experience.score!);
  });

  it("qualification is independent of all three work-content channels", () => {
    const withoutQualification = buildV3Person("x", [
      { id: "p", kind: "preference", text: taskText, stance: "LIKE" },
      { id: "e", kind: "experience", text: taskText, strength: "deep", ownership: "led", sourceGroup: "role-1" },
      { id: "a", kind: "aspiration", text: taskText },
    ]);
    const fit = scoreV3(withoutQualification, job());
    // Liking, having done, and wanting the work satisfies no requirement.
    expect(fit.qualification.score).toBe(0);
    expect(fit.qualification.diagnostics).toContain("hardGaps=1");
  });

  it("occupation/title context creates no evidence in any channel", () => {
    const person = buildV3Person("x", [{ id: "o", kind: "occupation_context", text: "Senior Reliability Engineer" }]);
    expect(person).toEqual({ id: "x", preferences: [], experience: [], qualifications: [], aspirations: [] });
    const fit = scoreV3(person, job());
    expect([fit.preference.score, fit.experience.score, fit.direction.score]).toEqual([null, null, null]);
  });

  it("shares Task/DWA mapping infrastructure across channels without sharing semantics", () => {
    // Same source text through four different channels maps to the same canonical work
    // (shared infrastructure) but produces four differently-scored channels (distinct
    // semantics).
    const raw: RawV3Evidence[] = [
      { id: "p", kind: "preference", text: taskText, stance: "LIKE" },
      { id: "e", kind: "experience", text: taskText, strength: "demonstrated", ownership: "performed", sourceGroup: "role-1" },
      { id: "a", kind: "aspiration", text: taskText },
    ];
    const person = buildV3Person("x", raw);
    const mappings = [person.preferences[0]!.mapping, person.experience[0]!.mapping, person.aspirations[0]!.mapping];
    expect(new Set(mappings.map((mapping) => mapping.cacheKey)).size).toBe(1);
    const fit = scoreV3(person, job());
    expect(new Set([fit.preference.score, fit.experience.score, fit.direction.score]).size).toBeGreaterThan(1);
  });

  it("there is no combined or overall V3 score", () => {
    const fit = scoreV3(buildV3Person("x", [{ id: "p", kind: "preference", text: taskText, stance: "LIKE" }]), job());
    expect(Object.keys(fit).sort()).toEqual(["direction", "experience", "preference", "qualification"]);
    for (const key of Object.keys(fit)) expect(key).not.toMatch(/overall|combined|total|composite/i);
  });
});

describe("strategy boundaries keep channel scoring deterministic", () => {
  it("declares a replaceable boundary for every experimentable stage", () => {
    expect(STRATEGY_BOUNDARIES.map((entry) => entry.boundary).sort()).toEqual([
      "abstention_policy",
      "contextual_reranking",
      "direction_fit",
      "experience_fit",
      "preference_evidence_extraction",
      "preference_fit",
      "preference_representation",
      "qualification_fit",
      "semantic_retrieval",
      "task_candidate_retrieval",
    ]);
    for (const entry of STRATEGY_BOUNDARIES) {
      expect(entry.construct.length).toBeGreaterThan(0);
      expect(entry.evaluator.length).toBeGreaterThan(0);
      expect(entry.plausibleAlternativeFamilies.length).toBeGreaterThan(0);
    }
  });

  it("never permits a model or agent to author a final channel score", () => {
    expect(channelScoringIsDeterministic()).toBe(true);
    for (const entry of STRATEGY_BOUNDARIES.filter((row) => row.boundary.endsWith("_fit"))) {
      expect(entry.currentFamily).toBe("DETERMINISTIC_ARITHMETIC");
      expect(entry.modelAdmissibility).not.toBe("CANDIDATE_RERANKING");
    }
  });

  it("permits models only at language-interpretation and candidate-reranking boundaries", () => {
    const admissible = modelAdmissibleBoundaries();
    expect(admissible.length).toBeGreaterThan(0);
    for (const entry of admissible) {
      expect(["LANGUAGE_INTERPRETATION", "CANDIDATE_RERANKING"]).toContain(entry.modelAdmissibility);
    }
  });
});
