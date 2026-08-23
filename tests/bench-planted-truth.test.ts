// The benchmark's scientific validity depends on properties that must be ASSERTED, not
// assumed. If any of these break, every ranking number in the product report becomes
// meaningless, so they are tested first.
//
//  1. NON-CIRCULARITY: labels are computed from planted atom identity and never from a score.
//  2. PARAPHRASE GAP: person-side and job-side renderings of the same atom differ materially,
//     so the benchmark is not string equality.
//  3. CHANNEL INDEPENDENCE IS PLANTED: performed / liked / disliked / desired overlap only
//     where deliberately arranged, and all required combinations occur.
//  4. ORTHOGONAL TITLES: titles and industries are assigned independently of atoms.
//  5. DETERMINISM: same configuration, byte-identical corpus.
//  6. NO LEAKAGE: no atom id, planted label, or corpus metadata reaches the algorithm.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allJobs, buildBenchCorpus, JOB_ARCHETYPES, SPLIT_PARAPHRASE_FAMILIES } from "@/bench/corpus";
import { dominates, gradeFor, INCIDENTAL_LABEL_WEIGHT, isJointRelevant, isSurprisingTransfer, isTransitionRelevant, labelPair, paretoFrontier } from "@/bench/labels";
import { paraphrase, tokenOverlap } from "@/bench/render";
import { buildAtomPool } from "@/bench/workAtoms";
import { buildPersonFromRenderedText, buildJobFromRenderedText } from "@/bench/pipeline";
import { mulberry32 } from "@/lab/rng";

const corpus = buildBenchCorpus({ people: 6 });
const people = corpus.people;
const jobsFor = (personId: string) => corpus.jobsByPerson.get(personId)!;

