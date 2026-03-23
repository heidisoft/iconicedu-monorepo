# IconicEdu Monorepo

IconicEdu is a communication-first education platform spanning web, mobile, and API surfaces for guardians, educators, children, advisors, and staff.

## Purpose

This document is the executive entrypoint for the repository. It explains what lives here, how to run the project quickly, and where the canonical engineering documentation now lives.

## Intended Audience

Internal engineers, operators, and AI assistants working in this monorepo.

## Last Updated

2026-03-23

## Key Docs

- [Documentation Hub](docs/README.md)
- [Local Setup](docs/getting-started/setup.md)
- [Development Workflow](docs/getting-started/development-workflow.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Best Practices](docs/standards/best-practices.md)

## Repo Layout

```text
iconicedu-monorepo/
├── apps/
│   ├── web/            # Next.js 15 application
│   ├── mobile/         # Expo / React Native application
│   └── api/            # NestJS backend
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
nvm use
pnpm install
pnpm build:packages
pnpm dev:web
```

For full environment setup, Supabase configuration, and troubleshooting, use [docs/getting-started/setup.md](docs/getting-started/setup.md).

## Common Commands

```bash
pnpm dev
pnpm dev:web
pnpm dev:mobile
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm test
pnpm ci
```

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
