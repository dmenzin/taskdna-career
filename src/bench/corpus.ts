// Planted-truth person and job corpus for the product-level benchmarks.
//
// DESIGN CONSTRAINTS
// ------------------
// 1. Channel independence is PLANTED, not derived. A person's performed / liked / disliked /
//    desired atom sets are sampled so that all the required combinations occur: performed and
//    liked, performed and disliked, liked but never performed, desired but never performed,
//    and so on. No channel is a function of another.
// 2. Titles and industries are assigned ORTHOGONALLY to atoms. That is what makes
//    "different title, same work" and "same title, different work" constructible, and it is
//    why a title-only baseline must fail exactly where task-based matching should succeed.
// 3. Every job is tagged with an ARCHETYPE describing the relationship it was built to have
//    with its person. Archetypes are the known answers the ranking benchmarks assert against.
// 4. Surface language is rendered independently on each side (src/bench/render.ts). The
//    algorithm sees only text; the grader sees only atom ids.
import { hashSeed, mulberry32, pick, type Rng } from "@/lab/rng";
import { atomIds, buildAtomPool, shuffle, takeDistinct, usableStrata, type AtomPool, type WorkAtom } from "@/bench/workAtoms";
import {
  PARAPHRASE_FAMILIES,
  renderAspirationStatement,
  renderJobResponsibility,
  renderPersonEvidence,
  renderPreferenceStatement,
  type ParaphraseFamily,
  type RenderDifficulty,
  type RenderedAtomText,
} from "@/bench/render";
import type { OnetStratum } from "@/onet/strata";

export const BENCH_CORPUS_VERSION = "bench-corpus.v1";
export const BENCH_SEED = 20260823;

export type BenchSplit = "DEVELOPMENT" | "VALIDATION" | "LOCKED_CONFIRMATION";

/**
 * Paraphrase families available per split. `nominalized` and `colloquial` are WITHHELD from
 * DEVELOPMENT so a decoder tuned to development phrasing shows a measurable generalization
 * gap on VALIDATION rather than a silent one.
 */
export const SPLIT_PARAPHRASE_FAMILIES: Record<BenchSplit, ParaphraseFamily[]> = {
  DEVELOPMENT: ["plain", "clausal"],
  VALIDATION: ["nominalized", "colloquial"],
  LOCKED_CONFIRMATION: [...PARAPHRASE_FAMILIES],
};

/**
 * Job archetypes. These ARE the known answers: each name states the relationship the job was
 * planted to have with its person, independent of any score.
 */
export const JOB_ARCHETYPES = [
  /** Performed atoms, title and industry from the person's own stratum. Conventional matching should also find these. */
  "OBVIOUS_EXPERIENCE_MATCH",
  /** Performed atoms, title borrowed from an unrelated stratum. Task-based matching should find it; title matching should not. */
  "CROSS_TITLE_TRANSFER",
  /** Performed atoms, industry from an unrelated family. */
  "CROSS_INDUSTRY_TRANSFER",
  /** The person's own title, but unrelated atoms. Title matching should be fooled; task matching should not. */
  "SAME_TITLE_DIFFERENT_WORK",
  /** Disliked atoms plus performed-but-not-liked atoms. High experience, low preference. */
  "EXPERIENCE_WITH_DISLIKED_WORK",
  /** Liked AND disliked work in the same job: the case a mean-based preference score cancels. */
  "MIXED_PREFERENCE",
  /** Liked and desired atoms the person has never performed. The career-transition case. */
  "TRANSITION_PREFERENCE_DIRECTION",
  /** Liked atoms only, no performed and no desired overlap. */
  "PREFERENCE_ONLY",
  /** Desired atoms only. */
  "DIRECTION_ONLY",
  /** A single peripheral performed atom among unrelated core work. Must not read as a strong match. */
  "INCIDENTAL_ONLY_MATCH",
  /** Requirements the person satisfies, but unrelated work. */
  "QUALIFICATION_ONLY",
  /**
   * The discriminative case. Atoms drawn from the person's OWN occupation and stratum but
   * NOT from their performed set: the same kind of work, in the same vocabulary, that this
   * specific person did not do. Lexically very similar, plantedly irrelevant. Without these,
   * an experience benchmark sits at ceiling and gives the research loop no headroom.
   */
  "HARD_NEAR_MISS",
  /** No planted relationship on any channel. */
  "IRRELEVANT",
] as const;
export type JobArchetype = (typeof JOB_ARCHETYPES)[number];