describe("non-circularity", () => {
  it("the label module imports nothing from the scoring or mapping pipeline", () => {
    const source = readFileSync("src/bench/labels.ts", "utf8");
    for (const forbidden of ["@/v3/fit", "@/v3/mapper", "@/v3/person", "@/v3/job", "@/domain/engine", "@/bench/pipeline"]) {
      expect(source, `labels.ts must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("labels are unchanged by anything the scorer does", () => {
    // Computing labels before and after running the full pipeline must give identical results.
    const person = people[0]!;
    const jobs = jobsFor(person.personId);
    const before = jobs.map((job) => labelPair(person, job));
    buildPersonFromRenderedText(person);
    for (const job of jobs) buildJobFromRenderedText(job);
    const after = jobs.map((job) => labelPair(person, job));
    expect(after).toEqual(before);
  });

  it("labels depend only on planted atom overlap", () => {
    const person = people[0]!;
    const job = jobsFor(person.personId).find((entry) => entry.archetype === "OBVIOUS_EXPERIENCE_MATCH")!;
    const label = labelPair(person, job);
    const performedIds = new Set(person.performed.map((entry) => entry.atom.atomId));
    const expectedCore = job.coreAtoms.filter((atom) => performedIds.has(atom.atomId)).length;
    const expectedIncidental = job.incidentalAtoms.filter((atom) => performedIds.has(atom.atomId)).length;
    const denominator = job.coreAtoms.length + job.incidentalAtoms.length * INCIDENTAL_LABEL_WEIGHT;
    expect(label.experience.raw).toBeCloseTo((expectedCore + expectedIncidental * INCIDENTAL_LABEL_WEIGHT) / denominator, 10);
  });
});

describe("paraphrase gap", () => {
  it("never emits the verbatim task statement at standard or hard difficulty", () => {
    for (const person of people) {
      for (const entry of person.experienceEvidence) {
        expect(entry.rendered.difficulty).not.toBe("verbatim");
        const atom = person.performed.find((performed) => performed.atom.atomId === entry.rendered.atomId)!;
        expect(entry.rendered.text).not.toBe(atom.atom.statement);
      }
    }
  });

  it("person-side and job-side renderings of the same atom differ materially", () => {
    const overlaps: number[] = [];
    for (const person of people) {
      const byAtom = new Map(person.experienceEvidence.map((entry) => [entry.rendered.atomId, entry.rendered.text]));
      for (const job of jobsFor(person.personId)) {
        for (const responsibility of job.responsibilities) {
          const personText = byAtom.get(responsibility.rendered.atomId);
          if (!personText) continue;
          expect(personText).not.toBe(responsibility.rendered.text);
          overlaps.push(tokenOverlap(personText, responsibility.rendered.text));
        }
      }
    }
    expect(overlaps.length).toBeGreaterThan(20);
    const mean = overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
    // Well below 1.0: the two sides are genuinely different surface text.
    expect(mean).toBeLessThan(0.7);
  });

  it("the hard tier removes materially more signal than the standard tier", () => {
    const statement = "Analyze validation test data to determine whether systems or processes have met validation criteria, or to identify root causes of production problems.";
    const standard = paraphrase(statement, mulberry32(7), 0, "standard");
    const hard = paraphrase(statement, mulberry32(7), 0, "hard");
    expect(hard.split(/\s+/).length).toBeLessThan(standard.split(/\s+/).length);
    expect(tokenOverlap(hard, statement)).toBeLessThan(tokenOverlap(standard, statement));
  });

  it("withholds paraphrase families from DEVELOPMENT so template overfitting is detectable", () => {
    const development = new Set(SPLIT_PARAPHRASE_FAMILIES.DEVELOPMENT);
    const validation = SPLIT_PARAPHRASE_FAMILIES.VALIDATION;
    expect(validation.length).toBeGreaterThan(0);
    for (const family of validation) expect(development.has(family)).toBe(false);
  });
});

describe("planted channel independence", () => {
  it("plants every required experience/preference/direction combination", () => {
    let performedAndLiked = 0;
    let performedAndDisliked = 0;
    let likedNeverPerformed = 0;
    let desiredNeverPerformed = 0;
    for (const person of people) {
      const performed = new Set(person.performed.map((entry) => entry.atom.atomId));
      performedAndLiked += person.liked.filter((atom) => performed.has(atom.atomId)).length;
      performedAndDisliked += person.disliked.filter((atom) => performed.has(atom.atomId)).length;
      likedNeverPerformed += person.liked.filter((atom) => !performed.has(atom.atomId)).length;
      desiredNeverPerformed += person.desired.filter((atom) => !performed.has(atom.atomId)).length;
    }
    expect(performedAndLiked).toBeGreaterThan(0);
    expect(performedAndDisliked).toBeGreaterThan(0);
    expect(likedNeverPerformed).toBeGreaterThan(0);
    expect(desiredNeverPerformed).toBeGreaterThan(0);
  });

  it("never plants an atom as both liked and disliked for one person", () => {
    for (const person of people) {
      const liked = new Set(person.liked.map((atom) => atom.atomId));
      for (const atom of person.disliked) expect(liked.has(atom.atomId)).toBe(false);
    }
  });

  it("plants direction independently of experience", () => {
    for (const person of people) {
      const performed = new Set(person.performed.map((entry) => entry.atom.atomId));
      // Every desired atom is work the person has NOT performed, so Direction cannot be a
      // function of Experience.
      for (const atom of person.desired) expect(performed.has(atom.atomId)).toBe(false);
    }
  });

  it("produces all the required known-answer cases across archetypes", () => {
    const present = new Set(allJobs(corpus).map((job) => job.archetype));
    for (const archetype of ["OBVIOUS_EXPERIENCE_MATCH", "CROSS_TITLE_TRANSFER", "CROSS_INDUSTRY_TRANSFER", "SAME_TITLE_DIFFERENT_WORK", "EXPERIENCE_WITH_DISLIKED_WORK", "TRANSITION_PREFERENCE_DIRECTION", "INCIDENTAL_ONLY_MATCH", "QUALIFICATION_ONLY", "IRRELEVANT"] as const) {
      expect(present.has(archetype), archetype).toBe(true);
    }
    expect(JOB_ARCHETYPES.length).toBeGreaterThanOrEqual(11);
  });

  it("labels the required E/P/D/Q case matrix correctly", () => {
    for (const person of people) {
      const jobs = jobsFor(person.personId);
      const labelOf = (archetype: string) => {
        const job = jobs.find((entry) => entry.archetype === archetype);
        return job ? labelPair(person, job) : null;
      };
      // CASE A: high experience, low preference (the burned-out expert).
      const disliked = labelOf("EXPERIENCE_WITH_DISLIKED_WORK");
      if (disliked) {
        expect(disliked.experience.grade).toBeGreaterThanOrEqual(2);
        expect(disliked.preference.raw).toBeLessThan(disliked.experience.raw);
      }
      // CASE B: low experience, high direction (the career changer).
      const transition = labelOf("TRANSITION_PREFERENCE_DIRECTION");
      if (transition) {
        expect(transition.experience.grade).toBeLessThanOrEqual(1);
        expect(transition.direction.grade).toBeGreaterThanOrEqual(2);
      }
      // CASE D: qualification satisfied, no work relationship.
      const qualificationOnly = labelOf("QUALIFICATION_ONLY");
      if (qualificationOnly) {
        expect(qualificationOnly.experience.grade).toBe(0);
        expect(qualificationOnly.direction.grade).toBe(0);
      }
      // SAME_TITLE_DIFFERENT_WORK carries no planted experience relevance at all.
      const trap = labelOf("SAME_TITLE_DIFFERENT_WORK");
      if (trap) expect(trap.experience.grade).toBe(0);
    }
  });
});

describe("orthogonal titles and industries", () => {
  it("assigns titles independently of the atoms' source strata", () => {
    // A CROSS_TITLE_TRANSFER job carries the person's own performed work under someone else's
    // title, which is what makes title-only matching fail on it by construction.
    for (const person of people) {
      const job = jobsFor(person.personId).find((entry) => entry.archetype === "CROSS_TITLE_TRANSFER");
      if (!job) continue;
      expect(job.titleStratum).not.toBe(person.homeStratum);
      const performed = new Set(person.performed.map((entry) => entry.atom.atomId));
      expect(job.coreAtoms.some((atom) => performed.has(atom.atomId))).toBe(true);
    }
  });

  it("gives the title-collision trap the person's own title and none of their work", () => {
    for (const person of people) {
      const job = jobsFor(person.personId).find((entry) => entry.archetype === "SAME_TITLE_DIFFERENT_WORK");
      if (!job) continue;
      expect(job.titleStratum).toBe(person.homeStratum);
      const held = new Set([...person.performed.map((entry) => entry.atom.atomId), ...person.liked.map((atom) => atom.atomId), ...person.desired.map((atom) => atom.atomId)]);
      expect(job.coreAtoms.filter((atom) => held.has(atom.atomId))).toEqual([]);
    }
  });
});

describe("determinism and leakage", () => {
  it("produces a byte-identical corpus for the same configuration", () => {
    const a = buildBenchCorpus({ people: 4 });
    const b = buildBenchCorpus({ people: 4 });
    expect(JSON.stringify(serialize(b))).toBe(JSON.stringify(serialize(a)));
  });

  it("produces a deterministic atom pool", () => {
    expect(buildAtomPool(11, 5).atoms.map((atom) => atom.atomId)).toEqual(buildAtomPool(11, 5).atoms.map((atom) => atom.atomId));
  });

  it("leaks no atom id or planted label into anything the algorithm receives", () => {
    const person = people[0]!;
    const jobs = jobsFor(person.personId);
    const allAtomIds = new Set([
      ...person.performed.map((entry) => entry.atom.atomId),
      ...person.liked.map((atom) => atom.atomId),
      ...person.desired.map((atom) => atom.atomId),
      ...jobs.flatMap((job) => [...job.coreAtoms, ...job.incidentalAtoms].map((atom) => atom.atomId)),
    ]);
    const v3Person = buildPersonFromRenderedText(person);
    const v3Jobs = jobs.map(buildJobFromRenderedText);
    const exposed = JSON.stringify({ v3Person, v3Jobs });
    for (const atomId of allAtomIds) expect(exposed, `atom id ${atomId} leaked into the pipeline input`).not.toContain(atomId);
    for (const token of ["coreAtoms", "incidentalAtoms", "plantedTruth", "archetype", "targetPersonId", "atomId"]) {
      expect(exposed, `${token} leaked into the pipeline input`).not.toContain(token);
    }
  });
});

describe("label helpers", () => {
  it("quantizes grades monotonically", () => {
    expect(gradeFor(0)).toBe(0);
    expect(gradeFor(0.2)).toBe(1);
    expect(gradeFor(0.4)).toBe(2);
    expect(gradeFor(1)).toBe(3);
  });

  it("computes dominance and the Pareto frontier over independent channels", () => {
    const person = people[0]!;
    const labels = jobsFor(person.personId).map((job) => labelPair(person, job));
    const frontier = paretoFrontier(labels);
    expect(frontier.length).toBeGreaterThan(0);
    for (const candidate of frontier) {
      expect(labels.some((other) => other.jobId !== candidate.jobId && dominates(other, candidate))).toBe(false);
    }
  });

  it("requires relevance for a transfer to count as surprising", () => {
    const person = people[0]!;
    for (const job of jobsFor(person.personId)) {
      const label = labelPair(person, job);
      if (isSurprisingTransfer(label)) {
        expect(label.experience.grade).toBeGreaterThanOrEqual(2);
        expect(label.crossTitle || label.crossIndustry).toBe(true);
      }
    }
  });

  it("requires low experience for a transition, and both channels for joint relevance", () => {
    const person = people[0]!;
    for (const job of jobsFor(person.personId)) {
      const label = labelPair(person, job);
      if (isTransitionRelevant(label)) expect(label.experience.grade).toBeLessThanOrEqual(1);
      if (isJointRelevant(label)) {
        expect(label.experience.grade).toBeGreaterThanOrEqual(2);
        expect(label.preference.grade).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

function serialize(corpusToSerialize: ReturnType<typeof buildBenchCorpus>) {
  return {
    people: corpusToSerialize.people.map((person) => ({ id: person.personId, narrative: person.narrative, performed: person.performed.map((entry) => entry.atom.atomId) })),
    jobs: allJobs(corpusToSerialize).map((job) => ({ id: job.jobId, title: job.title, text: job.descriptionText, core: job.coreAtoms.map((atom) => atom.atomId) })),
  };
}
