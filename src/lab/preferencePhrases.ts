// Generator phrase catalogs and the statement planner that turns hidden truth into
// semantically coherent natural language.
//
// A catalog maps each dimension to [high-side phrases, low-side phrases] -- phrases that
// describe the BEHAVIOUR at each pole, saying nothing about whether the person likes it.
// Stance is applied separately by src/lab/preferenceSemantics.ts, which is what makes the
// four valid (side x stance) combinations expressible and the two backwards ones
// detectable.
import { DIMENSION_IDS } from "@/config/model";
import type { DimensionId, Vector } from "@/domain/types";
import type { Rng } from "@/lab/rng";
import { pick } from "@/lab/rng";
import {
  behaviorSideFor,
  expressibleDimensions,
  intendedDirection,
  PREFERENCE_SEMANTICS_VERSION,
  renderStatement,
  seededShuffle,
  type ExpressibleDimension,
  type PreferenceConstruction,
  type PreferenceDirection,
  type PreferenceEvidenceSource,
  type PreferenceStance,
  type PreferenceStatement,
} from "@/lab/preferenceSemantics";

export type PreferencePhraseCatalog = Record<DimensionId, [string[], string[]]>;

/**
 * Natural preference language for every TaskDNA dimension, independent of any occupation.
 * [high-side phrases, low-side phrases]
 */
export const ONET_PREFERENCE_PHRASES: PreferencePhraseCatalog = {
  problem_structure: [["well-scoped problems I can finish", "bounded diagnostic questions"], ["open-ended ambiguity", "problems nobody has framed yet"]],
  measurable_feedback: [["work where I can see the numbers move", "fast observable feedback"], ["long-horizon work without clear metrics", "slow uncertain feedback loops"]],
  investigation_orientation: [["digging into why something failed", "root-cause investigation"], ["keeping many workstreams coordinated", "status coordination and administration"]],
  evidence_density: [["logs and measurements", "working directly from raw data"], ["summaries and administrative packets", "narrative reports over raw data"]],
  experimentation_preference: [["running targeted experiments", "testing ideas before trusting them"], ["executing an established playbook", "following the proven procedure"]],
  scope_preference: [["owning one bounded subsystem deeply", "a well-fenced area of responsibility"], ["sprawling many-team problems", "very broad ambiguous scope"]],
  software_as_tool: [["building small tools to remove drudgery", "scripting away repetitive work"], ["hands-on work away from screens", "work that does not revolve around software"]],
  reasoning_style: [["forming and testing hypotheses", "reasoning from first causes"], ["applying documented rules precisely", "compliance-first checking"]],
  creation_style: [["making something concrete within constraints", "constrained creative work"], ["blank-page invention", "wide-open greenfield creation"]],
  real_system_grounding: [["physical systems I can observe", "real equipment and real users"], ["purely abstract processes", "work that never touches a real system"]],
  closure_preference: [["closing the loop and verifying the fix", "finishing things properly"], ["perpetual exploration without a finish line", "open threads that never close"]],
  causal_reasoning: [["understanding why something happened", "tracing mechanisms to the root"], ["recording what happened", "cataloging events without digging"]],
  integration_preference: [["connecting systems and evidence streams", "cross-system integration work"], ["working one isolated piece at a time", "staying inside a single silo"]],
  customer_interaction_preference: [["customer-facing troubleshooting", "talking with users about their real problems"], ["internal-only analysis", "heads-down work without customer contact"]],
  coordination_preference: [["stakeholder orchestration", "aligning many owners on a decision"], ["solo deep work", "long uninterrupted focus without meetings"]],
  theory_vs_application: [["applied hands-on testing", "practical work over theory"], ["abstract modeling and theory", "conceptual work over immediate application"]],
  repetition_tolerance: [["repeatable protocols done well", "routine workflows I can perfect"], ["novel problems every week", "work that never repeats"]],
};

/** Smaller catalog used by the legacy v1 (pre-O*NET) lab. Its phrases agree in side with the v2 catalog. */
export const LEGACY_PREFERENCE_PHRASES: PreferencePhraseCatalog = withNeutralDefaults({
  investigation_orientation: [["root-cause investigation"], ["status coordination"]],
  evidence_density: [["logs and measurements"], ["administrative packets"]],
  coordination_preference: [["stakeholder orchestration"], ["solo deep work"]],
  customer_interaction_preference: [["customer-facing troubleshooting"], ["internal-only analysis"]],
  repetition_tolerance: [["repeatable protocols"], ["novel problem solving"]],
  software_as_tool: [["building tools"], ["hands-on field work"]],
  problem_structure: [["bounded diagnostic problems"], ["open-ended ambiguity"]],
  theory_vs_application: [["applied experiments"], ["abstract modeling"]],
});

