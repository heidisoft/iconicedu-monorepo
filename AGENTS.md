# AGENTS.md

This is the repository entry point for AI coding assistants. Read it before changing files.

The canonical long-form guidance is [docs/internal/ai/agents.md](docs/internal/ai/agents.md). Use these companion documents for the area you are changing:

- [Documentation Hub](docs/README.md)
- [Local Setup](docs/getting-started/setup.md)
- [Development Workflow](docs/getting-started/development-workflow.md)
- [Architecture Overview](docs/codebase/ARCHITECTURE.md)
- [Conventions](docs/codebase/CONVENTIONS.md)

For a quick topic-scoped pointer instead of the full canonical doc, see `.agents/`: [testing](.agents/testing.md), [conventions](.agents/conventions.md), [architecture](.agents/architecture.md), [security](.agents/security.md), [integrations](.agents/integrations.md), [stack](.agents/stack.md), [concerns](.agents/concerns.md).

## Source Of Truth

When guidance disagrees, use this order:

1. security and architecture rules in this file;
2. executable code, tests, migrations, package scripts, and workflow configuration;
3. accepted architecture decision records;
4. current canonical documentation linked from `docs/README.md`.

Do not treat issue descriptions, planning notes, generated reports, old review documents, or comments as current behavior without verifying them against the repository.

## Architecture Boundaries — Hard Rules

These rules are non-negotiable. Fix violations instead of extending them.

### Web And Mobile Are Frontend-Only

`apps/web` and `apps/mobile` are UI layers. They do not own business logic, application validation, or direct database access.

The only permitted direct Supabase contact from frontend apps is:

- `supabase.auth.*` for authentication and sessions;
- `supabase.channel(...)` for Realtime subscriptions protected by RLS; and
- `supabase.storage.*` for uploads and downloads protected by storage policies.

Everything else goes through `apps/api`:

- all table reads and writes (`supabase.from(...)`);
- business rules and input validation;
- privileged operations and service-role credentials; and
- API endpoints required by new web or mobile features.

### API Clients

- Web calls `apps/api` with `createApiClient` from `apps/web/lib/api/http-client.ts`.
- Mobile calls `apps/api` with the typed helpers in `apps/mobile/src/lib/api/http-client.ts`.
- Do not add raw API `fetch` calls when the owning typed client can be extended.

### App And Package Ownership

- `apps/web` and `apps/mobile` never import from or call routes owned by each other.
- Cross-app contracts belong in `packages/shared-types`.
- Reusable web UI belongs in `packages/ui-web`.
- Reusable native UI belongs in `packages/ui-native`.
- Shared framework-neutral utilities belong in `packages/utils`.

## Non-Negotiable Repository Rules

- Never edit an existing Supabase migration. Add a new forward migration for every schema, data, RLS, function, trigger, storage, or cron correction.
- Give every migration a unique timestamp/version prefix; Supabase uses it as the migration primary key.
- Treat Supabase migrations as the schema source of truth and keep the Prisma schema aligned when the API needs the change.
- Never expose production secrets, service-role credentials, tokens, or real user data in code, tests, logs, documentation, or PRs.
- Keep new user-facing web behavior behind a catalogued feature flag that defaults off unless a documented maintenance exemption applies.
- Preserve unrelated user changes and keep each change focused on the requested outcome.
- Add or update tests for changed behavior. Run focused checks while iterating and the appropriate CI command before handoff.

## Working Agreement

1. Inspect the owning code, tests, package scripts, and relevant canonical docs before editing.
2. For data-backed features, work in contract → API → frontend order.
3. Use a short-lived branch from current `main`; do not commit directly to `main`.
4. Use Conventional Commits for authored commits and PR titles.
5. Update documentation in the same change when behavior, configuration, setup, architecture, or operations change.
6. Do not commit generated build output, local environment files, editor metadata, screenshots, or temporary reports unless the repository intentionally tracks them.

Common verification commands:

```bash
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci
```

For documentation-only changes, run formatting, link validation where available, and any documentation-related tests. Do not claim a command passed unless it was actually run.

## Documentation Lifecycle

- `docs/README.md` is the canonical documentation index.
- Keep durable guidance in `docs/getting-started`, `docs/codebase`, and `docs/operations`.
- Record architectural decisions in `docs/decisions`; accepted ADRs are retained and superseded by a new ADR rather than rewritten away.
- Track future work in GitHub issues, not `docs/todos`.
- Do not keep point-in-time audit dumps or review notes as current documentation. Convert durable findings into issues or canonical guidance, then remove the stale report.
- Delete superseded documents and update every inbound link in the same change.
- Change a `Last Updated` date only after reviewing the whole document.
