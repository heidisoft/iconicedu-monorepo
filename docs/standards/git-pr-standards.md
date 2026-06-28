# Git and Pull Request Standards

## Purpose

This document defines the standard branch naming, commit message, and pull request conventions for the IconicEdu monorepo.

## Intended Audience

Engineers and AI assistants creating branches, commits, and pull requests.

## Last Updated

2026-06-27

## Related Docs

- [Documentation Hub](../README.md)
- [Development Workflow](../getting-started/development-workflow.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Best Practices](best-practices.md)
- [Pull Request Template](../../.github/PULL_REQUEST_TEMPLATE.md)

## Branch Naming

Create branches from the latest `main`.

Use this format:

```text
<type>/<short-kebab-case-summary>
```

Use lowercase letters, numbers, and hyphens. Keep the summary short and searchable. Prefer the issue or feature noun over vague wording.

| Prefix      | Use for                                             |
| ----------- | --------------------------------------------------- |
| `feat/`     | New user-facing functionality                       |
| `fix/`      | Bug fixes and production regressions                |
| `docs/`     | Documentation-only changes                          |
| `chore/`    | Tooling, dependencies, generated files, maintenance |
| `refactor/` | Internal restructuring with no behavior change      |
| `test/`     | Test-only additions or corrections                  |
| `perf/`     | Performance improvements                            |
| `ci/`       | GitHub Actions, deployment, or automation changes   |
| `build/`    | Build-system or packaging changes                   |
| `hotfix/`   | Urgent production fix branched for fast release     |

Examples:

```text
feat/channel-file-previews
fix/unviewed-message-staff-alerts
docs/pr-standards
chore/upgrade-expo-sdk
refactor/message-activity-publisher
test/activity-projector-recipients
ci/preview-environment-cache
```

Avoid:

```text
my-changes
fix/stuff
feature/big-update
feat/JIRA-123_NewThing
```

## Commit Messages

Use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

The scope is optional, but recommended when it makes the changed area obvious.

Common types:

| Type       | Use for                                      |
| ---------- | -------------------------------------------- |
| `feat`     | New functionality                            |
| `fix`      | Bug fixes                                    |
| `docs`     | Documentation changes                        |
| `chore`    | Maintenance, dependencies, generated updates |
| `refactor` | Restructuring without behavior change        |
| `test`     | Tests only                                   |
| `perf`     | Performance improvements                     |
| `ci`       | CI/CD and automation                         |
| `build`    | Build system or packaging                    |
| `revert`   | Revert a previous commit                     |

Preferred scopes:

```text
api
web
mobile
ui-web
ui-native
shared-types
supabase
docs
ci
```

Good examples:

```text
feat(web): add channel file preview panel
fix(api): notify staff about unviewed classroom messages
docs: add git and pull request standards
chore(supabase): regenerate database types
test(api): cover activity projector recipients
```

Guidelines:

- Use imperative mood: `add`, `fix`, `remove`, `update`.
- Keep the subject under 72 characters when practical.
- Do not end the subject with a period.
- Make one commit do one conceptual thing.
- Explain motivation and tradeoffs in the body when the summary is not enough.
- Add issue references in the footer when relevant.

Breaking changes use `!` and a footer:

```text
feat(api)!: require channel id for message uploads

BREAKING CHANGE: message upload callers must pass channelId.
```

## Pull Request Titles

Use the same Conventional Commit style as commit messages:

```text
fix(api): notify staff about unviewed classroom messages
docs: add git and pull request standards
feat(mobile): add notification preference controls
```

The PR title should describe the merged change because squash merge uses it as the default commit title.

## Pull Request Body

Use [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md). Fill every relevant section. If a section does not apply, write `N/A` instead of deleting context reviewers may expect.

### Summary

Use 1-3 bullets. Explain why the change exists and what behavior changes.

Good:

```markdown
- Lowers the classroom unviewed-message alert threshold to 1 hour.
- Includes admin and staff-role account profiles as staff alert recipients.
- Rewrites pending unviewed-check jobs so already queued alerts use the new threshold.
```

Avoid:

```markdown
- Updated files.
- Fixed stuff.
```

### Type Of Change

Check the single best primary category. If the PR spans categories, choose the one reviewers should optimize for and mention the secondary category in the summary.

### Affected Areas

Check every touched product area. Include `supabase/migrations` for any database, RLS, cron, function, enum, or seed-data migration.

### Screenshots Or Recordings

Required for visible UI changes. Include before/after when the change affects layout, empty states, loading states, mobile behavior, or theme behavior.

Use `N/A` for backend-only and docs-only PRs.

### Test Plan

List exact commands and manual checks performed.

Good:

```markdown
- `pnpm --filter api test -- message-activity unviewed-message-alert-config`
- `pnpm exec turbo run lint typecheck test --affected`
- Verified the migration schedules pending `message_unviewed_check` jobs at `message.created_at + interval '1 hour'`.
```

For skipped checks, say why:

```markdown
- Not run: `supabase db reset` because this PR only changes docs.
```

### Checklist

Keep the template checklist accurate. Do not check items that were not run. Use `N/A` next to items that do not apply.

## PR Size And Shape

Prefer small, reviewable PRs:

- Keep one behavior change per PR.
- Separate mechanical refactors from functional changes.
- Put migrations in the same PR as the code that depends on them.
- Avoid drive-by formatting outside touched files.
- Avoid mixing unrelated web, mobile, API, and database changes unless one feature requires all of them.

## Required Local Checks

Run the smallest relevant checks while developing, then broader checks before review when the blast radius is larger.

Common commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:affected
pnpm run ci
```

Area-specific examples:

```bash
pnpm --filter api test -- message-activity
pnpm --filter web test
pnpm --filter mobile test
pnpm build:packages
```

For migrations:

```bash
supabase db reset
pnpm --filter api db:generate
```

## Migrations

Follow the repository migration rules:

- Never edit an existing Supabase migration after it has been created.
- Add a new forward migration for every database or cron change.
- Use a unique timestamp/version prefix.
- Test schema changes with `supabase db reset`.
- Regenerate shared database types when schema changes require it.

## Review Etiquette

For authors:

- Open the PR early when design feedback is useful.
- Keep the branch updated with `main` for long-running work.
- Respond to every review thread.
- Re-request review after material changes.

For reviewers:

- Lead with correctness, data safety, security, and user impact.
- Mark subjective or non-blocking comments with `nit:`.
- Ask for tests when behavior changes are not covered.
- Approve only when the PR is ready to merge.

## Merge Strategy

Use squash merge for normal PRs. The squash commit title should be the PR title, so keep it clean and Conventional Commit compliant.

Use merge commits only when preserving branch history is intentional and discussed in the PR.
