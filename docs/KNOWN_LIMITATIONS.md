# Known limitations

- Jobs are synthetic demo data and are not live openings.
- Recommendation scores are heuristic and not psychometrically validated.
- No live-market availability, compensation accuracy, or hiring outcome is implied.
- SQLite/ORM migrations are not fully implemented; V1 uses deterministic JSON seed output and typed repository boundaries.
- Adaptive interview is represented by deterministic evidence and feedback updates; the next iteration should add a dedicated scenario queue.
- Commute is simulated conceptually through work mode and documented provider semantics.
- No production auth, payment, external LLM, job API, Supabase, or deployment integration is included.
