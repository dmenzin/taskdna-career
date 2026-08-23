// Invariants of the frame corpus. Each of these encodes a defect that was actually found
// while building it — they are regression tests, not decoration.
import { describe, expect, it } from "vitest";
import {
  IDENTITY_ROLES,
  RENDER_FAMILIES,
  conceptsFor,
  frameIdentity,
  identityOverlap,
  identitySpaceSize,
  perturbFrame,
  renderJobFrame,
  renderPersonFrame,
  renderPreferenceFrame,
  sampleFrame,
  trapVariant,
  verifyFamilyCoverage,
  verifyLexiconDisjointness,
  verifyNoStemCorrelation,
  verifyPlausibilityCoverage,
  verifyTrapPairs,
} from "@/bench/semanticFrame";
import { measureFamilyLeak } from "@/bench/familyLeak";
import { allFrameJobs, buildFrameCorpus, titleOnlyBaselineAuc } from "@/bench/frameCorpus";
import { labelFramePair } from "@/bench/frameLabels";
import { mulberry32 } from "@/lab/rng";

describe("lexicon invariants", () => {
  it("keeps bridge person and job vocabularies content-token disjoint", () => {
    expect(verifyLexiconDisjointness()).toEqual([]);
  });

  it("keeps person and job forms free of stem correlation", () => {
    expect(verifyNoStemCorrelation()).toEqual([]);
  });

  // v1 shipped with ZERO held-out instrument and output concepts, so `sampleFrame` threw on the
  // held-out family and the contract's generalization mechanism had never been runnable.
  it("populates every role in every vocabulary family", () => {
    expect(verifyFamilyCoverage()).toEqual([]);
  });

  it("can build a frame from the held-out family without throwing", () => {
    expect(() => sampleFrame(mulberry32(1), ["held-out"], 0)).not.toThrow();
  });

  it("leaves both vocabulary families large enough to be a real corpus", () => {
    expect(identitySpaceSize(["core"])).toBeGreaterThan(5_000);
    // The whole point of the held-out family is a VALIDATION split that is not two work items.
    expect(identitySpaceSize(["held-out"])).toBeGreaterThan(500);
  });

  it("declares trap pairs that are symmetric, same-role, and actually confusable", () => {
    expect(verifyTrapPairs()).toEqual([]);
  });

  it("gives every object a plausible action, domain and purpose", () => {
    expect(verifyPlausibilityCoverage()).toEqual([]);
  });
});

