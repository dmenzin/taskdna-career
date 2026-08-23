// Semantic frames: hidden truth as STRUCTURE, not as a sentence.
//
// WHY THIS REPLACES THE ATOM-AS-STATEMENT MODEL
// ---------------------------------------------
// `WorkAtom.statement` is a verbatim O*NET sentence, and both `renderPersonEvidence` and
// `renderJobResponsibility` paraphrase THAT ONE STRING. They are therefore not independent
// renderings of the same work; they are two paraphrases of a shared source. Because
// `substituteSynonyms` only rewrites about 40 common verbs, every object noun survives
// verbatim on both sides, and raw token overlap identifies the underlying atom at ROC AUC
// 0.981 even at `hard` difficulty (`pnpm diag:generator-lexical-leak`).
//
// A benchmark with that property cannot test the product thesis. Matching on "the underlying
// work rather than the wording" has no room to be demonstrated when the wording IS the work.
//
// Here the hidden truth is a frame of CONCEPT IDS. Neither side ever sees a shared surface
// string. Each side renders through its own lexicon, and the disjointness of those lexicons is
// a machine-verified invariant (`verifyLexiconDisjointness`), not an authoring intention.
//
// WHAT THIS DELIBERATELY BREAKS
// -----------------------------
// Every purely lexical method — including TaskDNA's own mapper, which is
// `overlap(tokens(text), tokens(onet_statement))` with no stemming or embeddings — has no
// mechanism to match across disjoint vocabulary. Scores near chance on this corpus are the
// CORRECT result and are what make it discriminative. A high score here would be evidence of
// a leak, not of quality.
import { contentTokens } from "@/bench/render";
import type { Rng } from "@/lab/rng";

export const SEMANTIC_FRAME_VERSION = "semantic-frame.v1";

export type ConceptRole = "action" | "object" | "purpose" | "method" | "instrument" | "output" | "domain";

/**
 * One unit of meaning with two independent surface realizations.
 *
 * `personForms` is resume/interview voice; `jobForms` is posting voice. Their CONTENT tokens
 * must not intersect: that is what removes the lexical giveaway. Function words may of course
 * be shared, which is why the check runs over `contentTokens`.
 */
export interface Concept {
  id: string;
  role: ConceptRole;
  /** Vocabulary family. VALIDATION uses families DEVELOPMENT never sees. */
  family: "core" | "held-out";
  personForms: string[];
  jobForms: string[];
}

/** Hidden truth for one piece of work. Concept ids only — never a sentence. */
export interface WorkFrame {
  frameId: string;
  action: string;
  object: string;
  purpose: string;
  method: string;
  instrument: string;
  output: string;
  domain: string;
}

/**
 * Frame identity for grading.
 *
 * Two frames are the SAME WORK when action, object, purpose, method and domain agree.
 * `instrument` and `output` are incidental colour and deliberately excluded, so a system cannot
 * score by matching tooling rather than work.
 */
export function frameIdentity(frame: WorkFrame): string {
  return [frame.action, frame.object, frame.purpose, frame.method, frame.domain].join("|");
}

// ---------------------------------------------------------------------------
// Concept lexicon
// ---------------------------------------------------------------------------

const c = (id: string, role: ConceptRole, family: Concept["family"], personForms: string[], jobForms: string[]): Concept =>
  ({ id, role, family, personForms, jobForms });

/**
 * The lexicon. Person and job realizations are authored independently per concept.
 *
 * This is deliberately NOT derived from a thesaurus or an embedding model: deriving one side
 * from the other would reintroduce a systematic surface relationship for a system to learn
 * instead of the meaning. It is authored, then mechanically checked.
 */
