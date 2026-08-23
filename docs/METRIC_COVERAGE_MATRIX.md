# Metric coverage matrix

Machine-readable source: `config/metric-contracts.json` (31 rows, 20 mandatory fields each).
Enforced by `pnpm audit:metric-contracts` and `tests/metric-contracts.test.ts`, which fail if a
row claims a runnable benchmark but names a command that does not resolve.

**No row has human gold.** Every runnable benchmark measures recovery of a known construct from
synthetically rendered language. That is autonomous engineering signal, not real-world validity.

Legend: **RUN** = runnable benchmark exists. **BASE** = naive/conventional baseline exists.
**AUTO** = autonomously optimizable. **BLOCK** = blocking gap.

| # | Subsystem | Product question | Primary metric | RUN | Command | BASE | AUTO | Current limitation | BLOCK |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Preference extraction / decoder | Did we understand what work they like/dislike? | `AVAILABLE_EVIDENCE_PREFERENCE_MACRO_MAE_V1` | yes | `pnpm eval:preference` | yes | yes | 2 of 17 dimensions eligible; recall 0.31 | no |
| 2 | Experience extraction | Did we identify work actually performed? | `EXPERIENCE_CLASS_F1` | yes | `pnpm bench:subsystems` | yes | yes | class-level, not span-level; 11.8% unclassified | no |
| 3 | Direction / aspiration extraction | Did we understand desired future work? | `ASPIRATION_CLASS_F1` | yes | `pnpm bench:subsystems` | yes | yes | recall 0.708; weakest mapping stream | no |
| 4 | Qualification extraction | Did we identify actual qualifications? | `QUALIFICATION_EXTRACTION_F1` | **no** | — | no | no | **no free-text extractor exists**; structured path only | no |
| 5 | Person Experience Task/DWA mapping | Right canonical work for performed statements? | `PERSON_EXPERIENCE_TASK_TOP1_ACCURACY` | yes | `pnpm bench:subsystems` | yes | yes | 0.194 Top-1 at hard tier | no |
| 6 | Person Preference Task/DWA mapping | Right canonical work for likes/dislikes? | `PERSON_PREFERENCE_TASK_TOP1_ACCURACY` | yes | `pnpm bench:subsystems` | yes | yes | 0.179 Top-1 at hard tier | no |
| 7 | Person Direction Task/DWA mapping | Right canonical work for aspirations? | `PERSON_DIRECTION_TASK_TOP1_ACCURACY` | yes | `pnpm bench:subsystems` | yes | yes | 0.083 Top-1, 0.542 abstention | no |
| 8 | Job responsibility extraction | Did we understand what the job contains? | `RESPONSIBILITY_EXTRACTION_F1` | **no** | — | no | no | **no JD segmenter exists**; structured list only | no |
| 9 | Job Task/DWA mapping | Right canonical work for responsibilities? | `JOB_RESPONSIBILITY_TASK_TOP1_ACCURACY` | yes | `pnpm bench:subsystems` | yes | yes | 0.870 Top-1; DWA fallback picks wrong DWA (0.120) | no |
| 10 | Candidate-job generation | Do relevant jobs enter the pool at all? | `CANDIDATE_RECALL_AT_K` | yes | `pnpm bench:product` | yes | yes | canonical recall 0.540 at hard tier vs lexical 0.868 | no |
| 11 | Experience Fit ranking | Do transferable-work jobs rank well? | `EXPERIENCE_NDCG_AT_K` | yes | `pnpm bench:product` | yes | yes | saturates at standard tier; must run hard | no |
| 12 | Preference Fit ranking | Do liked-work jobs outrank disliked-work jobs? | `PREFERENCE_NDCG_AT_K` | yes | `pnpm bench:product` | yes | yes | 0.618; mixed jobs collapse to the neutral 0.5 | no |
| 13 | Qualification Fit | Do we correctly determine requirement satisfaction? | `HARD_GAP_PRECISION` / `RECALL` | yes | `pnpm bench:product` | yes | yes | matching only, not extraction; legacy Hireability is NOT a substitute | no |
| 14 | Direction Fit ranking | Do desired-work jobs rank well? | `DIRECTION_NDCG_AT_K` | yes | `pnpm bench:product` | yes | yes | 0.769; 3 of 12 people below catastrophe threshold | no |
| 15 | Experience + Preference joint | Jobs good on BOTH? | `JOINT_RELEVANT_RECALL_AT_K` | yes | `pnpm bench:product` | yes | yes | Pareto + maximin is declared, not validated | no |
| 16 | E + P + D career transition | Moderate experience, high preference/direction? | `TRANSITION_RECALL_AT_K` | yes | `pnpm bench:product` | yes | yes | transitions planted as fully novel work | no |
| 17 | Surprising cross-title/industry | Relevant jobs conventional matching misses? | `SURPRISING_TRANSFER_RECALL_AT_K` | yes | `pnpm bench:product` | yes | yes | cross-boundary is stratum/industry difference, coarse | no |
| 18 | Recommendation policy | Which jobs shown, in what order, for which question? | per-mode NDCG on graded channels | yes | `pnpm bench:product` | yes | yes | modes are not personalized | no |
| 19 | User constraint enforcement | Are hard constraints never violated? | `HARD_CONSTRAINT_VIOLATION_RATE` | **no** | — | no | no | **no constraint fields exist**; vacuous, not passing | no |
| 20 | Conventional baseline comparison | Does task matching beat title/resume matching? | `ABSOLUTE_LIFT_OVER_BEST_BASELINE` | yes | `pnpm bench:product` | yes | yes | no embedding baseline | no |
| 21 | Explanation faithfulness | Do explanations cite only used evidence? | `UNSUPPORTED_RATIONALE_RATE` | yes | `pnpm bench:subsystems` | no | yes | structural grounding only, not usefulness | no |
| 22 | Result-set diversity / redundancy | Is top-K non-redundant while relevant? | `NEAR_DUPLICATE_RATE` | yes | `pnpm bench:product` | yes | yes | uses planted atom overlap, stronger than production info | no |
| 23 | Generalization / anti-overfitting | Do gains survive unseen phrasing? | `DEVELOPMENT_TO_VALIDATION_GAP` | yes | `pnpm bench:all` | no | yes | only paraphrase families withheld, not occupations | no |
| 24 | Core-vs-incidental responsibilities | Does one peripheral match imply relevance? | `INCIDENTAL_OVER_REWARD_RATE` | yes | `pnpm bench:product` | yes | yes | scoring does not yet distinguish core from incidental; only the label does | no |
| 25 | Robustness / invariance / leakage | Any gain from unavailable information? | `LEAKAGE_CHECK_PASS_RATE` | yes | `vitest run tests/bench-planted-truth.test.ts` | no | yes | paraphrase invariance across 4 families only | no |
| 26 | Score / confidence interpretation | Do the numbers support their reading? | `COVERAGE_ACCURACY_CURVE` | yes | `pnpm bench:subsystems` | yes | yes | no probabilistic calibration; scores are NOT probabilities | no |
| 27 | Contextual model/agent reranking | Does selective reranking beat the cheap mapper? | `RERANK_TOP1_DELTA_OVER_DETERMINISTIC` | **no** | — | yes | yes | **no reranker implemented**; harness accepts one via `mapWork`'s `CandidateReranker` | no |
| 28 | Cache / recomputation | Can a behaviour change be served stale? | `STALE_CACHE_POSSIBILITY` (must be 0) | yes | `vitest run tests/hybrid-readiness.test.ts` | yes | yes | only the mapper cache exists | no |
| 29 | Debug traceability | Can a bad recommendation be localized? | `STAGE_LOCALIZATION_COMPLETENESS` | yes | `vitest run tests/bench-traceability.test.ts` | no | yes | V3 path traced; legacy 17-D path not to the same depth | no |
| 30 | Whole-pipeline performance | Fast enough for many experiments? | `END_TO_END_BENCHMARK_RUNTIME` | yes | `pnpm bench:product` | yes | yes | measured on this VM only | no |
| 31 | End-to-end human recommendation validity | Are recommendations good for real people? | `HUMAN_LABELLED_NDCG_AT_K` | **no** | — | no | **no** | **no human annotation exists** | no |

