// Acceptance gates for the frame corpus.
//
// Runs every gate declared in `docs/BENCHMARK_FAMILIES_PREREGISTRATION.md` § 4 and exits
// nonzero if any fails. This is the check that must pass BEFORE any candidate architecture is
// scored — the stopping rule in `docs/RESEARCH_CONTRACT_AMENDMENTS.md` § A makes benchmark
// integrity outrank reaching later phases, and this script is where that is enforced rather
// than asserted.
//
// Nothing here reads a score from the system under test. Every gate is computed from planted
// truth and rendered surface text only.
import { createHash } from "node:crypto";
import {
  buildFrameCorpus,
  allFrameJobs,
  titleOnlyBaselineAuc,
  FRAME_CORPUS_VERSION,
  SPLIT_VOCABULARY,
} from "../src/bench/frameCorpus";
import { labelFramePair } from "../src/bench/frameLabels";
import { measureFamilyLeak, FAMILY_LEAK_EXPECTATIONS } from "../src/bench/familyLeak";
import {
  RENDER_FAMILIES,
  SEMANTIC_FRAME_VERSION,
  identitySpaceSize,
  verifyFamilyCoverage,
  verifyLexiconDisjointness,
  verifyNoStemCorrelation,
  verifyPlausibilityCoverage,
  verifyTrapPairs,
} from "../src/bench/semanticFrame";

/** Corpus size the gates are evaluated at. Small samples cannot resolve a chance-level claim. */
const ACCEPTANCE_PEOPLE = 48;
const TITLE_AUC_TOLERANCE = 0.05;

interface Gate { name: string; pass: boolean; detail: string }
const gates: Gate[] = [];
const add = (name: string, pass: boolean, detail: string) => gates.push({ name, pass, detail });

// --- Gate 1-2: lexicon invariants -----------------------------------------------------
const disjoint = verifyLexiconDisjointness();
add("bridge lexicons are content-token disjoint", disjoint.length === 0,
  disjoint.length ? disjoint.slice(0, 3).map((v) => `${v.conceptId}:${v.sharedTokens.join(",")}`).join("; ") : "0 violations");

const stems = verifyNoStemCorrelation();
add("no person/job stem correlation", stems.length === 0,
  stems.length ? stems.slice(0, 3).map((v) => `${v.conceptId}:${v.sharedTokens.slice(0, 3).join(",")}`).join("; ") : "0 violations");

const coverage = verifyFamilyCoverage();
add("every role populated in every vocabulary family", coverage.length === 0,
  coverage.length ? coverage.join("; ") : `core=${identitySpaceSize(["core"])} identities, held-out=${identitySpaceSize(["held-out"])} identities`);

const traps = verifyTrapPairs();
add("trap pairs are symmetric and confusable", traps.length === 0, traps.length ? traps.join("; ") : "all pairs valid");

const plausibility = verifyPlausibilityCoverage();
add("every object has a plausible action/domain/purpose", plausibility.length === 0,
  plausibility.length ? plausibility.join("; ") : "0 problems");

// --- Gate 5: per-family lexical leak --------------------------------------------------
for (const family of RENDER_FAMILIES) {
  const report = measureFamilyLeak(family, { frames: 300 });
  const expectation = FAMILY_LEAK_EXPECTATIONS[family];
  const trap = report.trapConfusabilityMargin === null ? "" : `, trap margin ${report.trapConfusabilityMargin.toFixed(4)}`;
  add(`lexical leak: ${family}`, report.pass,
    `AUC ${report.lexicalAuc.toFixed(4)} in [${expectation.minAuc}, ${expectation.maxAuc}]${trap}` +
    (report.failures.length ? ` — ${report.failures.join("; ")}` : ""));
}

// --- Gate 2 (surface): no shared source string ----------------------------------------
{
  const corpus = buildFrameCorpus({ people: ACCEPTANCE_PEOPLE });
  const personSentences = new Set(corpus.people.flatMap((person) => person.experienceEvidence.map((entry) => entry.text)));
  const jobSentences = allFrameJobs(corpus).flatMap((job) => job.responsibilities.map((entry) => entry.text));
  const shared = jobSentences.filter((text) => personSentences.has(text));
  add("no person/job sentence is byte-identical", shared.length === 0,
    shared.length ? `${shared.length} shared sentences, e.g. ${JSON.stringify(shared[0])}` : "0 shared sentences");
}

