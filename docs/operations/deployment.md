# Deployment Guide

## Purpose

Canonical deployment guide for web, mobile, API, and database delivery.

## Intended Audience

Internal engineers and operators responsible for shipping or validating production changes.

## Last Updated

2026-08-14

## Related Docs

- [Documentation Hub](../README.md)
- [Development Workflow](../getting-started/development-workflow.md)
- [Reminders Runbook](reminders.md)

How to deploy each app in the IconicEdu monorepo to production.

---

## Table of Contents

- [Web — Vercel](#web--vercel)
- [Mobile — EAS Build and Submit](#mobile--eas-build-and-submit)
- [API — NestJS](#api--nestjs)
- [Database — Supabase](#database--supabase)
- [Environment Variables Reference](#environment-variables-reference)

---

## Web — Vercel

The Next.js web app is designed to deploy on [Vercel](https://vercel.com). It uses the App Router and Supabase SSR, both of which work natively on Vercel's edge/serverless runtime.

### First-time setup

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Set the **Root directory** to `apps/web`
4. Set the **Framework preset** to `Next.js`
5. Add environment variables (see below)
6. Deploy

### Environment variables (Vercel dashboard)

| Variable                               | Source                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `API_URL` / `NEXT_PUBLIC_API_URL`      | Railway API origin                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project API settings                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project API settings                                            |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Cloudflare Turnstile widget (optional; see [turnstile.md](turnstile.md)) |

### Deploying

Every push to `main` triggers an automatic production deployment. PRs get preview deployments automatically.

Vercel uses Node `24.x` from the root `package.json`. Its pnpm 10 auto-detection may select a different compatible patch release than the `packageManager` version pinned for local development and CI; the root `engines.pnpm` range permits supported pnpm 10 releases for this reason.

To deploy manually:

```bash
# From repo root
pnpm --filter web build   # verify locally first
# then push to main or use Vercel CLI:
vercel --prod
```

### Custom domain

Set up in Vercel dashboard → Project → Settings → Domains.

---

## Mobile — EAS Build and Submit

The Expo mobile app is built and distributed via [EAS (Expo Application Services)](https://expo.dev/eas).

### Prerequisites

```bash
pnpm add --global eas-cli
eas login
```

### Build profiles

Three profiles are configured in `apps/mobile/eas.json`:

| Profile       | Use for                        | Distribution                           |
| ------------- | ------------------------------ | -------------------------------------- |
| `development` | Local testing with dev client  | Internal                               |
| `preview`     | Stakeholder testing            | Internal (TestFlight / internal track) |
| `production`  | App Store / Play Store release | Store                                  |

### Development build

A development build includes the Expo dev client, which lets you run the app with `expo start` against a physical device — unlike Expo Go, it supports custom native modules.

```bash
pnpm mobile:eas:build:dev
```

Install the resulting build on your device, then start the dev server:

```bash
pnpm dev:mobile
```

### Preview build

For stakeholder testing or QA. Distributed via TestFlight (iOS) or an internal Google Play track.

```bash
pnpm mobile:eas:build:preview
```

### Production build

```bash
# Both platforms
pnpm mobile:eas:build:prod

# iOS only
pnpm --filter mobile eas:build:ios

# Android only
pnpm --filter mobile eas:build:android
```

### Submit to stores

```bash
# Submit both
pnpm mobile:eas:submit

# iOS to App Store Connect
pnpm --filter mobile eas:submit:ios

# Android to Play Store
pnpm --filter mobile eas:submit:android
```

### OTA updates (EAS Update)

For JavaScript-only changes (no native code changes), you can push an over-the-air update without a full store release:

```bash
pnpm --filter mobile eas:update
```

### Environment variables in EAS

Mobile env vars (`EXPO_PUBLIC_*`) are set in `apps/mobile/eas.json` under the `env` key per profile, or in the EAS dashboard:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "your-publishable-key",
        "EXPO_PUBLIC_TURNSTILE_SITE_KEY": "your-turnstile-site-key"
      }
    }
  }
}
```

Do not commit actual values — use EAS Secrets for production credentials.

---

## API — NestJS

The NestJS API is a standard Node.js HTTP server and can be deployed to any platform that runs Docker or Node.js.

### Build

```bash
pnpm --filter api build
# Output: apps/api/dist/
```

### Run in production

```bash
pnpm --filter api start:prod
```

The current production host is Railway. Repository CI configures the Railway service and environment; do not introduce an alternate deployment path without documenting ownership, health checks, migrations, and rollback.

### Environment variables

| Variable                    | Description                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Supabase Postgres connection string (pooled)                                                                                                                                                          |
| `DIRECT_URL`                | Non-pooled URL for Prisma schema tooling                                                                                                                                                              |
| `SUPABASE_URL`              | Supabase project URL                                                                                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS)                                                                                                                                                                       |
| `SUPABASE_JWT_SECRET`       | From Supabase → Settings → API → JWT Settings                                                                                                                                                         |
| `INTERNAL_EVENTS_TOKEN`     | Shared secret for unified event dispatcher                                                                                                                                                            |
| `INTERNAL_REMINDERS_TOKEN`  | Shared secret for reminder dispatcher                                                                                                                                                                 |
| `EXPO_ACCESS_TOKEN`         | Expo push API token                                                                                                                                                                                   |
| `DAILY_API_KEY`             | Daily.co API key; required to create Daily live-session rooms. Optional — without it, joining a Daily-provider channel fails with "Daily is not configured" instead of the whole API failing to start |
| `DAILY_REST_BASE_URL`       | Daily.co REST API base URL. Optional — defaults to `https://api.daily.co/v1`                                                                                                                          |
| `DAILY_WEBHOOK_SECRET`      | Verifies incoming Daily webhook signatures. Optional — verification is skipped when unset                                                                                                             |
| `PORT`                      | HTTP port (default `3001`)                                                                                                                                                                            |

Prisma does not own production migrations. Generate the client during the build, apply the forward-only files in `supabase/migrations`, then start the API. Never run `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push` against a repository environment.

---

## Database — Supabase

The database is fully managed by Supabase. Schema changes are applied via migration files in `supabase/migrations/`.

### Edge Functions And Cron

Preview CI now deploys the required Supabase Edge Functions and sets branch-local secrets after the Railway API preview URL is known. The unified activity/notification path is:

- `events-dispatch` Edge Function
- `EVENTS_DISPATCH_URL=https://<api-domain>/internal/events/dispatch`
- `INTERNAL_EVENTS_TOKEN=<same value in apps/api and Supabase Edge Functions>`

When a preview branch is new or `supabase/**` changes, preview CI applies
migrations, sets branch-local Edge Function secrets, deploys functions, deletes
deprecated remote functions, runs `public.configure_edge_function_cron(...)`,
and verifies the active cron set. Application-only pushes reuse the existing
preview schema and run preview provisioning alongside the application build.
Production configuration runs automatically after a PR is merged to `main`, waits
for the GitHub `production` Environment approval, then uses
`ops/env/production.env.json` and GitHub Actions secrets to configure Railway,
Vercel, Supabase Edge Function secrets, Edge Functions, migrations, remote
function cleanup, and cron.
Configure required reviewers on the GitHub `production` Environment; otherwise
GitHub will not pause the job for approval.

Manual fallback for operators:

```bash
supabase secrets set \
  SUPABASE_URL=https://<project-ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  EVENTS_DISPATCH_URL=https://<api-domain>/internal/events/dispatch \
  INTERNAL_EVENTS_TOKEN=<long-random-secret> \
  REMINDERS_DISPATCH_URL=https://<api-domain>/internal/reminders/dispatch \
  INTERNAL_REMINDERS_TOKEN=<long-random-secret>

supabase functions deploy --use-api --jobs 4
```

Production GitHub Actions secrets:

| Where               | Variable / value                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform access     | `RAILWAY_API_TOKEN`                                                | Lets CI configure Railway production                                                                                                                                                                                                                                                                                                                                              |
| Production variable | `RAILWAY_PROJECT_ID`                                               | Railway project containing the production API service                                                                                                                                                                                                                                                                                                                             |
| Production variable | `RAILWAY_SERVICE_ID`                                               | Railway API service ID                                                                                                                                                                                                                                                                                                                                                            |
| Platform access     | `VERCEL_TOKEN`                                                     | Lets CI configure Vercel production env                                                                                                                                                                                                                                                                                                                                           |
| Production variable | `VERCEL_PROJECT_ID`                                                | Vercel project ID                                                                                                                                                                                                                                                                                                                                                                 |
| Production variable | `VERCEL_ORG_ID`                                                    | Vercel team/user ID                                                                                                                                                                                                                                                                                                                                                               |
| Platform access     | `SUPABASE_ACCESS_TOKEN`                                            | Lets CI deploy functions and set secrets                                                                                                                                                                                                                                                                                                                                          |
| Production variable | `SUPABASE_PROJECT_ID`                                              | Production Supabase project ref                                                                                                                                                                                                                                                                                                                                                   |
| Platform access     | `SUPABASE_DB_PASSWORD`                                             | Lets CI derive production DB connection strings                                                                                                                                                                                                                                                                                                                                   |
| Derived by CI       | `DATABASE_URL` / `DIRECT_URL`                                      | Derived from Supabase project metadata and DB password                                                                                                                                                                                                                                                                                                                            |
| Production variable | `API_URL`                                                          | Public production API origin; CI can derive it from Railway if omitted                                                                                                                                                                                                                                                                                                            |
| Derived by CI       | `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Derived from `SUPABASE_PROJECT_ID` via the Supabase API                                                                                                                                                                                                                                                                                                                           |
| Production values   | `SUPABASE_JWT_SECRET`                                              | Supabase JWT secret if the Supabase API cannot derive it                                                                                                                                                                                                                                                                                                                          |
| Production values   | `INTERNAL_EVENTS_TOKEN`                                            | Long random secret for unified event dispatch                                                                                                                                                                                                                                                                                                                                     |
| Production values   | `INTERNAL_REMINDERS_TOKEN`                                         | Long random secret for reminder dispatch                                                                                                                                                                                                                                                                                                                                          |
| Production values   | `EXPO_ACCESS_TOKEN` or `EXPO_TOKEN`                                | Required for authenticated Expo push sends                                                                                                                                                                                                                                                                                                                                        |
| Optional telemetry  | `POSTHOG_KEY`                                                      | Optional PostHog key                                                                                                                                                                                                                                                                                                                                                              |
| Optional telemetry  | `POSTHOG_HOST`                                                     | Optional PostHog host                                                                                                                                                                                                                                                                                                                                                             |
| Optional AI assist  | `AI_PROVIDER_KEY_ENCRYPTION_KEY`                                   | Encrypts each org's AI provider API key at rest (issue #264: refine + suggested replies). Each org now configures its own provider/key/model from the admin "Organization Settings" page — there is no global provider key; omit to leave AI assist unconfigurable and returning 503 for every org. Generate with `openssl rand -base64 32`; must match on apps/web and apps/api. |

The Vercel user that created `VERCEL_TOKEN` must connect its GitHub account under
**Vercel Account Settings → Authentication**. Vercel rejects branch-scoped preview
environment variables with `no_github_account_connected` until that connection exists;
CI reports this as a warning and does not redeploy the preview with stale variables.

Optional CI cache configuration:

| Where               | Variable / value | Notes                                            |
| ------------------- | ---------------- | ------------------------------------------------ |
| Repository secret   | `TURBO_TOKEN`    | Authenticates an optional Turborepo remote cache |
| Repository variable | `TURBO_TEAM`     | Team slug associated with the remote cache       |

Without these optional values, CI still shares `.turbo` build outputs through
the GitHub Actions cache. Do not reuse an unrelated platform token or guess the
team slug.

When a PR introduces a new production env var, add it to
`ops/env/production.env.json` and add the matching GitHub Actions secret or
variable before merge. The production job fails before mutating anything if a
required manifest value is missing.

After functions are deployed and migrations are applied, configure pg_cron with the Supabase project URL:

```sql
select public.configure_edge_function_cron('https://<project-ref>.supabase.co');
```

Required production checks:

- `apps/api` and Supabase Edge Functions use the same `INTERNAL_EVENTS_TOKEN`.
- `apps/api` and Supabase Edge Functions use the same `INTERNAL_REMINDERS_TOKEN`.
- `events-dispatch` is deployed with `verify_jwt=false`.
- `cron.job` includes `edge-function-events-dispatch`, `edge-function-reminders-dispatch`, and `edge-function-channel-read-state-repair`.
- `cron.job` does not include deprecated `edge-function-notifications-dispatch`, `edge-function-reminders-reconcile-dispatch`, `edge-function-activity-worker-dispatch`, or `edge-function-activity-projector-dispatch`.
- `EXPO_ACCESS_TOKEN` is set in `apps/api` if push delivery should use Expo authenticated sends.
- iOS release builds are signed with the production APNs entitlement, and a real-device notification delivery test succeeds after TestFlight/App Store signing.
- Android 13+ real-device testing confirms the runtime `POST_NOTIFICATIONS` prompt appears after the in-app soft consent, while Android 12 and older register only after in-app consent.

`supabase functions deploy` accepts an optional function name. Omitting the name
deploys all local functions. CI does not use `--prune`; it explicitly deletes
only the known deprecated functions after deployment:
`notifications-dispatch`, `reminders-reconcile-dispatch`,
`activity-worker-dispatch`, and `activity-projector-dispatch`.

### Applying migrations to production

```bash
# Link to the production project (one-time)
supabase link --project-ref <production-project-ref>

# Push pending migrations
supabase db push --include-all
```

`--include-all` is required because migration versions are immutable and the repository
contains historical migrations whose timestamp sorts before migrations already recorded by
hosted environments. Review the pending migration list in the command output before
confirming a manual production push.

For newly created preview branches, hosted migration history can briefly lag behind the
branch status. CI retries only the resulting duplicate `schema_migrations_pkey` error; all
SQL errors and unrelated push failures remain fatal. Never delete or repair migration-history
rows to work around this provisioning race.

Always test migrations locally first:

```bash
supabase db reset   # wipe + reapply all migrations locally
```

Public-schema access must remain fail-closed:

- Public and unauthenticated product flows go through `apps/api`; `anon` has no direct table
  or sequence privileges in `public`.
- New tables enable RLS in the same migration and receive only explicit per-object grants
  needed by a reviewed caller.
- Do not restore default table or sequence privileges for `anon` or `authenticated`.
- Public views use `security_invoker = true`; materialized views stay outside `public`.
- Run `pnpm guard:supabase-access-control` before pushing migration changes. An exceptional
  anonymous grant or policy requires the review annotation described by the guard output.

### Branching (preview environments)

Supabase supports database branching for preview deployments. Each Vercel preview can have its own Supabase branch. See [Supabase Branching docs](https://supabase.com/docs/guides/platform/branching) for setup.

### Backups

Confirm the production project's current backup and point-in-time recovery configuration in Supabase before a risky migration. A migration plan must not assume that a backup exists merely because the project is hosted.

---

## Environment Variables Reference

| Variable                               | Web                                                     | Mobile | API | Notes                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------- | ------ | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | ✅                                                      | —      | —   | Public, browser-safe                                                                                                                                                                                                                                                                                                                                                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅                                                      | —      | —   | Public, browser-safe                                                                                                                                                                                                                                                                                                                                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`            | —                                                       | —      | ✅  | API-only privileged credential                                                                                                                                                                                                                                                                                                                                                                                    |
| `EXPO_PUBLIC_SUPABASE_URL`             | —                                                       | ✅     | —   | Inlined at build time                                                                                                                                                                                                                                                                                                                                                                                             |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | —                                                       | ✅     | —   | Inlined at build time                                                                                                                                                                                                                                                                                                                                                                                             |
| `DATABASE_URL`                         | —                                                       | —      | ✅  | Pooled Postgres URL                                                                                                                                                                                                                                                                                                                                                                                               |
| `DIRECT_URL`                           | —                                                       | —      | ✅  | Non-pooled schema tooling URL                                                                                                                                                                                                                                                                                                                                                                                     |
| `SUPABASE_URL`                         | —                                                       | —      | ✅  |                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `SUPABASE_JWT_SECRET`                  | —                                                       | —      | ✅  | From Supabase JWT settings                                                                                                                                                                                                                                                                                                                                                                                        |
| `INTERNAL_EVENTS_TOKEN`                | ✅ (server/admin tools)                                 | —      | ✅  | Match Supabase Edge Function secret                                                                                                                                                                                                                                                                                                                                                                               |
| `INTERNAL_REMINDERS_TOKEN`             | ✅ (server/admin tools)                                 | —      | ✅  | Match Supabase Edge Function secret                                                                                                                                                                                                                                                                                                                                                                               |
| `EXPO_ACCESS_TOKEN`                    | —                                                       | —      | ✅  | Expo push provider token                                                                                                                                                                                                                                                                                                                                                                                          |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | ✅                                                      | —      | —   | Public Cloudflare Turnstile site key; optional — no widget when unset. See [turnstile.md](turnstile.md)                                                                                                                                                                                                                                                                                                           |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY`       | —                                                       | ✅     | —   | Same key for mobile; inlined at build/OTA time. See [turnstile.md](turnstile.md)                                                                                                                                                                                                                                                                                                                                  |
| `AI_PROVIDER_KEY_ENCRYPTION_KEY`       | ✅                                                      | —      | ✅  | Encrypts each org's AI provider API key at rest; same value required on web and API. Optional — AI settings are just unconfigurable without it. `openssl rand -base64 32`                                                                                                                                                                                                                                         |
| `DAILY_API_KEY`                        | ✅ (existing, managed outside this manifest — see note) | —      | ✅  | Daily.co API key for live-session room creation. Optional — join requests for Daily-provider channels fail with "Daily is not configured" without it, rest of the API is unaffected. Web's copy is set directly in the Vercel dashboard rather than through `ops/env/production.env.json`'s `vercel` array or the CI preview payload                                                                              |
| `ZOOM_VIDEO_SDK_KEY`                   | ✅                                                      | —      | —   | Zoom Video SDK key (Zoom App Marketplace → "Video SDK" app, not Meeting SDK/OAuth). Optional — Zoom-provider live sessions fail to mint a join token without it. Only consumed by web today (`resolveLiveSessionJoinAccess` mints the join JWT server-side there); also listed in `apps/api/.env.example` for the planned unauthenticated guest-join endpoint, not yet wired into this manifest's `railway` array |
| `ZOOM_VIDEO_SDK_SECRET`                | ✅                                                      | —      | —   | Signs the Zoom Video SDK join JWT. Same scope notes as `ZOOM_VIDEO_SDK_KEY`                                                                                                                                                                                                                                                                                                                                       |
| `ZOOM_WEBHOOK_SECRET_TOKEN`            | ✅                                                      | —      | —   | Verifies/answers Zoom webhook requests (signature + the one-time `endpoint.url_validation` CRC challenge) at `app/api/webhooks/live-sessions/[provider]/route.ts`. Optional — signature verification is skipped when unset (local dev only, same as Daily's)                                                                                                                                                      |

## Adding A New Required Environment Variable

A new env var has more consumers than it looks like it does — missing one silently breaks the feature in exactly one environment (a past miss: an env var reached Railway PR previews but not Vercel PR previews, so saving settings 500'd only on preview, not locally or in production). Wire every consumer in the same change:

1. **Local dev**: add it to `apps/api/.env.example` and/or `apps/web/.env.local.example` (whichever app(s) read it), with a comment on where the real value comes from.
2. **Production**: add an entry to the relevant array(s) — `railway` (apps/api) and/or `vercel` (apps/web) — in [`ops/env/production.env.json`](../../ops/env/production.env.json). This is the only place production env resolution is defined; the CI job that deploys to production reads this manifest generically, so nothing else to touch there.
3. **PR previews**: unlike production, the two PR-preview steps in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) do **not** read the manifest — each hardcodes its own variable list and both need the addition separately:
   - The `Configure Railway PR environment` step building `VARS_JSON` (apps/api preview).
   - The `Configure Vercel preview env vars` step building `VERCEL_ENV_PAYLOAD` (apps/web preview).
4. **Secret vs. var**: if the value is sensitive (a key, token, or anything that shouldn't be readable by anyone with repo read access), add it as a GitHub **secret** (`secrets.<NAME>`), not a variable (`vars.<NAME>`) — Settings → Secrets and variables → Actions.
5. **This reference table**: add a row above with which app(s) read it and any setup notes (how to generate it, whether it's optional, what breaks without it).
6. Confirm required vs. optional deliberately — `"optional": true` in the manifest and an `if length > 0` guard in the CI payload mean CI won't fail without it, but say plainly in this table what silently doesn't work when it's missing.

Local edits only reach your own machine; step 1 alone is not enough for anyone else, preview, or production to have the variable.
