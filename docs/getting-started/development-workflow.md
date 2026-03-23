# Development Workflow

## Purpose

This document is the canonical workflow guide for local development, testing, preview environments, and CI expectations.

## Intended Audience

Internal engineers working day to day in the monorepo.

## Last Updated

2026-03-23

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

Shared packages should be built before first app startup or after structural package changes:

```bash
pnpm build:packages
```

## Local Service URLs

| Service         | URL                    |
| --------------- | ---------------------- |
| Web app         | http://localhost:3000  |
| API             | http://localhost:3001  |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API    | http://127.0.0.1:54321 |
| Email testing   | http://127.0.0.1:54324 |

## Seed Credentials

All seed accounts share the password `Seed123!`:

| Email                  | Role     | Profile   |
| ---------------------- | -------- | --------- |
| `heshanmw@gmail.com`   | Owner    | Marc F    |
| `heshanmw+1@gmail.com` | Guardian | Lura H    |
| `heshanmw+3@gmail.com` | Educator | Denise R  |
| `heshanmw+4@gmail.com` | Educator | Barbara Y |
| `heshanmw+5@gmail.com` | Staff    | Harold B  |
| `heshanmw+6@gmail.com` | Guardian | Jessica K |

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
