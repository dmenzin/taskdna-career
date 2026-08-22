# Logic invariants

These are the claims the engine is allowed to make. If an invariant fails, the recommendation is not logically defensible.

## Career / Task DNA

1. Observable career text must be able to change Work Fit. Fixture persona IDs must not be model inputs.
2. Duplicate identical sentences must not inflate confidence without bound.
3. A dimension with no evidence is unknown, not a confident neutral 5.
4. Sparse evidence must produce lower confidence than rich evidence.
5. Preference feedback may move Task DNA. It must not fabricate capabilities.
6. Preference and capability must remain separable: high fit can coexist with low hireability and the reverse.
7. Same title / different tasks must produce different Work Fit. Different titles / same tasks must stay close.

## Scoring

8. CAF = `predictedFit - 2 * (1 - confidence)`.
9. Overall uses the published weights. Hireability currently dominates; that must stay visible.
10. Scoring is deterministic for a fixed config version and input.
11. Action-tier labels are cliffs. Raw numbers must remain in the trace.

## Jobs

12. Job function matching prefers task content over title.
13. Novelty requires relevance and transfer before title distance can promote a role.
14. Hard filters and freshness transitions follow configured rules.

## Network / human strategy

15. Work Fit is independent of network access. Changing only the graph must not change predictedFit.
16. Information, routing, credibility, and advocacy are separate numbers, not one "network score."
17. `DO_NOT_CONTACT` and explicit referral boundaries constrain actions.
18. Credibility decays across hops. Second-degree paths are labeled as such.
19. Next-best actions may use inferred high-fit functions, never fixture `expectedHighFunctions`.

## Generalization

20. Occupation does not define preference ground truth.
21. Zero-origin (no demo persona, no golden network) must still infer, rank, and plan.
22. A finance/sales/operations subject must not be trapped in a medical-device function map.

`pnpm audit:logic` is the executable form of this list.
