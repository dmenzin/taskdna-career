// Generic work-structure interpreter: maps work language (job descriptions, task
// statements, career evidence) onto the 17 TaskDNA dimensions.
//
// The lexicon is derived from the dimension DEFINITIONS (src/config/model.ts) and
// general O*NET-style work-activity vocabulary. It is versioned, configurable domain
// knowledge — not calibrated weights and not fixture-specific keywords. It describes
// what kind of work a text depicts; whether a person LIKES that work is decided by
// evidence-class handling, never here.
import { DIMENSION_IDS, vector } from "@/config/model";
import type { DimensionId, Vector } from "@/domain/types";

export const WORK_STRUCTURE_VERSION = "work-structure.v1";

interface LexiconEntry {
  id: string;
  pattern: RegExp;
  signals: Partial<Vector>;
}

// Values express the dimension SIDE the language depicts (high side > 5, low side < 5).
export const workStructureLexicon: LexiconEntry[] = [
  // Investigation vs administration
  { id: "investigate", pattern: /investigat|diagnos|troubleshoot|root.?cause|debug|inspect\w* (?:for|to determine)|determine (?:the )?cause|forensic|incident/i, signals: { investigation_orientation: 8.8, causal_reasoning: 8.6, evidence_density: 7.2 } },
  { id: "why-mechanism", pattern: /why (?:it|this|something) (?:happened|failed)|failure mechanism|underlying cause|isolate (?:the )?(?:mechanism|issue|fault)/i, signals: { causal_reasoning: 9, reasoning_style: 8.2 } },
  { id: "analyze-data", pattern: /analy[sz]\w+ (?:\w+ ){0,3}?(?:data|information|results|trends|records|evidence|performance|metrics)|statistical|quantitative analysis/i, signals: { evidence_density: 7.8, measurable_feedback: 7.2 } },
  { id: "logs-signals", pattern: /\blogs?\b|telemetry|sensor data|measurements|instrument\w* read|signals?\b/i, signals: { evidence_density: 8.4, measurable_feedback: 7.8 } },
  { id: "monitor-measure", pattern: /monitor|measur\w+|track(?:ing)? (?:\w+ ){0,2}?(?:performance|progress|metrics|quality|output)|kpis?|dashboards?/i, signals: { measurable_feedback: 8, evidence_density: 6.8 } },
  { id: "test-experiment", pattern: /experiment|a\/b test|design(?:ing)? tests?|run(?:ning)? tests?|test(?:ed|ing)? hypothes|pilot(?:ing)? (?:a|new)|trial/i, signals: { experimentation_preference: 8.4, measurable_feedback: 7.4 } },
  { id: "research-study", pattern: /research|literature|study design|peer.?review|publish/i, signals: { experimentation_preference: 6.8, theory_vs_application: 4.2, measurable_feedback: 4.6 } },
  // Coordination vs deep work
  { id: "coordinate", pattern: /coordinat|orchestrat|liaison|align(?:ing)? (?:\w+ ){0,2}?(?:stakeholders|teams|owners|departments)|facilitat|schedul\w+ (?:\w+ ){0,3}?(?:work|meetings|staff|activities)|delegat/i, signals: { coordination_preference: 8.6, investigation_orientation: 3.8 } },
  { id: "supervise-direct", pattern: /supervis|direct(?:ing)? (?:the )?(?:work|staff|activities|operations)|oversee|manage (?:\w+ ){0,2}?(?:staff|team|people|personnel|contractors)/i, signals: { coordination_preference: 8.2, scope_preference: 4.2 } },
  { id: "stakeholder-meetings", pattern: /stakeholder|steering committee|status (?:meetings|reviews|reports)|cross.?functional (?:alignment|meetings)/i, signals: { coordination_preference: 8.4, problem_structure: 3.8 } },
  { id: "solo-deep-work", pattern: /solo deep work|uninterrupted focus|independent(?:ly)? (?:analysis|work(?:ing)?)|heads.?down|deep concentration/i, signals: { coordination_preference: 2, scope_preference: 7 } },
  // Documentation / routine vs novelty
  { id: "document-records", pattern: /document\w*|record.?keeping|maintain (?:\w+ ){0,2}?(?:records|files|documentation|logs)|traceability|file (?:\w+ ){0,2}?(?:reports|paperwork)|data entry/i, signals: { repetition_tolerance: 7.6, problem_structure: 7, investigation_orientation: 4.2, evidence_density: 4.4 } },
  { id: "compliance-audit", pattern: /complian\w+|regulator|audit(?:s|ing|or)?\b|policy adherence|qms|iso \d|legal requirements|permits?\b/i, signals: { repetition_tolerance: 7.2, reasoning_style: 3.6, problem_structure: 7.4 } },
  { id: "routine-protocol", pattern: /routine|standard(?:ized)? procedures?|established (?:methods|protocols)|repeatable|checklists?|protocols?\b/i, signals: { repetition_tolerance: 8.2, experimentation_preference: 3.8 } },
  { id: "novel-varied", pattern: /novel problems?|never repeats|constantly changing|new challenges? (?:each|every)|varied work/i, signals: { repetition_tolerance: 2.2 } },
  // Customer / interpersonal
  { id: "customer-facing", pattern: /customers?\b|clients?\b|patients?\b|students?\b|customer.?facing|public\b|end.?users?|guests?\b/i, signals: { customer_interaction_preference: 8 } },
  { id: "advise-teach", pattern: /advis|counsel|teach|train(?:ing)?\b|instruct|coach|mentor|educat|present(?:ing)? to/i, signals: { customer_interaction_preference: 7.6, coordination_preference: 6.4 } },
  { id: "sell-negotiate", pattern: /sell|sales\b|negotiat|persuad|close (?:deals|decisions)|quota|prospect/i, signals: { customer_interaction_preference: 8.6, closure_preference: 7.2, coordination_preference: 7 } },
  { id: "internal-only", pattern: /internal.?only|without customer contact|behind the scenes|back.?office/i, signals: { customer_interaction_preference: 2.4 } },
  // Physical / real systems vs abstraction
  { id: "physical-systems", pattern: /equipment|machin\w+|hardware|repair|install|maintain\w* (?:\w+ ){0,2}?(?:equipment|systems|machinery)|onsite|in the field|physical|hands.?on|fabricat|assembl/i, signals: { real_system_grounding: 8.6, theory_vs_application: 7.8 } },
  { id: "lab-bench", pattern: /laborator|bench test|specimens?|samples?\b|instrument(?:s|ation)\b/i, signals: { real_system_grounding: 7.8, evidence_density: 7.4 } },
  { id: "abstract-model", pattern: /theoretical|abstract model|mathematical model|simulat|conceptual framework|digital twin/i, signals: { theory_vs_application: 3.2, real_system_grounding: 3.4, creation_style: 6.8 } },
  // Software
  { id: "software-tool", pattern: /software|script(?:s|ing)?\b|automat\w+ (?:\w+ ){0,3}?(?:workflow|process|task|report)|programm|databases?\b|\bcode\b|apis?\b|spreadsheet|python|sql|typescript/i, signals: { software_as_tool: 8.2, creation_style: 6.8 } },
  // Creation
  { id: "design-create", pattern: /design\w*|develop(?:ing|ment)? (?:\w+ ){0,2}?(?:new|products?|programs?|curricul|systems?|plans?)|create|build(?:ing)?\b|prototype|draft(?:ing)?\b|compose|author/i, signals: { creation_style: 7.6 } },
  { id: "blank-sheet", pattern: /greenfield|blank.?(?:page|sheet)|from scratch|invent|brand.?new concept/i, signals: { creation_style: 3.2, problem_structure: 3.2 } },
  // Integration
  { id: "integrate-connect", pattern: /integrat|interfac\w+ (?:between|with)|connect(?:ing)? (?:\w+ ){0,2}?(?:systems|data|streams|teams)|cross.?(?:layer|system)|end.?to.?end/i, signals: { integration_preference: 8, scope_preference: 4.6 } },
  { id: "single-silo", pattern: /isolated (?:work|tasks?)|one (?:component|module) at a time|single silo/i, signals: { integration_preference: 2.6 } },
  // Closure / verification
  { id: "verify-close", pattern: /verif\w+|validat\w+|confirm(?:ing)?\b|close(?:d|s)? (?:the )?loop|resolv\w+|complete (?:\w+ ){0,2}?(?:tasks|orders|cases)|finish|corrective action/i, signals: { closure_preference: 8, measurable_feedback: 6.6 } },
  { id: "open-ended", pattern: /open.?ended|no clear (?:answer|finish)|exploratory|ongoing inquiry|perpetual/i, signals: { closure_preference: 3, problem_structure: 2.8 } },
  // Problem structure / scope
  { id: "bounded-defined", pattern: /well.?(?:scoped|defined)|bounded|clear(?:ly)? defined|specific (?:procedures|assignments|tasks)|assigned (?:tasks|cases)/i, signals: { problem_structure: 7.8, scope_preference: 7.2 } },
  { id: "ambiguous-strategy", pattern: /ambiguous|ambiguity|ill.?defined|formulate (?:\w+ ){0,2}?(?:policy|policies|strategy|strategies)|strategic direction|vision\b|determine (?:\w+ ){0,2}?direction|organization.?wide|enterprise.?wide/i, signals: { problem_structure: 2.8, scope_preference: 3.2, coordination_preference: 6.8 } },
  { id: "prioritize-decide", pattern: /prioriti[sz]|trade.?offs?|make (?:\w+ ){0,2}?decisions|decision.?making|allocat\w+ (?:resources|budget)/i, signals: { problem_structure: 4.2, coordination_preference: 6.6 } },
  // Applied vs theoretical
  { id: "applied-practical", pattern: /applied|practical|real.?world|day.?to.?day operations|operational/i, signals: { theory_vs_application: 7.6 } },
  // Official O*NET generalized work activity names (exposure vocabulary).
  { id: "gwa-investigating", pattern: /investigating/i, signals: { investigation_orientation: 9.2, causal_reasoning: 8.6 } },
  { id: "gwa-analyzing-data", pattern: /analyzing data or information/i, signals: { evidence_density: 8.6, measurable_feedback: 7.8 } },
  { id: "gwa-documenting", pattern: /documenting\/recording information|documenting\/recording/i, signals: { repetition_tolerance: 8.2, problem_structure: 7.2 } },
  { id: "gwa-selling", pattern: /selling or influencing others/i, signals: { customer_interaction_preference: 8.8, coordination_preference: 7.2 } },
  { id: "gwa-coordinating-work", pattern: /coordinating the work and activities of others/i, signals: { coordination_preference: 9 } },
  { id: "gwa-making-decisions", pattern: /making decisions and solving problems/i, signals: { problem_structure: 5.8, closure_preference: 7 } },
  { id: "gwa-inspecting", pattern: /inspecting equipment, structures, or materials/i, signals: { real_system_grounding: 8.6, investigation_orientation: 7.8 } },
  { id: "gwa-repairing", pattern: /repairing and maintaining (electronic|mechanical) equipment/i, signals: { real_system_grounding: 8.8, theory_vs_application: 8 } },
  { id: "gwa-compliance-standards", pattern: /evaluating information to determine compliance with standards/i, signals: { repetition_tolerance: 8.4, problem_structure: 7.6, reasoning_style: 3.8 } },
  { id: "gwa-public", pattern: /performing for or working directly with the public/i, signals: { customer_interaction_preference: 8.8, coordination_preference: 7 } },
  { id: "gwa-physical", pattern: /performing general physical activities/i, signals: { real_system_grounding: 8.6, theory_vs_application: 8.2, software_as_tool: 3 } },
  { id: "gwa-machines", pattern: /controlling machines and processes/i, signals: { real_system_grounding: 8.4, measurable_feedback: 7.4 } },
  { id: "gwa-vehicles", pattern: /operating vehicles, mechanized devices, or equipment/i, signals: { real_system_grounding: 8.6, theory_vs_application: 8 } },
  { id: "gwa-drafting", pattern: /drafting, laying out, and specifying technical devices/i, signals: { creation_style: 7.8, real_system_grounding: 7.2, theory_vs_application: 6.8 } },
  { id: "gwa-admin", pattern: /performing administrative activities/i, signals: { repetition_tolerance: 8.2, coordination_preference: 7.2, investigation_orientation: 3.6 } },
  { id: "gwa-caring", pattern: /assisting and caring for others/i, signals: { customer_interaction_preference: 8.6, coordination_preference: 6.8 } },
  { id: "gwa-teaching", pattern: /training and teaching others/i, signals: { customer_interaction_preference: 7.8, coordination_preference: 7.2 } },
  { id: "gwa-directing", pattern: /guiding, directing, and motivating subordinates/i, signals: { coordination_preference: 8.8, scope_preference: 4.2 } },
  { id: "gwa-creative", pattern: /thinking creatively/i, signals: { creation_style: 7.6, problem_structure: 3.8, repetition_tolerance: 3.6 } },
  { id: "gwa-computers", pattern: /interacting with computers/i, signals: { software_as_tool: 8 } },
  { id: "gwa-handling", pattern: /handling and moving objects/i, signals: { real_system_grounding: 8.2, theory_vs_application: 8 } },
  { id: "gwa-negotiate", pattern: /resolving conflicts and negotiating with others/i, signals: { customer_interaction_preference: 8, coordination_preference: 8, closure_preference: 7 } },
  { id: "gwa-outside", pattern: /communicating with people outside the organization/i, signals: { customer_interaction_preference: 8.2, coordination_preference: 7.2 } },
  { id: "gwa-staffing", pattern: /staffing organizational units/i, signals: { coordination_preference: 8.4, scope_preference: 4.4 } },
  { id: "gwa-resources", pattern: /monitoring and controlling resources/i, signals: { coordination_preference: 7.6, measurable_feedback: 6.8 } },
  { id: "gwa-strategy", pattern: /developing objectives and strategies/i, signals: { problem_structure: 3.2, scope_preference: 3.4, coordination_preference: 6.8 } },
  { id: "gwa-consult", pattern: /provide consultation and advice to others/i, signals: { customer_interaction_preference: 7.6, coordination_preference: 6.8 } },
];

