# Local Environment Setup

## Purpose

This is the canonical guide for preparing and verifying an IconicEdu development machine.

## Intended Audience

Engineers setting up the repository for web, API, mobile, or database work.

## Last Updated

2026-08-14

## Related Docs

- [Development Workflow](development-workflow.md)
- [Contributing](../../CONTRIBUTING.md)
- [Architecture Overview](../codebase/ARCHITECTURE.md)
- [Mobile Workflow](../../apps/mobile/README.md)

## What The Local Stack Includes

| Component                                   | Local address                | Started by                      |
| ------------------------------------------- | ---------------------------- | ------------------------------- |
| Next.js web app                             | `http://localhost:3000`      | `pnpm dev:web` or `pnpm dev`    |
| NestJS API                                  | `http://localhost:3001`      | `pnpm dev:api` or `pnpm dev`    |
| Swagger                                     | `http://localhost:3001/docs` | API process                     |
| Expo Metro                                  | printed by Expo              | `pnpm dev:mobile` or `pnpm dev` |
| Supabase API, Studio, database, and Mailpit | printed by `supabase status` | `supabase start`                |

Use `supabase status` as the source of truth for Supabase ports and URLs.

## Prerequisites

The repository files take precedence over versions written in documentation. Use the pinned Node version for CI parity; compatible Node 24 patch releases are accepted by `package.json`.

| Tool         | Recommended or required version                        | Source of truth                                          |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Node.js      | `24.19.0`                                              | [`.nvmrc`](../../.nvmrc)                                 |
| pnpm         | `10.33.0`                                              | `packageManager` in [`package.json`](../../package.json) |
| Git          | Current supported release                              | Local installation                                       |
| Docker       | Current Docker Desktop/Engine                          | Required for local Supabase                              |
| Supabase CLI | Current release compatible with `supabase/config.toml` | Local installation                                       |

Mobile developers also need:

- iOS: macOS, Xcode with an installed simulator, and Xcode Command Line Tools.
- Android: Android Studio, an Android Virtual Device, the Android SDK, and the JDK version recommended by the installed Expo SDK.
- Physical devices: the development machine and device must be able to reach each other on the same network.

Windows development should run inside WSL2. Native iOS builds require macOS.

Common installation paths:

```bash
# macOS Supabase CLI
brew install supabase/tap/supabase

# Xcode command-line tools (macOS mobile development)
xcode-select --install
```

