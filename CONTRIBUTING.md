# Contributing Guide

## Purpose

This document defines how engineers contribute changes to the IconicEdu monorepo.

## Intended Audience

Internal engineers and trusted contributors opening branches, pull requests, and production-facing changes.

## Last Updated

2026-03-23

## Related Docs

- [Documentation Hub](docs/README.md)
- [Local Setup](docs/getting-started/setup.md)
- [Development Workflow](docs/getting-started/development-workflow.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Best Practices](docs/standards/best-practices.md)

## Before You Start

1. Complete local setup in [docs/getting-started/setup.md](docs/getting-started/setup.md).
2. Review the development workflow in [docs/getting-started/development-workflow.md](docs/getting-started/development-workflow.md).
3. Read the architecture summary in [docs/architecture/overview.md](docs/architecture/overview.md).
4. Follow the code conventions in [docs/standards/best-practices.md](docs/standards/best-practices.md).

## Branch Naming

Use a prefix that describes the change type, followed by a short kebab-case description.

| Prefix      | Use for                                     |
| ----------- | ------------------------------------------- |
| `feature/`  | New functionality                           |
| `fix/`      | Bug fixes                                   |
| `chore/`    | Tooling, config, dependency updates         |
| `docs/`     | Documentation-only changes                  |
| `refactor/` | Structural changes without behavior changes |
| `test/`     | Adding or fixing tests                      |

Examples:

```text
feature/avatar-upload
fix/thread-duplicate-parent-message
chore/upgrade-expo-sdk-54
docs/restructure-engineering-docs
refactor/message-list-virtualization
```

## Commit Messages

Follow Conventional Commits:

```text
<type>(<scope>): <short description>
```

Common types:

- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`
- `test`
- `style`
- `perf`
- `ci`

Guidelines:

- Use imperative mood.
- Keep the subject under 72 characters.
- Do not end the subject with a period.
- Reference issues in the footer when relevant.

## Pull Requests

Keep PRs focused on one concern.

Before opening a PR, run the relevant checks:

```bash
pnpm ci
pnpm ci:web
pnpm ci:mobile
pnpm ci:api
```

PR expectations:

- Use a Conventional Commit style PR title.
- Explain why the change exists, not just what changed.
- Include screenshots or recordings for UI changes.
- List manual verification steps when review depends on them.

## PR Checklist

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build:packages`
- [ ] Fresh migration validation with `supabase db reset` if schema changed
- [ ] `.env.*.example` updates if new environment variables were introduced
- [ ] No secrets or credentials committed

## Code Review

For reviewers:

- Focus on correctness, maintainability, and consistency.
- Mark non-blocking feedback with `nit:`.
- Approve only when the change is genuinely ready.

For authors:

- Respond to every comment.
- Do not silently ignore nits.
- Re-request review after material changes.

## Dependencies

Always add dependencies to the correct workspace with `pnpm --filter`.

Examples:

```bash
pnpm --filter web add <pkg>
pnpm --filter mobile add <pkg>
pnpm --filter api add <pkg>
pnpm --filter @iconicedu/ui-web add <pkg>
```

Use `workspace:*` for internal packages.

## Merge Strategy

- Use squash merge for normal feature work.
- Use merge commits only when preserving branch history is intentionally required.
