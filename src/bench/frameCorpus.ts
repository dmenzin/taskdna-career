// Planted-truth corpus over SEMANTIC FRAMES.
//
// This replaces the atom-based corpus substrate. The archetype design, channel independence
// and title/industry orthogonality are carried over deliberately — those were sound. What
// changes is the unit of truth: a `WorkFrame` of concept ids rather than a verbatim O*NET
// sentence, so person text and job text are no longer two paraphrases of one shared string.
//
// DESIGN CONSTRAINTS (unchanged in intent, re-established on the new substrate)
// ----------------------------------------------------------------------------
// 1. Channel independence is PLANTED, not derived. performed / liked / disliked / desired are
//    sampled so every required combination occurs, and no channel is a function of another.
// 2. Titles and industries are assigned ORTHOGONALLY to frames — drawn from their own pools
//    with their own RNG draws, never conditioned on the frame's domain concept. That is what
//    makes "different title, same work" and "same title, different work" constructible, and
//    it is why a title-only baseline must score at chance. `titleLeakageTest` measures that
//    this holds via a permutation null rather than assuming it.
// 3. Surface language is rendered independently on each side, under a declared RenderFamily.
//    The algorithm sees only text; the grader sees only frame identity.
//
// WHAT THE FRAME SUBSTRATE MAKES POSSIBLE THAT ATOMS DID NOT
// ----------------------------------------------------------
// Two O*NET atoms were either identical or unrelated, so HARD_NEAR_MISS could only mean
// "a different task from the same occupation" — a blunt instrument. A frame can be perturbed
// in exactly ONE identity role, producing work that shares four of five roles and is
// genuinely, arguably not the same job. LEXICAL_TRAP goes further: swap a role for its
// declared trap partner and the surface stays similar while the work changes.
import { hashSeed, mulberry32, pick, type Rng } from "@/lab/rng";
import {
  frameIdentity,
  perturbFrame,
  renderAspirationFrame,
  renderJobFrame,
  renderPersonFrame,
  renderPreferenceFrame,
  sampleFrame,
  trapVariant,
  type Concept,
  type RenderFamily,
  type WorkFrame,
} from "@/bench/semanticFrame";

export const FRAME_CORPUS_VERSION = "frame-corpus.v1";
export const FRAME_BENCH_SEED = 20260823;

export type BenchSplit = "DEVELOPMENT" | "VALIDATION" | "LOCKED_CONFIRMATION";

/**
 * Vocabulary available per split.
 *
 * VALIDATION draws from a `held-out` family DEVELOPMENT never sees, so a system tuned to
 * development phrasing shows a MEASURABLE generalization gap rather than a silent one.
 */
export const SPLIT_VOCABULARY: Record<BenchSplit, Concept["family"][]> = {
  DEVELOPMENT: ["core"],
  VALIDATION: ["held-out"],
  LOCKED_CONFIRMATION: ["core", "held-out"],
};

/** One piece of planted work. `identity` is the grading key and is never shown to any system. */
export interface FrameWork {
  identity: string;
  frame: WorkFrame;
}

const asWork = (frame: WorkFrame): FrameWork => ({ identity: frameIdentity(frame), frame });

/**
 * Job archetypes. These ARE the known answers: each name states the relationship the job was
 * planted to have with its person, independent of any score.
 */
