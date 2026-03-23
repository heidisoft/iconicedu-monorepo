# Local Environment Setup

## Purpose

This is the canonical setup guide for getting the IconicEdu monorepo running locally.

## Intended Audience

Internal engineers setting up web, mobile, API, and local Supabase development.

## Last Updated

2026-03-23

## Related Docs

- [Documentation Hub](../README.md)
- [Development Workflow](development-workflow.md)
- [Contributing](../../CONTRIBUTING.md)
- [Architecture Overview](../architecture/overview.md)

Step-by-step guide to get the IconicEdu monorepo running on your machine.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone and Install](#clone-and-install)
- [Supabase Setup](#supabase-setup)
  - [Option A: Supabase Cloud (recommended for most devs)](#option-a-supabase-cloud)
  - [Option B: Supabase Local (fully offline dev)](#option-b-supabase-local)
- [Environment Variables](#environment-variables)
- [Build Shared Packages](#build-shared-packages)
- [Run the Apps](#run-the-apps)
- [Mobile Setup](#mobile-setup)
- [API Setup](#api-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required tools

| Tool         | Version | How to install                                               |
| ------------ | ------- | ------------------------------------------------------------ |
| Node.js      | 20.19.0 | nvm or asdf                                                  |
| pnpm         | 9.12.0  | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| Git          | any     | system                                                       |
| Supabase CLI | latest  | `brew install supabase/tap/supabase`                         |

### macOS only (for iOS development)

- Xcode 15+ (from App Store)
- Xcode Command Line Tools: `xcode-select --install`
- iOS Simulator included with Xcode

### Android development (any OS)

- Android Studio with an emulator configured
- Java 17+

---

### Install Node with nvm (recommended for macOS/Linux)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install the project's Node version (reads from .nvmrc)
nvm install
nvm use
```

### Install Node with asdf (alternative, also manages pnpm)

```bash
# macOS
brew install asdf

# Linux — follow https://asdf-vm.com/guide/getting-started.html
asdf plugin add nodejs
asdf plugin add pnpm

# Installs all versions defined in .tool-versions
asdf install
```

### Install pnpm

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

---

## Clone and Install

```bash
git clone <repo-url> iconicedu-monorepo
cd iconicedu-monorepo

pnpm install
```

> **Why pnpm?** The repo uses `node-linker=hoisted` in `.npmrc` for Expo/jest-expo compatibility. Do not switch to npm or yarn.

---

## Supabase Setup

The database schema lives in `supabase/migrations/`. All migrations must be applied before running any app.

### Option A: Supabase Cloud

Use this if you want to develop against a real hosted Supabase project. This is the fastest way to get started and avoids running Docker locally.

#### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note down:

- **Project URL** — e.g. `https://abcdefgh.supabase.co`
- **Anon/public key** — from Settings → API → Project API keys
- **Service role key** — from Settings → API (keep this secret)
- **Database password** — set during project creation
- **Project ref** — the short ID in your project URL, e.g. `abcdefgh`

#### 2. Install and authenticate the Supabase CLI

```bash
brew install supabase/tap/supabase   # macOS
# or: https://supabase.com/docs/guides/local-development/cli/getting-started

supabase login
```

#### 3. Link your project

```bash
supabase link --project-ref <your-project-ref>
# Enter your database password when prompted
```

#### 4. Apply all migrations

```bash
supabase db push
```

This applies every file in `supabase/migrations/` in order. Run this again whenever new migration files are added.

#### 5. Verify

Check the Supabase dashboard → Table Editor. You should see tables like `profiles`, `accounts`, `channels`, `messages`, etc.

#### 6. Use the tracked email templates

Customized Supabase Auth email templates are already tracked in this repo under `supabase/templates/email/`, and local Supabase uses them through the managed block in `supabase/config.toml`.

---

### Option B: Supabase Local

Use this for fully offline development or to avoid sharing a cloud project between developers.

#### Prerequisites

- Docker Desktop running

#### 1. Start local Supabase

```bash
supabase start
```

This pulls Docker images and starts local Postgres, Auth, Storage, and Studio on your machine. First run takes a few minutes.

#### 2. Apply migrations

```bash
supabase db reset
```

`db reset` drops and recreates the local database, then applies all migrations from `supabase/migrations/` in order. Use this any time you pull new migrations.

For incremental updates (without a full reset):

```bash
supabase migration up
```

#### 3. Get your local credentials

```bash
supabase status --output json
```

The current CLI returns values like:

```json
{
  "API_URL": "http://127.0.0.1:54321",
  "DB_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  "JWT_SECRET": "super-secret-jwt-token-with-at-least-32-characters-long",
  "PUBLISHABLE_KEY": "sb_publishable_...",
  "ANON_KEY": "eyJ...",
  "SECRET_KEY": "sb_secret_...",
  "SERVICE_ROLE_KEY": "eyJ...",
  "STUDIO_URL": "http://127.0.0.1:54323"
}
```

You can wire these into local env files automatically with:

```bash
pnpm env:sync:local
```

That command reads `supabase status --output json` and updates only the matching keys inside the existing env files. It does not replace the whole file.

#### 4. Stop local Supabase

```bash
supabase stop
```

If you sync or edit local email templates, restart the local stack so GoTrue reloads `supabase/config.toml` and the template files:

```bash
supabase stop
supabase start
```

## Supabase Email Templates

The customized Supabase Auth email templates are already tracked in git under:

- `supabase/templates/email/*.html`
- the managed email-template block inside `supabase/config.toml`

To push the git-tracked templates back into a hosted Supabase project or branch:

```bash
export SUPABASE_ACCESS_TOKEN=<your-management-api-token>
export SUPABASE_PROJECT_REF=<target-project-or-branch-ref>

pnpm supabase:email:push -- --dry-run
pnpm supabase:email:push
```

The preview branch workflow uses this push step automatically after each Supabase preview branch is created or refreshed, so git-tracked email templates apply to preview branches as well.

## Supabase Storage Buckets

The repo also tracks seeded Supabase Storage objects under:

- `supabase/storage/public-message-thumbnails/`
- `supabase/storage/channel-files/`
- `supabase/storage/public-avatars/`

Local Supabase reads those directories from the bucket definitions in `supabase/config.toml`.

To seed the git-tracked storage files into local Supabase:

```bash
supabase seed buckets --local
```

Preview branches use the Supabase CLI in GitHub Actions:

```bash
supabase link --project-ref <branch-project-ref>
supabase seed buckets --linked
```

That workflow seeds only the files tracked in `supabase/storage/`, so preview branches receive only the repo’s test assets.

---

## Environment Variables

Create the following files. Never commit `.env` files — they are in `.gitignore`.

For local Supabase, prefer:

```bash
pnpm env:sync:local
```

This command:

- reads the running local Supabase credentials from `supabase status --output json`
- updates only the supported keys in `apps/web/.env.local`, `apps/mobile/.env`, and `apps/api/.env`
- preserves unrelated comments and env vars already in those files
- auto-generates local internal reminder/activity tokens if they are missing
- leaves optional integrations like PostHog and Daily unchanged, then reports what is still unset

If the env files do not exist yet, create them first from the examples below, then run `pnpm env:sync:local`.

### apps/web/.env.local

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

```env
# Cloud / manual setup
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Optional fallback for local/manual setups
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Useful for server-side local usage as well
SUPABASE_URL=https://your-project-ref.supabase.co

# Keep this secret — never expose to the browser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

When synced from local Supabase, the command writes:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>` only if that key already exists or publishable key is absent
- `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`
- `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000` if missing
- `INTERNAL_REMINDERS_TOKEN` and `INTERNAL_ACTIVITY_FEED_TOKEN` if missing

### apps/mobile/.env

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```env
# EXPO_PUBLIC_ prefix is required — variables are inlined at build time
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

When synced from local Supabase, the command writes:

- `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`

> **Note:** Mobile reads env via `Constants.expoConfig?.extra`, not `process.env`. The `app.config.js` bridges these at build time.
>
> For this repo’s local setup, mobile is intentionally pinned to `127.0.0.1`. If you run on a physical device, update that URL manually to a reachable host.

### apps/api/.env

```bash
cp apps/api/.env.example apps/api/.env
```

```env
# Supabase Postgres connection string
# Cloud: find in Supabase dashboard → Settings → Database → Connection string (URI)
# Local: postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# For direct connections (Prisma migrations) use the non-pooling URL
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Supabase keys for server-side access
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT secret — from Supabase dashboard → Settings → API → JWT Settings
JWT_SECRET=your-jwt-secret
```

When synced from local Supabase, the command writes:

- `DATABASE_URL=<DB_URL>`
- `DIRECT_URL=<DB_URL>`
- `SUPABASE_URL=<API_URL>`
- `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`
- `JWT_SECRET=<JWT_SECRET>`
- `INTERNAL_REMINDERS_TOKEN_API` if missing

---

## Build Shared Packages

Turborepo requires packages to be built before apps can consume them. Always run this after a fresh install:

```bash
pnpm build:packages
```

This builds `shared-types`, `ui-web`, `ui-native`, and `utils` in dependency order.

> You only need to re-run this if you change code inside `packages/`. The `dev` tasks watch for changes and rebuild automatically.

---

## Run the Apps

### All apps in parallel

```bash
pnpm dev
```

### Web only (recommended during web development)

```bash
pnpm dev:web
# → http://localhost:3000
```

### API only

```bash
pnpm dev:api
# → http://localhost:3001
# → Swagger: http://localhost:3001/docs
```

### Mobile only

```bash
pnpm dev:mobile
```

Then in the Expo terminal:

- Press `i` — open iOS Simulator (macOS only)
- Press `a` — open Android Emulator
- Scan QR code — open on physical device with Expo Go

### Log In To The Website Locally

For local email-based authentication flows such as sign-in, sign-up, password reset, and OTP verification, Supabase routes emails to Mailpit instead of sending real email.

1. Start the local Supabase stack:

```bash
supabase start
```

2. Get the local service URLs:

```bash
supabase status
```

3. Open the Mailpit URL shown in the output.
   The default local URL is usually `http://127.0.0.1:54324`.

4. Trigger the auth flow in the local web app:
   sign in, request an OTP, create an account, or start a password reset.

5. Find the captured email in Mailpit and open it.

6. Copy the code, magic link, or token from the email and use it in the app’s verification step.

If you prefer the machine-readable version of the local Supabase endpoints, you can also run:

```bash
supabase status --output json
```

---

## Mobile Setup

### iOS Simulator (macOS only)

1. Install Xcode from the App Store
2. Open Xcode once to accept the license agreement
3. Install simulators: Xcode → Settings → Platforms → iOS

```bash
pnpm dev:mobile
# then press 'i'
```

### Android Emulator

1. Install Android Studio
2. Open AVD Manager (Virtual Device Manager)
3. Create a device with API level 33+

```bash
pnpm dev:mobile
# then press 'a'
```

### Physical device

Install [Expo Go](https://expo.dev/client) on your device and scan the QR code shown in the terminal.

### EAS builds (for distribution)

```bash
# Install EAS CLI
pnpm add -g eas-cli
eas login

# Development build (includes dev client for debugging)
pnpm mobile:eas:build:dev

# Preview build (for stakeholder testing)
pnpm mobile:eas:build:preview

# Production build
pnpm mobile:eas:build:prod
```

---

## API Setup

The NestJS API uses Prisma as its ORM against the Supabase Postgres database.

### Generate the Prisma client

This must be done after install and whenever `apps/api/prisma/schema.prisma` changes:

```bash
pnpm --filter api db:generate
```

The `build` script in the API already runs `prisma generate` automatically.

### Run database migrations (Prisma)

```bash
# Create a new migration from schema changes
pnpm --filter api db:migrate

# Push schema changes without a migration file (dev only)
pnpm --filter api db:push
```

> **Important:** Supabase migrations (`supabase/migrations/`) are the source of truth for the live database schema. Prisma migrations (`apps/api/prisma/migrations/`) are for the NestJS ORM layer. Keep them in sync.

### Open Prisma Studio

```bash
pnpm --filter api db:studio
# → http://localhost:5555
```

---

## Troubleshooting

### `pnpm install` fails with peer dependency errors

Ensure you are using the exact pnpm version:

```bash
corepack prepare pnpm@9.12.0 --activate
pnpm install
```

### `supabase db push` fails with "relation does not exist"

Migrations are applied in filename order. If a migration references a table from a later migration, this error occurs. Check that migration filenames are correctly ordered.

### Expo throws "Unable to resolve module"

Shared packages haven't been built yet:

```bash
pnpm build:packages
```

Then restart the Metro bundler with `pnpm dev:mobile`.

### Metro starts but the app crashes on device

Clear the Expo cache:

```bash
pnpm --filter mobile start -- --clear
```

### `prisma generate` fails with "Can't reach database server"

`DATABASE_URL` in `apps/api/.env` is not set correctly, or Supabase (local or cloud) is not reachable.

For local Supabase, confirm it is running with `supabase status`.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY` shows as undefined in browser

The variable name must start with `NEXT_PUBLIC_` and the Next.js dev server must be restarted after changing `.env.local`.

### Corepack fails with signature validation error

```bash
nvm use 20
npm install -g corepack
corepack prepare pnpm@9.12.0 --activate
```

### Windows: Metro symlink errors

Run everything inside WSL2. Do not use Windows native Node.js with Expo.

### TypeScript errors after pulling new code

Rebuild packages to pick up new type definitions:

```bash
pnpm build:packages
```
