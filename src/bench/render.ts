// Independent surface renderers for planted work atoms.
//
// WHY TWO RENDERERS
// -----------------
// If the person's evidence text and the job's responsibility text were both the verbatim
// O*NET statement, every benchmark here would degenerate into string equality and would
// measure nothing about work understanding. Person-side and job-side renderers therefore
// paraphrase the SAME atom along DIFFERENT axes: different framing, different synonym
// choices, different clause order, different surrounding noise.
//
// `tests/bench-planted-truth.test.ts` asserts the two renderings of one atom are never
// identical and share well under 100% of their content tokens, so the paraphrase gap is a
// measured property of the corpus rather than an assumption.
//
// PARAPHRASE FAMILIES exist so the loop can be tested for template overfitting: a family can
// be withheld from DEVELOPMENT and held for VALIDATION (see src/bench/corpus.ts).
import { pick, type Rng } from "@/lab/rng";
import type { WorkAtom } from "@/bench/workAtoms";

export const RENDER_VERSION = "bench-render.v1";

/** Withholdable paraphrase families. Used to detect template overfitting. */
export const PARAPHRASE_FAMILIES = ["plain", "clausal", "nominalized", "colloquial"] as const;
export type ParaphraseFamily = (typeof PARAPHRASE_FAMILIES)[number];

/**
 * Deterministic synonym substitutions over common O*NET work vocabulary. Each entry maps a
 * source form to alternatives that preserve the work meaning. Applied whole-word only.
 */
export const SYNONYMS: Record<string, string[]> = {
  analyze: ["examine", "work through", "break down"],
  analyzing: ["examining", "breaking down"],
  evaluate: ["assess", "weigh up", "judge"],
  evaluating: ["assessing", "weighing up"],
  inspect: ["check over", "look through", "survey"],
  investigate: ["look into", "dig into", "run down"],
  monitor: ["keep watch on", "track", "keep tabs on"],
  develop: ["put together", "work up", "build out"],
  prepare: ["put together", "draw up", "write up"],
  coordinate: ["line up", "keep in sync", "pull together"],
  direct: ["steer", "run", "oversee"],
  maintain: ["keep up", "look after", "keep current"],
  review: ["go over", "read through", "walk through"],
  recommend: ["put forward", "advise on", "suggest"],
  determine: ["work out", "pin down", "establish"],
  identify: ["pin down", "spot", "single out"],
  ensure: ["make certain", "see to it", "make sure"],
  provide: ["supply", "deliver", "give"],
  conduct: ["run", "carry out", "perform"],
  perform: ["carry out", "do", "run"],
  resolve: ["sort out", "settle", "clear up"],
  implement: ["roll out", "put in place", "stand up"],
  plan: ["map out", "lay out", "sketch out"],
  report: ["write up", "document", "communicate"],
  test: ["trial", "try out", "put through checks"],
  design: ["lay out", "draw up", "shape"],
  operate: ["run", "work", "handle"],
  supervise: ["oversee", "look after", "run"],
  train: ["coach", "bring up to speed", "teach"],
  consult: ["talk through things", "confer", "check in"],
  problems: ["issues", "trouble", "faults"],
  procedures: ["methods", "processes", "routines"],
  records: ["files", "documentation", "logs"],
  reports: ["write-ups", "documents", "summaries"],
  equipment: ["hardware", "kit", "machinery"],
  data: ["figures", "information", "readings"],
  information: ["details", "data", "material"],
  customers: ["clients", "the people we serve", "end users"],
  patients: ["the people in our care", "clients", "those we treat"],
  students: ["learners", "the people in the class", "trainees"],
  staff: ["the team", "people", "colleagues"],
  systems: ["setups", "platforms", "environments"],
  requirements: ["needs", "specs", "asks"],
  standards: ["rules", "benchmarks", "expectations"],
  quality: ["standard of the output", "workmanship", "soundness"],
  performance: ["how things are running", "output", "results"],
  activities: ["work", "efforts", "tasks"],
  policies: ["rules", "guidelines", "ground rules"],
  budgets: ["spend plans", "financial plans", "cost plans"],
  materials: ["supplies", "stock", "inputs"],
};

/** Person-side framings, indexed by paraphrase family. */
const PERSON_FRAMES: Record<ParaphraseFamily, string[]> = {
  plain: ["In my last role I would {phrase}.", "Day to day I would {phrase}.", "Most weeks I would {phrase}."],
  clausal: ["When things escalated, it fell to me to {phrase}.", "Whenever the work backed up I was the one to {phrase}.", "If something looked off, I would {phrase}."],
  nominalized: ["Ownership of {gerund} sat with me.", "My remit covered {gerund}.", "{Gerund} was mine to run."],
  colloquial: ["A big chunk of my week was {gerund}.", "Honestly, most of the job was {gerund}.", "I spent a lot of time {gerund}."],
};

