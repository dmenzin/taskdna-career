# Known limitations

- Jobs are synthetic demo data and are not live openings.
- Recommendation scores are heuristic and not psychometrically validated.
- No live-market availability, compensation accuracy, or hiring outcome is implied.
- SQLite/ORM migrations are not fully implemented; V1 uses deterministic JSON seed output and typed repository boundaries.
- Adaptive interview now uses a deterministic 12-scenario bank and information-value heuristic, but it is still a sandbox heuristic rather than a validated psychometric interview.
- Commute is simulated conceptually through work mode and documented provider semantics.
- Provider interfaces exist for future integrations, but local heuristic implementations are still concentrated in the domain engine and should be split before production growth.
- Novelty is gated on fit and transfer, but real non-obvious discovery quality cannot be proven from synthetic jobs alone.
- Human Opportunity Graph V2 uses synthetic fictional contacts only; it does not import real contacts or persist user-edited network state yet.
- V2 outreach is strategy/draft/simulated/manual only. No messages are sent and no LinkedIn/email automation is implemented.
- Next-best-action priorities are deterministic heuristics, not outcome probabilities.
- No production auth, payment, external LLM, job API, Supabase, or deployment integration is included.
- Hidden Task-DNA recovery on virtual subjects is coarse (MAE ≈ 1.88/10 on the O*NET lab). Property tests can pass while exact latent vectors stay wrong.
- Official O*NET 30.3 is ingested (see `docs/ONET_INTEGRATION.md`). The old 24-occupation snapshot remains a v1-lab fixture only.
- Title-removal twins are often no-ops because many adversarial resumes already use misleading titles.
- Extended knowledge-work functions exist for generic users; `field-applications` still over-absorbs public/customer occupations (281 / 1,016).
- Confidence is not associated with lower synthetic error and is not a probability.
- Scoring still has 74 free coefficients. Ask gates and evidence-class rules replaced some lexical shortcuts, not the Overall weights.