export const FRAME_JOB_ARCHETYPES = [
  /** Performed work, own title and industry. Conventional matching should also find these. */
  "OBVIOUS_EXPERIENCE_MATCH",
  /**
   * Performed AND liked work, no disliked work. The genuinely good recommendation: strong on
   * two independent channels at once. Without this archetype the joint E+P objective has an
   * EMPTY relevant set, and every joint metric silently reports on nothing.
   */
  "STRONG_EXPERIENCE_AND_PREFERENCE",
  /**
   * Half the core work is performed, half is unrelated. Produces the middle of the grade
   * scale. With only full matches and full misses, relevance is effectively binary and NDCG
   * cannot distinguish a good ranking from a merely adequate one.
   */
  "PARTIAL_EXPERIENCE_MATCH",
  /** One performed frame among three unrelated: the grade-1 rung. */
  "WEAK_EXPERIENCE_MATCH",
  /** Performed work, title borrowed from an unrelated family. Task matching should find it; title matching should not. */
  "CROSS_TITLE_TRANSFER",
  /** Performed work, unrelated industry. */
  "CROSS_INDUSTRY_TRANSFER",
  /** The person's own title, unrelated work. Title matching should be fooled; task matching should not. */
  "SAME_TITLE_DIFFERENT_WORK",
  /** Disliked work plus performed-but-not-liked work. High experience, low preference. */
  "EXPERIENCE_WITH_DISLIKED_WORK",
  /** Liked AND disliked work in one job: the case a mean-based preference score cancels. */
  "MIXED_PREFERENCE",
  /** Liked and desired work never performed. The career-transition case. */
  "TRANSITION_PREFERENCE_DIRECTION",
  /** Liked only: not performed, not desired. */
  "PREFERENCE_ONLY",
  /** Desired only: not performed, not liked. */
  "DIRECTION_ONLY",
  /** One peripheral performed frame among unrelated core work. Must not read as a strong match. */
  "INCIDENTAL_ONLY_MATCH",
  /** Requirements the person satisfies, work they have not done. */
  "QUALIFICATION_ONLY",
  /**
   * Work differing from the person's performed work in exactly ONE identity role. Genuinely
   * similar, genuinely not the same job. This is the headroom the atom substrate could not
   * express.
   */
  "HARD_NEAR_MISS",
  /**
   * A trap-partner swap: the surface reads like the person's performed work, but a role was
   * exchanged for its declared confusable partner, so the work is materially different.
   * A system that matches words rather than meaning should rank these highly and be wrong.
   */
  "LEXICAL_TRAP_NEAR_MISS",
  /** No planted relationship on any channel. */
  "IRRELEVANT",
] as const;
export type FrameJobArchetype = (typeof FRAME_JOB_ARCHETYPES)[number];

/**
 * Title pool, grouped into families purely so "same title" and "different title" are
 * definable. Families are NOT aligned to domain concepts — a title carries no information
 * about the work, which is the property the counterfactual family tests.
 */
export const TITLE_FAMILIES: Record<string, string[]> = {
  analysis: ["Insight Analyst", "Reporting Analyst", "Business Analyst", "Decision Scientist"],
  engineering: ["Reliability Engineer", "Systems Engineer", "Test Engineer", "Platform Engineer"],
  operations: ["Operations Analyst", "Service Manager", "Business Operations Lead", "Process Specialist"],
  assurance: ["Compliance Analyst", "Audit Associate", "Controls Specialist", "Quality Investigator"],
  delivery: ["Programme Lead", "Delivery Manager", "Project Coordinator", "Implementation Lead"],
  commercial: ["Account Executive", "Partnerships Lead", "Category Analyst", "Sourcing Specialist"],
  people: ["People Partner", "Talent Partner", "Learning Specialist", "Capability Lead"],
};
export const TITLE_FAMILY_NAMES = Object.keys(TITLE_FAMILIES);

export const INDUSTRY_POOL = [
  "medical devices", "aerospace", "automotive", "energy utilities", "financial services",
  "public sector", "higher education", "logistics", "consumer electronics", "pharmaceuticals",
  "telecommunications", "industrial manufacturing",
];

export const QUALIFICATION_POOL: { value: string; kind: "skill" | "education" | "credential" | "capability" }[] = [
  { value: "Python", kind: "skill" }, { value: "SQL", kind: "skill" }, { value: "Excel", kind: "skill" },
  { value: "statistical analysis", kind: "capability" }, { value: "technical writing", kind: "capability" },
  { value: "project coordination", kind: "capability" }, { value: "root cause analysis", kind: "capability" },
  { value: "bachelor degree", kind: "education" }, { value: "master degree", kind: "education" },
  { value: "six sigma green belt", kind: "credential" }, { value: "PMP", kind: "credential" },
  { value: "JavaScript", kind: "skill" }, { value: "Tableau", kind: "skill" }, { value: "R", kind: "skill" },
];

export interface PerformedFrame {
  work: FrameWork;
  strength: "weak" | "demonstrated" | "deep";
  ownership: "assisted" | "performed" | "led";
  /** Which rendered evidence statement carried this work. Provenance for traceability. */
  evidenceId: string;
}

export interface PlantedFramePerson {
  personId: string;
  split: BenchSplit;
  family: RenderFamily;
  /** The person's own title family and title. Used to build title-collision jobs. */
  homeTitleFamily: string;
  homeTitle: string;
  homeIndustry: string;