/** Job-side framings, deliberately different in voice from the person-side frames. */
const JOB_FRAMES: Record<ParaphraseFamily, string[]> = {
  plain: ["{Phrase}.", "You will {phrase}.", "The role will {phrase}."],
  clausal: ["Working with the wider team, {phrase}.", "As part of this remit, {phrase}.", "Alongside the existing group, {phrase}."],
  nominalized: ["Accountability for {gerund}.", "Responsibility for {gerund}.", "Day-to-day ownership of {gerund}."],
  colloquial: ["A large share of this role is {gerund}.", "Expect to spend real time {gerund}.", "Much of the week goes on {gerund}."],
};

/** Domain noise appended to job responsibilities so job text is not a bare task statement. */
const JOB_NOISE = [
  "Partnering closely with adjacent groups.",
  "Reporting into the functional lead.",
  "Contributing to the team's operating rhythm.",
  "Working within the existing governance model.",
  "",
];

/**
 * Difficulty of the person-side rendering.
 *
 *  verbatim  the raw O*NET statement. LEAKAGE CONTROL ONLY -- establishes the trivial upper
 *            bound, and if a harder tier ever beats it something is wrong.
 *  standard  full paraphrase: synonym substitution, clause reordering, reframing.
 *  hard      compressed paraphrase: qualifying clauses dropped and a deterministic share of
 *            remaining content words removed, the way a real resume bullet compresses a duty.
 *            This is the tier with headroom; `standard` saturates.
 */
export const RENDER_DIFFICULTIES = ["verbatim", "standard", "hard"] as const;
export type RenderDifficulty = (typeof RENDER_DIFFICULTIES)[number];

/** Share of remaining content words dropped at `hard` difficulty. Declared, not tuned. */
export const HARD_DROP_RATE = 0.35;

export interface RenderedAtomText {
  atomId: string;
  text: string;
  family: ParaphraseFamily;
  difficulty: RenderDifficulty;
}

/**
 * Render an atom as first-person person-side evidence. The atom's O*NET statement is
 * paraphrased and reframed; the verbatim statement is never emitted unless `verbatim` is set
 * explicitly, which only the leakage control uses.
 */
export function renderPersonEvidence(atom: WorkAtom, rng: Rng, family: ParaphraseFamily, difficulty: RenderDifficulty = "standard"): RenderedAtomText {
  if (difficulty === "verbatim") return { atomId: atom.atomId, text: atom.statement, family, difficulty };
  const phrase = paraphrase(atom.statement, rng, 0, difficulty);
  const frame = pick(rng, PERSON_FRAMES[family]);
  return { atomId: atom.atomId, text: applyFrame(frame, phrase), family, difficulty };
}

/**
 * Render an atom as a job responsibility. Uses a different synonym offset and a different
 * frame pool from the person renderer, so the same atom yields materially different surface
 * text on the two sides.
 */
export function renderJobResponsibility(atom: WorkAtom, rng: Rng, family: ParaphraseFamily, difficulty: RenderDifficulty = "standard"): RenderedAtomText {
  if (difficulty === "verbatim") return { atomId: atom.atomId, text: atom.statement, family, difficulty };
  // Job postings are not compressed the way resume bullets are, so the job side always uses
  // the full paraphrase. Difficulty is carried by the PERSON side, which is where real-world
  // information loss happens.
  const phrase = paraphrase(atom.statement, rng, 1, "standard");
  const frame = pick(rng, JOB_FRAMES[family]);
  const noise = pick(rng, JOB_NOISE);
  return { atomId: atom.atomId, text: `${applyFrame(frame, phrase)}${noise ? ` ${noise}` : ""}`, family, difficulty };
}

/** Render a person's stated preference for an atom, with an explicit LIKE/DISLIKE stance. */
export function renderPreferenceStatement(atom: WorkAtom, rng: Rng, stance: "LIKE" | "DISLIKE", family: ParaphraseFamily, difficulty: RenderDifficulty = "standard"): RenderedAtomText {
  const phrase = paraphrase(atom.statement, rng, 2, difficulty);
  const gerund = toGerund(phrase);
  const frames = stance === "LIKE"
    ? ["I genuinely enjoy {gerund}.", "The part I like most is {gerund}.", "I would happily spend more time {gerund}."]
    : ["I really do not enjoy {gerund}.", "The part that drains me is {gerund}.", "I would rather not spend my week {gerund}."];
  return { atomId: atom.atomId, text: applyFrame(pick(rng, frames), phrase, gerund), family, difficulty };
}

