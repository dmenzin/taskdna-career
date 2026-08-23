// Semantic frames: hidden truth as STRUCTURE, not as a sentence.
//
// WHY THIS REPLACES THE ATOM-AS-STATEMENT MODEL
// ---------------------------------------------
// `WorkAtom.statement` is a verbatim O*NET sentence, and both `renderPersonEvidence` and
// `renderJobResponsibility` paraphrase THAT ONE STRING. They are therefore not independent
// renderings of the same work; they are two paraphrases of a shared source. Because
// `substituteSynonyms` only rewrites about 40 common verbs, every object noun survives
// verbatim on both sides, and raw token overlap identifies the underlying atom at ROC AUC
// 0.981 even at `hard` difficulty.
//
// Here the hidden truth is a frame of CONCEPT IDS. Neither side ever sees a shared surface
// string. Each side renders through its own vocabulary, and the relationship between those
// vocabularies is a machine-verified invariant, not an authoring intention.
//
// WHAT CHANGED IN v2
// ------------------
// v1 supported exactly one rendering regime — fully disjoint vocabulary — which is a single
// artificial extreme. Production language is not always vocabulary-disjoint, and a corpus that
// only tests the extreme cannot distinguish "understands meaning" from "handicapped by
// design". v2 adds three REGIMES over the same truth model
// (`docs/BENCHMARK_FAMILIES_PREREGISTRATION.md`):
//
//   NATURAL         both sides draw from one neutral professional register; overlap allowed
//   SEMANTIC_BRIDGE disjoint vocabularies; tests genuine transfer
//   LEXICAL_TRAP    near-identical wording, materially different work; words-vs-meaning
//
// (Title/industry counterfactuals are a corpus-level regime, not a lexicon one.)
//
// v2 also repairs a defect that made the contract's generalization mechanism unusable: the
// `held-out` family had ZERO instrument and output concepts, so `sampleFrame(rng,["held-out"])`
// threw, and the remaining roles had one concept each — two distinct identities in total.
// Every role is now populated in both families, and `verifyFamilyCoverage` turns a recurrence
// into a test failure rather than a runtime crash.
import { contentTokens } from "@/bench/render";
import type { Rng } from "@/lab/rng";

export const SEMANTIC_FRAME_VERSION = "semantic-frame.v2";

export type ConceptRole = "action" | "object" | "purpose" | "method" | "instrument" | "output" | "domain";

/** The rendering regimes. Reported separately, never averaged. */
export const RENDER_FAMILIES = ["NATURAL", "SEMANTIC_BRIDGE", "LEXICAL_TRAP"] as const;
export type RenderFamily = (typeof RENDER_FAMILIES)[number];

/**
 * One unit of meaning with several independent surface realizations.
 *
 * `personForms` is resume/interview voice; `jobForms` is posting voice. Under SEMANTIC_BRIDGE
 * their CONTENT tokens must not intersect — that is what removes the lexical giveaway.
 * `neutralForms` is the shared professional register used by NATURAL, where overlap is
 * realistic and permitted. `trapForms` is shared with `trapPartner` and is what makes
 * LEXICAL_TRAP look similar while meaning something materially different.
 */
