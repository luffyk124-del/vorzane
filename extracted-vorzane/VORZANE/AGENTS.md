# VORZANE Application Development Instructions

Follow the repository-root `/AGENTS.md` in addition to these project-specific rules.

## Project conventions

- Preserve the existing Expo Router, React Native, TypeScript, and Supabase architecture.
- Reuse the installed dependencies and existing abstractions before adding packages or parallel implementations.
- Keep mobile and web behavior compatible.
- Keep game rules and client presentation separate from authoritative server-side validation.
- Treat the authenticated user identity from Supabase Auth as the authority for ownership. Never trust a client-supplied user ID for privileged operations.

## Verification

Run from this directory:

1. `pnpm install --frozen-lockfile` when dependencies need installing in a clean environment.
2. `pnpm test`
3. `pnpm run typecheck`
4. `pnpm run test:browser` when UI, navigation, or browser behavior changes.
5. `pnpm run build`
6. For changed Edge Functions, run `deno check` and `deno test` for the affected functions.
7. For changed migrations or RLS policies, run the matching isolated PostgreSQL integration tests. Never point local tests at production.

The existing GitHub Pages workflow also validates the app, Supabase Edge Functions, isolated database migrations, and web export. Inspect and reuse it instead of creating duplicate CI pipelines.

## Supabase safety

- Preserve the existing Supabase project and existing player data.
- Review current migrations, functions, grants, and RLS policies before changing authorization behavior.
- Add migrations rather than rewriting already-applied migration history.
- Test migrations against an isolated database first.
- Do not deploy migrations or change hosted Auth/security settings without explicit user approval.
