// Canonical Task/DWA mapping accuracy against planted atom identity.
//
// Every rendered statement in the benchmark corpus carries the atom it was rendered FROM. The
// mapper is asked to recover that atom from paraphrased text. Because the target is planted
// rather than model-generated, this is a genuine accuracy measurement of the mapping subsystem
// -- not the forbidden "run the mapper, call its output gold, evaluate the mapper".
//
// LIMIT, stated plainly: this measures recovery of a KNOWN canonical target from
// SYNTHETICALLY PARAPHRASED text. It is not human-validated mapping accuracy on real career
// language. An independent human-annotated set is still required for that claim
// (docs/METRIC_COVERAGE_MATRIX.md, human gold column).
import { mapWork, MAPPER_CONFIG } from "@/v3/mapper";
import type { TaskMapping } from "@/v3/types";
import { buildBenchCorpus, type BenchSplit, type PlantedJob, type PlantedPerson } from "@/bench/corpus";
import type { RenderDifficulty } from "@/bench/render";
import type { WorkAtom } from "@/bench/workAtoms";

export const MAPPING_BENCH_VERSION = "bench-mapping.v1";

/** Which evidence stream a mapping target came from. Evaluated separately, never pooled. */
export type MappingStream = "person_experience" | "person_preference" | "person_direction" | "job_responsibility";

export interface MappingCase {
  stream: MappingStream;
  sourceId: string;
  text: string;
  atom: WorkAtom;
}

export interface MappingOutcome extends MappingCase {
  level: TaskMapping["level"];
  /** Selected exact Task id, when the mapper committed to a Task. */
  selectedTaskId: string | null;
  /** Selected DWA id, when the mapper fell back to DWA level. */
  selectedDwaId: string | null;
  /** Ranked candidate Task ids, for Recall@K. */
  candidateTaskIds: string[];
  diagnosticConfidence: number;
  /** Top-1 exact Task recovery. */
  exactTop1: boolean;
  /** The planted atom's Task appears among the returned candidates. */
  inCandidates: boolean;
  /** The selected DWA is one of the planted atom's DWAs. */
  dwaCorrect: boolean;
  /**
   * Mapped confidently to a Task from a DIFFERENT occupation with no shared DWA. The
   * damaging error: a confident wrong answer, not an abstention.
   */
  catastrophic: boolean;
}

export interface StreamReport {
  stream: MappingStream;
  n: number;
  topK: number;
  exactTop1Accuracy: number;
  taskRecallAtK: number;
  /** Precision@K over candidates: share of returned candidates that are the planted Task. */
  taskPrecisionAtK: number;
  dwaHierarchicalAccuracy: number;
  /** Correct at either Task or DWA level: the acceptable-alternative notion. */
  acceptableAlternativeRecall: number;
  catastrophicUnrelatedMapRate: number;
  abstentionRate: number;
  /** Of abstentions, how many were on cases nothing could have recovered (no candidate held the atom). */
  abstentionPrecision: number | null;
  /** Of cases nothing could recover, how many did the mapper correctly abstain on. */
  abstentionRecall: number | null;
  /** Accuracy restricted to cases the mapper did NOT abstain on. */
  selectiveAccuracy: number | null;
  /** Coverage (non-abstention rate) paired with selective accuracy at several confidence floors. */
  coverageAccuracyCurve: { minConfidence: number; coverage: number; selectiveAccuracy: number | null }[];
  /** Mean diagnostic confidence on correct versus incorrect cases. Confidence should separate them. */
  meanConfidenceCorrect: number | null;
  meanConfidenceIncorrect: number | null;
}

export interface MappingBenchReport {
  version: string;
  split: BenchSplit;
  difficulty: RenderDifficulty;
  topK: number;
  mapperConfig: typeof MAPPER_CONFIG;
  streams: StreamReport[];
  /** Slices exposing worst-case behaviour that a macro average would hide. */
  slices: { slice: string; n: number; exactTop1Accuracy: number; abstentionRate: number }[];
  note: string;
}

