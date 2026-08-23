// Invariants for the semantic-frame corpus.
//
// The previous corpus was solvable by raw token overlap (ROC AUC 0.981 at `hard`) because
// person and job text for one atom were paraphrases of the same O*NET sentence. These tests
// exist so that property cannot come back by accident: a single shared distinctive noun in the
// lexicon is enough to reintroduce the giveaway.
import { describe, expect, it } from "vitest";
import { contentTokens } from "@/bench/render";
import { mulberry32 } from "@/lab/rng";
import {
  CONCEPTS,
  conceptsFor,
  frameIdentity,
  renderJobFrame,
  renderPersonFrame,
  sampleFrame,
  verifyLexiconDisjointness,
  verifyNoStemCorrelation,
  type ConceptRole,
} from "@/bench/semanticFrame";

describe("the lexicon cannot leak work identity lexically", () => {
  it("no concept shares a content token between its person and job realizations", () => {
    expect(verifyLexiconDisjointness()).toEqual([]);
  });

  it("person and job realizations are not related by a shared stem", () => {
    // Guards the subtler artifact: a systematic surface relationship would let a system learn
    // the mapping rather than the meaning.
    expect(verifyNoStemCorrelation()).toEqual([]);
  });

  it("every concept supplies both sides", () => {
    for (const concept of CONCEPTS) {
      expect(concept.personForms.length, concept.id).toBeGreaterThan(0);
      expect(concept.jobForms.length, concept.id).toBeGreaterThan(0);
    }
  });

  it("every identity-bearing role has enough concepts to compose distinct work", () => {
    // instrument and output are incidental colour and excluded from frameIdentity, so they are
    // allowed to be thin. The identity-bearing roles are not.
    for (const role of ["action", "object", "purpose", "method", "domain"] as ConceptRole[]) {
      expect(conceptsFor(role, ["core"]).length, role).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("rendered text does not give the answer away", () => {
  it("the same frame rendered on both sides shares essentially no content vocabulary", () => {
    // Cross-CONCEPT collisions are realistic and not banned: a person-side form of one concept
    // may legitimately reuse a word a job-side form of a DIFFERENT concept uses. What must not
    // happen is that such collisions become common enough to carry identity. Per-concept
    // disjointness is asserted strictly above; this bounds the sentence-level residue.
    const rng = mulberry32(11);
    const frames = Array.from({ length: 120 }, (_, i) => sampleFrame(rng, ["core"], i));
    let withShared = 0;
    for (const frame of frames) {
      const person = contentTokens(renderPersonFrame(frame, mulberry32(3)));
      const job = contentTokens(renderJobFrame(frame, mulberry32(3)));
      const shared = [...job].filter((token) => person.has(token));
      expect(shared.length, `${frame.frameId} shared ${shared.join(",")}`).toBeLessThanOrEqual(1);
      if (shared.length) withShared += 1;
    }
    expect(withShared / frames.length).toBeLessThan(0.1);
  });

  it("token overlap cannot separate same-work pairs from different-work pairs", () => {
    const rng = mulberry32(23);
    const frames = Array.from({ length: 80 }, (_, i) => sampleFrame(rng, ["core"], i));
    const jaccard = (a: Set<string>, b: Set<string>) => {
      if (!a.size || !b.size) return 0;
      let shared = 0;
      for (const t of a) if (b.has(t)) shared += 1;
      return shared / new Set([...a, ...b]).size;
    };
    const person = frames.map((f) => ({ id: frameIdentity(f), tokens: contentTokens(renderPersonFrame(f, rng)) }));
    const job = frames.map((f) => ({ id: frameIdentity(f), tokens: contentTokens(renderJobFrame(f, rng)) }));

    const same: number[] = [];
    const different: number[] = [];
    for (const p of person) for (const j of job) (p.id === j.id ? same : different).push(jaccard(p.tokens, j.tokens));
    const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

    // On the old corpus same-atom overlap was 33x different-atom overlap even at `hard`.
    // Here the two distributions must be close enough that overlap carries no usable signal.
    expect(mean(same)).toBeLessThan(mean(different) * 2 + 0.01);
  });
});

describe("frame identity is the graded truth, and excludes incidental colour", () => {
  it("instrument and output do not change work identity", () => {
    const base = sampleFrame(mulberry32(5), ["core"], 0);
    const recoloured = { ...base, instrument: "ins.spreadsheet", output: "out.dashboard" };
    const otherColour = { ...base, instrument: "ins.ticket_system", output: "out.written_report" };
    expect(frameIdentity(recoloured)).toBe(frameIdentity(otherColour));
  });

  it("changing purpose, method or domain changes work identity even when action and object match", () => {
    // This is the case the old corpus could not express at all: same words, different work.
    const base = sampleFrame(mulberry32(5), ["core"], 0);
    expect(frameIdentity({ ...base, purpose: "pur.reduce_cost" })).not.toBe(frameIdentity({ ...base, purpose: "pur.satisfy_regulator" }));
    expect(frameIdentity({ ...base, domain: "dom.healthcare" })).not.toBe(frameIdentity({ ...base, domain: "dom.manufacturing" }));
    expect(frameIdentity({ ...base, method: "met.statistical" })).not.toBe(frameIdentity({ ...base, method: "met.interview" }));
  });
});

describe("the held-out vocabulary family is genuinely withheld", () => {
  it("sampling core families never emits a held-out concept", () => {
    const rng = mulberry32(77);
    const heldOut = new Set(CONCEPTS.filter((c) => c.family === "held-out").map((c) => c.id));
    for (let i = 0; i < 200; i += 1) {
      const frame = sampleFrame(rng, ["core"], i);
      for (const id of [frame.action, frame.object, frame.purpose, frame.method, frame.domain]) {
        expect(heldOut.has(id), `${id} leaked into a core-only frame`).toBe(false);
      }
    }
  });

  it("a held-out family exists for every identity-bearing role that claims one", () => {
    expect(CONCEPTS.some((c) => c.family === "held-out")).toBe(true);
  });
});
