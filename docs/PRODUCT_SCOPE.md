# Product scope

## Intended population

Sandbox V1/V2 is aimed at **US skilled knowledge workers** exploring career direction from messy career text.

That is an intentional scope limit, not a claim of universal career science.

## What is implemented

- Generic Task-DNA dimensions (work structure, not job titles)
- A technical demo function pack used by the original 15 personas
- An extended knowledge-work pack used by generic / virtual subjects (finance, sales, operations, people, instruction, compliance, discovery, research)
- Synthetic jobs and synthetic networks
- Heuristic scoring and human-strategy rules

## What is not validated

- Trades and non-knowledge work
- Non-US labor markets and visa regimes
- Licensed professions as hiring-outcome predictors
- Compensation accuracy
- Live job availability
- Psychometric reliability of Task DNA
- Real-world networking effectiveness

## Geographic / cultural assumptions

Commute defaults live in `scoringConfig.commuteRules.defaultHomeRegion` (currently `Boston, MA`). That is demo configuration, not a hidden user fact.

## Occupational coverage

The demo job corpus and original function map are still densest in technical / biomedical / software work. That is a **scope limit**.

It is a **logic failure** if the engine claims generic behavior while requiring the original failure-analyst persona, medical-device function list, or golden network to initialize.

Zero-origin mode (`pnpm audit:zero-origin`) is the check for that failure.

## Evidence requirements

The engine should degrade honestly:

- sparse text → low confidence, exploratory recommendations
- contradiction → lower dimension confidence
- no network intake → apply/build-network actions, not invented warm paths