/** Collect every (rendered text, planted atom) pair in a corpus, tagged by stream. */
export function mappingCases(people: PlantedPerson[], jobsByPerson: Map<string, PlantedJob[]>): MappingCase[] {
  const cases: MappingCase[] = [];
  const atomById = new Map<string, WorkAtom>();
  for (const person of people) {
    for (const entry of person.performed) atomById.set(entry.atom.atomId, entry.atom);
    for (const atom of [...person.liked, ...person.disliked, ...person.desired]) atomById.set(atom.atomId, atom);
    for (const job of jobsByPerson.get(person.personId) ?? []) {
      for (const atom of [...job.coreAtoms, ...job.incidentalAtoms]) atomById.set(atom.atomId, atom);
    }
  }
  for (const person of people) {
    for (const entry of person.experienceEvidence) {
      const atom = atomById.get(entry.rendered.atomId);
      if (atom) cases.push({ stream: "person_experience", sourceId: entry.id, text: entry.rendered.text, atom });
    }
    for (const entry of person.preferenceEvidence) {
      const atom = atomById.get(entry.rendered.atomId);
      if (atom) cases.push({ stream: "person_preference", sourceId: entry.id, text: entry.rendered.text, atom });
    }
    for (const entry of person.aspirationEvidence) {
      const atom = atomById.get(entry.rendered.atomId);
      if (atom) cases.push({ stream: "person_direction", sourceId: entry.id, text: entry.rendered.text, atom });
    }
    for (const job of jobsByPerson.get(person.personId) ?? []) {
      for (const entry of job.responsibilities) {
        const atom = atomById.get(entry.rendered.atomId);
        if (atom) cases.push({ stream: "job_responsibility", sourceId: entry.id, text: entry.rendered.text, atom });
      }
    }
  }
  return cases;
}

export function evaluateMappingCase(input: MappingCase): MappingOutcome {
  const mapping = mapWork(input.text);
  const selected = mapping.selected as { taskId?: string | null; id?: string } | null;
  const selectedTaskId = mapping.level === "task" && selected?.taskId ? String(selected.taskId) : null;
  const selectedDwaId = mapping.level === "dwa" && selected?.id ? selected.id : null;
  const candidateTaskIds = mapping.candidates.map((candidate) => String(candidate.task.taskId));
  const plantedDwas = new Set(input.atom.dwaIds);
  const exactTop1 = selectedTaskId === input.atom.taskId;
  const dwaCorrect = Boolean(selectedDwaId && plantedDwas.has(selectedDwaId));
  // Catastrophic: committed to an exact Task that is neither the planted Task nor shares any
  // of its DWAs. An abstention is never catastrophic.
  const chosenTask = mapping.candidates.find((candidate) => String(candidate.task.taskId) === selectedTaskId)?.task;
  const sharesDwa = chosenTask ? chosenTask.dwas.some((dwa) => plantedDwas.has(dwa.id)) : false;
  return {
    ...input,
    level: mapping.level,
    selectedTaskId,
    selectedDwaId,
    candidateTaskIds,
    diagnosticConfidence: mapping.diagnosticConfidence,
    exactTop1,
    inCandidates: candidateTaskIds.includes(input.atom.taskId),
    dwaCorrect,
    catastrophic: mapping.level === "task" && !exactTop1 && !sharesDwa,
  };
}

