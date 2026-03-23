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
