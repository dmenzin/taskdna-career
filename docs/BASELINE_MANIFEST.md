# Baseline manifest and provenance quarantine

## Checkout finding

The first readiness mission observed `c10b914a147fc39f2be37cd0584425aeec958d1f`, tree `b729cb28…`, and produced the authorized readiness-lab base `51ccb94c63663591503e1ee214962c130a366c85`. The earlier `b42e121…` prototype is formally retired and not required. Readiness provenance now means that the working commit descends from `51ccb94…` and that the frozen historical artifact still matches its manifest.

The normative machine record is [`config/baseline-manifest.json`](../config/baseline-manifest.json). `pnpm eval:iteration-readiness` checks the readiness-lab ancestry and exact frozen SHA-256.

## Artifact classification

| Artifact/claim | Classification | Evidence |
|---|---|---|
| `onet_external_shock_baseline.json` (MAE 1.8452277688400356; spread 0.2933333333333327) | **VERIFIED_FROZEN_BASELINE** | Introduced at `80312e2`; committed bytes SHA-256 `00ec10ef…`; seed 20260823; lab v2; O*NET 30.3. |
| `onet_shock_latest.json` (MAE 1.875021105795119; spread 1.9860654971892342) | **VERIFIED_TRANSIENT_RUN** | Mutable latest artifact, SHA-256 `e4d8d60d…`, present at starting `c10b914`. |
| documentation claim 1.875021 / holdout 1.816938 | **VERIFIED_TRANSIENT_RUN** only | It matches the reproducible current transient recipe but is not an immutable comparison baseline. |
| readiness work on this branch | **CURRENT_CANDIDATE** | Laboratory-only changes; not a scoring baseline. |

The historical holdout was published and inspected, so it is not pristine. `LOCKED_CONFIRMATION` is an access-control mode, not a claim that history can be undone.

## Frozen record details

The baseline contains 150 development, 100 validation, 100 holdout and 100 adversarial subjects (7,650 dimension observations), generated with `subject-lab.v2-onet`, seed `20260823`, and O*NET 30.3 corpus SHA-256 `ae981c0e…`. Its metric is the legacy equal-subject/equal-dimension 17D MAE. The historical exact command is `pnpm eval:onet-shock`; evaluator provenance is `onet-shock.v1`. The manifest records commit/tree, complete hashes, formula, freeze status, and confidence.

**Rule:** generated `latest` files are outputs, never source truth. Only a record whose classification is `VERIFIED_FROZEN_BASELINE` and whose bytes match the manifest may be used as the comparison baseline.