function reportForStream(stream: MappingStream, outcomes: MappingOutcome[], topK: number): StreamReport {
  const n = outcomes.length;
  const rate = (predicate: (outcome: MappingOutcome) => boolean) => (n ? outcomes.filter(predicate).length / n : 0);
  const abstained = outcomes.filter((outcome) => outcome.level === "abstain");
  const committed = outcomes.filter((outcome) => outcome.level !== "abstain");
  const correct = (outcome: MappingOutcome) => outcome.exactTop1 || outcome.dwaCorrect;
  // "Unrecoverable" = the planted Task never appeared among the candidates, so no selection
  // policy could have got it right. Abstaining there is the correct behaviour.
  const unrecoverable = outcomes.filter((outcome) => !outcome.inCandidates);
  const confidences = (subset: MappingOutcome[]) => (subset.length ? subset.reduce((sum, outcome) => sum + outcome.diagnosticConfidence, 0) / subset.length : null);

  return {
    stream,
    n,
    topK,
    exactTop1Accuracy: rate((outcome) => outcome.exactTop1),
    taskRecallAtK: rate((outcome) => outcome.inCandidates),
    taskPrecisionAtK: n ? outcomes.reduce((sum, outcome) => sum + (outcome.inCandidates ? 1 / Math.max(1, outcome.candidateTaskIds.length) : 0), 0) / n : 0,
    dwaHierarchicalAccuracy: rate((outcome) => outcome.dwaCorrect),
    acceptableAlternativeRecall: rate(correct),
    catastrophicUnrelatedMapRate: rate((outcome) => outcome.catastrophic),
    abstentionRate: rate((outcome) => outcome.level === "abstain"),
    abstentionPrecision: abstained.length ? abstained.filter((outcome) => !outcome.inCandidates).length / abstained.length : null,
    abstentionRecall: unrecoverable.length ? unrecoverable.filter((outcome) => outcome.level === "abstain").length / unrecoverable.length : null,
    selectiveAccuracy: committed.length ? committed.filter(correct).length / committed.length : null,
    coverageAccuracyCurve: [0, 0.2, 0.4, 0.6].map((minConfidence) => {
      const kept = outcomes.filter((outcome) => outcome.level !== "abstain" && outcome.diagnosticConfidence >= minConfidence);
      return { minConfidence, coverage: n ? kept.length / n : 0, selectiveAccuracy: kept.length ? kept.filter(correct).length / kept.length : null };
    }),
    meanConfidenceCorrect: confidences(outcomes.filter(correct)),
    meanConfidenceIncorrect: confidences(outcomes.filter((outcome) => !correct(outcome))),
  };
}

export function runMappingBenchmark(options: { split?: BenchSplit; difficulty?: RenderDifficulty; people?: number; seed?: number } = {}): MappingBenchReport {
  const corpus = buildBenchCorpus({ split: options.split, difficulty: options.difficulty, people: options.people ?? 12, seed: options.seed });
  const outcomes = mappingCases(corpus.people, corpus.jobsByPerson).map(evaluateMappingCase);
  const streams: MappingStream[] = ["person_experience", "person_preference", "person_direction", "job_responsibility"];
  const sliceOf = (name: string, subset: MappingOutcome[]) => ({
    slice: name,
    n: subset.length,
    exactTop1Accuracy: subset.length ? subset.filter((outcome) => outcome.exactTop1).length / subset.length : 0,
    abstentionRate: subset.length ? subset.filter((outcome) => outcome.level === "abstain").length / subset.length : 0,
  });
  const wordCount = (outcome: MappingOutcome) => outcome.text.split(/\s+/).length;
  return {
    version: MAPPING_BENCH_VERSION,
    split: corpus.split,
    difficulty: corpus.difficulty,
    topK: MAPPER_CONFIG.topK,
    mapperConfig: MAPPER_CONFIG,
    streams: streams.map((stream) => reportForStream(stream, outcomes.filter((outcome) => outcome.stream === stream), MAPPER_CONFIG.topK)),
    slices: [
      sliceOf("core task type", outcomes.filter((outcome) => outcome.atom.taskType === "core")),
      sliceOf("supplemental task type", outcomes.filter((outcome) => outcome.atom.taskType === "supplemental")),
      sliceOf("short text (<= 12 words)", outcomes.filter((outcome) => wordCount(outcome) <= 12)),
      sliceOf("long text (> 24 words)", outcomes.filter((outcome) => wordCount(outcome) > 24)),
      sliceOf("high importance (>= 4)", outcomes.filter((outcome) => (outcome.atom.importance ?? 0) >= 4)),
      sliceOf("low importance (< 3)", outcomes.filter((outcome) => (outcome.atom.importance ?? 5) < 3)),
      sliceOf("committed to exact Task", outcomes.filter((outcome) => outcome.level === "task")),
      sliceOf("fell back to DWA", outcomes.filter((outcome) => outcome.level === "dwa")),
    ],
    note: "Measures recovery of a PLANTED canonical target from synthetically paraphrased text. Not human-validated mapping accuracy on real career language.",
  };
}
