# Environments Runbook

Operator-facing guide for creating and operating the `local`, `preview`, and `staging`
environments for IconicEdu.

Use this document when you need to stand up or rotate the full environment stack across:

- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions, and seeding
- Vercel: web deployment
- Railway: API deployment
- Expo / EAS: mobile builds
- PostHog: analytics and feature flags
- Daily: live-session provider
- internal dispatch tokens and background job routes

Supporting documents:

- [Environment Contract](./environment-contract.md)
- [Local Setup](./setup.md)
- [Deployment Guide](./deployment.md)

## 1. Environment Model

The standard promotion path is:

`local -> preview -> staging -> production`

- `local`: developer machine using local Supabase CLI stack plus sandbox vendor credentials.
- `preview`: per-PR non-production environment with a fresh Supabase preview branch.
- `staging`: long-lived hosted non-production environment with explicit reseed flow.
- `production`: isolated live environment, not covered by this runbook.

Use the repo contract in `config/environment-contract.json` as the source of truth for environment
names, secrets, and validation targets.

## 2. Operator Prerequisites

Before creating any environment, ensure you have:

1. GitHub repository admin or workflow secret access.
2. Supabase organization access with permission to create projects or preview branches.
3. Vercel access for the web project.
4. Railway access for the API project.
5. Expo/EAS access for mobile builds.
6. PostHog admin access for non-production analytics projects.
7. Daily admin access for sandbox credentials and webhook configuration.
8. Local tooling installed:
   - Node.js `20.19.x`
   - `pnpm 9.12.0`
   - Supabase CLI
   - Docker Desktop
   - `eas-cli`
   - `psql`

Install and prepare tools:

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
brew install supabase/tap/supabase
npm install -g eas-cli
```

Then clone and install the repo:

```bash
git clone <repo-url> iconicedu-monorepo
cd iconicedu-monorepo
pnpm install
pnpm env:generate
```

## 3. Shared Environment Contract and Secret Naming

All environments should set the same metadata keys:

- `ICONIC_ENV_NAME`
- `ICONIC_ENV_TIER`
- `ICONIC_PREVIEW_BRANCH`
- `ICONIC_PREVIEW_REF`
- `SUPABASE_PROJECT_REF`

Validate config with:

```bash
pnpm env:validate:local-web
pnpm env:validate:local-api
pnpm env:validate:local-mobile
pnpm env:validate:preview
pnpm env:validate:staging
```

Generated examples:

- `apps/web/.env.local.example`
- `apps/mobile/.env.example`
- `apps/api/.env.example`

Do not edit generated example files by hand. Update the contract, then regenerate them with:

```bash
pnpm env:generate
```

## 4. Local Environment

### 4.1 Create local env files

1. Generate examples:

```bash
pnpm env:generate
```

2. Copy env files:

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

3. Fill local values:
   - Use `http://127.0.0.1:54321` or `http://localhost:54321` for local Supabase URLs.
   - Use keys from `supabase status`.
   - Use sandbox PostHog credentials.
   - Use sandbox Daily API key and webhook secret.
   - Set `EAS_PROJECT_ID` to your Expo project.

### 4.2 Start Supabase locally

1. Start the local stack:

```bash
supabase start
```

2. Reset and seed the local database:

```bash
supabase db reset --yes
```

This imports [`supabase/seed.sql`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/supabase/seed.sql)
automatically because [`supabase/config.toml`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/supabase/config.toml)
points `db.seed.sql_paths` at `./seed.sql`.

3. Serve local edge functions:

```bash
supabase functions serve
```

4. Inspect credentials if needed:

```bash
supabase status
```

### 4.3 Start app surfaces

1. Build shared packages:

```bash
pnpm build:packages
```

2. Start web:

```bash
pnpm dev:web
```

3. Start API:

```bash
pnpm dev:api
```

4. Start mobile:

```bash
pnpm dev:mobile
```

Mobile reads env through `app.config.js`, which bridges `EXPO_PUBLIC_*` values into
`Constants.expoConfig.extra`.

### 4.4 Local external dependencies

1. PostHog:
   - create or reuse a non-production project
   - set `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`
   - keep all local traffic out of production analytics