  // ---- planted truth, never visible to the algorithm ----
  performed: PerformedFrame[];
  liked: FrameWork[];
  disliked: FrameWork[];
  desired: FrameWork[];
  qualifications: { value: string; kind: "skill" | "education" | "credential" | "capability" }[];

  // ---- surface language, all the algorithm sees ----
  experienceEvidence: { id: string; text: string }[];
  preferenceEvidence: { id: string; stance: "LIKE" | "DISLIKE"; text: string }[];
  aspirationEvidence: { id: string; text: string }[];
  narrative: string;
}

export interface PlantedFrameJob {
  jobId: string;
  split: BenchSplit;
  family: RenderFamily;
  archetype: FrameJobArchetype;
  targetPersonId: string;
  title: string;
  industry: string;
  /** Family the TITLE came from. Deliberately independent of the work. */
  titleFamily: string;
  coreWork: FrameWork[];
  incidentalWork: FrameWork[];
  requirements: { id: string; value: string; kind: "skill" | "education" | "credential" | "capability"; required: boolean }[];
  responsibilities: { id: string; text: string; core: boolean }[];
  descriptionText: string;
}

export interface FrameBenchCorpus {
  version: string;
  seed: number;
  split: BenchSplit;
  family: RenderFamily;
  vocabulary: Concept["family"][];
  people: PlantedFramePerson[];
  jobsByPerson: Map<string, PlantedFrameJob[]>;
}

export interface BuildFrameCorpusOptions {
  seed?: number;
  split?: BenchSplit;
  family?: RenderFamily;
  people?: number;
  /** Distractor jobs added per person on top of the archetype set. */
  distractors?: number;
}

const shuffle = <T,>(rng: Rng, items: readonly T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
};

/**
 * Build a planted-truth frame corpus.
 *
 * Determinism: everything derives from seed, split, family and person index, so two runs of
 * the same configuration produce byte-identical corpora. `LOCKED_CONFIRMATION` is buildable
 * here — the guard against USING it lives at the evaluation entry points, not in construction.
 */
export function buildFrameCorpus(options: BuildFrameCorpusOptions = {}): FrameBenchCorpus {
  const seed = options.seed ?? FRAME_BENCH_SEED;
  const split = options.split ?? "DEVELOPMENT";
  const family = options.family ?? "SEMANTIC_BRIDGE";
  const peopleCount = options.people ?? 24;
  const distractors = options.distractors ?? 6;
  const vocabulary = SPLIT_VOCABULARY[split];

  const people: PlantedFramePerson[] = [];
  const jobsByPerson = new Map<string, PlantedFrameJob[]>();
  for (let index = 0; index < peopleCount; index += 1) {
    const rng = mulberry32(hashSeed(`frame-person:${seed}:${split}:${family}:${index}`));
    const person = buildPerson(
      `frame-${split.toLowerCase()}-p${String(index + 1).padStart(3, "0")}`,
      split,
      family,
      vocabulary,
      rng,
      index,
    );
    people.push(person);
    const jobRng = mulberry32(hashSeed(`frame-jobs:${seed}:${split}:${family}:${index}`));
    jobsByPerson.set(person.personId, buildJobsFor(person, vocabulary, jobRng, distractors, index));
  }
  return { version: FRAME_CORPUS_VERSION, seed, split, family, vocabulary, people, jobsByPerson };
}