export interface Concept {
  id: string;
  role: ConceptRole;
  /** Vocabulary family. VALIDATION uses families DEVELOPMENT never sees. */
  family: "core" | "held-out";
  personForms: string[];
  jobForms: string[];
  /** NATURAL register. Both sides sample independently from this same pool. */
  neutralForms: string[];
  /** LEXICAL_TRAP surface, deliberately shared with `trapPartner`. */
  trapForms?: string[];
  /** The concept this one is confusable with. Symmetric by convention. */
  trapPartner?: string;
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

/** The five roles that constitute same-work identity. */
export const IDENTITY_ROLES = ["action", "object", "purpose", "method", "domain"] as const;
export type IdentityRole = (typeof IDENTITY_ROLES)[number];

/**
 * Frame identity for grading.
 *
 * Two frames are the SAME WORK when action, object, purpose, method and domain agree.
 * `instrument` and `output` are incidental colour and deliberately excluded, so a system cannot
 * score by matching tooling rather than work.
 */
export function frameIdentity(frame: WorkFrame): string {
  return IDENTITY_ROLES.map((role) => frame[role]).join("|");
}

/** How many identity roles two frames share. Used to build graded near-misses. */
export function identityOverlap(a: WorkFrame, b: WorkFrame): number {
  return IDENTITY_ROLES.filter((role) => a[role] === b[role]).length;
}

// ---------------------------------------------------------------------------
// Concept lexicon
// ---------------------------------------------------------------------------

interface ConceptSpec {
  personForms: string[];
  jobForms: string[];
  neutralForms: string[];
  trapForms?: string[];
  trapPartner?: string;
}

const c = (id: string, role: ConceptRole, family: Concept["family"], spec: ConceptSpec): Concept => ({
  id,
  role,
  family,
  ...spec,
});

/**
 * The lexicon. Person and job realizations are authored independently per concept.
 *
 * Deliberately NOT derived from a thesaurus or an embedding model: deriving one side from the
 * other would reintroduce a systematic surface relationship for a system to learn instead of
 * the meaning. It is authored, then mechanically checked by the verifiers below.
 */
export const CONCEPTS: Concept[] = [
  // ======================= ACTIONS =======================
  c("act.diagnose", "action", "core", {
    personForms: ["tracked down", "got to the bottom of", "worked out what was behind"],
    jobForms: ["determine the cause of", "isolate the source of", "establish why"],
    neutralForms: ["investigated", "diagnosed", "identified the cause of"],
    // Trap: "went through it carefully" reads the same as a formal audit, but diagnosing a
    // fault and auditing for compliance are different work with different outputs.
    trapForms: ["went through it carefully", "worked through it in detail"],
    trapPartner: "act.audit",
  }),
  c("act.audit", "action", "core", {
    personForms: ["combed over", "checked end to end", "went over every entry"],
    jobForms: ["conduct formal examination of", "perform structured verification of", "systematically inspect"],
    neutralForms: ["audited", "reviewed in detail", "examined"],
    trapForms: ["went through it carefully", "worked through it in detail"],
    trapPartner: "act.diagnose",
  }),
  c("act.reconcile", "action", "core", {
    personForms: ["squared up", "tied out", "matched off"],
    jobForms: ["bring into agreement", "resolve discrepancies between", "align"],
    neutralForms: ["reconciled", "balanced", "resolved differences in"],
  }),
  c("act.forecast", "action", "core", {
    personForms: ["called ahead on", "put numbers to", "said early what was coming for"],
    jobForms: ["produce forward estimates of", "model expected", "anticipate"],
    neutralForms: ["forecast", "projected", "modelled future"],
  }),
  c("act.negotiate", "action", "core", {
    personForms: ["hammered out", "talked through the details on", "worked out a deal on"],
    jobForms: ["reach agreement on", "settle terms for", "broker"],
    neutralForms: ["negotiated", "agreed terms on", "settled"],
  }),
  c("act.instruct", "action", "core", {
    personForms: ["walked people through", "brought others up to speed on", "showed teams how to handle"],
    jobForms: ["deliver training on", "educate staff regarding", "provide instruction covering"],
    neutralForms: ["trained others on", "taught", "coached the team on"],
  }),
  c("act.design", "action", "core", {
    personForms: ["drew up", "sketched out", "shaped"],
    jobForms: ["author specifications for", "produce the blueprint for", "architect"],
    neutralForms: ["designed", "specified", "planned out"],
  }),
  c("act.triage", "action", "core", {
    personForms: ["sorted by urgency", "worked out what mattered first", "ranked what to hit first"],
    jobForms: ["prioritise incoming", "assign severity to", "order by criticality"],
    neutralForms: ["triaged", "prioritised", "ranked by urgency"],
  }),
  c("act.monitor", "action", "core", {
    personForms: ["kept an eye on", "watched over", "kept tabs on"],
    jobForms: ["maintain surveillance of", "continuously observe", "track the state of"],
    neutralForms: ["monitored", "tracked", "observed"],
  }),
  c("act.remediate", "action", "core", {
    personForms: ["put right", "sorted out for good", "cleaned up"],
    jobForms: ["implement corrective measures for", "rectify", "deliver remediation of"],
    neutralForms: ["remediated", "fixed", "corrected"],
  }),
  c("act.mediate", "action", "held-out", {
    personForms: ["smoothed over", "stood between the parties on", "cooled down"],
    jobForms: ["facilitate resolution of", "arbitrate", "reconcile opposing positions in"],
    neutralForms: ["mediated", "resolved the dispute over", "brokered a settlement on"],
  }),
  c("act.provision", "action", "held-out", {
    personForms: ["stood up", "got running", "spun up"],
    jobForms: ["commission", "bring into service", "establish operational"],
    neutralForms: ["provisioned", "deployed", "brought online"],
  }),
  c("act.consolidate", "action", "held-out", {
    personForms: ["pulled together", "brought under one roof", "merged down"],
    jobForms: ["unify disparate", "centralise", "integrate fragmented"],
    neutralForms: ["consolidated", "centralised", "unified"],
  }),
  c("act.decommission", "action", "held-out", {
    personForms: ["wound down", "took out of service", "switched off for good"],
    jobForms: ["retire legacy", "sunset", "formally withdraw"],
    neutralForms: ["decommissioned", "retired", "phased out"],
  }),
  c("act.benchmark", "action", "held-out", {
    personForms: ["sized ourselves up next to others on", "saw how we stacked up on", "put us side by side with the rest on"],
    jobForms: ["evaluate comparative performance of", "assess relative standing in", "measure against peer"],
    neutralForms: ["benchmarked", "compared against peers on", "assessed relative performance of"],
  }),

  // ======================= OBJECTS =======================
  c("obj.equipment_fault", "object", "core", {
    personForms: ["kit that kept cutting out", "machines that kept dropping offline", "gear that kept failing"],
    jobForms: ["intermittent hardware malfunctions", "recurring plant defects", "unplanned equipment downtime"],
    neutralForms: ["equipment failures", "machine breakdowns", "hardware faults"],
    // Trap: "problems that kept cropping up" fits a plant fault and a code defect alike.
    trapForms: ["problems that kept cropping up", "issues that kept coming back"],
    trapPartner: "obj.software_defect",
  }),
  c("obj.software_defect", "object", "core", {
    personForms: ["bugs users kept hitting", "faults in the build", "broken behaviour in the release"],
    jobForms: ["reported application errors", "software non-conformances", "production code defects"],
    neutralForms: ["software bugs", "application defects", "code errors"],
    trapForms: ["problems that kept cropping up", "issues that kept coming back"],
    trapPartner: "obj.equipment_fault",
  }),
  c("obj.ledger", "object", "core", {
    personForms: ["the books", "the monthly figures", "our running totals"],
    jobForms: ["general ledger balances", "period-end accounts", "financial close records"],
    neutralForms: ["the accounts", "ledger balances", "the financial records"],
    // Trap: "the returns that had to go in" is a regulatory lodgement or an accounting
    // submission — same words, different work, different accountability.
    trapForms: ["the returns that had to go in", "the submissions that were due"],
    trapPartner: "obj.regulatory_filing",
  }),
  c("obj.regulatory_filing", "object", "core", {
    personForms: ["the forms the inspectors wanted", "our periodic lodgements", "what had to go to the watchdog"],
    jobForms: ["mandated compliance submissions", "prescribed statutory returns", "required supervisory disclosures"],
    neutralForms: ["regulatory filings", "compliance submissions", "statutory returns"],
    trapForms: ["the returns that had to go in", "the submissions that were due"],
    trapPartner: "obj.ledger",
  }),
  c("obj.customer_complaint", "object", "core", {
    personForms: ["angry callers", "people who had had a bad time", "folk who had been let down"],
    jobForms: ["escalated client grievances", "customer dissatisfaction cases", "service failure reports"],
    neutralForms: ["customer complaints", "escalations", "service complaints"],
  }),
  c("obj.staffing_level", "object", "core", {
    personForms: ["who we needed on shift", "cover for the rota", "headcount on the floor"],
    jobForms: ["workforce capacity requirements", "personnel allocation", "rostered manning levels"],
    neutralForms: ["staffing levels", "shift cover", "headcount planning"],
  }),
  c("obj.safety_incident", "object", "core", {
    personForms: ["near misses", "things that nearly went wrong", "close calls on site"],
    jobForms: ["reportable safety events", "occupational injury occurrences", "workplace hazard incidents"],
    neutralForms: ["safety incidents", "near misses on site", "workplace accidents"],
  }),
  c("obj.supply_shortfall", "object", "core", {
    personForms: ["stock running out", "not being able to get hold of things", "shortages coming down the line"],
    jobForms: ["inventory deficits", "procurement gaps", "materials availability constraints"],
    neutralForms: ["stock shortages", "supply gaps", "inventory shortfalls"],
  }),
  c("obj.access_request", "object", "core", {
    personForms: ["people asking to get into systems", "who was allowed where", "requests to be let in somewhere"],
    jobForms: ["privilege elevation submissions", "entitlement provisioning demands", "authorisation grant queues"],
    neutralForms: ["access requests", "permission requests", "user access approvals"],
  }),
  c("obj.contract_terms", "object", "core", {
    personForms: ["what was written into the deal", "the small print", "what both sides had signed up to"],
    jobForms: ["negotiated agreement provisions", "commercial clause schedules", "executed instrument conditions"],
    neutralForms: ["contract terms", "the agreement clauses", "contractual conditions"],
  }),
  c("obj.patient_pathway", "object", "held-out", {
    personForms: ["how people moved from one stage to the next", "the route someone took while being looked after"],
    jobForms: ["clinical journey progressions", "care episode trajectories", "treatment continuum flows"],
    neutralForms: ["patient pathways", "care pathways", "treatment journeys"],
  }),
  c("obj.energy_usage", "object", "held-out", {
    personForms: ["what we were burning through", "how much power was going out the door"],
    jobForms: ["aggregate consumption profiles", "utility draw metrics", "resource expenditure loads"],
    neutralForms: ["energy consumption", "power usage", "utility consumption"],
  }),
  c("obj.training_gap", "object", "held-out", {
    personForms: ["what people did not know yet", "where the team was light on know-how"],
    jobForms: ["competency deficiencies", "capability shortfalls in personnel", "skills attainment gaps"],
    neutralForms: ["skills gaps", "training needs", "capability gaps"],
  }),
  c("obj.data_quality", "object", "held-out", {
    personForms: ["records that could not be trusted", "figures that did not hang together"],
    jobForms: ["dataset integrity deficiencies", "information reliability defects", "master data inconsistencies"],
    neutralForms: ["data quality issues", "data integrity problems", "unreliable records"],
  }),
  c("obj.vendor_performance", "object", "held-out", {
    personForms: ["how our suppliers were doing", "whether the firms we used were keeping up"],
    jobForms: ["third-party delivery attainment", "counterparty service adherence", "external provider conformance"],
    neutralForms: ["supplier performance", "vendor delivery", "third-party performance"],
  }),

  // ======================= PURPOSES =======================
  c("pur.restore_uptime", "purpose", "core", {
    personForms: ["so the line could keep running", "to stop losing hours", "to get production moving again"],
    jobForms: ["to minimise operational interruption", "in order to sustain availability", "to protect throughput continuity"],
    neutralForms: ["to restore service", "to reduce downtime", "to keep operations running"],
  }),
  c("pur.prevent_recurrence", "purpose", "core", {
    personForms: ["so it would not happen again", "to stop it coming back", "to close it out for good"],
    jobForms: ["to eliminate repeat occurrences", "for permanent corrective closure", "to preclude reincidence"],
    neutralForms: ["to prevent recurrence", "to stop it happening again", "for lasting resolution"],
  }),
  c("pur.satisfy_regulator", "purpose", "core", {
    personForms: ["to keep the inspectors happy", "so we would pass", "to stay on the right side of the rules"],
    jobForms: ["to maintain statutory compliance", "in order to meet supervisory obligations", "to uphold regulatory standing"],
    neutralForms: ["to remain compliant", "to satisfy the regulator", "to meet legal obligations"],
    // Trap: "to keep us inside the limits" is a compliance limit or a budget limit. Different
    // stakeholders, different work, different consequence of failure.
    trapForms: ["to keep us inside the limits", "to stay within what we were allowed"],
    trapPartner: "pur.reduce_cost",
  }),
  c("pur.reduce_cost", "purpose", "core", {
    personForms: ["to stop money leaking out", "to bring spend down", "to save on what we were paying"],
    jobForms: ["to achieve expenditure reduction", "for margin improvement", "to lower unit economics"],
    neutralForms: ["to reduce cost", "to cut spend", "to improve margin"],
    trapForms: ["to keep us inside the limits", "to stay within what we were allowed"],
    trapPartner: "pur.satisfy_regulator",
  }),
  c("pur.improve_experience", "purpose", "core", {
    personForms: ["so people had a better time of it", "to make it less painful for those we served", "to stop annoying people"],
    jobForms: ["to elevate client satisfaction", "for service quality enhancement", "to strengthen the customer journey"],
    neutralForms: ["to improve the customer experience", "to raise satisfaction", "to make the service better"],
  }),
  c("pur.reduce_risk", "purpose", "core", {
    personForms: ["so a bad turn could not hurt us as much", "to take the danger out of it", "so one bad day could not sink us"],
    jobForms: ["to mitigate downside exposure", "for hazard reduction", "to limit adverse contingency"],
    neutralForms: ["to reduce risk", "to lower our exposure", "to make it safer"],
  }),
  c("pur.increase_throughput", "purpose", "core", {
    personForms: ["to get more done in a day", "so we could take on a bigger load", "to speed things up"],
    jobForms: ["to raise processing capacity", "for volume scalability", "to expand handling rates"],
    neutralForms: ["to increase throughput", "to raise capacity", "to handle more volume"],
  }),
  c("pur.inform_decision", "purpose", "held-out", {
    personForms: ["so the boss could choose", "to give leadership something to go on", "so a call could be made"],
    jobForms: ["to underpin executive determination", "for governance decision support", "to substantiate strategic selection"],
    neutralForms: ["to inform the decision", "to support leadership choices", "to guide strategy"],
  }),
  c("pur.retain_staff", "purpose", "held-out", {
    personForms: ["so good people would stay", "to stop everyone walking out the door"],
    jobForms: ["to improve workforce retention", "for attrition mitigation", "to sustain talent continuity"],
    neutralForms: ["to retain staff", "to reduce turnover", "to keep the team together"],
  }),
  c("pur.enable_growth", "purpose", "held-out", {
    personForms: ["so we could take on more business", "to open the door to bigger work"],
    jobForms: ["to underpin commercial expansion", "for scalable market extension", "to facilitate revenue enlargement"],
    neutralForms: ["to enable growth", "to support expansion", "to grow the business"],
  }),
  c("pur.improve_accuracy", "purpose", "held-out", {
    personForms: ["so the numbers could be trusted", "to stop us getting it wrong"],
    jobForms: ["to raise output precision", "for error rate suppression", "to strengthen correctness assurance"],
    neutralForms: ["to improve accuracy", "to reduce errors", "to make the figures reliable"],
  }),

  // ======================= METHODS =======================
  c("met.elimination", "method", "core", {
    personForms: ["ruling things out one at a time", "narrowing it down step by step", "crossing off what it was not"],
    jobForms: ["systematic exclusion of candidate causes", "progressive differential isolation", "structured cause elimination"],
    neutralForms: ["process of elimination", "systematic narrowing", "ruling out causes one by one"],
  }),
  c("met.statistical", "method", "core", {
    personForms: ["crunching the numbers", "looking at what the figures showed", "running it through the maths"],
    jobForms: ["quantitative analytical techniques", "statistical inference methods", "numerical modelling approaches"],
    neutralForms: ["statistical analysis", "quantitative methods", "numerical analysis"],
  }),
  c("met.interview", "method", "core", {
    personForms: ["sitting down and talking to people", "getting the story from those involved", "asking around"],
    jobForms: ["structured stakeholder consultation", "formal witness elicitation", "systematic informant enquiry"],
    neutralForms: ["interviews with those involved", "stakeholder conversations", "speaking to the people concerned"],
    // Trap: "gathering accounts of what happened" is spoken testimony or written record —
    // different method, different reliability, different skill.
    trapForms: ["gathering accounts of what happened", "collecting what had been set down"],
    trapPartner: "met.documentation_review",
  }),
  c("met.documentation_review", "method", "core", {
    personForms: ["reading back through old notes", "going over what had been written down", "digging through past logs"],
    jobForms: ["examination of archival documentation", "retrospective record analysis", "documentary evidence assessment"],
    neutralForms: ["reviewing the records", "document review", "going through historical logs"],
    trapForms: ["gathering accounts of what happened", "collecting what had been set down"],
    trapPartner: "met.interview",
  }),
  c("met.observation", "method", "core", {
    personForms: ["standing there and watching how it actually ran", "seeing it for myself on the floor"],
    jobForms: ["direct operational observation", "in-situ behavioural study", "first-hand process witnessing"],
    neutralForms: ["direct observation", "watching the process in action", "on-site observation"],
  }),
  c("met.experiment", "method", "core", {
    personForms: ["changing one thing at a time and seeing what happened", "trying variations to see which held up"],
    jobForms: ["controlled comparative trials", "designed factorial testing", "hypothesis-driven experimentation"],
    neutralForms: ["controlled experiments", "structured testing", "trialling variations"],
  }),
  c("met.simulation", "method", "held-out", {
    personForms: ["trying it out in a safe copy", "running a dry version first", "checking it away from the real thing"],
    jobForms: ["modelled scenario evaluation", "synthetic environment trials", "emulated condition testing"],
    neutralForms: ["simulation", "modelling scenarios", "testing in a sandbox"],
  }),
  c("met.peer_review", "method", "held-out", {
    personForms: ["having someone else check my working", "getting a second pair of eyes on it"],
    jobForms: ["independent collegial verification", "structured external appraisal", "formal appraisal by qualified peers"],
    neutralForms: ["peer review", "independent review", "a second opinion"],
  }),
  c("met.root_cause_tree", "method", "held-out", {
    personForms: ["keeping on asking why until it bottomed out", "following the chain back to where it started"],
    jobForms: ["formal causal decomposition", "hierarchical fault tree construction", "structured causality mapping"],
    neutralForms: ["root cause analysis", "causal analysis", "tracing the chain of causes"],
  }),
  c("met.benchmarked_comparison", "method", "held-out", {
    personForms: ["putting us side by side with others", "seeing how the same job was done elsewhere"],
    jobForms: ["comparative external referencing", "peer cohort standardisation", "cross-organisational baselining"],
    neutralForms: ["benchmarking against peers", "external comparison", "comparative study"],
  }),

  // ============ INSTRUMENTS (incidental colour; excluded from identity) ============
  c("ins.sensor_log", "instrument", "core", {
    personForms: ["readouts from the machines"],
    jobForms: ["telemetry captures"],
    neutralForms: ["sensor logs", "machine telemetry"],
  }),
  c("ins.spreadsheet", "instrument", "core", {
    personForms: ["a big sheet I kept"],
    jobForms: ["tabular workbooks"],
    neutralForms: ["spreadsheets", "workbooks"],
  }),
  c("ins.ticket_system", "instrument", "core", {
    personForms: ["the job queue"],
    jobForms: ["case management platforms"],
    neutralForms: ["the ticketing system", "case tracking tools"],
  }),
  c("ins.checklist", "instrument", "core", {
    personForms: ["a list I worked down"],
    jobForms: ["structured verification schedules"],
    neutralForms: ["checklists", "standard procedures"],
  }),
  c("ins.query_console", "instrument", "held-out", {
    personForms: ["poking at the database directly"],
    jobForms: ["structured interrogation interfaces"],
    neutralForms: ["database queries", "query tooling"],
  }),
  c("ins.field_kit", "instrument", "held-out", {
    personForms: ["what I could carry out to site"],
    jobForms: ["portable diagnostic instrumentation"],
    neutralForms: ["field equipment", "portable test kit"],
  }),
  c("ins.survey_form", "instrument", "held-out", {
    personForms: ["a short set of questions I sent round"],
    jobForms: ["standardised elicitation instruments"],
    neutralForms: ["surveys", "questionnaires"],
  }),

  // ============== OUTPUTS (incidental colour; excluded from identity) ==============
  c("out.written_report", "output", "core", {
    personForms: ["a write up at the end"],
    jobForms: ["formal findings documentation"],
    neutralForms: ["a written report", "a findings document"],
  }),
  c("out.recommendation", "output", "core", {
    personForms: ["what I reckoned we should do"],
    jobForms: ["advisory determinations"],
    neutralForms: ["recommendations", "proposed actions"],
  }),
  c("out.dashboard", "output", "core", {
    personForms: ["a screen the team could watch"],
    jobForms: ["monitoring visualisations"],
    neutralForms: ["a dashboard", "monitoring views"],
  }),
  c("out.revised_procedure", "output", "core", {
    personForms: ["a new way of doing it that stuck"],
    jobForms: ["amended operating instructions"],
    neutralForms: ["an updated procedure", "revised standard practice"],
  }),
  c("out.forecast_model", "output", "held-out", {
    personForms: ["something that told us what was coming"],
    jobForms: ["predictive estimation apparatus"],
    neutralForms: ["a forecasting model", "a projection model"],
  }),
  c("out.training_material", "output", "held-out", {
    personForms: ["stuff other people could learn from"],
    jobForms: ["instructional curricula"],
    neutralForms: ["training materials", "course content"],
  }),
  c("out.risk_register", "output", "held-out", {
    personForms: ["a running list of what could bite us"],
    jobForms: ["catalogued exposure schedules"],
    neutralForms: ["a risk register", "a logged risk list"],
  }),

  // ======================= DOMAINS =======================
  c("dom.manufacturing", "domain", "core", {
    personForms: ["on the factory floor", "out in the works", "around the assembly bays"],
    jobForms: ["within industrial operations", "in a fabrication environment", "across process manufacturing"],
    neutralForms: ["in manufacturing", "on the production side", "in an industrial setting"],
  }),
  c("dom.healthcare", "domain", "core", {
    personForms: ["on the wards", "in a hospital setting", "around patient treatment"],
    jobForms: ["within clinical services", "in a care delivery environment", "across health provision"],
    neutralForms: ["in healthcare", "in a clinical setting", "across care services"],
    // Trap: "somewhere every step gets checked" fits clinical care and financial services
    // alike, but the domain changes what the work actually involves.
    trapForms: ["somewhere every step gets checked", "in a place where the rules are tight"],
    trapPartner: "dom.financial_services",
  }),
  c("dom.financial_services", "domain", "core", {
    personForms: ["in banking", "around lending and deposits", "on the money side"],
    jobForms: ["within capital markets", "in a fiduciary environment", "across investment operations"],
    neutralForms: ["in financial services", "in banking", "across finance"],
    trapForms: ["somewhere every step gets checked", "in a place where the rules are tight"],
    trapPartner: "dom.healthcare",
  }),
  c("dom.public_sector", "domain", "core", {
    personForms: ["in local council work", "on town hall business", "in a civic setting"],
    jobForms: ["within municipal administration", "in a governmental environment", "across public authority functions"],
    neutralForms: ["in the public sector", "in local government", "across public services"],
  }),
  c("dom.retail", "domain", "core", {
    personForms: ["out on the shop floor", "around tills and shelves"],
    jobForms: ["within consumer commerce", "across merchandising operations"],
    neutralForms: ["in retail", "in stores", "across consumer sales"],
  }),
  c("dom.education", "domain", "core", {
    personForms: ["around classrooms", "in a school setting"],
    jobForms: ["within academic institutions", "across pedagogic provision"],
    neutralForms: ["in education", "in schools", "across teaching institutions"],
  }),
  c("dom.logistics", "domain", "held-out", {
    personForms: ["in the warehouse and on the road", "around shipping and haulage", "on distribution"],
    jobForms: ["within freight operations", "in a supply chain environment", "across fulfilment networks"],
    neutralForms: ["in logistics", "across the supply chain", "in distribution"],
  }),
  c("dom.energy", "domain", "held-out", {
    personForms: ["around generation and the grid", "out on the network"],
    jobForms: ["within power utilities", "across transmission infrastructure"],
    neutralForms: ["in energy", "in utilities", "across power networks"],
  }),
  c("dom.telecoms", "domain", "held-out", {
    personForms: ["around masts and exchanges", "on the phone network"],
    jobForms: ["within communications carriers", "across connectivity infrastructure"],
    neutralForms: ["in telecoms", "in communications", "across network services"],
  }),
  c("dom.hospitality", "domain", "held-out", {
    personForms: ["around visitors and bookings", "in hotels and venues"],
    jobForms: ["within accommodation services", "across guest experience operations"],
    neutralForms: ["in hospitality", "in hotels", "across guest services"],
  }),
];

export const CONCEPTS_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

export function conceptsFor(role: ConceptRole, families: Concept["family"][]): Concept[] {
  return CONCEPTS.filter((concept) => concept.role === role && families.includes(concept.family));
}

/** Concepts that carry a trap partner, i.e. can participate in LEXICAL_TRAP. */
export function trapPairs(): Array<[Concept, Concept]> {
  const seen = new Set<string>();
  const pairs: Array<[Concept, Concept]> = [];
  for (const concept of CONCEPTS) {
    if (!concept.trapPartner || seen.has(concept.id)) continue;
    const partner = CONCEPTS_BY_ID.get(concept.trapPartner);
    if (!partner) throw new Error(`Concept ${concept.id} names unknown trap partner ${concept.trapPartner}`);
    seen.add(concept.id);
    seen.add(partner.id);
    pairs.push([concept, partner]);
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// The invariants that make this corpus honest
// ---------------------------------------------------------------------------

export interface DisjointnessViolation {
  conceptId: string;
  sharedTokens: string[];
  personForm: string;
  jobForm: string;
}

/**
 * Every concept's person-side and job-side SEMANTIC_BRIDGE realizations must share NO content
 * token.
 *
 * This is the property whose absence made the previous corpus solvable by token overlap. It is
 * checked mechanically rather than trusted, because a single shared distinctive noun is enough
 * to reintroduce the giveaway. `neutralForms` and `trapForms` are deliberately NOT checked —
 * sharing vocabulary is the entire point of those regimes.
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

/**
 * Every role must be populated in every vocabulary family.
 *
 * v1 shipped with zero held-out instruments and outputs, so `sampleFrame(rng, ["held-out"])`
 * threw and the contract's generalization mechanism could never have run. This turns that class
 * of defect into a test failure rather than a runtime crash.
 */
export function verifyFamilyCoverage(minimumPerIdentityRole = 4, minimumPerIncidentalRole = 2): string[] {
  const problems: string[] = [];
  for (const family of ["core", "held-out"] as const) {
    for (const role of ["action", "object", "purpose", "method", "instrument", "output", "domain"] as const) {
      const count = conceptsFor(role, [family]).length;
      const minimum = (IDENTITY_ROLES as readonly string[]).includes(role) ? minimumPerIdentityRole : minimumPerIncidentalRole;
      if (count < minimum) problems.push(`${family}/${role}: ${count} concepts, need at least ${minimum}`);
    }
  }
  return problems;
}

/**
 * Every declared trap partnership must be symmetric, cross-role-consistent, and actually
 * confusable. An asymmetric partner would make trap construction direction-dependent, and a
 * trap pair with no shared surface would not be a trap at all.
 */
export function verifyTrapPairs(): string[] {
  const problems: string[] = [];
  for (const concept of CONCEPTS) {
    if (!concept.trapPartner) continue;
    const partner = CONCEPTS_BY_ID.get(concept.trapPartner);
    if (!partner) {
      problems.push(`${concept.id}: unknown trap partner ${concept.trapPartner}`);
      continue;
    }
    if (partner.trapPartner !== concept.id) problems.push(`${concept.id} <-> ${partner.id}: partnership is not symmetric`);
    if (partner.role !== concept.role) problems.push(`${concept.id} <-> ${partner.id}: trap partners must share a role`);
    if (!concept.trapForms?.length) problems.push(`${concept.id}: declares a trap partner but has no trapForms`);
    const mine = new Set(concept.trapForms ?? []);
    const theirs = new Set(partner.trapForms ?? []);
    const shared = [...mine].filter((form) => theirs.has(form));
    if (!shared.length) problems.push(`${concept.id} <-> ${partner.id}: trap forms share no surface, so the pair is not confusable`);
  }
  return problems;
}

/** Distinct work identities constructible from a vocabulary family. */
export function identitySpaceSize(families: Concept["family"][]): number {
  return IDENTITY_ROLES.reduce((total, role) => total * conceptsFor(role, families).length, 1);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const pick = <T,>(rng: Rng, values: T[]): T => {
  if (!values.length) throw new Error("cannot pick from an empty list");
  return values[Math.floor(rng() * values.length)]!;
};

/**
 * Surface form for one concept, under one family and one side.
 *
 * NATURAL draws both sides from the same neutral pool — that is what makes overlap realistic
 * rather than engineered. LEXICAL_TRAP uses the shared trap surface when the concept has one
 * and falls back to neutral otherwise, so a trap frame reads as similar precisely at the role
 * that distinguishes it.
 */
export function conceptForm(rng: Rng, conceptId: string, side: "person" | "job", family: RenderFamily): string {
  const concept = CONCEPTS_BY_ID.get(conceptId);
  if (!concept) throw new Error(`Unknown concept: ${conceptId}`);
  if (family === "SEMANTIC_BRIDGE") return pick(rng, side === "person" ? concept.personForms : concept.jobForms);
  if (family === "LEXICAL_TRAP") return pick(rng, concept.trapForms ?? concept.neutralForms);
  return pick(rng, concept.neutralForms);
}

const PERSON_TEMPLATES = [
  "I {action} {object} {domain}, {purpose}, mostly by {method}.",
  "A lot of my time went on {action} {object} {domain} — {purpose} — {method}.",
  "{domain}, I {action} {object}. {method} was how I did it, {purpose}.",
  "Most weeks I {action} {object} {domain}. {purpose}, and the way in was {method}.",
];

const JOB_TEMPLATES = [
  "{action} {object} {domain}, {purpose}. Approach: {method}.",
  "The role will {action} {object} {domain} {purpose}, applying {method}.",
  "Responsible for work to {action} {object} {domain}, {purpose}. Method: {method}.",
  "You will {action} {object} {domain} {purpose}, working through {method}.",
];

const fill = (template: string, frame: WorkFrame, rng: Rng, side: "person" | "job", family: RenderFamily): string =>
  template
    .replace("{action}", conceptForm(rng, frame.action, side, family))
    .replace("{object}", conceptForm(rng, frame.object, side, family))
    .replace("{purpose}", conceptForm(rng, frame.purpose, side, family))
    .replace("{method}", conceptForm(rng, frame.method, side, family))
    .replace("{domain}", conceptForm(rng, frame.domain, side, family));

/**
 * Render a frame as first-person person-side evidence.
 *
 * The person and job TEMPLATE pools are disjoint in every family, so even when NATURAL causes
 * both sides to draw the same phrase, the rendered sentences are never identical. There is no
 * shared source string at any point, in any family — that is the defect this model exists to
 * remove, and it must not creep back in via a shared template.
 */
export function renderPersonFrame(frame: WorkFrame, rng: Rng, family: RenderFamily = "SEMANTIC_BRIDGE"): string {
  return fill(pick(rng, PERSON_TEMPLATES), frame, rng, "person", family);
}

/** Render the SAME frame as a job responsibility. */
export function renderJobFrame(frame: WorkFrame, rng: Rng, family: RenderFamily = "SEMANTIC_BRIDGE"): string {
  return fill(pick(rng, JOB_TEMPLATES), frame, rng, "job", family);
}

// Preference and aspiration voice.
//
// Stance is stated EXPLICITLY in the surface text and is never implied by word choice. The
// standing rule (`docs/PREFERENCE_GENERATOR_SEMANTICS.md`) is that generated preference
// language must MEAN what the hidden truth says: a LIKE statement must read as liking the
// work, a DISLIKE statement as disliking that same work. These templates carry the stance in
// the frame carrier, so the stance cannot drift with the vocabulary regime.
const LIKE_TEMPLATES = [
  "The part I genuinely enjoyed was when I {work}.",
  "What I liked most: {work}.",
  "I always wanted more of the work where I {work}.",
];

const DISLIKE_TEMPLATES = [
  "The part I came to dread was when I {work}.",
  "What I disliked most: {work}.",
  "I would be happy never again to be the one who {work}.",
];

const ASPIRATION_TEMPLATES = [
  "What I want to move into next is work where I {work}.",
  "Going forward I am looking for a role where I {work}.",
  "The direction I want next: {work}.",
];

/** A clause describing the frame in person voice, for embedding in a carrier sentence. */
function personClause(frame: WorkFrame, rng: Rng, family: RenderFamily): string {
  return [
    conceptForm(rng, frame.action, "person", family),
    conceptForm(rng, frame.object, "person", family),
    conceptForm(rng, frame.domain, "person", family),
    conceptForm(rng, frame.purpose, "person", family),
  ].join(" ");
}

/** Render a LIKE or DISLIKE statement about a frame. Stance is explicit, never inferred. */
export function renderPreferenceFrame(
  frame: WorkFrame,
  rng: Rng,
  stance: "LIKE" | "DISLIKE",
  family: RenderFamily = "SEMANTIC_BRIDGE",
): string {
  const template = pick(rng, stance === "LIKE" ? LIKE_TEMPLATES : DISLIKE_TEMPLATES);
  return template.replace("{work}", personClause(frame, rng, family));
}

/** Render a forward-looking statement about a frame the person wants to do next. */
export function renderAspirationFrame(frame: WorkFrame, rng: Rng, family: RenderFamily = "SEMANTIC_BRIDGE"): string {
  return pick(rng, ASPIRATION_TEMPLATES).replace("{work}", personClause(frame, rng, family));
}

// ---------------------------------------------------------------------------
// Plausibility
// ---------------------------------------------------------------------------
//
// WHY COHERENCE IS A CORRECTNESS REQUIREMENT, NOT POLISH
// -----------------------------------------------------
// Sampling every role independently produces frames like "design software defects in local
// government by direct observation" — a well-defined identity attached to nonsense prose. That
// is survivable for a lexical baseline (token overlap does not care whether text means
// anything) and fatal for a fair architecture comparison: a language model is trained on
// coherent language and degrades on nonsense, so an incoherent corpus would systematically
// handicap exactly the hypothesis under test and we would mistake that artifact for a result.
//
// So each OBJECT declares the actions, domains and purposes it plausibly participates in.
// This constrains only which frames are SAMPLED. It does not touch identity, does not couple
// the person and job lexicons, and does not make any role recoverable from another beyond the
// correlation real work already has.
interface ObjectAffinity {
  actions: string[];
  domains: string[];
  purposes: string[];
}

const OBJECT_AFFINITY: Record<string, ObjectAffinity> = {
  "obj.equipment_fault": {
    actions: ["act.diagnose", "act.remediate", "act.monitor", "act.triage", "act.audit"],
    domains: ["dom.manufacturing", "dom.energy", "dom.logistics", "dom.telecoms", "dom.healthcare"],
    purposes: ["pur.restore_uptime", "pur.prevent_recurrence", "pur.reduce_cost", "pur.reduce_risk", "pur.increase_throughput"],
  },
  "obj.software_defect": {
    actions: ["act.diagnose", "act.remediate", "act.triage", "act.monitor", "act.audit"],
    domains: ["dom.financial_services", "dom.retail", "dom.telecoms", "dom.public_sector", "dom.education"],
    purposes: ["pur.restore_uptime", "pur.prevent_recurrence", "pur.improve_experience", "pur.improve_accuracy", "pur.reduce_risk"],
  },
  "obj.ledger": {
    actions: ["act.reconcile", "act.audit", "act.forecast", "act.remediate", "act.consolidate"],
    domains: ["dom.financial_services", "dom.public_sector", "dom.retail", "dom.manufacturing", "dom.education"],
    purposes: ["pur.improve_accuracy", "pur.satisfy_regulator", "pur.reduce_cost", "pur.prevent_recurrence", "pur.inform_decision"],
  },
  "obj.regulatory_filing": {
    actions: ["act.audit", "act.reconcile", "act.design", "act.instruct", "act.consolidate"],
    domains: ["dom.financial_services", "dom.healthcare", "dom.public_sector", "dom.energy", "dom.education"],
    purposes: ["pur.satisfy_regulator", "pur.reduce_risk", "pur.improve_accuracy", "pur.prevent_recurrence"],
  },
  "obj.customer_complaint": {
    actions: ["act.triage", "act.diagnose", "act.remediate", "act.mediate", "act.monitor"],
    domains: ["dom.retail", "dom.financial_services", "dom.telecoms", "dom.hospitality", "dom.healthcare"],
    purposes: ["pur.improve_experience", "pur.prevent_recurrence", "pur.reduce_risk", "pur.retain_staff"],
  },
  "obj.staffing_level": {
    actions: ["act.forecast", "act.design", "act.monitor", "act.negotiate", "act.consolidate"],
    domains: ["dom.healthcare", "dom.retail", "dom.hospitality", "dom.logistics", "dom.public_sector"],
    purposes: ["pur.reduce_cost", "pur.increase_throughput", "pur.improve_experience", "pur.retain_staff"],
  },
  "obj.safety_incident": {
    actions: ["act.diagnose", "act.audit", "act.remediate", "act.instruct", "act.triage"],
    domains: ["dom.manufacturing", "dom.healthcare", "dom.energy", "dom.logistics", "dom.public_sector"],
    purposes: ["pur.prevent_recurrence", "pur.reduce_risk", "pur.satisfy_regulator"],
  },
  "obj.supply_shortfall": {
    actions: ["act.forecast", "act.negotiate", "act.monitor", "act.triage", "act.benchmark"],
    domains: ["dom.manufacturing", "dom.retail", "dom.logistics", "dom.healthcare", "dom.hospitality"],
    purposes: ["pur.restore_uptime", "pur.reduce_cost", "pur.increase_throughput", "pur.reduce_risk"],
  },
  "obj.access_request": {
    actions: ["act.triage", "act.audit", "act.provision", "act.design", "act.monitor"],
    domains: ["dom.financial_services", "dom.healthcare", "dom.public_sector", "dom.telecoms", "dom.education"],
    purposes: ["pur.reduce_risk", "pur.satisfy_regulator", "pur.increase_throughput", "pur.improve_experience"],
  },
  "obj.contract_terms": {
    actions: ["act.negotiate", "act.audit", "act.design", "act.mediate", "act.consolidate"],
    domains: ["dom.financial_services", "dom.public_sector", "dom.manufacturing", "dom.telecoms", "dom.hospitality"],
    purposes: ["pur.reduce_cost", "pur.reduce_risk", "pur.satisfy_regulator", "pur.enable_growth"],
  },
  "obj.patient_pathway": {
    actions: ["act.design", "act.monitor", "act.diagnose", "act.instruct", "act.benchmark"],
    domains: ["dom.healthcare", "dom.public_sector", "dom.education"],
    purposes: ["pur.improve_experience", "pur.increase_throughput", "pur.reduce_risk", "pur.improve_accuracy"],
  },
  "obj.energy_usage": {
    actions: ["act.monitor", "act.forecast", "act.audit", "act.remediate", "act.benchmark"],
    domains: ["dom.energy", "dom.manufacturing", "dom.logistics", "dom.retail", "dom.hospitality"],
    purposes: ["pur.reduce_cost", "pur.satisfy_regulator", "pur.reduce_risk", "pur.enable_growth"],
  },
  "obj.training_gap": {
    actions: ["act.instruct", "act.design", "act.audit", "act.benchmark", "act.monitor"],
    domains: ["dom.education", "dom.healthcare", "dom.manufacturing", "dom.retail", "dom.public_sector"],
    purposes: ["pur.retain_staff", "pur.improve_accuracy", "pur.reduce_risk", "pur.increase_throughput"],
  },
  "obj.data_quality": {
    actions: ["act.audit", "act.reconcile", "act.remediate", "act.diagnose", "act.consolidate"],
    domains: ["dom.financial_services", "dom.healthcare", "dom.public_sector", "dom.telecoms", "dom.retail"],
    purposes: ["pur.improve_accuracy", "pur.inform_decision", "pur.satisfy_regulator", "pur.prevent_recurrence"],
  },
  "obj.vendor_performance": {
    actions: ["act.monitor", "act.benchmark", "act.negotiate", "act.audit", "act.mediate"],
    domains: ["dom.logistics", "dom.manufacturing", "dom.public_sector", "dom.retail", "dom.telecoms"],
    purposes: ["pur.reduce_cost", "pur.improve_experience", "pur.reduce_risk", "pur.enable_growth"],
  },
};

/**
 * Concepts of `role` that are plausible for `objectId`, restricted to the allowed vocabulary
 * families. Falls back to the unrestricted set when the affinity list and the family filter
 * have no intersection, so a held-out-only corpus can still be built.
 */
function plausible(objectId: string, role: "action" | "domain" | "purpose", families: Concept["family"][]): Concept[] {
  const affinity = OBJECT_AFFINITY[objectId];
  const available = conceptsFor(role, families);
  if (!affinity) return available;
  const key = role === "action" ? affinity.actions : role === "domain" ? affinity.domains : affinity.purposes;
  const allowed = available.filter((concept) => key.includes(concept.id));
  return allowed.length ? allowed : available;
}

/** Every object must have a plausible action, domain and purpose in every vocabulary family. */
export function verifyPlausibilityCoverage(): string[] {
  const problems: string[] = [];
  for (const families of [["core"], ["held-out"], ["core", "held-out"]] as Concept["family"][][]) {
    for (const object of conceptsFor("object", families)) {
      for (const role of ["action", "domain", "purpose"] as const) {
        if (!plausible(object.id, role, families).length) {
          problems.push(`${object.id} has no plausible ${role} in families [${families.join(",")}]`);
        }
      }
    }
  }
  return problems;
}

/**
 * Deterministic frame sampler. Families control what VALIDATION is allowed to see.
 *
 * The OBJECT is drawn first and then constrains action, domain and purpose, so sampled work is
 * plausible rather than a uniform random tuple. Method, instrument and output stay
 * unconstrained — they vary freely across real work of the same kind.
 */
export function sampleFrame(rng: Rng, families: Concept["family"][], index: number): WorkFrame {
  const object = pick(rng, conceptsFor("object", families)).id;
  const frame: Omit<WorkFrame, "frameId"> = {
    action: pick(rng, plausible(object, "action", families)).id,
    object,
    purpose: pick(rng, plausible(object, "purpose", families)).id,
    method: pick(rng, conceptsFor("method", families)).id,
    instrument: pick(rng, conceptsFor("instrument", families)).id,
    output: pick(rng, conceptsFor("output", families)).id,
    domain: pick(rng, plausible(object, "domain", families)).id,
  };
  return { ...frame, frameId: `frame-${index}-${frameIdentity(frame as WorkFrame)}` };
}

/**
 * A frame that differs from `frame` in exactly ONE identity role.
 *
 * This is the HARD_NEAR_MISS generator: work sharing four of five identity roles is genuinely
 * similar and genuinely not the same job. The atom model could not express this — two O*NET
 * tasks were either identical or unrelated — which is why the previous experience benchmark
 * had so little headroom between "obvious match" and "irrelevant".
 */
export function perturbFrame(frame: WorkFrame, rng: Rng, families: Concept["family"][], index: number): WorkFrame {
  // Candidate roles are shuffled so a role with no plausible alternative does not abort the
  // perturbation; the near-miss stays plausible for the same reason the sampler does.
  const roles = [...IDENTITY_ROLES].sort(() => rng() - 0.5);
  for (const role of roles) {
    const pool =
      role === "object"
        ? conceptsFor("object", families)
        : role === "method"
          ? conceptsFor("method", families)
          : plausible(frame.object, role, families);
    const alternatives = pool.filter((concept) => concept.id !== frame[role]);
    if (!alternatives.length) continue;
    const perturbed = { ...frame, [role]: pick(rng, alternatives).id } as WorkFrame;
    // Changing the object can invalidate the existing action/purpose/domain. Re-draw them
    // from the new object's affinity so a near-miss reads as real work, not as a mash-up.
    if (role === "object") {
      perturbed.action = plausible(perturbed.object, "action", families).some((concept) => concept.id === perturbed.action)
        ? perturbed.action
        : pick(rng, plausible(perturbed.object, "action", families)).id;
      perturbed.purpose = plausible(perturbed.object, "purpose", families).some((concept) => concept.id === perturbed.purpose)
        ? perturbed.purpose
        : pick(rng, plausible(perturbed.object, "purpose", families)).id;
      perturbed.domain = plausible(perturbed.object, "domain", families).some((concept) => concept.id === perturbed.domain)
        ? perturbed.domain
        : pick(rng, plausible(perturbed.object, "domain", families)).id;
    }
    return { ...perturbed, frameId: `frame-${index}-${frameIdentity(perturbed)}` };
  }
  throw new Error(`No perturbable identity role for frame in families ${families.join(",")}`);
}

/**
 * A frame whose surface will look like `frame` but whose identity differs, by swapping one
 * role for its declared trap partner. Returns null when no identity role of this frame has a
 * trap partner available.
 */
export function trapVariant(frame: WorkFrame, rng: Rng, index: number): WorkFrame | null {
  const swappable = IDENTITY_ROLES.filter((role) => CONCEPTS_BY_ID.get(frame[role])?.trapPartner);
  if (!swappable.length) return null;
  const role = pick(rng, [...swappable]);
  const partner = CONCEPTS_BY_ID.get(frame[role])!.trapPartner!;
  const swapped = { ...frame, [role]: partner } as WorkFrame;
  return { ...swapped, frameId: `frame-${index}-${frameIdentity(swapped)}` };
}
