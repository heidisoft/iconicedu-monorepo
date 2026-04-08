# Development Workflow

## Purpose

This document is the canonical workflow guide for local development, testing, preview environments, and CI expectations.

## Intended Audience

Internal engineers working day to day in the monorepo.

## Last Updated

2026-04-01

## Related Docs

- [Documentation Hub](../README.md)
- [Local Setup](setup.md)
- [Contributing](../../CONTRIBUTING.md)
- [Deployment](../operations/deployment.md)

## Local Workflow

Run the full stack or individual applications from the repo root:

```bash
pnpm dev
pnpm dev:web
pnpm dev:mobile
pnpm dev:api
```

`pnpm dev:mobile` is the preferred mobile workflow because it preserves Expo's interactive terminal controls such as `i` for the iOS Simulator and `a` for the Android Emulator. `pnpm dev` also starts mobile with the same direct Expo path while keeping the rest of the stack running in parallel.

Shared packages should be built before first app startup or after structural package changes:

```bash
pnpm build:packages
```

## Local Service URLs

App URLs are stable:

| Service | URL                        |
| ------- | -------------------------- |
| Web app | http://localhost:3000      |
| API     | http://localhost:3001      |
| Swagger | http://localhost:3001/docs |

Supabase local service URLs should be read from the running stack instead of assumed from memory:

```bash
supabase status
```

Use that output to open the current local endpoints for:

- Supabase Studio
- Mailpit
- Supabase API
- Database

If you need machine-readable values for scripts or env syncing, use:

```bash
supabase status --output json
```

## Seed Credentials

Use these seeded test emails for local auth flows:

| Email                              | Role     | Profile   |
| ---------------------------------- | -------- | --------- |
| `iconicedudev@gmail.com`           | Owner    | Marc F    |
| `iconicedudev+guardian1@gmail.com` | Guardian | Lura H    |
| `iconicedudev+educator1@gmail.com` | Educator | Denise R  |
| `iconicedudev+educator2@gmail.com` | Educator | Barbara Y |
| `iconicedudev+staff1@gmail.com`    | Staff    | Harold B  |
| `iconicedudev+guardian2@gmail.com` | Guardian | Jessica K |

For local email OTP or magic-link login:

1. Run `supabase start` if the local stack is not already running.
2. Run `supabase status` and open the Mailpit URL from the output.
3. Start the app and enter one of the seeded test emails in the login flow.
4. Open the captured email in Mailpit.
5. Copy the OTP code or use the magic link from the email to complete sign-in.

If you are exercising password-based auth instead of OTP, the seeded password is `Seed123!`.

## Database Workflow

```bash
supabase db reset
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:studio
```

When adding a migration:

```bash
supabase migration new <description>
supabase db reset
```