/**
 * Every phrase any generator can emit, per dimension and side. The evaluation-only
 * availability reader (src/lab/evidenceAvailability.ts) matches against this union so it
 * can grade subjects from either lab generation without needing to know which produced them.
 */
export const ALL_GENERATOR_PHRASES: PreferencePhraseCatalog = Object.fromEntries(
  DIMENSION_IDS.map((id) => [id, [
    unique([...ONET_PREFERENCE_PHRASES[id][0], ...LEGACY_PREFERENCE_PHRASES[id][0]]),
    unique([...ONET_PREFERENCE_PHRASES[id][1], ...LEGACY_PREFERENCE_PHRASES[id][1]]),
  ]]),
) as PreferencePhraseCatalog;

/** Non-dimensional filler used when no dimension is expressible. Never counted as evidence. */
export const GENERIC_FALLBACK_PHRASES = { LIKE: "work that suits me", DISLIKE: "work that drains me" } as const;

/** Which observable sources may receive a preference statement for this subject. */
export interface PreferenceSourceBudget {
  resumeNarrative: boolean;
  explicitPreferenceList: boolean;
  explicitDislikeList: boolean;
  contradictoryStatement: boolean;
}

export interface PreferenceStatementPlanOptions {
  catalog?: PreferencePhraseCatalog;
  /** Selection budget per stance channel. Matches the pre-fix generator's slice(0, 3). */
  maxPerStance?: number;
  sources: PreferenceSourceBudget;
  /** Emit the weaker aspirational LIKE construction when a narrative LIKE slot is reached. */
  includeAspiration?: boolean;
  burnedOut?: boolean;
  workContext?: string;
  /**
   * Deliberately produce backwards polarity (LOW truth expressed as DISLIKE of the LOW-side
   * behaviour). This exists ONLY so the semantic-consistency audit and its regression test
   * have a known-bad corpus to fail on. It must never be enabled for a graded corpus.
   */
  adversarialPolarityInversion?: boolean;
}

export interface PreferenceStatementPlan {
  version: string;
  /** Every dimension whose hidden truth was expressible, BEFORE truncation. */
  opportunities: ExpressibleDimension[];
  /** Dimensions actually selected, in selection order. */
  selected: ExpressibleDimension[];
  statements: PreferenceStatement[];
}

interface Slot {
  source: PreferenceEvidenceSource;
  construction: PreferenceConstruction;
}

/**
 * Turn a hidden truth vector into a set of semantically coherent preference statements,
 * each assigned to exactly one observable source.
 *
 * Selection is a seeded Fisher-Yates shuffle of ALL expressible dimensions followed by
 * truncation, so no dimension gains exposure from its position in DIMENSION_IDS. Stance is
 * drawn per dimension, and the behaviour side is then derived from
 * `behaviorSideFor(truthDirection, stance)` -- which is what guarantees the generated
 * sentence means what the hidden truth says.
 */
export function planPreferenceStatements(truth: Vector, rng: Rng, options: PreferenceStatementPlanOptions): PreferenceStatementPlan {
  const catalog = options.catalog ?? ONET_PREFERENCE_PHRASES;
  const maxPerStance = options.maxPerStance ?? 3;
  const expressible = expressibleDimensions(truth, DIMENSION_IDS).filter((entry) => hasPhrases(catalog, entry.dimensionId));
  const shuffled = seededShuffle(rng, expressible);

  const likeSlots = buildSlots(options.sources, "LIKE", options);
  const dislikeSlots = buildSlots(options.sources, "DISLIKE", options);

  const statements: PreferenceStatement[] = [];
  const selected: ExpressibleDimension[] = [];
  const used = { LIKE: 0, DISLIKE: 0 };
  for (const entry of shuffled) {
    const stance: PreferenceStance = rng() < 0.5 ? "LIKE" : "DISLIKE";
    const slots = stance === "LIKE" ? likeSlots : dislikeSlots;
    if (used[stance] >= Math.min(maxPerStance, slots.length)) continue;
    const slot = slots[used[stance]]!;
    used[stance] += 1;
    selected.push(entry);
    statements.push(buildStatement(entry, stance, slot, catalog, rng, options));
  }
  return { version: `${PREFERENCE_SEMANTICS_VERSION}+${options.adversarialPolarityInversion ? "adversarial" : "coherent"}`, opportunities: expressible, selected, statements };
}