/** Title pools per stratum, used to assign titles independently of a job's atoms. */
const TITLE_POOL: Partial<Record<OnetStratum, string[]>> = {
  engineering: ["Reliability Engineer", "Failure Analysis Engineer", "Systems Engineer", "Test Engineer"],
  manufacturing_technical_operations: ["Quality Investigator", "Process Technician", "Production Analyst"],
  software: ["Platform Engineer", "Backend Engineer", "Site Reliability Engineer"],
  cybersecurity: ["Incident Analyst", "Security Operations Analyst", "Threat Investigator"],
  data_analytics: ["Insight Analyst", "Reporting Analyst", "Decision Scientist"],
  science_research: ["Research Associate", "Laboratory Scientist", "Study Coordinator"],
  healthcare_professional: ["Clinical Specialist", "Care Practitioner", "Health Practitioner"],
  healthcare_operations: ["Clinical Operations Lead", "Patient Services Coordinator"],
  finance: ["Financial Analyst", "Treasury Analyst", "Planning Analyst"],
  accounting_audit: ["Audit Associate", "Assurance Analyst", "Controls Specialist"],
  insurance_risk: ["Risk Analyst", "Claims Investigator", "Underwriting Analyst"],
  consulting: ["Engagement Consultant", "Advisory Associate"],
  product: ["Product Manager", "Product Operations Lead"],
  project_program: ["Programme Lead", "Delivery Manager"],
  operations: ["Operations Analyst", "Business Operations Lead", "Service Manager"],
  supply_chain: ["Supply Planner", "Logistics Analyst"],
  procurement: ["Sourcing Specialist", "Category Analyst"],
  sales: ["Account Executive", "Solutions Specialist"],
  business_development: ["Partnerships Lead"],
  customer_success: ["Customer Success Manager", "Technical Account Manager"],
  marketing: ["Marketing Analyst", "Campaign Manager"],
  communications: ["Communications Specialist", "Content Lead"],
  hr: ["People Partner", "Compensation Analyst"],
  recruiting: ["Talent Partner", "Sourcing Recruiter"],
  learning_education: ["Instructional Designer", "Learning Specialist", "Programme Instructor"],
  ux_design: ["Product Designer", "Interaction Designer"],
  research: ["Research Analyst", "Field Researcher"],
  legal: ["Legal Analyst", "Contracts Specialist"],
  compliance: ["Compliance Analyst", "Regulatory Specialist"],
  policy: ["Policy Analyst"],
  public_administration: ["Programme Administrator", "Public Services Analyst"],
  field_technical: ["Field Service Specialist", "Technical Field Analyst"],
  other: ["Operations Specialist", "Programme Associate", "Business Analyst"],
};

const INDUSTRY_POOL = [
  "medical devices", "aerospace", "automotive", "energy utilities", "financial services",
  "public sector", "higher education", "logistics", "consumer electronics", "pharmaceuticals",
  "telecommunications", "industrial manufacturing",
];

const QUALIFICATION_POOL: { value: string; kind: "skill" | "education" | "credential" | "capability" }[] = [
  { value: "Python", kind: "skill" }, { value: "SQL", kind: "skill" }, { value: "Excel", kind: "skill" },
  { value: "statistical analysis", kind: "capability" }, { value: "technical writing", kind: "capability" },
  { value: "project coordination", kind: "capability" }, { value: "root cause analysis", kind: "capability" },
  { value: "bachelor degree", kind: "education" }, { value: "master degree", kind: "education" },
  { value: "six sigma green belt", kind: "credential" }, { value: "PMP", kind: "credential" },
  { value: "JavaScript", kind: "skill" }, { value: "Tableau", kind: "skill" }, { value: "R", kind: "skill" },
];

