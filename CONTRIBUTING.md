# Contributing Guide

## Purpose

This is the contributor entry point for the IconicEdu monorepo. Detailed commands and examples live in the linked canonical guides.

## Intended Audience

Engineers opening branches, commits, and pull requests against the repository.

## Last Updated

2026-08-14

## Start Here

1. Complete [local setup](docs/getting-started/setup.md).
2. Read the [development workflow](docs/getting-started/development-workflow.md).
3. Understand the [architecture boundaries](docs/codebase/ARCHITECTURE.md).
4. Follow the [engineering standards](docs/codebase/CONVENTIONS.md).

## Non-Negotiable Architecture Rules

- `apps/web` and `apps/mobile` are frontend-only. Direct Supabase access is limited to Auth, Realtime, and Storage.
- All table reads, writes, validation, and business logic go through `apps/api`.
- Web uses `createApiClient`; mobile uses the typed API helpers in its `src/lib/api` directory.
- Apps never import from each other. Shared contracts and utilities belong in `packages/*`.
- Reusable web UI belongs in `packages/ui-web`; reusable native UI belongs in `packages/ui-native`.
- Existing Supabase migrations are immutable. Every database correction is a new forward migration with a unique timestamp prefix.

## Branches And Commits

Create a short-lived branch from an up-to-date `main`:

```bash
git switch main
git pull --ff-only
git switch -c feat/guardian-dashboard-filters
```

Branch names use `<type>/<kebab-description>`, normally `feat/`, `fix/`, `docs/`, `refactor/`, `perf/`, `test/`, `build/`, `ci/`, `chore/`, or `style/`.

Authored commits and PR titles use Conventional Commits:

```text
<type>(<optional-scope>): <imperative description>
```

```text
feat(web): add guardian dashboard filters
fix(api): reject duplicate channel members
docs(workflow): explain local setup
```

The repository validates commit headers locally and PR titles in CI. See [Conventional Commits](docs/getting-started/development-workflow.md#7-write-conventional-commits) for types, scopes, breaking changes, bodies, and footers.

## Implementing A Feature

For data-backed work, change the layers in this order:

1. shared VM/payload contract in `packages/shared-types`;
2. API DTO, validation, service, and controller in `apps/api`;
3. typed web/mobile API call;
4. shared and app-level UI; and
5. unit, integration, and relevant end-to-end tests.

Every new web user-facing feature defaults off behind a catalogued feature flag unless the PR documents a maintenance-only exemption.

## Validation

Use scoped checks during iteration and the full pipeline before review:

```bash
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci
```

Area-specific commands include:

```bash
pnpm run ci:web
pnpm run ci:mobile
pnpm run ci:api
pnpm --filter web test:e2e
```

When schema or RLS changes:

```bash
supabase db reset
pnpm --filter api db:generate
```

If a check was not run, say so in the PR and explain why.

## Pull Requests

- Open a draft early for cross-cutting or high-risk work.
- Keep one problem and one coherent outcome per PR.
- Use a Conventional Commit PR title; squash merge makes it the `main` commit subject.
- Explain why the change exists and call out non-obvious design decisions.
- Include screenshots or recordings for visible changes.
- List exact automated and manual verification.
- Document migrations, new env vars, rollout flags, rollback strategy, security impact, and known limitations.
- Link the issue with `Closes: #<number>` when merge should close it.

The optional `pnpm pr:ai` helper proposes a branch, commit, title, and draft PR body. Review all generated metadata before publishing.

## Review And Merge

Authors respond to every review thread and re-request review after material changes. Reviewers distinguish blocking concerns from optional `nit:` feedback and check architecture, tenant isolation, auth, migration safety, tests, accessibility, and maintainability.

Required branch-protection checks are:

- `Quality (format · lint · typecheck)`
- `Test`
- `Build`

At least one approving review is required, stale approvals are dismissed after new changes, and review conversations must be resolved. Use squash merge for normal work and delete the merged branch. Merge commits require an explicit reason to preserve branch history.

## Dependencies

Add dependencies to the owning workspace and commit the lockfile:

```bash
pnpm --filter web add <package>
pnpm --filter mobile add <package>
pnpm --filter api add <package>
pnpm --filter @iconicedu/ui-web add <package>
```

Use `workspace:*` for internal packages. Explain major runtime dependencies in the PR and avoid adding the same utility to multiple workspaces without considering `packages/*` ownership.

## Documentation

Update documentation in the same PR when behavior, configuration, architecture, commands, environment variables, workflows, or operational responsibilities change. Keep subsystem-specific detail beside the subsystem and link it from the [documentation hub](docs/README.md).

Do not update a `Last Updated` field unless the document's content was actually reviewed and remains accurate.

## Repository Governance

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Branch protection configuration](.github/branch-protection/main.json)
- [CODEOWNERS](.github/CODEOWNERS)

## Maintainer Checklist For A New Developer

- Grant the least GitHub repository permission needed for their role.
- Add them to the appropriate GitHub team and replace individual `CODEOWNERS` entries with team handles as ownership grows.
- Confirm branch protection is applied from `.github/branch-protection/main.json`.
- Have the developer complete `pnpm setup:local` and `pnpm run ci` before assigning a feature.
- Provide only non-production credentials for optional providers the feature needs; do not distribute production database or service-role credentials.
- Grant preview/QA access separately for Supabase, Railway, Vercel, and Expo, using provider roles rather than shared personal accounts.
- Keep production environment approval limited to designated maintainers.
- Start with a small vertical slice and pair on the first migration, auth change, or release workflow.
