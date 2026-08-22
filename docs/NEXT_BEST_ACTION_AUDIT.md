# Next Best Action audit (Pass 2)

Command: `pnpm audit:next-best-action` → `artifacts/logic_audit/next_best_action.json`

NBA is constrained planning, not a weighted dump of every possible ask.

## Stages

1. Generate feasible actions (apply + eligible asks + explicit material requests + function-gap build)
2. Remove forbidden / redundant / person-duplicate actions
3. Assign opportunity / access / information / urgency
4. Account for time, social cost, and weak-job advocacy
5. Build a small portfolio under a **90-minute** default budget with type diversity

## Constraints that now fire

- Time budget 90 minutes (no real user-facing budget editor yet)
- Max two deadline-ish applies; reserve ~18 minutes for a network action
- No person-level duplicate send/ask
- Explicit `SEND_REQUESTED_MATERIAL` outranks routine outreach
- Referral skipped when `overall < 6.8` (portfolio rule)
- At least one live/open apply so the plan cannot become all-networking after stricter Hireability
- `no networking` constraint strips outreach

## Audit cases (demo failure-analyst graph)

| Case | Result |
|---|---|
| time-budget-90 | 90 min, pass |
| no-duplicates | pass |
| not-all-networking | APPLY + SEND + ASK_ADVICE |
| no-advocacy-on-weak | pass |
| has-actions | 6 |
| type-diversity | 3 types |

60-minute and 15-minute budgets are specified but not user-editable. They remain a documented defect, not a silent pass.
