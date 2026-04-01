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
pnpm mobile:start
pnpm dev:api
```

`pnpm mobile:start` is the preferred mobile workflow because it preserves Expo's interactive terminal controls such as `i` for the iOS Simulator and `a` for the Android Emulator. `pnpm dev` also starts mobile with the same direct Expo path while keeping the rest of the stack running in parallel.

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

| Email                          | Role     | Profile   |
| ------------------------------ | -------- | --------- |
| `owner.marc@example.com`       | Owner    | Marc F    |
| `guardian.lura@example.com`    | Guardian | Lura H    |
| `educator.denise@example.com`  | Educator | Denise R  |
| `educator.barbara@example.com` | Educator | Barbara Y |
| `staff.harold@example.com`     | Staff    | Harold B  |
| `guardian.jessica@example.com` | Guardian | Jessica K |

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

The workflow is defined in [`.github/workflows/preview-env.yml`](../../.github/workflows/preview-env.yml).

Preview environment behavior:

1. A PR triggers the `CI` workflow first.
2. Preview provisioning runs only after `CI` completes successfully for that PR.
3. Create or reuse a Supabase preview branch.
4. Deploy a Railway preview environment for the API.
5. Redeploy web against the preview backend.
6. Comment on the PR with URLs and seed credentials.

Cleanup runs automatically when the PR closes or merges.

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