/** Render a person's stated aspiration for an atom. Never phrased as past experience. */
export function renderAspirationStatement(atom: WorkAtom, rng: Rng, family: ParaphraseFamily, difficulty: RenderDifficulty = "standard"): RenderedAtomText {
  const phrase = paraphrase(atom.statement, rng, 3, difficulty);
  const gerund = toGerund(phrase);
  const frames = [
    "Going forward I want to move into {gerund}, which I have not done professionally.",
    "The work I am aiming for next is {gerund}.",
    "I would like my next role to be centred on {gerund}.",
  ];
  return { atomId: atom.atomId, text: applyFrame(pick(rng, frames), phrase, gerund), family, difficulty };
}

// ---------------------------------------------------------------------------

/**
 * Paraphrase a task statement: lowercase the lead, substitute synonyms deterministically,
 * and reorder trailing clauses. `offset` shifts which synonym alternative is chosen, so the
 * person-side and job-side renderings of one atom diverge.
 */
export function paraphrase(statement: string, rng: Rng, offset: number, difficulty: RenderDifficulty = "standard"): string {
  const stripped = statement.replace(/\.$/, "").trim();
  const clauses = stripped.split(/,\s+(?=(?:such as|including|to |or |and )?)/).map((clause) => clause.trim()).filter(Boolean);
  const head = clauses[0] ?? stripped;
  const tail = clauses.slice(1);
  if (difficulty === "hard") {
    // Compress the way a resume bullet does: drop the qualifying clauses entirely, then drop a
    // deterministic share of the remaining content words. Rare, distinctive words are as
    // eligible for dropping as common ones, so this genuinely removes recoverable signal
    // rather than only trimming filler.
    return dropContentWords(substituteSynonyms(lowerFirst(head), offset), rng);
  }
  const reordered = tail.length > 1 && rng() < 0.5 ? [tail[tail.length - 1]!, ...tail.slice(0, -1)] : tail;
  const rebuilt = [head, ...reordered].join(", ");
  return substituteSynonyms(lowerFirst(rebuilt), offset);
}

const KEEP_ALWAYS = new Set("a an and are as at be by for from in into is it of on or that the their this to use using with or".split(" "));

function dropContentWords(text: string, rng: Rng): string {
  const words = text.split(/\s+/);
  const kept = words.filter((word, index) => {
    if (index === 0) return true;
    if (KEEP_ALWAYS.has(word.toLowerCase())) return true;
    return rng() >= HARD_DROP_RATE;
  });
  return (kept.length >= 3 ? kept : words.slice(0, Math.max(3, Math.ceil(words.length / 2)))).join(" ");
}

function substituteSynonyms(text: string, offset: number): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const options = SYNONYMS[word.toLowerCase()];
    if (!options) return word;
    return options[(word.length + offset) % options.length]!;
  });
}

function applyFrame(frame: string, phrase: string, gerundOverride?: string): string {
  const gerund = gerundOverride ?? toGerund(phrase);
  return frame
    .replace("{phrase}", phrase)
    .replace("{Phrase}", upperFirst(phrase))
    .replace("{gerund}", gerund)
    .replace("{Gerund}", upperFirst(gerund));
}

/** Convert a leading verb to its -ing form so nominalized frames read naturally. */
export function toGerund(phrase: string): string {
  const [first, ...rest] = phrase.split(/\s+/);
  if (!first) return phrase;
  const lower = first.toLowerCase();
  let gerund = lower;
  if (/[^aeiou]e$/.test(lower)) gerund = `${lower.slice(0, -1)}ing`;
  else if (/[aeiou][bdgklmnprt]$/.test(lower) && lower.length <= 5) gerund = `${lower}${lower.slice(-1)}ing`;
  else if (!lower.endsWith("ing")) gerund = `${lower}ing`;
  return [gerund, ...rest].join(" ");
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Content tokens used by the paraphrase-gap assertion and by the lexical baselines. */
export function contentTokens(text: string): Set<string> {
  const stop = new Set("a an and are as at be by for from in into is it of on or that the their this to use using with will you i my me we our".split(" "));
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2 && !stop.has(token)));
}

/** Jaccard overlap of content tokens. Used to quantify the person/job paraphrase gap. */
export function tokenOverlap(a: string, b: string): number {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}
