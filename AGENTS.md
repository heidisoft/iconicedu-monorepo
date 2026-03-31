# AGENTS.md

This is the tool-entry file for AI assistants working in this repository.

The canonical long-form AI guidance now lives at [docs/internal/ai/agents.md](docs/internal/ai/agents.md).

Use these companion documents:

- [Documentation Hub](docs/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Best Practices](docs/standards/best-practices.md)
- [Development Workflow](docs/getting-started/development-workflow.md)

## Non-negotiable Repo Rules

- Keep reusable web UI in `packages/ui-web` rather than `apps/web`.
- Treat shared VMs in `packages/shared-types` as the cross-app contract.
- Prefer vendor-isolated adapters and keep feature code vendor-agnostic where practical.
- Follow existing ownership boundaries between `apps/*` and `packages/*`.
- Run relevant tests for the area you change.
- Mobile must not depend on `apps/web` API routes. If mobile needs a server endpoint, add or use it in `apps/api`.
- Prefer direct Supabase SDK access from mobile only for RLS-safe reads and narrowly-scoped writes that do not require server-side business logic, service-role access, or shared validation.
