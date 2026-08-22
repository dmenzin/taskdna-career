# Network logic audit (Pass 2)

Command: `pnpm audit:network-logic` → `artifacts/logic_audit/network_logic.json`

Ask selection is **gates first**:

HARD INVARIANTS → eligible actions → subtype-specific readiness → score within eligible actions

Aggregate Network Access is a summary only. It cannot unlock a forbidden ask.

## Gates

| Rule | Behavior |
|---|---|
| `DO_NOT_CONTACT` | Blocks all outreach |
| Referral / resume-forward | Needs credibility ≥ 6 **and** observed work, or an explicit offer |
| Referral already submitted / referral boundary | Blocks duplicate referral |
| Reference | Credibility ≥ 7 and observed work |
| Hiring-manager intro | Routing ≥ 4 **or** `FORMER_MANAGER` |
| Send requested material | Explicit offer only |
| Weak job | **NBA portfolio rule**, not an ask-gate |

High warmth + high routing + low credibility does **not** yield a referral.

## Orthogonal cases

All eight audit cases pass: high-warmth/low-credibility, low-warmth/high-credibility, high-routing/no-credibility, former manager outside company, explicit refusal, repeated submission, do-not-contact, weak job still eligible if credible.

Demo `pnpm eval:network` still passes (golden failure-analyst plus four regression personas).

## What remains arbitrary

Social-cost integers, ask-readiness priors, and action weights are still versioned heuristics. O*NET cannot calibrate networking. The O*NET-lab strategy audit (`former-manager-direct`, `second-degree-paths`) still fails on generic lab graphs because those graphs do not contain the demo fixture coincidences — that is a **fixture-shaped golden case**, not a gate regression.