export interface PerformedAtom {
  atom: WorkAtom;
  strength: "weak" | "demonstrated" | "deep";
  ownership: "assisted" | "performed" | "led";
  /** Which rendered evidence statement carried this atom. Provenance for traceability. */
  evidenceId: string;
}

export interface PlantedPerson {
  personId: string;
  split: BenchSplit;
  /** The person's own occupation stratum and title. Used to build title-collision jobs. */
  homeStratum: OnetStratum;
  homeTitle: string;
  homeIndustry: string;

  // ---- planted truth, never visible to the algorithm ----
  performed: PerformedAtom[];
  liked: WorkAtom[];
  disliked: WorkAtom[];
  desired: WorkAtom[];
  qualifications: { value: string; kind: "skill" | "education" | "credential" | "capability" }[];

  // ---- surface language, all the algorithm sees ----
  experienceEvidence: { id: string; rendered: RenderedAtomText }[];
  preferenceEvidence: { id: string; stance: "LIKE" | "DISLIKE"; rendered: RenderedAtomText }[];
  aspirationEvidence: { id: string; rendered: RenderedAtomText }[];
  /** Whole narrative, used by the lexical resume baseline and by extraction benchmarks. */
  narrative: string;
}

export interface PlantedJob {
  jobId: string;
  split: BenchSplit;
  archetype: JobArchetype;
  /** Which person this job was planted relative to. */
  targetPersonId: string;
  title: string;
  industry: string;
  /** Stratum the TITLE came from. Deliberately independent of the atoms' strata. */
  titleStratum: OnetStratum;

  // ---- planted truth ----
  coreAtoms: WorkAtom[];
  incidentalAtoms: WorkAtom[];
  requirements: { id: string; value: string; kind: "skill" | "education" | "credential" | "capability"; required: boolean }[];

  // ---- surface language ----
  responsibilities: { id: string; rendered: RenderedAtomText; core: boolean }[];
  descriptionText: string;
}

export interface BenchCorpus {
  version: string;
  seed: number;
  split: BenchSplit;
  difficulty: RenderDifficulty;
  paraphraseFamilies: ParaphraseFamily[];
  atomPoolSize: number;
  people: PlantedPerson[];
  /** Jobs are shared across the split; each carries the person it was planted against. */
  jobsByPerson: Map<string, PlantedJob[]>;
}

export interface BuildCorpusOptions {
  seed?: number;
  split?: BenchSplit;
  people?: number;
  /** Distractor jobs added per person on top of the archetype set. */
  distractors?: number;
  /**
   * Person-side rendering difficulty. `standard` saturates the experience channel; `hard`
   * is the tier with headroom; `verbatim` is the leakage control upper bound.
   */
  difficulty?: RenderDifficulty;
  pool?: AtomPool;
}

/**
 * Build a planted-truth corpus.
 *
 * Determinism: everything derives from `seed`, the split name, and the person index, so two
 * runs of the same configuration produce byte-identical corpora.
 */
export function buildBenchCorpus(options: BuildCorpusOptions = {}): BenchCorpus {
  const seed = options.seed ?? BENCH_SEED;
  const split = options.split ?? "DEVELOPMENT";
  const peopleCount = options.people ?? 24;
  const distractors = options.distractors ?? 6;
  const pool = options.pool ?? buildAtomPool(seed);
  const families = SPLIT_PARAPHRASE_FAMILIES[split];
  const difficulty = options.difficulty ?? "standard";
  const strata = usableStrata(pool);

  const people: PlantedPerson[] = [];
  const jobsByPerson = new Map<string, PlantedJob[]>();
  for (let index = 0; index < peopleCount; index += 1) {
    const rng = mulberry32(hashSeed(`bench-person:${seed}:${split}:${index}`));
    const person = buildPerson(`bench-${split.toLowerCase()}-p${String(index + 1).padStart(3, "0")}`, split, pool, strata, families, rng, difficulty);
    people.push(person);
    const jobRng = mulberry32(hashSeed(`bench-jobs:${seed}:${split}:${index}`));
    jobsByPerson.set(person.personId, buildJobsFor(person, pool, strata, families, jobRng, distractors, difficulty));
  }
  return { version: BENCH_CORPUS_VERSION, seed, split, difficulty, paraphraseFamilies: families, atomPoolSize: pool.atoms.length, people, jobsByPerson };
}