export const CONCEPTS: Concept[] = [
  // --- actions ---
  c("act.diagnose", "action", "core", ["tracked down", "got to the bottom of", "worked out what was behind"], ["determine the cause of", "isolate the source of", "establish why"]),
  c("act.reconcile", "action", "core", ["squared up", "tied out", "matched off"], ["bring into agreement", "resolve discrepancies between", "align"]),
  c("act.forecast", "action", "core", ["called ahead on", "projected out", "put numbers to"], ["produce forward estimates of", "model expected", "anticipate"]),
  c("act.negotiate", "action", "core", ["hammered out", "talked through the details on", "worked out a deal on"], ["reach agreement on", "settle terms for", "broker"]),
  c("act.instruct", "action", "core", ["walked people through", "brought others up to speed on", "showed teams how to handle"], ["deliver training on", "educate staff regarding", "provide instruction covering"]),
  c("act.audit", "action", "core", ["went through line by line", "combed over", "checked end to end"], ["conduct formal examination of", "perform structured verification of", "systematically inspect"]),
  c("act.design", "action", "core", ["drew up", "sketched out", "shaped"], ["author specifications for", "produce the blueprint for", "architect"]),
  c("act.triage", "action", "core", ["sorted by urgency", "worked out what mattered first", "ranked what to hit first"], ["prioritise incoming", "assign severity to", "order by criticality"]),
  c("act.mediate", "action", "held-out", ["smoothed over", "stood between the parties on", "cooled down"], ["facilitate resolution of", "arbitrate", "reconcile opposing positions in"]),
  c("act.provision", "action", "held-out", ["stood up", "got running", "spun up"], ["commission", "bring into service", "establish operational"]),

  // --- objects ---
  c("obj.equipment_fault", "object", "core", ["kit that kept cutting out", "machines that kept dropping offline", "gear that kept failing"], ["intermittent hardware malfunctions", "recurring plant defects", "unplanned equipment downtime"]),
  c("obj.ledger", "object", "core", ["the books", "the monthly figures", "our running totals"], ["general ledger balances", "period-end accounts", "financial close records"]),
  c("obj.customer_complaint", "object", "core", ["angry callers", "people who had had a bad time", "folk who had been let down"], ["escalated client grievances", "customer dissatisfaction cases", "service failure reports"]),
  c("obj.staffing_level", "object", "core", ["who we needed on shift", "cover for the rota", "headcount on the floor"], ["workforce capacity requirements", "personnel allocation", "rostered manning levels"]),
  c("obj.safety_incident", "object", "core", ["near misses", "things that nearly went wrong", "close calls on site"], ["reportable safety events", "occupational injury occurrences", "workplace hazard incidents"]),
  c("obj.supply_shortfall", "object", "core", ["stock running out", "not being able to get hold of things", "shortages coming down the line"], ["inventory deficits", "procurement gaps", "materials availability constraints"]),
  c("obj.regulatory_filing", "object", "core", ["the forms the inspectors wanted", "our periodic filings", "what had to be lodged"], ["mandated compliance submissions", "prescribed regulatory returns", "required statutory disclosures"]),
  c("obj.software_defect", "object", "held-out", ["bugs users kept hitting", "faults in the build", "broken behaviour in the release"], ["reported application errors", "software non-conformances", "production code defects"]),

  // --- purposes ---
  c("pur.restore_uptime", "purpose", "core", ["so the line could keep running", "to stop losing hours", "to get production moving again"], ["to minimise operational interruption", "in order to sustain availability", "to protect throughput continuity"]),
  c("pur.prevent_recurrence", "purpose", "core", ["so it would not happen again", "to stop it coming back", "to close it out for good"], ["to eliminate repeat occurrences", "for permanent corrective closure", "to preclude reincidence"]),
  c("pur.satisfy_regulator", "purpose", "core", ["to keep the inspectors happy", "so we would pass", "to stay on the right side of the rules"], ["to maintain statutory compliance", "in order to meet supervisory obligations", "to uphold regulatory standing"]),
  c("pur.reduce_cost", "purpose", "core", ["to stop money leaking out", "to bring spend down", "to save on what we were paying"], ["to achieve expenditure reduction", "for margin improvement", "to lower unit economics"]),
  c("pur.improve_experience", "purpose", "core", ["so people had a better time of it", "to make it less painful for those we served", "to stop annoying people"], ["to elevate client satisfaction", "for service quality enhancement", "to strengthen the customer journey"]),
  c("pur.inform_decision", "purpose", "held-out", ["so the boss could choose", "to give leadership something to go on", "so a call could be made"], ["to underpin executive determination", "for governance decision support", "to substantiate strategic selection"]),

  // --- methods ---
  c("met.elimination", "method", "core", ["ruling things out one at a time", "narrowing it down step by step", "crossing off what it was not"], ["systematic exclusion of candidate causes", "progressive differential isolation", "structured cause elimination"]),
  c("met.statistical", "method", "core", ["crunching the numbers", "looking at what the figures showed", "running it through the maths"], ["quantitative analytical techniques", "statistical inference methods", "numerical modelling approaches"]),
  c("met.interview", "method", "core", ["asking around", "sitting down and talking to people", "getting the story from those involved"], ["structured stakeholder consultation", "formal witness elicitation", "systematic informant enquiry"]),
  c("met.documentation_review", "method", "core", ["reading back through old notes", "going over what had been written down", "digging through past logs"], ["examination of archival documentation", "retrospective record analysis", "documentary evidence assessment"]),
  c("met.simulation", "method", "held-out", ["trying it out in a safe copy", "running a dry version first", "checking it away from the real thing"], ["modelled scenario evaluation", "synthetic environment trials", "emulated condition testing"]),

  // --- instruments (incidental colour, excluded from identity) ---
  c("ins.sensor_log", "instrument", "core", ["readouts from the machines"], ["telemetry captures"]),
  c("ins.spreadsheet", "instrument", "core", ["a big sheet I kept"], ["tabular workbooks"]),
  c("ins.ticket_system", "instrument", "core", ["the job queue"], ["case management platforms"]),

  // --- outputs (incidental colour, excluded from identity) ---
  c("out.written_report", "output", "core", ["a write up at the end"], ["formal findings documentation"]),
  c("out.recommendation", "output", "core", ["what I reckoned we should do"], ["advisory determinations"]),
  c("out.dashboard", "output", "core", ["a screen the team could watch"], ["monitoring visualisations"]),

  // --- domains ---
  c("dom.manufacturing", "domain", "core", ["on the factory floor", "out in the works", "around the assembly bays"], ["within industrial operations", "in a fabrication environment", "across process manufacturing"]),
  c("dom.healthcare", "domain", "core", ["on the wards", "in a hospital setting", "around patient treatment"], ["within clinical services", "in a care delivery environment", "across health provision"]),
  c("dom.financial_services", "domain", "core", ["in banking", "around lending and deposits", "on the money side"], ["within capital markets", "in a fiduciary environment", "across investment operations"]),
  c("dom.public_sector", "domain", "core", ["in local council work", "on town hall business", "in a civic setting"], ["within municipal administration", "in a governmental environment", "across public authority functions"]),
  c("dom.logistics", "domain", "held-out", ["in the warehouse and on the road", "around shipping and haulage", "on distribution"], ["within freight operations", "in a supply chain environment", "across fulfilment networks"]),
];