function buildPerson(
  personId: string,
  split: BenchSplit,
  family: RenderFamily,
  vocabulary: Concept["family"][],
  rng: Rng,
  personIndex: number,
): PlantedFramePerson {
  // Planting is arranged so EVERY required channel combination occurs for every person, and
  // each job archetype below has a clean, non-overlapping source:
  //
  //   performed          6 frames
  //   likedFromPerformed 3 of them        -> performed AND liked
  //   disliked           2 others         -> performed AND disliked, never liked
  //   likedAndDesired    2 fresh frames   -> liked AND desired, never performed
  //   likedOnly          2 fresh frames   -> liked ONLY
  //   desiredOnly        2 fresh frames   -> desired ONLY
  let counter = personIndex * 1000;
  const fresh = (n: number) => Array.from({ length: n }, () => asWork(sampleFrame(rng, vocabulary, counter++)));

  const performedWork = fresh(6);
  const likedFromPerformed = shuffle(rng, performedWork).slice(0, 3);
  const disliked = shuffle(rng, performedWork.filter((w) => !likedFromPerformed.includes(w))).slice(0, 2);
  const likedAndDesired = fresh(2);
  const likedOnly = fresh(2);
  const desiredOnly = fresh(2);
  const desired = [...likedAndDesired, ...desiredOnly];
  const liked = [...likedFromPerformed, ...likedAndDesired, ...likedOnly];

  const qualifications = shuffle(rng, QUALIFICATION_POOL).slice(0, 5);
  // Title and industry are drawn from their own pools with their own RNG draws. Nothing about
  // the frames influences them — that orthogonality is the whole counterfactual mechanism.
  const homeTitleFamily = pick(rng, TITLE_FAMILY_NAMES);
  const homeTitle = pick(rng, TITLE_FAMILIES[homeTitleFamily]!);
  const homeIndustry = pick(rng, INDUSTRY_POOL);

  const experienceEvidence = performedWork.map((work, order) => ({
    id: `${personId}-exp-${order + 1}`,
    text: renderPersonFrame(work.frame, rng, family),
  }));
  const performed: PerformedFrame[] = performedWork.map((work, order) => ({
    work,
    strength: pick(rng, ["weak", "demonstrated", "deep"] as const),
    ownership: pick(rng, ["assisted", "performed", "led"] as const),
    evidenceId: experienceEvidence[order]!.id,
  }));

  const preferenceEvidence = [
    ...liked.map((work, order) => ({
      id: `${personId}-pref-like-${order + 1}`,
      stance: "LIKE" as const,
      text: renderPreferenceFrame(work.frame, rng, "LIKE", family),
    })),
    ...disliked.map((work, order) => ({
      id: `${personId}-pref-dislike-${order + 1}`,
      stance: "DISLIKE" as const,
      text: renderPreferenceFrame(work.frame, rng, "DISLIKE", family),
    })),
  ];
  const aspirationEvidence = desired.map((work, order) => ({
    id: `${personId}-asp-${order + 1}`,
    text: renderAspirationFrame(work.frame, rng, family),
  }));

  const narrative = [
    `${homeTitle} working in ${homeIndustry}.`,
    ...experienceEvidence.map((entry) => entry.text),
    ...preferenceEvidence.map((entry) => entry.text),
    ...aspirationEvidence.map((entry) => entry.text),
    `Skills: ${qualifications.map((qualification) => qualification.value).join(", ")}.`,
  ].join(" ");

  return {
    personId, split, family, homeTitleFamily, homeTitle, homeIndustry,
    performed, liked, disliked, desired, qualifications,
    experienceEvidence, preferenceEvidence, aspirationEvidence, narrative,
  };
}

