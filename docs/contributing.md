# Contributing Guide

Guidelines for contributing to the IconicEdu monorepo.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Code Review](#code-review)
- [Adding Dependencies](#adding-dependencies)
- [Adding a Migration](#adding-a-migration)
- [Pre-commit Hooks](#pre-commit-hooks)
- [CI Requirements](#ci-requirements)

---

## Before You Start

1. Set up your local environment: [docs/setup.md](setup.md)
2. Read the architecture overview: [docs/AGENTS.md](AGENTS.md)
3. Read the code conventions: [docs/best-practices.md](best-practices.md)

---

## Branch Naming

Use a prefix that describes the type of change, followed by a short kebab-case description.

| Prefix | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Tooling, config, dependency updates |
| `docs/` | Documentation only |
| `refactor/` | Code changes with no behavior change |
| `test/` | Adding or fixing tests |

**Examples:**

```
feature/avatar-upload
fix/thread-duplicate-parent-message
chore/upgrade-expo-sdk-54
docs/supabase-setup-guide
refactor/message-list-virtualization
```

Keep branch names lowercase and use hyphens, not underscores or spaces.

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This keeps the git log readable and makes changelog generation possible.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Build process, tooling, dependencies |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |
| `ci` | CI configuration changes |

### Scope (optional but recommended)

The scope names the part of the codebase affected:

- `web`, `mobile`, `api` — app-level changes
- `ui-web`, `ui-native`, `shared-types` — package changes
- `db`, `supabase` — database/migrations
- `auth`, `messages`, `channels`, `threads` — feature areas

### Examples

```
feat(mobile): add avatar image to DM participant list
fix(api): handle null profile in account activation
chore(deps): upgrade expo to 54.0.25
docs(setup): add Supabase local dev instructions
refactor(messages): extract fetchLastMessages helper
test(ui-native): add MessageItem snapshot tests
feat(db): add archived_at column to accounts
```

### Rules

- Use the **imperative mood** in the description: "add feature" not "added feature"
- Keep the subject line under **72 characters**
- Do not end the subject line with a period
- Reference GitHub issues in the footer: `Closes #123`

---

## Pull Requests

### Scope

Keep PRs **focused on a single concern**. A PR that fixes a bug and also refactors unrelated code is harder to review.

If you're fixing a bug but spot unrelated issues, open a separate issue or PR for those.

### Before opening a PR

Run the full CI pipeline locally to catch issues before pushing:

```bash
pnpm ci
```

Or scope it to your changed area:

```bash
pnpm ci:web       # lint + typecheck + test + build for web
pnpm ci:mobile    # lint + typecheck + test + build for mobile
pnpm ci:api       # lint + typecheck + test + build for api
```

### PR title and description

- Use the same Conventional Commits format as commit messages for the PR title
- In the description, explain **why** the change is needed, not just what changed
- Include screenshots or screen recordings for any UI changes
- List any manual testing steps reviewers should follow

### PR template checklist

- [ ] Lint passes: `pnpm lint`
- [ ] Type-check passes: `pnpm typecheck`
- [ ] Tests pass: `pnpm test`
- [ ] Shared packages build: `pnpm build:packages`
- [ ] New migrations tested against a fresh `supabase db reset` (if applicable)
- [ ] `.env.*.example` files updated if new env vars are required
- [ ] No secrets, API keys, or credentials committed

---

## Code Review

### For reviewers

- Focus on correctness, maintainability, and consistency with existing patterns
- Use GitHub's suggestion feature for small fixes
- Distinguish between blocking issues and non-blocking nits: prefix nits with `nit:`
- Approve only when you are genuinely comfortable with the change

### For authors

- Respond to all comments before merging
- For nits: apply them or explain why you're not; never silently ignore
- Re-request review after making significant changes

### Merge strategy

- **Squash and merge** for feature branches (keeps main history clean)
- **Merge commit** for release branches or when preserving individual commits matters

---

## Adding Dependencies

Always use `pnpm --filter` to add dependencies to the correct workspace. Never add dependencies to the root `package.json` (only devtools like Turbo, ESLint, and TypeScript belong there).

### App dependencies

```bash
# Add a runtime dependency to one app
pnpm --filter web add @some/package
pnpm --filter mobile add @some/package
pnpm --filter api add @some/package

# Add a dev dependency
pnpm --filter web add -D @some/package
```

### Package dependencies

```bash
pnpm --filter @iconicedu/ui-web add @some/package
pnpm --filter @iconicedu/shared-types add @some/package
```

### Internal workspace packages

Use `workspace:*` as the version — never pin to a specific version:

```json
{
  "dependencies": {
    "@iconicedu/shared-types": "workspace:*"
  }
}
```

### Expo / React Native packages

Use `expo install` to get the correct version for the current SDK:

```bash
pnpm --filter mobile exec expo install some-package
```

This pins to the version compatible with Expo SDK 54. Do not install Expo/RN packages with `pnpm add` directly unless you know the exact compatible version.

### After adding packages

Always rebuild packages if the new dep is inside a package (not an app):

```bash
pnpm build:packages
```

---

## Adding a Migration

Database schema changes go into `supabase/migrations/`. The API's Prisma schema (`apps/api/prisma/schema.prisma`) should be kept in sync.

### 1. Create a migration file

Migration filenames must be in the format `<timestamp>_<description>.sql`, where the timestamp determines application order.

```bash
# Use supabase CLI to create a new empty migration
supabase migration new <description>
# e.g.: supabase migration new add_avatar_url_to_profiles
```

This creates `supabase/migrations/<timestamp>_add_avatar_url_to_profiles.sql`.

### 2. Write the migration

Write standard PostgreSQL DDL. Follow the patterns in existing migrations:

- Always use `IF NOT EXISTS` / `IF EXISTS` guards where appropriate
- Add RLS policies alongside table creation
- Add indexes for foreign keys and frequently queried columns
- Add comments for non-obvious columns

```sql
-- Example
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update RLS if needed
-- (see existing RLS migration files for patterns)
```

### 3. Test locally

```bash
# Apply the new migration to your local Supabase
supabase db push

# Or do a full reset to test from scratch
supabase db reset
```

### 4. Update Prisma schema

If the API needs access to the new column, update `apps/api/prisma/schema.prisma` and regenerate the client:

```bash
pnpm --filter api db:generate
```

### 5. Commit both files together

The `.sql` migration file and any Prisma schema changes should be in the same commit so reviewers can see the full picture.

---

## Pre-commit Hooks

The repo uses [Husky](https://typicode.github.io/husky/) with [lint-staged](https://github.com/lint-staged/lint-staged) to run checks before each commit.

Hooks run automatically on `git commit`. If a hook fails, the commit is aborted. Fix the reported issues and try again.

To skip hooks in an emergency (use sparingly):

```bash
git commit --no-verify -m "..."
```

---

## CI Requirements

All PRs must pass the following checks before merging:

| Check | Command | Scope |
|---|---|---|
| Lint | `pnpm lint` | All packages |
| Type-check | `pnpm typecheck` | All packages |
| Unit tests | `pnpm test` | All packages |
| Build | `pnpm build` | All packages |

These are enforced via the `pnpm ci` command and run in the CI pipeline on every PR.

The `typecheck` task for the API requires `prisma generate` to run first (the `build` script handles this automatically). If you see Prisma-related type errors in CI, ensure the Prisma client is up to date.