function buildPerson(
  personId: string,
  split: BenchSplit,
  pool: AtomPool,
  strata: OnetStratum[],
  families: ParaphraseFamily[],
  rng: Rng,
  difficulty: RenderDifficulty,
): PlantedPerson {
  const homeStratum = pick(rng, strata);
  const homeAtoms = pool.byStratum.get(homeStratum)!;
  const otherStrata = strata.filter((stratum) => stratum !== homeStratum);
  const farStratum = pick(rng, otherStrata);
  const farAtoms = pool.byStratum.get(farStratum)!;

  // Planting is arranged so that EVERY required channel combination occurs for every person,
  // and so that each job archetype below has a clean, non-overlapping atom source.
  //
  //   performed          6 atoms from the home stratum
  //   likedFromPerformed 3 performed atoms         -> performed AND liked
  //   likedAndDesired    2 far atoms               -> liked AND desired, never performed
  //   likedOnly          2 second-far atoms        -> liked ONLY (not performed, not desired)
  //   disliked           2 performed atoms         -> performed AND disliked, never liked
  //   desiredOnly        2 far atoms               -> desired ONLY (not liked, not performed)
  const performedAtoms = takeDistinct(rng, homeAtoms, 6);
  const likedFromPerformed = shuffle(rng, performedAtoms).slice(0, 3);
  const disliked = shuffle(rng, performedAtoms.filter((atom) => !likedFromPerformed.includes(atom))).slice(0, 2);
  const likedAndDesired = takeDistinct(rng, farAtoms, 2);
  const desiredOnly = takeDistinct(rng, farAtoms, 2, new Set(likedAndDesired));
  const secondFarStratum = pick(rng, otherStrata.filter((stratum) => stratum !== farStratum).length ? otherStrata.filter((stratum) => stratum !== farStratum) : otherStrata);
  const likedOnly = takeDistinct(rng, pool.byStratum.get(secondFarStratum)!, 2, new Set([...likedAndDesired, ...desiredOnly]));
  const desired = [...likedAndDesired, ...desiredOnly];

  const qualifications = shuffle(rng, QUALIFICATION_POOL).slice(0, 5);
  const homeTitle = pick(rng, TITLE_POOL[homeStratum] ?? TITLE_POOL.other!);
  const homeIndustry = pick(rng, INDUSTRY_POOL);

  const experienceEvidence = performedAtoms.map((atom, order) => ({
    id: `${personId}-exp-${order + 1}`,
    rendered: renderPersonEvidence(atom, rng, pick(rng, families), difficulty),
  }));
  const performed: PerformedAtom[] = performedAtoms.map((atom, order) => ({
    atom,
    strength: pick(rng, ["weak", "demonstrated", "deep"] as const),
    ownership: pick(rng, ["assisted", "performed", "led"] as const),
    evidenceId: experienceEvidence[order]!.id,
  }));

  const liked = [...likedFromPerformed, ...likedAndDesired, ...likedOnly];
  const preferenceEvidence = [
    ...liked.map((atom, order) => ({ id: `${personId}-pref-like-${order + 1}`, stance: "LIKE" as const, rendered: renderPreferenceStatement(atom, rng, "LIKE", pick(rng, families), difficulty) })),
    ...disliked.map((atom, order) => ({ id: `${personId}-pref-dislike-${order + 1}`, stance: "DISLIKE" as const, rendered: renderPreferenceStatement(atom, rng, "DISLIKE", pick(rng, families), difficulty) })),
  ];
  const aspirationEvidence = desired.map((atom, order) => ({
    id: `${personId}-asp-${order + 1}`,
    rendered: renderAspirationStatement(atom, rng, pick(rng, families), difficulty),
  }));

  const narrative = [
    `${homeTitle} working in ${homeIndustry}.`,
    ...experienceEvidence.map((entry) => entry.rendered.text),
    ...preferenceEvidence.map((entry) => entry.rendered.text),
    ...aspirationEvidence.map((entry) => entry.rendered.text),
    `Skills: ${qualifications.map((qualification) => qualification.value).join(", ")}.`,
  ].join(" ");

  return {
    personId, split, homeStratum, homeTitle, homeIndustry,
    performed, liked, disliked, desired, qualifications,
    experienceEvidence, preferenceEvidence, aspirationEvidence, narrative,
  };
}