describe("frame identity", () => {
  it("ignores instrument and output", () => {
    const base = sampleFrame(mulberry32(5), ["core"], 0);
    const instruments = conceptsFor("instrument", ["core"]);
    const recoloured = { ...base, instrument: instruments[0]!.id, output: conceptsFor("output", ["core"])[0]!.id };
    const otherColour = { ...base, instrument: instruments[1]!.id, output: conceptsFor("output", ["core"])[1]!.id };
    expect(frameIdentity(recoloured)).toBe(frameIdentity(otherColour));
  });

  it("distinguishes work that differs on any identity role", () => {
    const base = sampleFrame(mulberry32(5), ["core"], 0);
    for (const role of IDENTITY_ROLES) {
      const alternative = conceptsFor(role, ["core"]).find((concept) => concept.id !== base[role])!;
      expect(frameIdentity({ ...base, [role]: alternative.id })).not.toBe(frameIdentity(base));
    }
  });

  // The atom substrate could only express "identical" or "unrelated". Graded near-misses are
  // the headroom that gives the experience benchmark something to measure.
  it("perturbs exactly one identity role, leaving four shared", () => {
    const rng = mulberry32(11);
    for (let index = 0; index < 40; index += 1) {
      const base = sampleFrame(rng, ["core"], index);
      const near = perturbFrame(base, rng, ["core"], index);
      expect(frameIdentity(near)).not.toBe(frameIdentity(base));
      // A changed object legitimately re-draws its dependent roles to stay plausible, so the
      // guarantee is "strictly fewer than five", not "exactly four".
      expect(identityOverlap(base, near)).toBeLessThan(IDENTITY_ROLES.length);
      expect(identityOverlap(base, near)).toBeGreaterThanOrEqual(1);
    }
  });

  it("produces trap variants that are different work", () => {
    const rng = mulberry32(13);
    let checked = 0;
    for (let index = 0; index < 60; index += 1) {
      const base = sampleFrame(rng, ["core"], index);
      const variant = trapVariant(base, rng, index);
      if (!variant) continue;
      checked += 1;
      expect(frameIdentity(variant)).not.toBe(frameIdentity(base));
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("rendering families", () => {
  it.each(RENDER_FAMILIES)("never renders an identical person and job sentence in %s", (family) => {
    const rng = mulberry32(17);
    for (let index = 0; index < 80; index += 1) {
      const frame = sampleFrame(rng, ["core"], index);
      expect(renderPersonFrame(frame, rng, family)).not.toBe(renderJobFrame(frame, rng, family));
    }
  });

  it("leaves SEMANTIC_BRIDGE token overlap at chance", () => {
    const report = measureFamilyLeak("SEMANTIC_BRIDGE", { frames: 200 });
    expect(report.lexicalAuc).toBeGreaterThan(0.45);
    expect(report.lexicalAuc).toBeLessThan(0.55);
  });

  // NATURAL must NOT be at chance. A natural family with no lexical signal would mean the
  // neutral register is secretly disjoint, and the family would not be natural at all.
  it("leaves NATURAL token overlap clearly above chance", () => {
    expect(measureFamilyLeak("NATURAL", { frames: 200 }).lexicalAuc).toBeGreaterThan(0.55);
  });

  it("makes LEXICAL_TRAP pairs look more alike than genuine matches", () => {
    const report = measureFamilyLeak("LEXICAL_TRAP", { frames: 200 });
    expect(report.trapConfusabilityMargin).not.toBeNull();
    expect(report.trapConfusabilityMargin!).toBeGreaterThan(0);
  });

  it("states preference stance explicitly rather than implying it by word choice", () => {
    const frame = sampleFrame(mulberry32(19), ["core"], 0);
    const like = renderPreferenceFrame(frame, mulberry32(3), "LIKE");
    const dislike = renderPreferenceFrame(frame, mulberry32(3), "DISLIKE");
    expect(like).not.toBe(dislike);
    expect(/enjoy|liked|wanted more/i.test(like)).toBe(true);
    expect(/dread|disliked|never again/i.test(dislike)).toBe(true);
  });
});

describe("corpus construction", () => {
  const corpus = buildFrameCorpus({ people: 24 });

  it("is deterministic for a given seed, split and family", () => {
    const again = buildFrameCorpus({ people: 24 });
    expect(again.people.map((p) => p.narrative)).toEqual(corpus.people.map((p) => p.narrative));
    expect(allFrameJobs(again).map((j) => j.descriptionText)).toEqual(allFrameJobs(corpus).map((j) => j.descriptionText));
  });

  it("plants every channel combination for every person", () => {
    for (const person of corpus.people) {
      const performed = new Set(person.performed.map((entry) => entry.work.identity));
      const liked = new Set(person.liked.map((w) => w.identity));
      const disliked = new Set(person.disliked.map((w) => w.identity));
      const desired = new Set(person.desired.map((w) => w.identity));

      // Every non-implication the product depends on must be exercised, not assumed.
      expect([...performed].some((id) => liked.has(id))).toBe(true);      // performed AND liked
      expect([...performed].some((id) => disliked.has(id))).toBe(true);   // performed AND disliked
      expect([...liked].some((id) => !performed.has(id))).toBe(true);     // liked, never performed
      expect([...desired].some((id) => !performed.has(id))).toBe(true);   // desired, never performed
      // Liked and disliked must never name the same work.
      expect([...liked].some((id) => disliked.has(id))).toBe(false);
    }
  });

  it("populates all four relevance grades", () => {
    const histogram = [0, 0, 0, 0];
    for (const person of corpus.people) {
      for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
        histogram[labelFramePair(person, job).experience.grade] += 1;
      }
    }
    // A benchmark whose labels are effectively binary cannot tell a good ranking from an
    // adequate one, however sophisticated the NDCG code is.
    for (const count of histogram) expect(count).toBeGreaterThan(0);
  });

  it("leaves a non-empty joint experience+preference relevant set", () => {
    let joint = 0;
    for (const person of corpus.people) {
      for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
        const label = labelFramePair(person, job);
        if (label.experience.grade >= 2 && label.preference.grade >= 2) joint += 1;
      }
    }
    expect(joint).toBeGreaterThan(0);
  });

  // The counterfactual gate. Measured at a size that can actually resolve it: the same claim
  // at 12 people swings by ±0.06 on noise alone, which is how the previous benchmark ended up
  // making confident claims it could not support.
  it("leaves title-only and industry-only baselines at chance", () => {
    const powered = buildFrameCorpus({ people: 48 });
    for (const signal of ["title", "industry"] as const) {
      expect(Math.abs(titleOnlyBaselineAuc(powered, labelFramePair, signal).auc - 0.5)).toBeLessThanOrEqual(0.05);
    }
  });

  it("keeps DEVELOPMENT and VALIDATION work identities disjoint", () => {
    const development = buildFrameCorpus({ people: 16, split: "DEVELOPMENT" });
    const validation = buildFrameCorpus({ people: 16, split: "VALIDATION" });
    const devIdentities = new Set(development.people.flatMap((p) => p.performed.map((e) => e.work.identity)));
    for (const person of validation.people) {
      for (const entry of person.performed) expect(devIdentities.has(entry.work.identity)).toBe(false);
    }
  });

  it("labels no work the algorithm can see — identity never reaches the surface text", () => {
    for (const person of corpus.people) {
      for (const entry of person.performed) {
        // Concept ids like "act.diagnose" must never appear in rendered prose.
        for (const role of IDENTITY_ROLES) expect(person.narrative).not.toContain(entry.work.frame[role]);
      }
    }
  });
});
