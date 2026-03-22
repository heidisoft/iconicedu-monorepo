# Development Guide

## Prerequisites

| Tool           | Version | Install                                                    |
| -------------- | ------- | ---------------------------------------------------------- |
| Node.js        | >= 20   | https://nodejs.org                                         |
| pnpm           | 9.12.0  | `npm install -g pnpm@9.12.0`                               |
| Supabase CLI   | latest  | `brew install supabase/tap/supabase`                       |
| Docker Desktop | latest  | https://www.docker.com/products/docker-desktop             |
| Railway CLI    | latest  | `npm install -g @railway/cli` (for preview env management) |
| EAS CLI        | latest  | `npm install -g eas-cli` (for mobile builds)               |

---

## Local Setup (one-time)

```bash
# From the repo root:
./scripts/setup-local.sh

# Or with auto-fill of Supabase env vars:
./scripts/setup-local.sh --fill
```

The script:

1. Verifies prerequisites
2. Copies `.env.*.example` files (non-destructive)
3. Runs `pnpm install`
4. Starts the local Supabase stack
5. Prints all connection details

After running, fill in the remaining env vars that need manual values:

**`apps/api/.env`**

```
INTERNAL_REMINDERS_TOKEN_API=<generate with: openssl rand -hex 32>
POSTHOG_KEY=<from PostHog dashboard>
```

**`apps/web/.env.local`**

```
DAILY_API_KEY=<from daily.co dashboard>
DAILY_REST_BASE_URL=<from daily.co docs>
DAILY_WEBHOOK_SECRET=<from daily.co webhook config>
INTERNAL_REMINDERS_TOKEN=<same value as INTERNAL_REMINDERS_TOKEN_API>
INTERNAL_ACTIVITY_FEED_TOKEN=<generate with: openssl rand -hex 32>
NEXT_PUBLIC_POSTHOG_KEY=<from PostHog dashboard>
NEXT_PUBLIC_POSTHOG_HOST=https://t.iconicedu.lk
```

**`apps/mobile/.env`**

```
EXPO_PUBLIC_POSTHOG_KEY=<from PostHog dashboard>
EXPO_PUBLIC_POSTHOG_HOST=https://t.iconicedu.lk
```

---

## Running the Apps

```bash
pnpm dev           # All three apps in parallel
pnpm dev:api       # NestJS API only (port 3000)
pnpm dev:web       # Next.js web only (port 3001 by default)
pnpm dev:mobile    # Expo mobile app
```

### Local Service URLs

| Service                  | URL                                    |
| ------------------------ | -------------------------------------- |
| Web app                  | http://localhost:3000                  |
| API                      | http://localhost:3000 (NestJS default) |
| Supabase Studio          | http://127.0.0.1:54323                 |
| Supabase API             | http://127.0.0.1:54321                 |
| Email testing (Inbucket) | http://127.0.0.1:54324                 |

### Seed Credentials

All seed accounts share the password **`Seed123!`**:

| Email                | Role     | Profile   |
| -------------------- | -------- | --------- |
| heshanmw@gmail.com   | Owner    | Marc F    |
| heshanmw+1@gmail.com | Guardian | Lura H    |
| heshanmw+3@gmail.com | Educator | Denise R  |
| heshanmw+4@gmail.com | Educator | Barbara Y |
| heshanmw+5@gmail.com | Staff    | Harold B  |
| heshanmw+6@gmail.com | Guardian | Jessica K |

### Resetting the Local Database

```bash
supabase db reset   # Drops, re-runs all migrations, re-seeds (auth users + data)
```

---

## Trunk-Based Development Workflow

This project uses **trunk-based development**. `main` is always deployable.

### Branch Naming

```
feature/<short-description>   # New features
fix/<issue-or-description>    # Bug fixes
chore/<task>                  # Maintenance, deps, tooling
```

### Workflow

1. Cut a short-lived branch from `main`
2. Make focused changes (aim to merge within 1-2 days)
3. Open a PR — preview environments are created automatically (see below)
4. CI must pass (`quality` → `test` → `build`)
5. Squash-merge to `main`

### Branch Protection Rules (configure in GitHub Settings > Branches)

- Pattern: `main`
- Require pull request before merging: **YES**
- Required status checks: `quality`, `test`, `build`
- Dismiss stale reviews on push: **YES**
- Restrict force pushes: **YES**

---

## Preview Environments

Every PR automatically gets a fully isolated preview stack:

| Service      | How                                                                                  |
| ------------ | ------------------------------------------------------------------------------------ |
| **Supabase** | Native database branch (Pro tier) — isolated DB with all migrations + seed data      |
| **API**      | Railway preview environment — NestJS API pointed at the Supabase branch              |
| **Web**      | Vercel preview deployment — Next.js app pointed at the Supabase branch + Railway API |
| **Mobile**   | EAS build triggered manually (see below)                                             |

### What happens when you open a PR

The `preview-env` GitHub Actions workflow runs and:

