# ICONICEDU Monorepo

ICONICEDU is a communication-first education platform spanning web, mobile, and API surfaces for guardians, educators, children, advisors, and staff.

## Purpose

This document is the executive entrypoint for the repository. It explains what lives here, how to run the project quickly, and where the canonical engineering documentation now lives.

## Intended Audience

Internal engineers, operators, and AI assistants working in this monorepo.

## Last Updated

2026-08-14

## Key Docs

- [Documentation Hub](docs/README.md)
- [Local Setup](docs/getting-started/setup.md)
- [Development Workflow](docs/getting-started/development-workflow.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture Overview](docs/codebase/ARCHITECTURE.md)
- [Conventions](docs/codebase/CONVENTIONS.md)

## Repo Layout

```text
iconicedu-monorepo/
├── apps/
│   ├── web/            # Next.js 15 frontend
│   ├── mobile/         # Expo 55 / React Native 0.83.2 frontend
│   └── api/            # NestJS 11 backend and business logic
├── packages/
│   ├── shared-types/   # Shared rows, VMs, payloads
│   ├── ui-web/         # Shared web UI library
│   ├── ui-native/      # Shared native UI library
│   └── utils/          # Shared utilities
├── docs/               # Canonical engineering documentation
├── supabase/           # Migrations, functions, seed data
└── .github/            # CI/CD workflows and repository automation
```

## Quick Start

```bash
nvm install
nvm use
corepack enable
pnpm setup:local
pnpm build:packages
pnpm dev
```

Start Docker before `pnpm setup:local`. For platform prerequisites, environment behavior, seed accounts, device networking, and troubleshooting, use the [local setup guide](docs/getting-started/setup.md).

## Common Commands

```bash
pnpm dev
pnpm dev:web
pnpm dev:mobile
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm test
pnpm run ci
pnpm commitlint -- --text "feat(web): add an example"
```

## Contribution Path

1. Branch from an up-to-date `main` using a name such as `feat/guardian-dashboard-filters`.
2. Keep table access and business logic in `apps/api`; web and mobile call the typed API clients.
3. Commit with Conventional Commits, for example `feat(web): add guardian dashboard filters`.
4. Run `pnpm run ci`, open a PR with a conventional title, and use squash merge after review.

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [development workflow](docs/getting-started/development-workflow.md) for the complete process.

## Documentation Model

- Root docs are limited to entrypoints and governance files.
- Canonical engineering guidance lives under [`docs/`](docs/README.md).
- Subsystem-local `README.md` files remain near the code they describe.

## Governance Files

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CHANGELOG.md](CHANGELOG.md)
- [AGENTS.md](AGENTS.md)
- [CLAUDE.md](CLAUDE.md)
