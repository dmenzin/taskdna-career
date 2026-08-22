# Known limitations

- Jobs are synthetic demo data and are not live openings.
- Recommendation scores are heuristic and not psychometrically validated.
- No live-market availability, compensation accuracy, or hiring outcome is implied.
- SQLite/ORM migrations are not fully implemented; V1 uses deterministic JSON seed output and typed repository boundaries.
- Adaptive interview now uses a deterministic 12-scenario bank and information-value heuristic, but it is still a sandbox heuristic rather than a validated psychometric interview.
- Commute is simulated conceptually through work mode and documented provider semantics.
- Provider interfaces exist for future integrations, but local heuristic implementations are still concentrated in the domain engine and should be split before production growth.
- Novelty is gated on fit and transfer, but real non-obvious discovery quality cannot be proven from synthetic jobs alone.
- No production auth, payment, external LLM, job API, Supabase, or deployment integration is included.
