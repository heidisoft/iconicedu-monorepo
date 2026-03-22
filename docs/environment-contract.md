# Environment Contract

Canonical environment contract for `web`, `api`, `mobile`, Supabase Edge Functions, and CI/CD.

## Source Of Truth

- Contract file: `config/environment-contract.json`
- Example file generator: `pnpm env:generate`
- Target validator: `pnpm env:validate:<target>`

The generated example files are:

- `apps/web/.env.local.example`
- `apps/mobile/.env.example`
- `apps/api/.env.example`

Update the contract first, then regenerate examples. Do not edit the example files by hand.

## Promotion Path

`local -> preview -> staging -> production`

- `local`: local Supabase CLI stack, local web/api, Expo dev client.
- `preview`: Vercel preview, preview API deploy, Supabase branch per PR, branch-scoped env.
- `staging`: long-lived hosted non-prod environment with synthetic data and scheduled jobs.
- `production`: isolated live environment with production-only secrets and no synthetic seeds.

## Shared Metadata Contract

These variables bind Vercel, Railway, Supabase, and EAS to the same environment identity:

- `ICONIC_ENV_NAME`
- `ICONIC_ENV_TIER`
- `ICONIC_PREVIEW_BRANCH`
- `ICONIC_PREVIEW_REF`
- `SUPABASE_PROJECT_REF`

Every preview, staging, and production deployment should set them consistently.

## Validation Targets

- `pnpm env:validate:local-web`
- `pnpm env:validate:local-api`
- `pnpm env:validate:local-mobile`
- `pnpm env:validate:preview`
- `pnpm env:validate:staging`
- `pnpm env:validate:production`

Use these targets in local bootstrap, preview automation, and deployment pipelines.

## Service Rules

### Supabase

- Local development uses `supabase start`, `supabase db reset --yes`, and `supabase functions serve`.
- Preview uses hosted Supabase branches per PR.
- When Supabase GitHub integration is enabled, it owns preview branch lifecycle.
- Staging and production use isolated hosted environments.
- Required parity surfaces: Postgres, Auth, Storage, Realtime, RLS, seeds, Edge Functions.
- `supabase/seed.sql` is the single non-production seed artifact.
- Local seeding is automatic through `supabase db reset --yes`.
- Remote preview and staging imports must use the guarded seed commands:
  - `pnpm seed:preview`
  - `pnpm seed:staging`
- `pnpm seed:preview` assumes the repo workflow is attaching to an existing fresh preview branch.
- Do not let multiple systems own preview branch creation, migrations, or seed replay for the same
  PR.
- `seed.sql` is treated as a non-idempotent full-load import and must not be replayed into
  production or reused shared databases without reset/recreate semantics.

### PostHog

- Web, API, and mobile must use environment-specific PostHog projects.
- Local and non-prod traffic must never write to production analytics.
- Feature flags should be evaluated against environment-specific PostHog config.

### Daily

- Use sandbox credentials outside production.
- Non-prod webhooks must point to preview or staging URLs only.
- Production uses separate credentials and webhook signing secret.

### Expo / EAS

- Local mobile development uses the Expo dev client with non-prod Supabase and PostHog.
- Preview and staging use EAS preview builds with non-prod credentials.
- Production uses EAS production builds with production credentials.

### Background Jobs

- Local jobs are invoked manually with local Supabase and seed packs.
- Hosted environments must set dispatch URLs and tokens per environment.
- Production schedules must never point at non-prod services.
