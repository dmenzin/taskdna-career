# Virtual Subject Laboratory

The lab exists to test whether the engine works for people who are not the original technical demo personas.

## Separation of concerns

| Layer | Who can see it | Purpose |
|---|---|---|
| Hidden subject truth | Evaluation harness only | Latent Task DNA, true capabilities, true attractors/repellents |
| Observable evidence | Production engine | Messy resume, stated likes/dislikes, imperfect network intake |
| Engine output | Product + eval | Inferred Task DNA, functions, jobs, actions |
| Evaluation | Audit only | Property checks, twins, holdout, leakage |

`src/domain/engine.ts` has no import path to `src/lab`. Hidden truth cannot leak into inference.

## Occupational skeletons

Two labs exist:

- **v1** (`src/lab/occupations.ts`, `onet-inspired.v1`): 24-occupation snapshot, 200 subjects, seed `20260822`. Still used by `pnpm audit:logic` / `subjects:*`.
- **v2** (`src/lab/onetLab.ts`, `subject-lab.v2-onet`): real O*NET 30.3 corpus (1,016 occupations, 923 with tasks), seed `20260823`. Used by `pnpm eval:onet-shock`. Hard-fails if the derived corpus is missing — no silent snapshot fallback.

Occupation is a **work skeleton**. It does **not** determine whether the virtual human likes that work. Preference is generated independently; only a minority is nudged toward occupation-shaped work.

## Population

`pnpm subjects:generate` builds 200 **v1** subjects (seed `20260822` by default):

- 80 design
- 40 validation
- 40 locked holdout
- 40 adversarial / OOD

Deliberate mess: accidental careers, career changers, burned-out specialists, contradictory self-report, sparse resumes, misleading titles, stale evidence.

## Anti-circularity

A virtual accountant is not assumed to like accounting. Preference vectors are generated independently, with only a modest optional nudge. The lab includes people who are good at work they dislike and people who like work they cannot yet sell.

## Twins

- same experience / different preference
- same preference / different experience
- same user / different network
- title-stripped observations

## Commands

```bash
pnpm subjects:generate
pnpm subjects:inspect subject-001
pnpm subjects:validate
pnpm subjects:regenerate --seed=20260822
```

Inspect prints observations and evaluation. It does not feed hidden truth into the engine.

## O*NET v2 lab

`generateOnetSubjects()` builds ~450 subjects: 150 development / 100 validation / 100 locked holdout / 100 adversarial, plus 600 twins and 1,000 observation-regime variants (sparse / contradictory / keyword-stuffed / misleading-title).

`pnpm eval:onet-shock` writes `artifacts/logic_audit/onet_shock_latest.json`. The Phase A file `onet_external_shock_baseline.json` is never overwritten.