function buildJobsFor(
  person: PlantedFramePerson,
  vocabulary: Concept["family"][],
  rng: Rng,
  distractors: number,
  personIndex: number,
): PlantedFrameJob[] {
  const performedWork = person.performed.map((entry) => entry.work);
  const heldIdentities = new Set(
    [...performedWork, ...person.liked, ...person.disliked, ...person.desired].map((w) => w.identity),
  );
  let counter = personIndex * 5000 + 2000;
  /** Fresh work with no planted relationship to this person, on any channel. */
  const neutral = (n: number): FrameWork[] => {
    const out: FrameWork[] = [];
    let guard = 0;
    while (out.length < n && guard < n * 50) {
      guard += 1;
      const work = asWork(sampleFrame(rng, vocabulary, counter++));
      if (!heldIdentities.has(work.identity) && !out.some((w) => w.identity === work.identity)) out.push(work);
    }
    return out;
  };
  const otherTitleFamilies = TITLE_FAMILY_NAMES.filter((name) => name !== person.homeTitleFamily);

  // TITLE AND INDUSTRY POLICY
  // -------------------------
  // Titles must carry no information about whether a job is relevant. The obvious-looking
  // assignment — relevant archetypes get the person's own title, distractors get a foreign one
  // — silently makes the title a relevance oracle, and a title-only baseline then beats chance
  // for a reason that has nothing to do with understanding work. (Measured on the first build
  // of this corpus: permutation z = 5.1 for title, 18.4 for industry.)
  //
  // So every archetype draws its title by coin flip, EXCEPT the two whose definition is about
  // the title relationship. Those two point in OPPOSITE directions — same-title/different-work
  // against cross-title/same-work — so they cannot combine into a usable title signal either.
  const homeOrOther = (): string => (rng() < 0.5 ? person.homeTitleFamily : pick(rng, otherTitleFamilies));
  const anyIndustry = (): string => (rng() < 0.5 ? person.homeIndustry : pick(rng, INDUSTRY_POOL.filter((i) => i !== person.homeIndustry)));

  // Job SPECS are collected first and only turned into identified jobs after a shuffle.
  //
  // Assigning ids in construction order is a serious defect: archetypes are added
  // relevant-first, so `job-001`..`job-006` were the relevant ones and the distractors came
  // last. Any architecture that produces tied scores then gets sorted by the id tie-break and
  // lands every relevant job at the top. Measured before this fix, the O*NET path — which
  // abstains on 100% of bridge text and scored every job exactly 0.000 — posted NDCG@10 0.933
  // on SEMANTIC_BRIDGE and "beat" every baseline by +0.53. The id order was doing all the work.
  interface JobSpec {
    archetype: FrameJobArchetype;
    core: FrameWork[];
    incidental: FrameWork[];
    titleFamily: string;
    industry: string;
    requirementSource: "person" | "unrelated";
  }
  const specs: JobSpec[] = [];
  const add = (
    archetype: FrameJobArchetype,
    core: FrameWork[],
    incidental: FrameWork[],
    titleFamily: string,
    industry: string,
    requirementSource: "person" | "unrelated",
  ) => {
    if (!core.length && !incidental.length) return;
    specs.push({ archetype, core, incidental, titleFamily, industry, requirementSource });
  };

  const otherIndustry = () => pick(rng, INDUSTRY_POOL.filter((industry) => industry !== person.homeIndustry));

  // Forced HOME title AND home industry, counterbalancing CROSS_TITLE_TRANSFER and
  // CROSS_INDUSTRY_TRANSFER below (both relevant work with a forced FOREIGN attribute). Left to a coin flip, the two definitional counterfactuals both push the
  // same way and a title-only baseline lands at AUC 0.449 — an inverted oracle, still
  // exploitable by anything that learns to flip the sign.
  add("OBVIOUS_EXPERIENCE_MATCH", shuffle(rng, performedWork).slice(0, 4), neutral(1), person.homeTitleFamily, person.homeIndustry, "person");

  // Performed AND liked, with no disliked work present — the job that should win on both
  // channels independently. Built explicitly because the intersection of two independently
  // sampled channels is otherwise rare enough to be empty at realistic corpus sizes.
  const performedAndLiked = performedWork.filter((w) => person.liked.includes(w) && !person.disliked.includes(w));
  add("STRONG_EXPERIENCE_AND_PREFERENCE", performedAndLiked.slice(0, 3), neutral(1), homeOrOther(), anyIndustry(), "person");

  // Half performed, half unrelated: lands in the middle of the grade scale so relevance is
  // genuinely graded rather than binary.
  add("PARTIAL_EXPERIENCE_MATCH", [...shuffle(rng, performedWork).slice(0, 2), ...neutral(2)], [], homeOrOther(), anyIndustry(), "person");

  // One performed frame among three unrelated: lands at grade 1, the rung the corpus
  // otherwise skips entirely (the first build had an empty grade-1 bucket).
  add("WEAK_EXPERIENCE_MATCH", [...shuffle(rng, performedWork).slice(0, 1), ...neutral(3)], [], homeOrOther(), anyIndustry(), "person");
  add("CROSS_TITLE_TRANSFER", shuffle(rng, performedWork).slice(0, 4), neutral(1), pick(rng, otherTitleFamilies), person.homeIndustry, "person");
  add("CROSS_INDUSTRY_TRANSFER", shuffle(rng, performedWork).slice(0, 4), neutral(1), homeOrOther(), otherIndustry(), "person");
  add("SAME_TITLE_DIFFERENT_WORK", neutral(4), [], person.homeTitleFamily, person.homeIndustry, "person");

  // High experience, low preference: the burned-out expert. Disliked work plus performed work
  // that is NOT liked, so liked and disliked contributions cannot cancel to the neutral centre
  // and hide the dislike.
  const performedNotLiked = performedWork.filter(
    (work) => !person.liked.includes(work) && !person.disliked.includes(work),
  );
  add("EXPERIENCE_WITH_DISLIKED_WORK", [...person.disliked, ...performedNotLiked.slice(0, 2)], [], homeOrOther(), anyIndustry(), "person");

  // Mixed preference: liked AND disliked in one job. Kept separate from the case above because
  // a mean-based preference score cancels these to the neutral centre, which makes a genuinely
  // mixed job look identical to one with no preference evidence at all.
  add("MIXED_PREFERENCE", [...person.disliked.slice(0, 1), ...person.liked.filter((w) => performedWork.includes(w)).slice(0, 2)], [], homeOrOther(), anyIndustry(), "person");

  add("TRANSITION_PREFERENCE_DIRECTION", shuffle(rng, person.desired).slice(0, 3), neutral(1), homeOrOther(), anyIndustry(), "person");

  const likedOnlyWork = person.liked.filter((w) => !performedWork.includes(w) && !person.desired.includes(w));
  add("PREFERENCE_ONLY", likedOnlyWork, [], homeOrOther(), anyIndustry(), "unrelated");

  const desiredOnlyWork = person.desired.filter((w) => !person.liked.includes(w) && !performedWork.includes(w));
  add("DIRECTION_ONLY", desiredOnlyWork, [], homeOrOther(), anyIndustry(), "unrelated");

  add("INCIDENTAL_ONLY_MATCH", neutral(4), [pick(rng, performedWork)], homeOrOther(), anyIndustry(), "unrelated");
  add("QUALIFICATION_ONLY", neutral(4), [], homeOrOther(), anyIndustry(), "person");

  // Hard near-misses: each core frame differs from a performed frame in exactly ONE identity
  // role. Four of five roles shared — similar work, different job.
  for (let index = 0; index < 3; index += 1) {
    const core = shuffle(rng, performedWork)
      .slice(0, 4)
      .map((work, order) => asWork(perturbFrame(work.frame, rng, vocabulary, counter + order)))
      .filter((work) => !heldIdentities.has(work.identity));
    counter += 4;
    add("HARD_NEAR_MISS", core, [], homeOrOther(), anyIndustry(), "person");
  }

  // Lexical traps: swap one role for its declared confusable partner. The surface reads like
  // the person's own work; the work itself is materially different.
  const trapCore = shuffle(rng, performedWork)
    .map((work, order) => {
      const variant = trapVariant(work.frame, rng, counter + order);
      return variant ? asWork(variant) : null;
    })
    .filter((work): work is FrameWork => work !== null && !heldIdentities.has(work.identity))
    .slice(0, 4);
  counter += performedWork.length;
  add("LEXICAL_TRAP_NEAR_MISS", trapCore, [], homeOrOther(), anyIndustry(), "person");

  for (let index = 0; index < distractors; index += 1) {
    // The first distractor takes a forced FOREIGN title, counterbalancing
    // SAME_TITLE_DIFFERENT_WORK (irrelevant work, forced HOME title). With both pairs
    // balanced, P(home title | relevant) == P(home title | irrelevant) in expectation and a
    // title-only baseline sits at chance in BOTH directions.
    const titleFamily = index === 0 ? pick(rng, otherTitleFamilies) : homeOrOther();
    add("IRRELEVANT", neutral(4), neutral(1), titleFamily, anyIndustry(), "unrelated");
  }

  // Shuffle BEFORE identifying, so position in the pool carries no relevance signal.
  return shuffle(rng, specs).map((spec, order) => {
    const jobId = `${person.personId}-job-${String(order + 1).padStart(3, "0")}`;
    const title = pick(rng, TITLE_FAMILIES[spec.titleFamily]!);
    const requirements = buildRequirements(person, rng, spec.requirementSource, jobId);
    const responsibilities = [
      ...spec.core.map((work, index) => ({ id: `${jobId}-r${index + 1}`, text: renderJobFrame(work.frame, rng, person.family), core: true })),
      ...spec.incidental.map((work, index) => ({ id: `${jobId}-i${index + 1}`, text: renderJobFrame(work.frame, rng, person.family), core: false })),
    ];
    return {
      jobId, split: person.split, family: person.family, archetype: spec.archetype, targetPersonId: person.personId,
      title, industry: spec.industry, titleFamily: spec.titleFamily,
      coreWork: spec.core, incidentalWork: spec.incidental, requirements, responsibilities,
      descriptionText: `${title} - ${spec.industry}. ${responsibilities.map((entry) => entry.text).join(" ")}`,
    };
  });
}