// --- Gate 6: title/industry counterfactual --------------------------------------------
{
  const corpus = buildFrameCorpus({ people: ACCEPTANCE_PEOPLE });
  for (const signal of ["title", "industry"] as const) {
    const { auc, relevant, irrelevant } = titleOnlyBaselineAuc(corpus, labelFramePair, signal);
    add(`${signal}-only baseline scores at chance`, Math.abs(auc - 0.5) <= TITLE_AUC_TOLERANCE,
      `AUC ${auc.toFixed(4)} (tolerance ±${TITLE_AUC_TOLERANCE}, relevant=${relevant}, irrelevant=${irrelevant})`);
  }
}

// --- Gate 7: deterministic reproducibility --------------------------------------------
{
  const digest = (people: number) => {
    const corpus = buildFrameCorpus({ people });
    const payload = JSON.stringify({
      people: corpus.people.map((p) => ({ id: p.personId, narrative: p.narrative })),
      jobs: allFrameJobs(corpus).map((j) => ({ id: j.jobId, text: j.descriptionText, archetype: j.archetype })),
    });
    return createHash("sha256").update(payload).digest("hex");
  };
  const first = digest(8);
  const second = digest(8);
  add("corpus is byte-identical across builds", first === second, `sha256 ${first.slice(0, 16)}`);
}

// --- Gate 8: DEVELOPMENT / VALIDATION disjoint ----------------------------------------
{
  const development = buildFrameCorpus({ people: 16, split: "DEVELOPMENT" });
  const validation = buildFrameCorpus({ people: 16, split: "VALIDATION" });
  const devIdentities = new Set(development.people.flatMap((p) => p.performed.map((e) => e.work.identity)));
  const valIdentities = validation.people.flatMap((p) => p.performed.map((e) => e.work.identity));
  const overlap = valIdentities.filter((identity) => devIdentities.has(identity));
  add("DEVELOPMENT and VALIDATION share no work identity", overlap.length === 0,
    overlap.length ? `${overlap.length} shared identities` : `dev vocab=[${SPLIT_VOCABULARY.DEVELOPMENT}], val vocab=[${SPLIT_VOCABULARY.VALIDATION}]`);

  // Vocabulary withholding: no VALIDATION concept may come from the development family.
  const devConcepts = new Set(development.people.flatMap((p) => p.performed.flatMap((e) => Object.values(e.work.frame))));
  const valConcepts = validation.people.flatMap((p) => p.performed.flatMap((e) => Object.values(e.work.frame)));
  const conceptOverlap = valConcepts.filter((concept) => concept.startsWith("act.") || concept.startsWith("obj.") ? devConcepts.has(concept) : false);
  add("VALIDATION vocabulary is withheld from DEVELOPMENT", conceptOverlap.length === 0,
    conceptOverlap.length ? `${conceptOverlap.length} shared concepts, e.g. ${conceptOverlap[0]}` : "no shared action/object concepts");
}

// --- Gate 9: LOCKED remains unexecuted ------------------------------------------------
add("LOCKED_CONFIRMATION not executed by this script", true, "acceptance never builds or scores the locked split");

// --- Gate: graded relevance actually exists -------------------------------------------
{
  const corpus = buildFrameCorpus({ people: ACCEPTANCE_PEOPLE });
  const histogram = [0, 0, 0, 0];
  for (const person of corpus.people) {
    for (const job of corpus.jobsByPerson.get(person.personId) ?? []) histogram[labelFramePair(person, job).experience.grade] += 1;
  }
  const populated = histogram.every((count) => count > 0);
  add("all four relevance grades are populated", populated,
    `grade histogram 0/1/2/3 = ${histogram.join(" / ")}` + (populated ? "" : " — NDCG cannot distinguish rankings on an unpopulated scale"));

  // The joint objective must have a non-empty relevant set, or every joint metric silently
  // reports on nothing.
  let joint = 0;
  for (const person of corpus.people) {
    for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
      const label = labelFramePair(person, job);
      if (label.experience.grade >= 2 && label.preference.grade >= 2) joint += 1;
    }
  }
  add("joint experience+preference relevant set is non-empty", joint > 0, `${joint} jointly relevant pairs`);
}

// --- Report ----------------------------------------------------------------------------
const passed = gates.every((gate) => gate.pass);
process.stdout.write(`\nFRAME CORPUS ACCEPTANCE — ${FRAME_CORPUS_VERSION} / ${SEMANTIC_FRAME_VERSION}\n`);
process.stdout.write(`evaluated at ${ACCEPTANCE_PEOPLE} people\n\n`);
for (const gate of gates) {
  process.stdout.write(`  ${gate.pass ? "PASS" : "FAIL"}  ${gate.name}\n        ${gate.detail}\n`);
}
process.stdout.write(`\n${gates.filter((g) => g.pass).length}/${gates.length} gates passed\n`);
if (!passed) {
  process.stderr.write("frame corpus acceptance FAILED; the corpus may not be used to score any architecture\n");
  process.exit(1);
}