export interface WorkStructureReading {
  vector: Vector;
  matchedEntryIds: string[];
  dimensionsCovered: number;
  /** 0..1 share of dimensions with at least one signal. */
  coverage: number;
  version: string;
}

/** Interpret what kind of work a text depicts (exposure structure, not preference). */
/** Amplify non-neutral dimensions so distinct work structures do not regress to the mean. */
export function emphasizeWorkStructure(values: Vector, factor = 1.7): Vector {
  return vector(Object.fromEntries(DIMENSION_IDS.map((id) => {
    const raw = values[id];
    return [id, Math.min(10, Math.max(0, 5 + (raw - 5) * factor))];
  })) as Partial<Vector>);
}

export function readWorkStructure(text: string): WorkStructureReading {
  const lower = text.toLowerCase();
  const sums = new Map<DimensionId, { high: number; low: number; highWeight: number; lowWeight: number }>();
  const matchedEntryIds: string[] = [];
  for (const entry of workStructureLexicon) {
    if (!entry.pattern.test(lower)) continue;
    matchedEntryIds.push(entry.id);
    for (const [dimension, value] of Object.entries(entry.signals) as [DimensionId, number][]) {
      const current = sums.get(dimension) ?? { high: 0, low: 0, highWeight: 0, lowWeight: 0 };
      if (value >= 5) {
        current.high += value;
        current.highWeight += 1;
      } else {
        current.low += value;
        current.lowWeight += 1;
      }
      sums.set(dimension, current);
    }
  }
  const values: Partial<Vector> = {};
  for (const [dimension, bucket] of sums) {
    // Majority side wins so mixed job language does not cancel a dominant work structure.
    values[dimension] = bucket.highWeight >= bucket.lowWeight
      ? bucket.high / Math.max(1, bucket.highWeight)
      : bucket.low / Math.max(1, bucket.lowWeight);
  }
  const dimensionsCovered = sums.size;
  return {
    vector: vector(values),
    matchedEntryIds,
    dimensionsCovered,
    coverage: dimensionsCovered / DIMENSION_IDS.length,
    version: WORK_STRUCTURE_VERSION,
  };
}

/** Per-sentence dimension signals for evidence extraction (same lexicon, partial output). */
export function sentenceWorkSignals(sentence: string): Partial<Vector> {
  const reading = readWorkStructure(sentence);
  const out: Partial<Vector> = {};
  for (const id of DIMENSION_IDS) {
    const entrySignals = workStructureLexicon
      .filter((entry) => reading.matchedEntryIds.includes(entry.id) && entry.signals[id] !== undefined)
      .map((entry) => entry.signals[id]!);
    if (entrySignals.length) out[id] = entrySignals.reduce((sum, value) => sum + value, 0) / entrySignals.length;
  }
  return out;
}