function buildStatement(
  entry: ExpressibleDimension,
  stance: PreferenceStance,
  slot: Slot,
  catalog: PreferencePhraseCatalog,
  rng: Rng,
  options: PreferenceStatementPlanOptions,
): PreferenceStatement {
  const coherentSide = behaviorSideFor(entry.direction, stance);
  // The adversarial case deliberately picks the OTHER side, producing e.g.
  // "LOW truth -> DISLIKE low-side behaviour", which means HIGH and is therefore backwards.
  const behaviorSide = options.adversarialPolarityInversion ? flip(coherentSide) : coherentSide;
  const phrase = pick(rng, catalog[entry.dimensionId][behaviorSide === "HIGH" ? 0 : 1]);
  return {
    dimensionId: entry.dimensionId,
    behaviorSide,
    stance,
    intendedDirection: intendedDirection(behaviorSide, stance),
    truthDirection: entry.direction,
    phrase,
    construction: slot.construction,
    text: renderStatement(slot.construction, phrase, { workContext: options.workContext }),
    source: slot.source,
    adversarialPolarityInversion: Boolean(options.adversarialPolarityInversion),
  };
}

/**
 * Ordered slots for one stance channel. Slot order decides which observable source each
 * successive selected dimension lands in; because a dimension fills exactly one slot, one
 * underlying statement can never appear in two sources.
 */
function buildSlots(budget: PreferenceSourceBudget, stance: PreferenceStance, options: PreferenceStatementPlanOptions): Slot[] {
  const listSource: PreferenceEvidenceSource = stance === "LIKE" ? "EXPLICIT_PREFERENCE_LIST" : "EXPLICIT_DISLIKE_LIST";
  const listAllowed = stance === "LIKE" ? budget.explicitPreferenceList : budget.explicitDislikeList;
  const narrativeFirst: PreferenceConstruction = stance === "LIKE" ? "ENJOY" : "AVOID";
  const narrativeSecond: PreferenceConstruction = stance === "LIKE" ? "ASPIRATION" : options.burnedOut ? "BURNOUT" : "STRUGGLE";
  const secondAllowed = stance === "LIKE" ? Boolean(options.includeAspiration) : true;
  return [
    ...(budget.resumeNarrative ? [{ source: "RESUME_NARRATIVE" as const, construction: narrativeFirst }] : []),
    ...(listAllowed ? [{ source: listSource, construction: "BARE_LIST_ENTRY" as const }] : []),
    ...(budget.resumeNarrative && secondAllowed ? [{ source: "RESUME_NARRATIVE" as const, construction: narrativeSecond }] : []),
    ...(stance === "DISLIKE" && budget.contradictoryStatement
      ? [{ source: "CONTRADICTORY_STATEMENT" as const, construction: "CLAIMED_DISLIKE_WITH_EXPOSURE" as const }]
      : []),
    ...(listAllowed ? [{ source: listSource, construction: "BARE_LIST_ENTRY" as const }] : []),
  ];
}

export function statementsForSource(plan: PreferenceStatementPlan, source: PreferenceEvidenceSource): PreferenceStatement[] {
  return plan.statements.filter((statement) => statement.source === source);
}

export function statementsForConstruction(plan: PreferenceStatementPlan, construction: PreferenceConstruction): PreferenceStatement[] {
  return plan.statements.filter((statement) => statement.construction === construction);
}

/** Fallback phrase for a construction that must render even when nothing was expressible. */
export function genericPhrase(stance: PreferenceStance): string {
  return GENERIC_FALLBACK_PHRASES[stance];
}

function hasPhrases(catalog: PreferencePhraseCatalog, id: DimensionId) {
  return catalog[id][0].length > 0 && catalog[id][1].length > 0;
}

function flip(side: PreferenceDirection): PreferenceDirection {
  return side === "HIGH" ? "LOW" : "HIGH";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function withNeutralDefaults(partial: Partial<PreferencePhraseCatalog>): PreferencePhraseCatalog {
  return Object.fromEntries(DIMENSION_IDS.map((id) => [id, partial[id] ?? [[], []]])) as PreferencePhraseCatalog;
}