2. Daily:
   - use sandbox API key in `DAILY_API_KEY`
   - use sandbox webhook secret in `DAILY_WEBHOOK_SECRET`
   - point local webhooks only at local routes or skip webhook testing
3. Expo / EAS:
   - set `EAS_PROJECT_ID`
   - use development builds for native features and push-token testing
4. Background jobs:
   - set local `INTERNAL_REMINDERS_TOKEN`, `INTERNAL_NOTIFICATIONS_TOKEN`,
     `INTERNAL_ACTIVITY_FEED_TOKEN`, and API-side `INTERNAL_REMINDERS_TOKEN_API`

### 4.5 Local verification checklist

Run:

```bash
pnpm env:validate:local-web
pnpm env:validate:local-api
pnpm env:validate:local-mobile
```

Confirm:

1. web loads on `http://localhost:3000`
2. api loads on `http://localhost:3001` and Swagger opens at `/docs`
3. mobile starts and reads env through `app.config.js`
4. Supabase Studio loads on `http://localhost:54323`
5. seeded data exists after `supabase db reset --yes`
6. auth, storage, and realtime work against local Supabase

## 5. Preview Environment

Preview is an operator-managed non-production environment created per PR.

### 5.1 Attach to the Supabase preview branch

If Supabase GitHub integration is enabled, it is the only owner of preview branch lifecycle. Do
not create a second preview branch in repo automation for the same PR.

1. Link the parent Supabase project if needed:

```bash
supabase link --project-ref <parent-project-ref>
```

2. Open the Supabase dashboard or PR integration output and record:
   - preview branch name
   - preview project ref if exposed by your setup
   - preview database URL
   - preview public API URL

3. Confirm the branch is fresh before seeding. Preview seeding assumes a fresh branch because
   `seed.sql` is non-idempotent.

### 5.2 Provision preview workflow secrets

Configure the reusable GitHub workflow
[`preview-branch-provision.yml`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/.github/workflows/preview-branch-provision.yml)
with:

- `PREVIEW_DATABASE_URL`
- `PREVIEW_SUPABASE_PROJECT_REF`
- `PREVIEW_SUPABASE_URL`
- `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`
- `PREVIEW_JWT_SECRET`
- `PREVIEW_NEXT_PUBLIC_SUPABASE_URL`
- `PREVIEW_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PREVIEW_EXPO_PUBLIC_SUPABASE_URL`
- `PREVIEW_EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `PREVIEW_NEXT_PUBLIC_POSTHOG_KEY`
- `PREVIEW_NEXT_PUBLIC_POSTHOG_HOST`
- `PREVIEW_POSTHOG_KEY`
- `PREVIEW_POSTHOG_HOST`
- `PREVIEW_EXPO_PUBLIC_POSTHOG_KEY`
- `PREVIEW_EXPO_PUBLIC_POSTHOG_HOST`
- `PREVIEW_INTERNAL_REMINDERS_TOKEN`
- `PREVIEW_INTERNAL_NOTIFICATIONS_TOKEN`
- `PREVIEW_INTERNAL_ACTIVITY_FEED_TOKEN`
- `PREVIEW_INTERNAL_REMINDERS_TOKEN_API`

### 5.3 Run preview migration and seed flow

The expected order is:

1. Supabase GitHub integration creates the fresh preview branch
2. this repo workflow attaches to that branch
3. apply migrations once
4. seed that branch once
5. Vercel, Railway, and EAS consume the same preview metadata

The workflow already encodes the migrate-and-seed order. Manual equivalent:

```bash
pnpm env:validate:preview
supabase db push --db-url "$DATABASE_URL" --include-all --yes
pnpm seed:preview
```

Do not replay `pnpm seed:preview` into a reused preview branch without resetting or recreating that
branch first.

Do not let a second system apply the same migration or seed step. Recommended ownership:

1. Supabase GitHub integration: branch creation and teardown
2. repo workflow: `pnpm env:validate:preview`, `supabase db push`, `pnpm seed:preview`
3. Vercel GitHub integration: web preview deployment

### 5.4 Configure preview web, API, mobile, and vendors

1. Vercel:
   - create preview environment vars for the web app
   - point web at preview Supabase URL and preview PostHog project
2. Railway:
   - create preview service or preview env set for API
   - use preview Supabase DB URL and service role key
3. Expo / EAS:
   - use preview profile in `apps/mobile/eas.json`
   - supply preview `EXPO_PUBLIC_*` secrets in EAS dashboard if needed
4. PostHog:
   - use preview-specific project or shared non-prod preview bucket/project
   - do not send preview traffic to production
5. Daily:
   - use sandbox credentials
   - point webhook target only at preview web/API URLs

### 5.5 Preview verification checklist

Confirm:

1. Supabase creates exactly one preview branch for the PR
2. preview branch workflow completes successfully
3. preview database URL and branch metadata match the PR identity
4. preview DB contains seeded orgs/accounts/profiles/messages
5. preview web loads seeded data
6. preview API can query Supabase
7. `pnpm env:validate:preview` passes inside the workflow environment
8. PostHog preview traffic lands in preview/non-prod analytics only
9. Daily webhook points to preview, not staging or production
10. migrations run once and `pnpm seed:preview` runs once

### 5.6 GitHub Integration Compatibility

The recommended ownership split is:

1. Vercel GitHub integration owns web preview deployments.
2. Supabase GitHub integration owns preview branch creation, naming, and teardown.
3. GitHub Actions in this repo own preview validation, migrations, guarded seeding, and
   cross-service coordination.

Rules:

1. Duplicate preview branch creation is not allowed.
2. Duplicate preview seeding is not allowed.
3. Duplicate migration application should be avoided.
4. For each PR, identify which system owns branch creation, migration, seeding, deployment, and
   teardown.

## 6. Staging Environment

Staging is a long-lived hosted non-production environment with a separate reseed flow.

### 6.1 Create staging infrastructure

1. Create a dedicated staging Supabase project or persistent branch.
2. Create a staging Vercel project or assign a staging domain/environment.
3. Create a staging Railway service using
   [`apps/api/Dockerfile`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/apps/api/Dockerfile).
4. Configure Expo/EAS preview distribution for staging mobile builds.
5. Create a dedicated staging PostHog project or equivalent non-prod analytics partition.
6. Configure Daily sandbox credentials and a staging-only webhook target.
7. Configure staging dispatch URLs and internal tokens.

### 6.2 Set staging secrets

Configure the GitHub workflow
[`staging-reseed.yml`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/.github/workflows/staging-reseed.yml)
with:

- `STAGING_SUPABASE_PROJECT_REF`
- `STAGING_DATABASE_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_JWT_SECRET`
- `STAGING_NEXT_PUBLIC_SUPABASE_URL`
- `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STAGING_EXPO_PUBLIC_SUPABASE_URL`
- `STAGING_EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `STAGING_NEXT_PUBLIC_POSTHOG_KEY`
- `STAGING_NEXT_PUBLIC_POSTHOG_HOST`
- `STAGING_POSTHOG_KEY`
- `STAGING_POSTHOG_HOST`
- `STAGING_EXPO_PUBLIC_POSTHOG_KEY`
- `STAGING_EXPO_PUBLIC_POSTHOG_HOST`
- `STAGING_INTERNAL_REMINDERS_TOKEN`
- `STAGING_INTERNAL_NOTIFICATIONS_TOKEN`
- `STAGING_INTERNAL_ACTIVITY_FEED_TOKEN`
- `STAGING_INTERNAL_REMINDERS_TOKEN_API`
- `STAGING_DAILY_API_KEY`
- `STAGING_DAILY_WEBHOOK_SECRET`
- `STAGING_REMINDERS_DISPATCH_URL`
- `STAGING_NOTIFICATIONS_DISPATCH_URL`

### 6.3 Staging deploy-only procedure

Use this for normal staging app promotion without reseeding:

1. update staging env vars if required
2. run:

```bash
pnpm env:validate:staging
supabase db push --db-url "$DATABASE_URL" --include-all --yes
```

3. redeploy web, API, and staging mobile artifacts

Do not run `pnpm seed:staging` as part of normal deploy-only promotion.

### 6.4 Staging reseed procedure

Use this only when you intentionally want to rebuild staging data from `seed.sql`.

1. reset or recreate the staging database/branch
2. replay migrations
3. run:

```bash
pnpm seed:staging
```

The command requires destructive confirmation semantics because `seed.sql` is treated as a
non-idempotent full-load import.

