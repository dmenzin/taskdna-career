# TaskDNA product north star

TaskDNA is a **task-based career discovery and job-ranking system**. It helps a person find
jobs based on the UNDERLYING WORK, not on job titles, occupation names, industries, resume
keywords, or past job labels.

## What the system must understand

1. What work the person has **actually performed**.
2. What work they independently **like or dislike**.
3. What they are **qualified** to do.
4. What work they **want to do next**.

Then compare those against a job's actual responsibilities, actual requirements, and relevant
context.

## Four independent questions

| channel | question |
| --- | --- |
| Experience Fit | Have I actually done work like this before? |
| Preference Fit | Would I likely enjoy doing this work? |
| Qualification Fit | Can I plausibly satisfy this role's requirements? |
| Direction Fit | Does this role move me toward work I explicitly want to do next? |

These stay independent. All of these must remain representable, and each has a planted
benchmark case:

- HIGH Experience / LOW Preference (the burned-out expert)
- LOW Experience / HIGH Direction (the career changer)
- HIGH Preference / no Experience
- HIGH Qualification / LOW Preference
- HIGH Direction / LOW Qualification
- HIGH on all three work channels
- UNKNOWN Preference / HIGH Experience

Not having performed something does not mean disliking it. Having performed something does not
mean liking it. Qualification implies neither preference nor direction.

## What the product must discover

**Transferable background.** Someone who investigated failures, analyzed telemetry, isolated
root causes, and validated corrective actions should surface Reliability Engineer, Failure
Analysis Engineer, Quality Investigator, Incident Analyst, Medical Device Failure Analyst, and
Aerospace Reliability Specialist roles when the responsibilities genuinely overlap — even when
titles, industries, occupation families, and vocabulary all differ.

**Independent interest.** Someone with deep coordination experience who dislikes coordination
should be told: this matches your background strongly, and contains substantial work you appear
not to enjoy. Experience Fit stays high. Preference Fit stays low.

**Background + interest.** Finding jobs that BOTH leverage transferable work AND contain
preferred work is a first-class objective, not a weighted blend of two others.

**Career transitions.** Moderate Experience with high Preference and high Direction must remain
discoverable. TaskDNA must not become a resume-replication machine.

**Surprisingly good jobs.** Roles conventional title/resume similarity misses. But **surprise
without relevance is failure**: relevance and surprise are measured and reported separately.

**Faithful explanation.** Every rationale must come from the structured evidence the system
actually used.

## What TaskDNA must not become

Not title similarity. Not resume similarity. Not occupation or industry similarity. Not one
giant embedding similarity. Not one opaque LLM judgement. Not one arbitrary Overall V3 score.
Not one MAE treated as "TaskDNA accuracy". Not one model call per person-job pair. Not a
coefficient-tuning treadmill.

**There is no single TaskDNA accuracy number. There is no single MAE that represents product
quality.**

Preference MAE measures preference interpretation only. It is not Experience accuracy, not
mapper accuracy, not job-ranking accuracy, not recommendation quality, and not human validity.

## The canonical work model

Messy person and job language resolves through a replaceable boundary:

```
source language
  -> deterministic candidate generation
  -> ranked canonical candidates
  -> optional contextual reranking
  -> exact Task when defensible
  -> DWA fallback when an exact Task is not defensible
  -> abstain when evidence is insufficient
```

Task ID, statement, occupation, provenance, task type, importance, DWA ids, broader hierarchy,
and corpus version are all preserved. Contextual metadata (domain, seniority, system, ownership,
environment) is kept separate from canonical identity. **Job titles never mint Task identity.**
Similarity and confidence are never labelled accuracy.

## Autonomous signal versus human validity

Every benchmark in this repository measures recovery of a KNOWN construct from SYNTHETICALLY
RENDERED language. That is legitimate autonomous engineering signal. It is **not** evidence of
real-world validity for mapping, fit, or recommendation quality. `config/metric-contracts.json`
states the boundary per subsystem; row 31 (human recommendation validity) is permanently
excluded from autonomous optimization.

## Related

- `docs/METRIC_COVERAGE_MATRIX.md` — what is measurable, by what command, with what limits
- `docs/BENCHMARK_DESIGN.md` — how planted truth avoids circular evaluation
- `docs/FOUR_CHANNEL_PARALLEL_SCOPE.md` — channel independence invariants
- `docs/RECOMMENDATION_POLICY.md` — the four modes, without an Overall score
- `docs/TRACEABILITY.md` — localizing a bad recommendation to a subsystem
