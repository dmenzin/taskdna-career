# TaskDNA Career

TaskDNA Career is a sandbox-first career-discovery prototype. It infers a user's work-preference "Task DNA" from demo evidence, scenarios, and feedback, then ranks synthetic jobs by actual day-to-day work structure rather than title similarity alone.

## Quick start

```bash
pnpm install
pnpm dev
```

Useful commands:

- `pnpm lint` - run Next linting.
- `pnpm typecheck` - type-check the app and domain layer.
- `pnpm test` - run recommendation engine regression tests.
- `pnpm eval` - run the deterministic persona evaluation harness.
- `pnpm audit:logic` - run the computational-brain audit and write `artifacts/logic_audit/`.
- `pnpm subjects:generate` - build the 200-subject Virtual Subject Laboratory.
- `pnpm build` - build the Next app.
- `pnpm export:demo` - write standalone demo exports to `artifacts/`.
- `pnpm reset` / `pnpm seed` - refresh deterministic local sandbox data.

## Sandbox scope

The app uses deterministic local providers and synthetic demo jobs. It does not require OpenAI, Anthropic, Supabase, Vercel, paid job APIs, production auth, or production databases.

See `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/BUILD_STATUS.json` for the current build state and implementation notes.
