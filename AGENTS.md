# AGENTS.md

This is the tool-entry file for AI assistants working in this repository.

The canonical long-form AI guidance now lives at [docs/internal/ai/agents.md](docs/internal/ai/agents.md).

Use these companion documents:

- [Documentation Hub](docs/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Best Practices](docs/standards/best-practices.md)
- [Development Workflow](docs/getting-started/development-workflow.md)

## Architecture Boundaries — Hard Rules

These rules are **non-negotiable** and apply everywhere in the repo. Violations must be fixed, not worked around.

### Web and Mobile are frontend-only apps

`apps/web` and `apps/mobile` are UI layers. They do **not** contain business logic, validation, or direct database access.

**The only permitted direct Supabase contact from FE apps:**

- `supabase.auth.*` — authentication (sign-in, sign-out, OTP, OAuth, session)
- `supabase.channel(...)` — Realtime subscriptions (with RLS policies enforced)
- `supabase.storage.*` — file uploads and downloads

**Everything else goes through `apps/api`:**

- All table reads and writes (`supabase.from(...).select/insert/update/delete`) belong in `apps/api`
- `apps/api` is the only app that holds service-role credentials or performs privileged operations
- New features must have an `apps/api` endpoint before web or mobile wires up a hook

### API clients

- `apps/web` calls `apps/api` using `createApiClient` from `apps/web/lib/api/http-client.ts`
- `apps/mobile` calls `apps/api` using the typed helpers in `apps/mobile/src/lib/api/http-client.ts`
- Neither app imports from the other app or calls the other app's routes

### Isolation between apps

- `apps/mobile` must not depend on `apps/web` routes or internals
- `apps/web` must not depend on `apps/mobile` internals
- No cross-app imports — shared code belongs in `packages/*`

---

## Non-negotiable Repo Rules

- Never edit an existing Supabase migration after it has been created. Add a new forward migration for every database or cron change, even if the earlier migration is recent.
- Every Supabase migration filename must have a unique timestamp/version prefix. Supabase uses that prefix as the migration primary key, so duplicates will fail during `supabase db push`.
- Keep reusable web UI in `packages/ui-web` rather than `apps/web`.
- Treat shared VMs in `packages/shared-types` as the cross-app contract between FE and API.
- Prefer vendor-isolated adapters and keep feature code vendor-agnostic where practical.
- Follow existing ownership boundaries between `apps/*` and `packages/*`.
- Run relevant tests for the area you change.