Install Docker Desktop from [Docker's official site](https://www.docker.com/products/docker-desktop/). Linux and Windows users should follow the [Supabase CLI installation guide](https://supabase.com/docs/guides/local-development/cli/getting-started) for their platform.

## 1. Clone And Select The Toolchain

```bash
git clone <repository-url> iconicedu-monorepo
cd iconicedu-monorepo
nvm install
nvm use
corepack enable
corepack prepare pnpm@10.33.0 --activate
node --version
pnpm --version
```

The CI-parity versions are Node `v24.19.0` and pnpm `10.33.0`. Compatible Node 24 patch releases are accepted, while pnpm must match exactly. The repository uses pnpm's hoisted node linker for Expo compatibility; do not install it with npm or Yarn.

If Corepack reports a permissions error, install Node through a user-scoped version manager such as nvm and retry. Avoid running package-manager commands with `sudo`.

### Editor setup

VS Code users can install the recommendations from [`.vscode/extensions.json`](../../.vscode/extensions.json). Workspace settings select the repository TypeScript version and enable Prettier formatting. Other editors should use the root `.editorconfig`, Prettier, ESLint, and the workspace TypeScript SDK from `node_modules/typescript/lib`.

## 2. Run The Recommended Bootstrap

Start Docker, then run:

```bash
pnpm setup:local
```

The bootstrap script:

1. checks Node, pnpm, Supabase CLI, and Docker;
2. copies missing env files from their tracked examples;
3. installs workspace dependencies;
4. starts the local Supabase stack;
5. reads the running stack's credentials;
6. writes the local values into each app's ignored env file; and
7. prints local service URLs, seed accounts, and optional unset integrations.

It updates only known keys and preserves other values already in the env files. Local credentials may be printed in the terminal; treat terminal output and copied logs as sensitive.

To repeat only the environment synchronization after Supabase is running:

```bash
pnpm env:sync:local
```

### Manual equivalent

Use this when diagnosing the bootstrap script:

```bash
pnpm install
supabase start
supabase db reset
pnpm env:sync:local
pnpm build:packages
```

`supabase db reset` destroys only the local Supabase database, reapplies every migration, and reloads [`supabase/seed.sql`](../../supabase/seed.sql). Do not point a reset command at a shared or production project.

## 3. Understand The Environment Files

These files are local and ignored by Git:

| App    | Local file            | Template                                                           | Main responsibility                                                  |
| ------ | --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Web    | `apps/web/.env.local` | [`apps/web/.env.local.example`](../../apps/web/.env.local.example) | Browser-safe Supabase settings, API origin, server-only integrations |
| Mobile | `apps/mobile/.env`    | [`apps/mobile/.env.example`](../../apps/mobile/.env.example)       | Expo build-time public values                                        |
| API    | `apps/api/.env`       | [`apps/api/.env.example`](../../apps/api/.env.example)             | Database, Supabase server settings, dispatcher tokens                |

Rules:

- Never commit an env file or paste a service-role key into an issue, PR, screenshot, or chat.
- Only variables prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` may be bundled into clients, and those values must be safe to expose.
- `SUPABASE_SERVICE_ROLE_KEY`, database URLs, internal tokens, and provider secrets are server-only.
- Add a documented placeholder to the appropriate example file whenever code introduces a new variable.
- Add build-time variables to `turbo.json` when they affect cached build output.

The normal local values are:

- Web API: `API_URL=http://localhost:3001` when an explicit value is needed; web otherwise uses the local default.
- Mobile API: `EXPO_PUBLIC_API_URL=http://localhost:3001` for simulators that can reach the host through localhost.
- Mobile environment: `EXPO_PUBLIC_APP_ENV=local`.
- Local Supabase: `http://127.0.0.1:54321` before mobile runtime host rewriting.

For an Android emulator or physical phone, `localhost` refers to that device. Set `EXPO_PUBLIC_API_URL` to a reachable host address, commonly `http://10.0.2.2:3001` for the standard Android emulator or `http://<your-lan-ip>:3001` for a physical device. The mobile Supabase client rewrites its local Supabase host automatically; the API URL is not rewritten.

Optional integrations such as Daily, PostHog, Expo Push, and OAuth providers are not required for the basic local stack. Obtain approved development credentials from a maintainer when a feature specifically needs them.

## 4. Build And Start The Apps

Build shared packages once after the initial install:

```bash
pnpm build:packages
```

Start the whole stack:

```bash
pnpm dev
```

Or start only the area being developed:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:mobile
```

`pnpm dev:mobile` is the guided first-run workflow. On a fresh clone, choose to generate and build the native project. For normal TypeScript, UI, or styling changes after a development client is installed, start Metro without rebuilding.

The full `pnpm dev` command starts Metro non-interactively and assumes a native development client is already installed. See the [mobile workflow](../../apps/mobile/README.md) for first builds, native rebuild rules, EAS builds, and device networking.

## 5. Verify The Setup

Run these checks before starting feature work:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Then verify the services you need:

1. `http://localhost:3001/docs` loads the API documentation.
2. `http://localhost:3000` loads the web app.
3. `supabase status` reports a healthy local stack.
4. The mobile development client connects to Metro when doing mobile work.

The full local CI equivalent is:

```bash
pnpm run ci
```

It includes formatting, repository guards, linting, type checking, tests, and builds. Run it before requesting review; use scoped checks during iteration.

## 6. Sign In With Seed Data

Every `supabase db reset` loads the following local accounts with password `Seed123!`:

| Email                              | Role     |
| ---------------------------------- | -------- |
| `iconicedudev@gmail.com`           | Owner    |
| `iconicedudev+guardian1@gmail.com` | Guardian |
| `iconicedudev+educator1@gmail.com` | Educator |
| `iconicedudev+educator2@gmail.com` | Educator |
| `iconicedudev+staff1@gmail.com`    | Staff    |
| `iconicedudev+guardian2@gmail.com` | Guardian |

For OTP, magic-link, invite, and password-reset testing:

1. run `supabase status`;
2. open the Mailpit URL shown in the output;
3. start the auth flow in the app; and
4. read the captured email in Mailpit.

Local emails are captured and are not delivered to the public internet.

## 7. Database And Prisma Setup

Supabase migrations are the only schema migration source of truth. After pulling new migrations:

```bash
supabase db reset
pnpm --filter api db:generate
```

The Prisma schema mirrors the tables used by the API. Regenerate the Prisma client after changing `apps/api/prisma/schema.prisma`:

```bash
pnpm --filter api db:generate
```

Inspect local data with Supabase Studio from `supabase status` or Prisma Studio:

```bash
pnpm --filter api db:studio
```

Do not use `prisma migrate dev` or `prisma db push` for repository schema changes. Create a new forward-only Supabase migration instead in `supabase/migrations/`.

## 8. Hosted Development Option

Local Supabase is the default because it is isolated and reproducible. Use a hosted development or preview branch only when a feature depends on hosted behavior.

Before connecting locally to a hosted project:

1. obtain the approved non-production project reference and credentials;
2. run `supabase login` and `supabase link --project-ref <development-project-ref>`;
3. confirm the linked project is not production;
4. copy the example env files and fill them with that project's values; and
5. apply migrations only with the team's approved workflow.

Never run `supabase db push`, reset commands, seed scripts, or destructive SQL against a shared project without explicit coordination.

## Troubleshooting

### A package cannot be resolved

```bash
pnpm install
pnpm build:packages
```

Restart the relevant development process afterward.

### Local Supabase will not start

Confirm Docker is running, then inspect:

```bash
docker info
supabase status
```

If ports are occupied, stop the conflicting process or the other Supabase project. Avoid deleting Docker volumes unless the local data can be discarded.

### The env sync fails

The sync command requires a running local stack:

```bash
supabase start
pnpm env:sync:local
```

If the Supabase CLI changed its status output, compare `supabase status --output json` with `scripts/setup-local.sh` and update the script and this guide together.

### The API cannot connect to Postgres

Confirm `DATABASE_URL` and `DIRECT_URL` in `apps/api/.env` match the database URL from `supabase status --output json`, then restart the API.

### A service-role PostgREST request returns `permission denied`

Confirm the local service-role grant by querying PostgREST directly. Use only the local key
reported by `supabase status`; never place a service-role key in a frontend environment file:

```bash
curl -i "http://127.0.0.1:54321/rest/v1/orgs?slug=eq.i&select=slug" \
  -H "apikey: <local-service-role-key>" \
  -H "Authorization: Bearer <local-service-role-key>"
```

A `42501 permission denied for table orgs` response means the API roles lack privileges on
the `public` schema. PostgREST checks table grants before row level security, so a missing
grant fails before any policy runs. The API is unaffected because Prisma connects as
`postgres`, which owns the tables.

Current Supabase Postgres images no longer grant DML on postgres-created tables in `public`
to `anon`, `authenticated`, and `service_role` by default. Migration
`20260820000000_restore_api_role_grants_public_schema.sql` restores the grants needed by
existing PostgREST callers. The forward hardening migration
`20260820010000_harden_public_api_role_grants.sql` then removes direct `anon` table access,
removes broad future defaults for `anon` and `authenticated`, and keeps service-role access
for API-owned flows. If the service-role query above fails, the local database predates those
migrations:

```bash
supabase db reset
```

### Mobile cannot reach the API

- iOS Simulator: `http://localhost:3001` normally works.
- Android Emulator: try `http://10.0.2.2:3001`.
- Physical device: use the development machine's LAN IP and allow the port through the firewall.
- Restart Metro after changing `apps/mobile/.env` because Expo values are read at startup.

### Metro has a stale cache

```bash
pnpm --filter mobile start -- --clear
```

### A local migration fails

Never edit a migration that has been committed or shared. Create another uniquely timestamped forward migration and validate the complete chain with:

```bash
supabase db reset
```
