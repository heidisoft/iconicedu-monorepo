# IconicEdu — Monorepo

A communication-first education platform connecting **guardians, educators, children, advisors, and staff** through modern chat, scheduling, progress tracking, and homework workflows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web | Next.js 15 (App Router) |
| Mobile | Expo 54 + React Native 0.81 |
| API | NestJS 11 |
| ORM | Prisma 7 |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS (web) · NativeWind v4 (mobile) |
| Monorepo | Turborepo 2 |
| Package manager | pnpm 9.12.0 |

---

## Monorepo Structure

```
iconicedu-monorepo/
├── apps/
│   ├── web/          # Next.js 15 web app
│   ├── mobile/       # Expo 54 mobile app
│   └── api/          # NestJS 11 backend
│
├── packages/
│   ├── ui-web/       # Web UI kit (shadcn/Radix + Tailwind)
│   ├── ui-native/    # Native UI kit (NativeWind)
│   ├── shared-types/ # VMs, rows, payloads, shared enums
│   ├── utils/        # Shared utilities
│   ├── config-eslint/
│   └── config-tsconfig/
│
├── supabase/
│   └── migrations/   # All database migrations (source of truth)
│
├── docs/             # Detailed documentation
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Quick Start

> Full setup guide with Supabase, environment variables, and troubleshooting: [docs/setup.md](docs/setup.md)

### 1. Prerequisites

- **Node 20.19.0** — use `.nvmrc` or `.tool-versions`
- **pnpm 9.12.0**
- macOS or Linux (Windows requires WSL2)

```bash
# Using nvm
nvm use

# Using asdf
asdf install
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

Fill in your Supabase credentials — see [docs/setup.md#environment-variables](docs/setup.md#environment-variables).

### 4. Set up Supabase and apply migrations

```bash
# Apply all migrations to your Supabase project
supabase link --project-ref <your-project-ref>
supabase db push
```

See [docs/setup.md#supabase-setup](docs/setup.md#supabase-setup) for local development with the Supabase CLI.

### 5. Build shared packages

```bash
pnpm build:packages
```

### 6. Run the apps

```bash
pnpm dev:web       # Next.js  → http://localhost:3000
pnpm dev:api       # NestJS   → http://localhost:3001
pnpm dev:mobile    # Expo     → scan QR or press i/a
```

---

## Common Commands

```bash
pnpm dev                 # All apps in parallel
pnpm build               # Build everything
pnpm lint                # Lint all packages
pnpm typecheck           # Type-check all packages
pnpm test                # Run all tests
pnpm ci                  # Full pipeline (lint + typecheck + test + build)
pnpm clean               # Clear build caches
pnpm clean:all           # Clear build caches + node_modules
```

### Scoped commands

```bash
pnpm dev:web             # Web only
pnpm dev:mobile          # Mobile + ui-native only
pnpm dev:api             # API only
pnpm test:web            # Web + ui-web tests
pnpm test:mobile         # Mobile + ui-native tests
```

### Mobile native builds (EAS)

```bash
pnpm mobile:ios          # Run on iOS Simulator
pnpm mobile:android      # Run on Android Emulator
pnpm mobile:eas:build:dev     # EAS development build
pnpm mobile:eas:build:preview # EAS preview build
```

### Database (Prisma — API only)

```bash
pnpm --filter api db:generate  # Regenerate Prisma client
pnpm --filter api db:migrate   # Create and apply new migration
pnpm --filter api db:studio    # Open Prisma Studio
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/setup.md](docs/setup.md) | Full local environment setup, Supabase, env vars |
| [docs/contributing.md](docs/contributing.md) | Branch naming, commits, PR process |
| [docs/best-practices.md](docs/best-practices.md) | Code conventions, patterns, adding packages |
| [docs/AGENTS.md](docs/AGENTS.md) | Architecture deep-dive, type system, data flow |

---

## Supported Platforms

| Platform | Status | Notes |
|---|---|---|
| macOS | Best | Required for iOS Simulator |
| Linux (Ubuntu/Debian) | Supported | Fastest CI builds |
| Windows (native) | Not supported | Expo/Metro issues |
| Windows (WSL2) | Supported | Works well for API/web |

---

## Troubleshooting

**`ERR_PNPM_FETCH_404`** — You forgot to use `workspace:*` in a local dependency.

**Corepack signature error** — Use Node 20 and re-activate corepack:
```bash
nvm use 20
corepack prepare pnpm@9.12.0 --activate
```

**Metro symlink errors on Expo** — Don't run on Windows native Node; use WSL2 or macOS.

**SWC errors on Next.js** — Node version mismatch. Run `nvm use`.

**`prisma generate` fails** — Ensure `DATABASE_URL` is set in `apps/api/.env` before running.

For more, see [docs/setup.md#troubleshooting](docs/setup.md#troubleshooting).
