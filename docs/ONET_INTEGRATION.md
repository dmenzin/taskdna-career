# O*NET integration

How the real O*NET 30.3 Database flows into TaskDNA. License and attribution live in `docs/EXTERNAL_DATA.md`.

## Normalized representation

`pnpm onet:build` produces one `OnetOccupationSkeleton` per O*NET-SOC occupation (`src/onet/types.ts`):

```
OnetOccupationSkeleton {
  onetSocCode, title, description,
  taskStatements[] (with task-ratings importance + DWA ids),
  workActivities[] (importance + level),
  workContext[] (CX ratings),
  essentialSkills[], transferableSkills[], knowledge[], abilities[],
  educationProfile (modal required-education category),
  trainingExperienceProfile (modal related-work-experience category),
  jobZone, alternateTitles[], relatedOccupationCodes[], sourceVersion
}
```

Provenance: every skeleton carries `sourceVersion: "onet-30.3"`; the manifest records archive/table SHA-256 hashes and the transformation version (`onet-corpus.v1`).

## Adapters (`src/onet/adapter.ts`)

- `occupationToJobPosting` — deterministic JobPosting the engine can analyze (tasks → responsibilities, essential skills + knowledge → requirements, job zone → coarse seniority band).
- `occupationToLabSkeleton` — lab exposure skeleton for virtual-subject generation.

## Stratification (`src/onet/strata.ts`)

Occupations map to ~32 work-structure strata (engineering, software, cybersecurity, data/analytics, healthcare professional/operations, finance, accounting/audit, insurance/risk, consulting, product, project/program, operations, supply chain, procurement, sales, business development, customer success, marketing, communications, HR, recruiting, learning/education, UX/design, research, science/research, legal, compliance, policy, public administration, field technical, manufacturing/technical operations, other). Job zones 3-5 mark the skilled-knowledge-work product scope; zone filtering is scope policy, not preference.

Known mapping limits: O*NET has no dedicated "recruiting" occupation (folded into HR), and 346 occupations (mostly zone-1/2 manual work) land in "other" — they stay available to the coverage suite and OOD cohorts.

## Hard invariant: exposure, not preference

O*NET descriptors describe what work in an occupation looks like. The Virtual Subject Lab (`src/lab/onetLab.ts`) draws hidden preference vectors independently of occupation; only a controlled minority (~35%, ~20% adversarial) is nudged toward occupation-shaped work, modeling people who genuinely like their jobs. Prohibited shortcuts (accountant → likes structure, salesperson → likes people, …) are tested in `tests/onet-lab.test.ts`.

## The virtual lab on real data

- Cohorts: development 150, validation 100, locked holdout 100, adversarial/OOD 100 (seed `20260823`, `subject-lab.v2-onet`).
- Counterfactuals: 4 twin kinds per development subject plus 4 observation-regime variants (sparse / contradictory / keyword-stuffed / misleading-title) per development+validation subject — 1,600+ variants.
- Occupation coverage suite: `pnpm audit:onet-coverage` pushes all 1,016 occupations through occupation → task representation → TaskDNA job structure → function mapping without crashes.

## External-shock discipline

`pnpm eval:onet-shock` froze `artifacts/logic_audit/onet_external_shock_baseline.json` on the first run with the unchanged pass-1 engine. The baseline is never overwritten; later runs write `onet_shock_latest.json` for comparison. See `docs/ONET_EXTERNAL_SHOCK_BASELINE.md`.
