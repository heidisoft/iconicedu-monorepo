# Development Workflow

## Purpose

This document defines the day-to-day path from selecting work to merging a reviewed change.

## Intended Audience

Engineers and reviewers contributing to the monorepo.

## Last Updated

2026-08-14

## Related Docs

- [Local Setup](setup.md)
- [Contributing](../../CONTRIBUTING.md)
- [Architecture Overview](../architecture/overview.md)
- [Best Practices](../standards/best-practices.md)
- [Deployment](../operations/deployment.md)

## Workflow At A Glance

1. Start from an up-to-date `main`.
2. Create a short-lived, conventionally named branch.
3. Implement vertically across shared types, API, and frontend as required.
4. Run focused checks while iterating.
5. Commit in coherent units with Conventional Commits.
6. Push, open a draft PR early, and complete the PR template.
7. Run full validation, address review, and squash merge.

`main` must remain deployable. Do not commit directly to it or mix unrelated work in one branch.

## 1. Select And Clarify The Work

Before coding, ensure the issue or task has:

- a user or operational problem statement;
- testable acceptance criteria;
- the expected app or package ownership;
- security, data, migration, analytics, rollout, and accessibility considerations where relevant; and
- a clear out-of-scope boundary.

For a large feature, split the work into independently reviewable vertical slices. Prefer a small API-plus-UI path that works end to end over separate long-running frontend and backend branches.

## 2. Update `main` And Create A Branch

Keep uncommitted work safe, then update without creating a merge commit:

```bash
git switch main
git pull --ff-only
git switch -c feat/guardian-dashboard-filters
```

Use `<type>/<short-kebab-description>`:

| Prefix      | Use for                                            |
| ----------- | -------------------------------------------------- |
| `feat/`     | User-facing capability                             |
| `fix/`      | Defect correction                                  |
| `docs/`     | Documentation only                                 |
| `refactor/` | Structural change without intended behavior change |
| `perf/`     | Performance improvement                            |
| `test/`     | Test-only change                                   |
| `build/`    | Build system or dependency packaging               |
| `ci/`       | CI/CD workflow                                     |
| `chore/`    | Maintenance not covered above                      |
| `style/`    | Formatting-only source change                      |

Add an issue number when useful, for example `feat/184-guardian-dashboard-filters`. Do not use names such as `updates`, `work`, or `final-fix`.

## 3. Implement Within Repository Boundaries

For a data-backed feature, use this order:

1. define or update cross-app VMs and payloads in `packages/shared-types`;
2. add validation, business logic, and table access in `apps/api`;
3. expose or update a typed API endpoint;
4. call it through the web or mobile API helper;
5. build reusable UI in `packages/ui-web` or `packages/ui-native`; and
6. add tests alongside every changed behavior.

Frontend apps may contact Supabase directly only for Auth, Realtime subscriptions, and Storage. All table reads and writes go through `apps/api`. Do not import one app from another.

Web features use `createApiClient` from `apps/web/lib/api/http-client.ts`. Mobile features use `apiGet`, `apiPost`, `apiPut`, and `apiDelete` from `apps/mobile/src/lib/api/http-client.ts`.

New web user-facing behavior must be introduced behind a flag in `apps/web/flags.ts`, defaulting to off, unless the PR documents a valid maintenance exemption.

## 4. Run The Development Stack

From the repository root:

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:mobile
```

Use the scoped command for faster iteration. Use `pnpm dev:mobile` for the first native build or when interactive Expo controls are needed. Run `pnpm build:packages` after structural changes to a shared package if a watcher does not pick them up.

Stable local app URLs are:

| Service | URL                          |
| ------- | ---------------------------- |
| Web     | `http://localhost:3000`      |
| API     | `http://localhost:3001`      |
| Swagger | `http://localhost:3001/docs` |

Use `supabase status` for Supabase Studio, Mailpit, database, and API URLs.

## 5. Database Changes

Never edit an existing Supabase migration after it has been created and shared. Every schema, RLS, function, trigger, storage, or cron correction gets a new, uniquely timestamped forward migration.

```bash
supabase migration new add_guardian_dashboard_preferences
supabase db reset
pnpm --filter api db:generate
```

When the API needs the changed schema, update `apps/api/prisma/schema.prisma` in the same PR. Supabase migrations remain the source of truth; do not use Prisma migrations or `prisma db push` for repository schema changes.

Review generated SQL, RLS behavior, indexes, existing data compatibility, and rollback-by-forward-migration before requesting review.

## 6. Test During Development

Use the smallest useful loop first:

```bash
pnpm test:web
pnpm test:mobile
pnpm test:api
pnpm --filter web test:watch
pnpm --filter web test:e2e
```

Validate all affected workspaces before pushing:

```bash
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
```

Run the full local pipeline before requesting review:

```bash
pnpm run ci
```

If a check cannot be run locally, state exactly which check was omitted and why in the PR. Do not describe an unrun check as passing.

## 7. Write Conventional Commits

Every authored commit uses:

```text
<type>(<optional-scope>): <imperative description>
```

Examples:

```text
feat(web): add guardian dashboard filters
fix(api): reject duplicate channel members
docs(workflow): explain Android device networking
refactor(shared-types): separate assessment payloads
ci: validate conventional PR titles
feat(api)!: remove the legacy schedules endpoint
```

Allowed types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style`, and `revert`.

Guidelines:

- Use a lowercase type and scope.
- Write the subject in imperative mood: `add`, `prevent`, `remove`; not `added` or `adds`.
- Start the subject with lowercase and do not end it with a period.
- Keep the complete header at 100 characters or fewer.
- Use a scope that helps reviewers, commonly `web`, `mobile`, `api`, `ui-web`, `ui-native`, `shared-types`, `utils`, `supabase`, `deps`, or `workflow`.
- Add a body after a blank line when the reason, constraints, or behavior are not obvious.
- Use footers such as `Refs: #184` or `Closes: #184` when applicable.
- Mark breaking changes with `!` and include a `BREAKING CHANGE:` footer explaining migration impact.

Example with body and footer:

```text
fix(api): prevent duplicate channel members

Enforce the existing tenant-scoped uniqueness rule before emitting the
membership event so retries remain idempotent.

Closes: #184
```

The `commit-msg` hook validates the header. Test a message manually with:

```bash
pnpm commitlint -- --text "feat(web): add guardian dashboard filters"
```

Do not bypass hooks to make an invalid commit. Fix the message instead. Git-generated merge and revert commit subjects are accepted.

## 8. Understand Git Hooks

Installing dependencies configures Husky:

| Hook         | Runs                                                      | Purpose                                                |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| `pre-commit` | lint-staged formatting, affected lint, affected typecheck | Catch quick local problems before a commit is recorded |
| `commit-msg` | Conventional Commit validation                            | Keep history and squash titles consistent              |
| `pre-push`   | affected guards, lint, typecheck, and tests               | Catch branch-level failures before CI                  |

Hooks support the workflow but do not replace the full CI run. If a hook reports unrelated baseline failures, document the evidence and coordinate with a maintainer; do not silently skip it.

## 9. Open And Maintain The Pull Request

Push the branch and open a draft PR as soon as the shape of the change is reviewable:

```bash
git push -u origin feat/guardian-dashboard-filters
```

PR titles must use the same Conventional Commit format as commits because the normal merge strategy is squash merge. The final PR title becomes the commit on `main`.

Complete the PR template with:

- the problem and outcome;
- implementation and architecture notes;
- exact automated and manual validation;
- screenshots or recordings for UI changes;
- migration, environment, rollout, and rollback details;
- accessibility and security impact; and
- related issues.

Keep the PR focused. Separate drive-by refactors, formatting, and dependency upgrades unless they are required for the feature.

The optional helper can propose a conventional branch, commit, title, and PR body from local changes:

```bash
pnpm pr:ai
```

Review its proposed scope and wording before allowing it to commit or publish anything.

## 10. CI, Preview, And Review

Branch protection requires:

- `Quality (format · lint · typecheck)`;
- `Test`; and
- `Build`.

It also requires one approving review and resolved conversations; pushing new changes dismisses a stale approval. The quality job validates the PR title and formats only changed files. `Bundle Size` provides additional change visibility.

CI classifies changed paths before starting expensive work. Documentation-only PRs keep the required `Build` check green as a fast no-op and skip bundle analysis and preview provisioning. For code changes, application builds and preview provisioning start in parallel after quality and tests pass. A small summary job joins their results and updates the single preview comment. Mobile binaries are created separately through the `Create EAS Build` workflow when needed.

Use the `Preview Environment Ready` PR comment as the source of truth for preview URLs and test credentials. Smoke-test the affected role and platform, not only the happy path.

As an author:

1. respond to every review thread;
2. push fixes as focused conventional commits;
3. resolve threads only when the concern is addressed or agreement is explicit;
4. rerun affected manual checks after material changes; and
5. re-request review when ready.

As a reviewer, prioritize correctness, data access, auth, tenant isolation, migration safety, tests, usability, accessibility, and maintainability. Prefix optional polish with `nit:` so blocking feedback is unambiguous.

## 11. Merge And Clean Up

Before merge:

- all required checks are green;
- required review is complete;
- conversations are resolved;
- the PR title is a valid Conventional Commit;
- preview verification is recorded; and
- migrations and environment changes have an approved rollout path.

Use squash merge for normal feature work. Delete the branch after merge, switch back to `main`, and fast-forward before beginning the next task:

```bash
git switch main
git pull --ff-only
git branch -d feat/guardian-dashboard-filters
```

Production configuration and deployment behavior are documented in the [deployment guide](../operations/deployment.md). Merging a PR does not authorize bypassing protected-environment approvals.

## Seed And Preview Accounts

Local accounts come from [`supabase/seed.sql`](../../supabase/seed.sql) and use password `Seed123!`. The owner login is `iconicedudev@gmail.com`; role aliases are listed in the [setup guide](setup.md#6-sign-in-with-seed-data).

Hosted preview credentials may differ. Read the generated PR preview comment and do not copy shared credentials into public issues, logs, screenshots, or documentation.