function buildRequirements(person: PlantedFramePerson, rng: Rng, source: "person" | "unrelated", jobId: string) {
  const held = person.qualifications;
  const notHeld = QUALIFICATION_POOL.filter((entry) => !held.some((q) => q.value === entry.value));
  const chosen = source === "person"
    ? [...shuffle(rng, held).slice(0, 2), ...shuffle(rng, notHeld).slice(0, 1)]
    : [...shuffle(rng, notHeld).slice(0, 2), ...shuffle(rng, held).slice(0, 1)];
  return chosen.map((entry, order) => ({
    id: `${jobId}-req-${order + 1}`,
    value: entry.value,
    kind: entry.kind,
    required: order < 2,
  }));
}

/** All jobs in a split, flattened. Candidate generation searches this pool. */
export function allFrameJobs(corpus: FrameBenchCorpus): PlantedFrameJob[] {
  return [...corpus.jobsByPerson.values()].flat();
}

/**
 * Plug-in mutual information, in bits, between a job attribute and the identity of its core
 * work.
 *
 * READ THIS BEFORE INTERPRETING THE NUMBER. Plug-in MI is badly biased upward when one
 * variable has many near-unique values, which is exactly the situation here: the identity
 * space has ~25,000 members, so in a realistic corpus most identities occur exactly once and
 * "knowing the identity" trivially pins down the single job it came from. The estimator then
 * returns something close to H(attribute) - about 4.8 bits for titles - even when the
 * attribute was drawn from an independent RNG and the true MI is exactly zero.
 *
 * This raw figure is therefore NOT the acceptance gate. `titleLeakageTest` below is.
 */
