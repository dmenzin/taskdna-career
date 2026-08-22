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

`src/lab/occupations.ts` is an O*NET-inspired local snapshot (`onet-inspired.v1`): 24 occupations across 21 families, each with tasks, generalized work activities, skills, and work context.

Occupation is a **work skeleton**. It does **not** determine whether the virtual human likes that work.

## Population

`pnpm subjects:generate` builds 200 subjects (seed `20260822` by default):

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
