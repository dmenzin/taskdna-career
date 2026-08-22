# External data

## O*NET 30.3 Database (May 2026)

- Source: [O*NET Resource Center database page](https://www.onetcenter.org/database.html), release archive at [db_releases.html](https://www.onetcenter.org/db_releases.html).
- Download consumed: `db_30_3_csv.zip` (comma-separated tabular form).
- License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://www.onetcenter.org/license_db.html).

### Attribution

This product includes information from the O*NET 30.3 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA.

TaskDNA modifies and derives interpretations from the O*NET data (normalized occupation skeletons, stratification, TaskDNA job-structure mappings, and synthetic-lab exposure text). **These derived interpretations are TaskDNA's own layer and do not represent the official position of USDOL/ETA and are not endorsed by USDOL/ETA.**

### Scope of use

- Only the downloadable O*NET **Database** is used. O*NET Career Exploration Tools content (Interest Profiler and related instruments) is separately licensed and is **not** copied here.
- O*NET occupational descriptors define **work exposure structure** (what work in an occupation looks like). They are **never** used as personal-preference ground truth. The Virtual Subject Lab generates hidden preference independently of occupation.

### Pipeline

| Command | What it does |
|---|---|
| `pnpm onet:fetch` | Downloads `db_30_3_csv.zip`, extracts, verifies expected tables, computes SHA-256 checksums, writes `data/manifests/onet-30.3.json`. Idempotent; `--force` re-downloads. |
| `pnpm onet:verify` | Re-verifies local files against the committed manifest. Supports offline reuse after the first fetch. |
| `pnpm onet:build` | Builds the normalized occupation corpus (`data/derived/onet/30.3/occupation-corpus.json.gz`, committed) and `coverage-summary.json`. |
| `pnpm audit:onet-coverage` | Runs every occupation through the engine's occupation → job → function → TaskDNA pipeline and reports coverage gaps. |

Raw downloads live under `data/external/onet/30.3/` and are **gitignored**; the manifest with hashes, sizes, fetch timestamp, license, and consumed tables is committed.

### Failure semantics

If the external download fails, the old "O*NET-inspired" local snapshot remains only as a **fallback test fixture** (`src/lab/occupations.ts`). O*NET-dependent gates report **BLOCKED** — they never silently pass against the old snapshot.

### Tables consumed

occupation_data, task_statements, task_ratings, work_activities, work_context, essential_skills, transferable_skills, knowledge, abilities, education, education_categories, training_and_experience, job_zones, sample_of_reported_titles, related_occupations, tasks_to_dwas, scales_reference.

Software Skills is treated as supplemental and is not currently consumed. Not every O*NET table influences scoring; tables are consumed for exposure structure, coverage measurement, and transfer evidence only.
