# Experiment {{EXPERIMENT_ID}}

## Portfolio declaration — required, validated by `pnpm experiment:guard`
- Workstream:
- Expected information value: HIGH | MEDIUM | LOW
- Scope: LOCAL | SUBSYSTEM | ARCHITECTURAL
- Mechanism being tested:
- Parameter search preregistered: no
- Repeat justification:

> `Workstream` must name (or number) a workstream in `config/research-portfolio.json`.
> `Mechanism being tested` names the CAUSAL MECHANISM, not the code edit — for example
> "does DWA-level partial credit carry signal at all", not "change DWA_PARTIAL_CREDIT to 0.55".
> `Parameter search preregistered` must be `yes` for any threshold/coefficient/regex/keyword/
> prompt-variant work; otherwise the guard rejects it as unpreregistered hill climbing.
> `Repeat justification` is required for a third consecutive experiment on substantially the
> same mechanism, and must argue why it beats switching workstreams.

## Preregistration — complete before implementation
- Timestamp:
- Starting commit:
- Review lens:
- Problem:
- Hypothesis:
- Construct:
- Primary metric:
- Guardrails:
- Expected direction before results:
- Allowed datasets:
- Forbidden datasets:
- Potential failure mechanisms:
- Files expected to change:
- Evaluation tier: FAST | CHECKPOINT | FULL

## Result — complete after evaluation
- Ending commit:
- Exact before values:
- Exact after values:
- Distribution changes:
- Coverage changes:
- Variance changes:
- Example wins:
- Example regressions:
- Anti-Goodhart checks:
- Independent review findings:
- Decision: KEEP | REVERT | INCONCLUSIVE
- Reason:

INCONCLUSIVE requires reverting/deactivating speculative runtime scoring behavior before closing this record.