## Testing and Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm run ci
```

Scoped checks:

```bash
pnpm run ci:web
pnpm run ci:mobile
pnpm run ci:api
pnpm test:affected
pnpm test:staged
pnpm --filter web test:e2e
```

## Trunk-Based Development

The repository uses trunk-based development. `main` should stay deployable.

Workflow:

1. Branch from `main`.
2. Keep changes focused and short-lived.
3. Open a PR early.
4. Ensure required checks pass.
5. Squash merge when approved.

## Required PR Checks

GitHub branch protection for `main` should require these CI checks before merge:

- `Quality (format · lint · typecheck)`
- `Test`
- `Build`

The protection payload is tracked in [`.github/branch-protection/main.json`](../../.github/branch-protection/main.json), and can be applied with [`scripts/github/apply-branch-protection.sh`](../../scripts/github/apply-branch-protection.sh).

## Preview Environments

Every PR can provision an isolated preview stack:

- Supabase branch
- Railway API environment
- Vercel web preview
- Optional EAS preview build for mobile

The preview stack is provisioned by the `preview-environment` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Mobile preview binaries are created separately by [`.github/workflows/eas-preview-build.yml`](../../.github/workflows/eas-preview-build.yml).

Preview environment behavior:

1. A PR triggers the `CI` workflow first.
2. Preview provisioning runs only after `CI` completes successfully for that PR.
3. Create or reuse a Supabase preview branch.
4. Deploy a Railway preview environment for the API.
5. Redeploy web against the preview backend.
6. Comment on the PR with URLs and seed credentials.

Cleanup runs automatically when the PR closes or merges.

### Preview Testing Credentials

For shared stage or preview testing, use:

- Email: `iconicedudev@gmail.com`
- Password: `Iconic@2026`

If the preview environment is seeded with the standard test dataset, these additional aliases are useful for role-based testing:

| Email                              | Role     | Use for                                               |
| ---------------------------------- | -------- | ----------------------------------------------------- |
| `iconicedudev@gmail.com`           | Owner    | Admin settings, org bootstrap, cross-role smoke tests |
| `iconicedudev+guardian1@gmail.com` | Guardian | Parent and family flows                               |
| `iconicedudev+educator1@gmail.com` | Educator | Teacher/classroom flows                               |
| `iconicedudev+educator2@gmail.com` | Educator | Multi-educator and secondary class scenarios          |
| `iconicedudev+staff1@gmail.com`    | Staff    | Staff-only tooling such as schedule management        |
| `iconicedudev+guardian2@gmail.com` | Guardian | Second-family and multi-household scenarios           |

Notes:

- Local Supabase resets use the same Gmail aliases from [`supabase/seed.sql`](../../supabase/seed.sql), but the local seed password remains `Seed123!`.
- Hosted preview or stage environments may expose only the shared login unless the branch/project has been seeded with the full dataset.
- When a PR preview comment includes explicit environment details, treat that comment as the source of truth for that PR.

### How To Use A PR Preview

1. Open the PR and wait for `CI` to finish successfully.
2. Wait for the PR comment titled `Preview Environment Ready`.
3. Open the `Web (Vercel)` URL from that comment to test the preview web app.
4. Use the `API (Railway)` URL from that comment for backend checks. Appending `/healthz` is the fastest smoke test.
5. Open the `Supabase Studio` link from that comment to inspect the preview database branch.
6. If you need a mobile binary, run the `Create EAS Build` workflow from GitHub Actions after the preview environment is ready.

### How To Create A Mobile Preview Build

There are two supported paths:

1. Local/terminal build

```bash
pnpm mobile:eas:build:preview
```

2. GitHub Actions build for a PR preview

- Open `Actions` in GitHub.
- Run `Create EAS Build`.
- Set `pr_number` to the PR number when building a non-`main` branch.
- Choose `ios`, `android`, or `all`.
- Wait for the workflow to post the Expo build link back to the PR.

### Preview Mobile Environment Notes

The preview EAS workflow currently injects these values automatically for PR-based builds:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV=preview`

The preview web and API URLs are posted in the PR comment, but they are not currently auto-injected into the mobile EAS preview workflow as `EXPO_PUBLIC_WEB_URL` and `EXPO_PUBLIC_API_URL`.

If a preview build must point at a specific preview API or preview web host, set these before triggering the build:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WEB_URL`

Use:

- The Vercel preview URL for web-hosted flows opened from mobile
- The Railway preview API URL for NestJS-backed server calls
- The Supabase preview branch URL and anon key for auth, RLS-safe reads, and narrowly-scoped mobile writes

## Mobile Native Builds

```bash
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:eas:build:dev
pnpm mobile:eas:build:preview
pnpm mobile:eas:build:prod
pnpm mobile:eas:submit
```

## Git Hooks

- `pre-commit` runs `pnpm lint-staged`
- `pre-push` runs `pnpm prepush:check`

## Required GitHub Secrets

Preview environments depend on repository secrets for Supabase, Railway, Vercel, PostHog, and internal tokens. Keep the workflow file and environment setup documentation aligned when new secrets are introduced.