export function titleIdentityMutualInformation(
  jobs: PlantedFrameJob[],
  attribute: (job: PlantedFrameJob) => string,
): number {
  const joint = new Map<string, number>();
  const attributeCounts = new Map<string, number>();
  const identityCounts = new Map<string, number>();
  let total = 0;
  for (const job of jobs) {
    for (const work of job.coreWork) {
      const a = attribute(job);
      const i = work.identity;
      joint.set(`${a} ${i}`, (joint.get(`${a} ${i}`) ?? 0) + 1);
      attributeCounts.set(a, (attributeCounts.get(a) ?? 0) + 1);
      identityCounts.set(i, (identityCounts.get(i) ?? 0) + 1);
      total += 1;
    }
  }
  if (!total) return 0;
  let mi = 0;
  for (const [key, count] of joint) {
    const [a, i] = key.split(" ") as [string, string];
    const pJoint = count / total;
    const pA = (attributeCounts.get(a) ?? 0) / total;
    const pI = (identityCounts.get(i) ?? 0) / total;
    if (pJoint > 0 && pA > 0 && pI > 0) mi += pJoint * Math.log2(pJoint / (pA * pI));
  }
  return mi;
}

export interface LeakageTestResult {
  attribute: string;
  observedBits: number;
  /** Mean and spread of the same statistic when the attribute is randomly reassigned. */
  nullMeanBits: number;
  nullStdDevBits: number;
  /** How many null standard deviations the observed value sits above the null mean. */
  zScore: number;
  /** Share of permutations whose MI was at least the observed MI. */
  pValue: number;
  permutations: number;
  pass: boolean;
}

/**
 * Acceptance gate 6, done properly: does a job attribute carry information about the work
 * BEYOND what the estimator's own bias produces?
 *
 * The attribute is repeatedly reshuffled across jobs, destroying any real association while
 * preserving both marginal distributions and the sample size — so the permuted statistic
 * carries exactly the same estimator bias as the observed one. If the observed MI sits inside
 * that null distribution, the attribute carries no information about the work, and a
 * title-only baseline must score at chance.
 *
 * Reported as a p-value rather than a threshold on raw bits, because the raw scale is
 * meaningless here (see above) and a fixed bits threshold would be quietly wrong.
 */