## The five rows with no runnable evaluator

Each carries an explicit exclusion in the contract, so none is silently left optimizable.

**Row 4, qualification extraction.** No free-text extractor exists; qualifications reach V3 as
structured input. The loop may not claim progress here. Qualification *Fit* (row 13) is
separately measurable and stays in scope.

**Row 8, job responsibility extraction.** No JD segmenter exists; responsibilities reach V3 as a
structured list. This is the single largest known coverage gap in the job-side pipeline. Job-side
Task mapping (row 9) is measurable because the benchmark supplies the structured list.

**Row 19, user constraint enforcement.** No location, remote-mode, compensation, employment-type,
schedule, travel, or authorization fields exist on the person or job model. Zero constraints are
declared, so zero can be violated — vacuous, not passing. Fabricating fields to satisfy a metric
would be worse than recording the gap, and the trace records the absence explicitly.

**Row 27, contextual reranking.** The `CandidateReranker` seam and the `LearnedComponent`
contract exist; nothing is wired. The mapping benchmark accepts a reranker, so a reranker
experiment is runnable the moment one is implemented. The loop may build and then measure; it may
not claim a reranking result before implementing one.

**Row 31, human recommendation validity.** Permanently excluded from autonomous optimization.

## Future human annotation

Schemas needed before any human-validity claim: person Task/DWA mapping correctness, job
Task/DWA mapping correctness, Experience relevance of person-job pairs, Preference relevance,
Direction relevance, Qualification feasibility, pairwise job usefulness, and surprising-transfer
relevance. Those would support human-labelled NDCG@K, Recall@K, Precision@K, and pairwise
ranking accuracy.

Behavioural outcomes (saves, applications, interviews, offers) are useful external signals but
carry user-selection and market bias, and must never be substituted for construct-valid labels.
