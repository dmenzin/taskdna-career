# Scoring

Scores are centralized in `src/domain/engine.ts` and configured in `src/config/model.ts`.

V1 stores raw values separately:

- predicted work fit,
- confidence,
- confidence-adjusted fit,
- capability alignment,
- hireability,
- career direction,
- technical growth,
- durability,
- negative-fit risk,
- novelty,
- overall priority,
- action tier,
- sellability.

Default confidence-adjusted fit:

`CAF = PredictedFit - 2 * (1 - Confidence)`

Default overall:

`0.40 * Hireability + 0.30 * CAF + 0.15 * CareerDirection + 0.10 * TechnicalGrowth + 0.05 * Durability`

Negative-fit risk is visible and also lightly penalizes overall ranking.