export const CONCEPTS_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

export function conceptsFor(role: ConceptRole, families: Concept["family"][]): Concept[] {
  return CONCEPTS.filter((concept) => concept.role === role && families.includes(concept.family));
}

// ---------------------------------------------------------------------------
// The invariant that makes this corpus honest
// ---------------------------------------------------------------------------

export interface DisjointnessViolation {
  conceptId: string;
  sharedTokens: string[];
  personForm: string;
  jobForm: string;
}

/**
 * Every concept's person-side and job-side realizations must share NO content token.
 *
 * This is the property whose absence made the previous corpus solvable by token overlap. It is
 * checked mechanically rather than trusted, because a single shared distinctive noun is enough
 * to reintroduce the giveaway.
 */
export function verifyLexiconDisjointness(concepts: Concept[] = CONCEPTS): DisjointnessViolation[] {
  const violations: DisjointnessViolation[] = [];
  for (const concept of concepts) {
    for (const personForm of concept.personForms) {
      const personTokens = contentTokens(personForm);
      for (const jobForm of concept.jobForms) {
        const shared = [...contentTokens(jobForm)].filter((token) => personTokens.has(token));
        if (shared.length) violations.push({ conceptId: concept.id, sharedTokens: shared, personForm, jobForm });
      }
    }
  }
  return violations;
}