export function titleLeakageTest(
  jobs: PlantedFrameJob[],
  attribute: (job: PlantedFrameJob) => string,
  attributeName: string,
  options: { permutations?: number; seed?: number; alpha?: number } = {},
): LeakageTestResult {
  const permutations = options.permutations ?? 200;
  const alpha = options.alpha ?? 0.01;
  const rng = mulberry32(hashSeed(`title-leak:${attributeName}:${options.seed ?? FRAME_BENCH_SEED}`));
  const observedBits = titleIdentityMutualInformation(jobs, attribute);

  const values = jobs.map(attribute);
  const nullBits: number[] = [];
  for (let index = 0; index < permutations; index += 1) {
    const permuted = shuffle(rng, values);
    const lookup = new Map(jobs.map((job, position) => [job.jobId, permuted[position]!]));
    nullBits.push(titleIdentityMutualInformation(jobs, (job) => lookup.get(job.jobId)!));
  }
  const nullMeanBits = nullBits.reduce((a, b) => a + b, 0) / nullBits.length;
  const variance = nullBits.reduce((total, value) => total + (value - nullMeanBits) ** 2, 0) / nullBits.length;
  const nullStdDevBits = Math.sqrt(variance);
  // +1 in numerator and denominator: the observed value is itself one draw from the null under
  // the null hypothesis, which keeps the p-value from ever being an impossible exact zero.
  const atLeastAsExtreme = nullBits.filter((value) => value >= observedBits).length;
  const pValue = (atLeastAsExtreme + 1) / (permutations + 1);

  return {
    attribute: attributeName,
    observedBits,
    nullMeanBits,
    nullStdDevBits,
    zScore: nullStdDevBits > 0 ? (observedBits - nullMeanBits) / nullStdDevBits : 0,
    pValue,
    permutations,
    pass: pValue > alpha,
  };
}

/**
 * The title/industry counterfactual gate, stated as the claim it is meant to support.
 *
 * MI against work identity turned out to be the wrong instrument twice over: the plug-in
 * estimator is wildly biased when identities are near-unique, and even after a permutation
 * null corrects that, "title is statistically associated with identity" is not the property
 * anyone cares about. The preregistered claim is narrower and directly testable:
 *
 *     A title-only baseline must score at chance.
 *
 * So this measures exactly that. For each person, rank their jobs by a title-only signal
 * (does the job's title family match the person's own?) and compute the ROC AUC of that
 * ranking against planted experience relevance. 0.5 means titles are useless for the task,
 * which is the requirement. Departures in EITHER direction are failures: an AUC well below
 * 0.5 would mean titles are an inverted oracle, still exploitable by a system that learns to
 * flip the sign.
 */
export function titleOnlyBaselineAuc(
  corpus: FrameBenchCorpus,
  labelOf: (person: PlantedFramePerson, job: PlantedFrameJob) => { experience: { grade: number } },
  signal: "title" | "industry" = "title",
): { auc: number; relevant: number; irrelevant: number } {
  const positive: number[] = [];
  const negative: number[] = [];
  for (const person of corpus.people) {
    for (const job of corpus.jobsByPerson.get(person.personId) ?? []) {
      const score = signal === "title"
        ? (job.titleFamily === person.homeTitleFamily ? 1 : 0)
        : (job.industry === person.homeIndustry ? 1 : 0);
      (labelOf(person, job).experience.grade >= 1 ? positive : negative).push(score);
    }
  }
  if (!positive.length || !negative.length) return { auc: 0.5, relevant: positive.length, irrelevant: negative.length };
  // Rank-based AUC with ties averaged; the signal is binary so ties dominate and a balanced
  // assignment lands exactly on 0.5.
  const all = [...positive.map((v) => ({ v, p: 1 })), ...negative.map((v) => ({ v, p: 0 }))].sort((a, b) => a.v - b.v);
  let index = 0;
  let rankSum = 0;
  while (index < all.length) {
    let end = index;
    while (end + 1 < all.length && all[end + 1]!.v === all[index]!.v) end += 1;
    const averageRank = (index + end) / 2 + 1;
    for (let t = index; t <= end; t += 1) if (all[t]!.p === 1) rankSum += averageRank;
    index = end + 1;
  }
  const auc = (rankSum - (positive.length * (positive.length + 1)) / 2) / (positive.length * negative.length);
  return { auc, relevant: positive.length, irrelevant: negative.length };
}