Use the scheduled/manual workflow in
[`staging-reseed.yml`](/Users/hwanigasooriya/Workspace/hobby/iconicedu-monorepo/.github/workflows/staging-reseed.yml)
for this path.

### 6.5 Staging verification checklist

Confirm:

1. `pnpm env:validate:staging` passes
2. staging web and API point to staging Supabase only
3. staging seeded login/account/channel flows work after reseed
4. reminders and notifications dispatch routes use staging tokens and URLs
5. PostHog events land in staging analytics only
6. Daily webhooks reach staging only
7. mobile preview/staging builds use staging `EXPO_PUBLIC_*` vars

## 7. External Dependency Setup by Vendor

### 7.1 Supabase

1. Local:
   - use `supabase start`
   - use `supabase db reset --yes`
   - use `supabase functions serve`
2. Preview:
   - let Supabase GitHub integration create the fresh branch per PR
   - attach repo workflow to that branch
   - migrate with `supabase db push`
   - seed once with `pnpm seed:preview`
3. Staging:
   - maintain long-lived project or branch
   - use deploy-only for routine promotion
   - use `pnpm seed:staging` only after reset/recreate
4. Edge Functions:
   - deploy and schedule environment-specific functions
   - never point production schedules to non-prod routes

### 7.2 PostHog

1. Create at least:
   - one non-production project for local/preview
   - one staging project
   - one production project
2. Map vars:
   - web: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
   - api: `POSTHOG_KEY`, `POSTHOG_HOST`
   - mobile: `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`
3. Keep preview and staging traffic out of production analytics and flags.

### 7.3 Daily

1. Use sandbox credentials outside production.
2. Set:
   - `DAILY_API_KEY`
   - `DAILY_WEBHOOK_SECRET`
   - optional `DAILY_REST_BASE_URL`
3. Point webhook URLs:
   - preview -> preview URL only
   - staging -> staging URL only
   - never cross-wire to production

### 7.4 Expo / EAS

1. Use profiles already defined in `apps/mobile/eas.json`:
   - `development`
   - `preview`
   - `production`
2. Keep committed values empty or placeholder-safe.
3. Put actual secrets in EAS dashboard or environment-specific build configuration.
4. `app.config.js` bridges env values into `Constants.expoConfig.extra` at runtime.

### 7.5 Vercel and Railway

1. Vercel:
   - web preview and staging should each point at their correct Supabase and PostHog env
   - redeploy after env changes
2. Railway:
   - API staging and preview should use the correct `DATABASE_URL`, `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`
   - redeploy after env changes
3. After any env change on either platform, rerun the relevant validator and redeploy.

## 8. Rotation, Reseed, and Teardown

### 8.1 Secret rotation

1. Rotate one environment at a time.
2. Update GitHub, Vercel, Railway, EAS, Supabase function secrets, PostHog, and Daily in lockstep.
3. Re-run `pnpm env:validate:<target>`.
4. Redeploy affected surfaces.

### 8.2 Reseed policy

1. Local: reseed freely with `supabase db reset --yes`.
2. Preview: reseed only by recreating/resetting the preview branch, then rerun `pnpm seed:preview`.
3. Staging: reseed only through explicit reset/recreate flow, then `pnpm seed:staging`.
4. Production: never import `seed.sql`.

### 8.3 Teardown

1. Preview:
   - delete Supabase preview branch
   - remove PR-specific Vercel/Railway references if created
   - remove temporary preview webhooks and secrets if they were unique to that PR
2. Staging:
   - usually kept long-lived
   - if replaced, rotate secrets and reconfigure all external integrations before reuse

## 9. Final Checklists

### Local

- `supabase start`
- `supabase db reset --yes`
- `supabase functions serve`
- `pnpm build:packages`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:mobile`
- env validators all pass

### Preview

- Supabase creates one fresh preview branch
- preview workflow secrets configured
- migrations applied
- `pnpm seed:preview` run once on fresh branch
- Vercel, Railway, EAS, PostHog, and Daily all point to preview

### Staging

- staging secrets configured
- deploy-only and reseed procedures clearly separated
- `pnpm seed:staging` used only after reset/recreate
- staging analytics, webhooks, and dispatch URLs are isolated from production