/**
 * Guards against a subtler artifact: if person and job forms were systematically related by
 * stem or prefix, a system could learn the surface mapping instead of the meaning. Reports any
 * concept where a person token and a job token share a long leading character run.
 */
export function verifyNoStemCorrelation(concepts: Concept[] = CONCEPTS, minPrefix = 5): DisjointnessViolation[] {
  const violations: DisjointnessViolation[] = [];
  for (const concept of concepts) {
    const personTokens = new Set(concept.personForms.flatMap((form) => [...contentTokens(form)]));
    const jobTokens = new Set(concept.jobForms.flatMap((form) => [...contentTokens(form)]));
    const shared: string[] = [];
    for (const p of personTokens) {
      for (const j of jobTokens) {
        const limit = Math.min(p.length, j.length);
        let common = 0;
        while (common < limit && p[common] === j[common]) common += 1;
        if (common >= minPrefix) shared.push(`${p}~${j}`);
      }
    }
    if (shared.length) {
      violations.push({ conceptId: concept.id, sharedTokens: shared, personForm: concept.personForms[0]!, jobForm: concept.jobForms[0]! });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const pick = <T,>(rng: Rng, values: T[]): T => values[Math.floor(rng() * values.length)]!;

const form = (rng: Rng, conceptId: string, side: "person" | "job"): string => {
  const concept = CONCEPTS_BY_ID.get(conceptId);
  if (!concept) throw new Error(`Unknown concept: ${conceptId}`);
  return pick(rng, side === "person" ? concept.personForms : concept.jobForms);
};

const PERSON_FRAMES = [
  "I {action} {object} {domain}, {purpose}, mostly by {method}.",
  "A lot of my time went on {action} {object} {domain} — {purpose} — {method}.",
  "{domain}, I {action} {object}. {method} was how I did it, {purpose}.",
];

const JOB_FRAMES = [
  "{action} {object} {domain}, {purpose}. Approach: {method}.",
  "The role will {action} {object} {domain} {purpose}, applying {method}.",
  "Responsible for work to {action} {object} {domain}, {purpose}. Method: {method}.",
];

/** Render a frame as first-person person-side evidence. Never touches the job lexicon. */
export function renderPersonFrame(frame: WorkFrame, rng: Rng): string {
  return pick(rng, PERSON_FRAMES)
    .replace("{action}", form(rng, frame.action, "person"))
    .replace("{object}", form(rng, frame.object, "person"))
    .replace("{purpose}", form(rng, frame.purpose, "person"))
    .replace("{method}", form(rng, frame.method, "person"))
    .replace("{domain}", form(rng, frame.domain, "person"));
}

/** Render the SAME frame as a job responsibility. Never touches the person lexicon. */
export function renderJobFrame(frame: WorkFrame, rng: Rng): string {
  return pick(rng, JOB_FRAMES)
    .replace("{action}", form(rng, frame.action, "job"))
    .replace("{object}", form(rng, frame.object, "job"))
    .replace("{purpose}", form(rng, frame.purpose, "job"))
    .replace("{method}", form(rng, frame.method, "job"))
    .replace("{domain}", form(rng, frame.domain, "job"));
}

/** Deterministic frame sampler. Families control what VALIDATION is allowed to see. */
export function sampleFrame(rng: Rng, families: Concept["family"][], index: number): WorkFrame {
  const roleOf = (role: ConceptRole) => pick(rng, conceptsFor(role, families)).id;
  const frame: Omit<WorkFrame, "frameId"> = {
    action: roleOf("action"),
    object: roleOf("object"),
    purpose: roleOf("purpose"),
    method: roleOf("method"),
    instrument: roleOf("instrument"),
    output: roleOf("output"),
    domain: roleOf("domain"),
  };
  return { ...frame, frameId: `frame-${index}-${frameIdentity(frame as WorkFrame)}` };
}