function buildJobsFor(
  person: PlantedPerson,
  pool: AtomPool,
  strata: OnetStratum[],
  families: ParaphraseFamily[],
  rng: Rng,
  distractors: number,
  difficulty: RenderDifficulty,
): PlantedJob[] {
  const performedAtoms = person.performed.map((entry) => entry.atom);
  const otherStrata = strata.filter((stratum) => stratum !== person.homeStratum);
  const unrelatedAtoms = () => pool.byStratum.get(pick(rng, otherStrata))!;
  const heldAtomIds = atomIds([...performedAtoms, ...person.liked, ...person.disliked, ...person.desired]);
  const neutralAtoms = pool.atoms.filter((atom) => !heldAtomIds.has(atom.atomId));

  const jobs: PlantedJob[] = [];
  let counter = 0;
  const add = (archetype: JobArchetype, core: WorkAtom[], incidental: WorkAtom[], titleStratum: OnetStratum, industry: string, requirementSource: "person" | "unrelated") => {
    counter += 1;
    const jobId = `${person.personId}-job-${String(counter).padStart(3, "0")}`;
    const title = pick(rng, TITLE_POOL[titleStratum] ?? TITLE_POOL.other!);
    const requirements = buildRequirements(person, rng, requirementSource, jobId);
    const responsibilities = [
      ...core.map((atom, order) => ({ id: `${jobId}-r${order + 1}`, rendered: renderJobResponsibility(atom, rng, pick(rng, families), difficulty), core: true })),
      ...incidental.map((atom, order) => ({ id: `${jobId}-i${order + 1}`, rendered: renderJobResponsibility(atom, rng, pick(rng, families), difficulty), core: false })),
    ];
    jobs.push({
      jobId, split: person.split, archetype, targetPersonId: person.personId, title, industry, titleStratum,
      coreAtoms: core, incidentalAtoms: incidental, requirements, responsibilities,
      descriptionText: `${title} - ${industry}. ${responsibilities.map((entry) => entry.rendered.text).join(" ")}`,
    });
  };

  // Obvious match: performed work, own title and industry.
  add("OBVIOUS_EXPERIENCE_MATCH", shuffle(rng, performedAtoms).slice(0, 4), takeDistinct(rng, neutralAtoms, 1), person.homeStratum, person.homeIndustry, "person");
  // Cross-title transfer: same performed work, a title from an unrelated stratum.
  add("CROSS_TITLE_TRANSFER", shuffle(rng, performedAtoms).slice(0, 4), takeDistinct(rng, neutralAtoms, 1), pick(rng, otherStrata), person.homeIndustry, "person");
  // Cross-industry transfer: same performed work, a different industry.
  add("CROSS_INDUSTRY_TRANSFER", shuffle(rng, performedAtoms).slice(0, 4), takeDistinct(rng, neutralAtoms, 1), pick(rng, otherStrata), pick(rng, INDUSTRY_POOL.filter((industry) => industry !== person.homeIndustry)), "person");
  // Same title, different work: the trap for title-based matching.
  add("SAME_TITLE_DIFFERENT_WORK", takeDistinct(rng, unrelatedAtoms(), 4, heldAtomIds as unknown as Set<WorkAtom>).filter((atom) => !heldAtomIds.has(atom.atomId)), [], person.homeStratum, person.homeIndustry, "person");
  // High experience, low preference: the burned-out expert. Built from disliked atoms plus
  // performed atoms that are NOT liked, so liked and disliked contributions cannot cancel to
  // the neutral centre and hide the dislike.
  const performedNotLiked = performedAtoms.filter((atom) => !person.liked.includes(atom) && !person.disliked.includes(atom));
  add("EXPERIENCE_WITH_DISLIKED_WORK", [...person.disliked, ...performedNotLiked.slice(0, 2)], [], person.homeStratum, person.homeIndustry, "person");
  // Mixed preference: liked AND disliked work in the same job. Separated from the case above
  // because a mean-based preference score cancels these to the neutral centre, which makes a
  // genuinely mixed job look identical to one with no preference evidence at all.
  add("MIXED_PREFERENCE", [...person.disliked.slice(0, 1), ...person.liked.filter((atom) => performedAtoms.includes(atom)).slice(0, 2)], [], person.homeStratum, person.homeIndustry, "person");
  // Career transition: liked and desired work never performed.
  add("TRANSITION_PREFERENCE_DIRECTION", shuffle(rng, person.desired).slice(0, 3), takeDistinct(rng, neutralAtoms, 1), pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "person");
  // Preference only: liked, never performed, and NOT desired.
  const likedOnlyAtoms = person.liked.filter((atom) => !performedAtoms.includes(atom) && !person.desired.includes(atom));
  if (likedOnlyAtoms.length) add("PREFERENCE_ONLY", likedOnlyAtoms, [], pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "unrelated");
  // Direction only: desired, never performed, and NOT liked.
  const desiredOnlyAtoms = person.desired.filter((atom) => !person.liked.includes(atom) && !performedAtoms.includes(atom));
  if (desiredOnlyAtoms.length) add("DIRECTION_ONLY", desiredOnlyAtoms, [], pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "unrelated");
  // Incidental-only: one performed atom buried among unrelated core work.
  add("INCIDENTAL_ONLY_MATCH", takeDistinct(rng, neutralAtoms, 4), [pick(rng, performedAtoms)], pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "unrelated");
  // Qualification only: requirements the person meets, work they have not done.
  add("QUALIFICATION_ONLY", takeDistinct(rng, neutralAtoms, 4), [], pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "person");
  // Hard near-misses: same occupation and stratum as the person, but work they did NOT do.
  // These are the jobs a lexical matcher should confuse with a genuine transfer.
  const homeNonPerformed = (pool.byStratum.get(person.homeStratum) ?? []).filter((atom) => !heldAtomIds.has(atom.atomId));
  const sameOccupationNonPerformed = homeNonPerformed.filter((atom) => performedAtoms.some((performed) => performed.occupationCode === atom.occupationCode));
  const nearMissSource = sameOccupationNonPerformed.length >= 4 ? sameOccupationNonPerformed : homeNonPerformed;
  for (let index = 0; index < Math.min(3, Math.floor(nearMissSource.length / 4)); index += 1) {
    add("HARD_NEAR_MISS", takeDistinct(rng, nearMissSource, 4), [], person.homeStratum, person.homeIndustry, "person");
  }
  // Irrelevant distractors.
  for (let index = 0; index < distractors; index += 1) {
    add("IRRELEVANT", takeDistinct(rng, neutralAtoms, 4), takeDistinct(rng, neutralAtoms, 1), pick(rng, otherStrata), pick(rng, INDUSTRY_POOL), "unrelated");
  }
  return jobs;
}

function buildRequirements(person: PlantedPerson, rng: Rng, source: "person" | "unrelated", jobId: string) {
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
export function allJobs(corpus: BenchCorpus): PlantedJob[] {
  return [...corpus.jobsByPerson.values()].flat();
}