1. Creates a Supabase database branch named `pr-<number>`
2. Seeds it with `supabase/seed.sql` (includes auth users)
3. Deploys all edge functions to the branch (disabled — no cron triggers)
4. Creates a Railway environment `pr-<number>` and deploys the API wired to the Supabase branch
5. Sets branch-specific env vars on Vercel and triggers a redeploy
6. Posts a comment on the PR with all URLs and seed credentials

### PR comment format

```
## Preview Environment Ready
| Service         | URL                              |
|-----------------|----------------------------------|
| Web (Vercel)    | https://pr-42.your-domain.vercel.app |
| API (Railway)   | https://pr-42.railway.app/healthz |
| Supabase Studio | https://supabase.com/dashboard/project/<branch-ref> |

Seed credentials (password: Seed123! for all):
- heshanmw@gmail.com (Owner)
- heshanmw+1@gmail.com (Guardian)
...
```

### Cleanup

When the PR is closed or merged, the `preview-cleanup` workflow automatically:

- Deletes the Supabase branch
- Deletes the Railway environment
- Removes the branch-specific Vercel env vars

### Triggering a Mobile (EAS) Build for a PR

1. Go to GitHub → Actions → **EAS Preview Build**
2. Click **Run workflow**
3. Enter the PR number and select platform (ios / android / all)
4. The build is submitted to EAS and a comment is posted on the PR with the build link
5. Install the build on your device via the Expo Go / TestFlight / internal distribution link

---

## Database

```bash
pnpm --filter api db:generate   # Regenerate Prisma client (required after schema changes)
pnpm --filter api db:migrate    # Run pending migrations
pnpm --filter api db:studio     # Open Prisma Studio
supabase db reset               # Reset local DB (migrations + seed)
supabase studio                 # Open Supabase Studio (or go to http://127.0.0.1:54323)
```

### Adding a Migration

```bash
supabase migration new <description>
# Edit the generated file in supabase/migrations/
supabase db reset   # Apply locally to verify
```

---

## Testing

```bash
pnpm test              # All tests
pnpm test:web          # Web + ui-web (Vitest)
pnpm test:mobile       # Mobile + ui-native (Jest)
pnpm test:api          # API (Jest)
pnpm test:affected     # Only affected packages (fast, good for local dev)
pnpm test:staged       # Only staged files
pnpm --filter web test:e2e   # Playwright E2E (requires dev server running)
```

---

## Quality

```bash
pnpm lint              # Lint all packages
pnpm lint:fix          # Lint + auto-fix
pnpm typecheck         # TypeScript check all
pnpm format            # Format all files (Prettier)
pnpm format:check      # Check formatting without writing
pnpm ci                # Full pipeline: format check → lint → typecheck → test → build
```

---

## GitHub Secrets Required

Set these in GitHub → Settings → Secrets and variables → Actions before preview environments work:

| Secret                         | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`        | Supabase CLI auth for branch management                |
| `SUPABASE_PROJECT_ID`          | Production Supabase project ref                        |
| `SUPABASE_DB_PASSWORD`         | DB password for constructing branch connection strings |
| `RAILWAY_API_TOKEN`            | Railway CLI auth                                       |
| `RAILWAY_PROJECT_ID`           | Railway project identifier                             |
| `RAILWAY_SERVICE_ID`           | Railway API service identifier                         |
| `EXPO_TOKEN`                   | EAS CLI auth for triggering builds                     |
| `VERCEL_TOKEN`                 | Vercel API token for setting branch env vars           |
| `VERCEL_ORG_ID`                | From `.vercel/project.json` (run `vercel link` first)  |
| `VERCEL_PROJECT_ID`            | From `.vercel/project.json`                            |
| `NEXT_PUBLIC_POSTHOG_KEY`      | PostHog client key                                     |
| `NEXT_PUBLIC_POSTHOG_HOST`     | PostHog host                                           |
| `POSTHOG_KEY`                  | PostHog server key                                     |
| `DAILY_API_KEY`                | Daily.co API key                                       |
| `DAILY_REST_BASE_URL`          | Daily.co REST base URL                                 |
| `DAILY_WEBHOOK_SECRET`         | Daily.co webhook secret                                |
| `INTERNAL_REMINDERS_TOKEN`     | Shared secret for reminders dispatcher                 |
| `INTERNAL_NOTIFICATIONS_TOKEN` | Shared secret for notifications dispatcher             |
| `INTERNAL_ACTIVITY_FEED_TOKEN` | Shared secret for activity feed                        |

---

## Railway Setup (one-time)

1. Create a project at railway.app
2. Add a service: **New Service → GitHub Repo → iconicedu-monorepo**
   - Root directory: `apps/api`
   - Railway auto-detects `railway.toml` and uses Nixpacks
3. Set production environment variables (from `apps/api/.env.example`)
4. Copy `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID` to GitHub Secrets
5. Enable Environments: Project Settings → General → Environments

`main` auto-deploys to the Railway production environment on every merge.

---

## Vercel Setup (one-time)

```bash
# From apps/web:
cd apps/web && vercel link
```

Commit `.vercel/project.json` to the repo, then copy `orgId` and `projectId` to GitHub Secrets as `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

In the Vercel dashboard, set:

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Node.js: 20.x
