# AI Project Instructions

## Purpose

Canonical long-form guidance for AI coding assistants operating in this repository.

## Intended Audience

AI coding agents and engineers maintaining agent-facing repository guidance.

## Last Updated

2026-08-28

## Related Docs

- [Root AGENTS Entry](../../../AGENTS.md)
- [Documentation Hub](../../README.md)
- [Local Setup](../../getting-started/setup.md)
- [Development Workflow](../../getting-started/development-workflow.md)
- [Architecture Overview](../../codebase/ARCHITECTURE.md)
- [Conventions](../../codebase/CONVENTIONS.md)

## 1. Start With Evidence

Before editing, inspect the owning code, nearby tests, package scripts, relevant migrations, and linked canonical documentation. Search the repository before inventing a new pattern.

Use this precedence when sources conflict:

1. hard security and architecture rules in the root `AGENTS.md`;
2. executable code, tests, migrations, package scripts, and CI configuration;
3. accepted architecture decision records;
4. current canonical documentation linked from `docs/README.md`.

Planning notes, issue descriptions, generated reports, review matrices, and comments can be useful context, but they are not proof of current behavior. Verify them against the repository.

Preserve unrelated work already present in the worktree. Do not broaden the requested change merely because adjacent cleanup is possible.

## 2. Project And Toolchain

IconicEdu is a pnpm/Turborepo TypeScript monorepo for a multi-platform education product.

- Web: Next.js 15 App Router and React 19.
- API: NestJS 11 and Prisma 7.
- Mobile: Expo 55, React Native 0.83, and Expo Router.
- Platform services: Supabase PostgreSQL, Auth, RLS, Realtime, and Storage.
- Shared state/data fetching: TanStack Query where client-side caching is needed.
- UI: Tailwind/shadcn for web and NativeWind for mobile.
- Runtime: Node `>=20.19.0 <21` and pnpm `10.33.0`; `package.json` is authoritative.

Use `pnpm setup:local` for first-time setup. Common commands are:

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:mobile
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci
```

Use the documented root scripts instead of bypassing repository orchestration unless a focused package command is appropriate.

## 3. Ownership And Dependency Direction

- `apps/web` owns web routes, components, and web-specific data wiring.
- `apps/mobile` owns native routes, screens, and mobile-specific UX.
- `apps/api` owns business logic, validation, authorization, table access, and privileged operations.
- `packages/shared-types` owns shared VMs, payloads, and cross-app contracts.
- `packages/ui-web` owns reusable web UI and shadcn wrappers.
- `packages/ui-native` owns reusable native UI.
- `packages/utils` owns framework-neutral shared utilities.

No app imports another app. Move reusable code down into an appropriate package instead of adding a cross-app dependency.

For a data-backed feature, implement in this order:

1. shared VM or payload contract;
2. API DTO, validation, service, and controller;
3. typed web or mobile API adapter;
4. shared and app-level UI; and
5. tests at the owning layers.

## 4. Data Access And Security

### 4.1 Frontend Boundary

`apps/web` and `apps/mobile` are frontend-only. They must not query or mutate database tables directly.

| Operation                | Frontend use | Rule                                 |
| ------------------------ | ------------ | ------------------------------------ |
| `supabase.auth.*`        | Allowed      | Session and authentication SDK       |
| `supabase.channel(...)`  | Allowed      | Realtime with applicable RLS         |
| `supabase.storage.*`     | Allowed      | Storage policies must enforce access |
| `supabase.from(...)`     | Forbidden    | Move the operation to `apps/api`     |
| Service-role credentials | Forbidden    | Only `apps/api` may hold them        |

Web calls the API through `createApiClient` in `apps/web/lib/api/http-client.ts`. Mobile uses the typed helpers in `apps/mobile/src/lib/api/http-client.ts`. Extend those clients instead of scattering raw `fetch` calls.

### 4.2 Migrations And Prisma

- Never modify an existing Supabase migration.
- Add a uniquely timestamped forward migration for every schema, data, RLS, function, trigger, storage, or cron change.
- Supabase migrations are the schema source of truth.
- Keep `apps/api/prisma/schema.prisma` aligned when the API consumes the changed schema.
- Do not use Prisma migrations or `prisma db push` for repository schema changes.
- Keep RLS enabled and review tenant boundaries, role access, indexes, existing-data compatibility, and forward recovery.

### 4.3 Secrets And User Data

- Never place production secrets, service-role keys, access tokens, or real user data in source, fixtures, logs, docs, commits, or PR descriptions.
- Use `.env.example`-style placeholders for documented configuration.
- Local seed credentials may be documented only when they are clearly non-production and committed seed data.
- Return user-safe errors to clients and retain diagnostic context only in appropriate server-side logs.

## 5. Types, APIs, And Errors

- Use strict TypeScript and avoid `any` at trust boundaries.
- Validate all external input in `apps/api` DTOs.
- Keep persistence rows, API payloads, and UI-facing VMs distinct unless their alignment is deliberate.
- Use discriminated unions for polymorphic messages and attachments.
- Avoid circular VM references and app-specific behavior in shared contracts.
- Prefer typed errors and do not silently suppress failures.
- Keep vendor-specific behavior behind adapters where practical.

## 6. UI Rules

- Reuse shadcn primitives and existing shared components before creating another pattern.
- Put reusable web components, dialogs, and interaction primitives in `packages/ui-web` and export them through the package.
- Put reusable native components in `packages/ui-native`.
- Use theme tokens and existing theme APIs; avoid hard-coded colors.
- Include responsive behavior and accessibility in the implementation and tests.
- Keep client components focused; default to server components in web routes unless browser APIs, local state, or hooks require a client boundary.

## 7. Domain-Specific Guardrails

### Messaging And Read State

- Keep stable React Query keys in `apps/mobile/src/lib/api/query-keys.ts`.
- Clean up every Realtime subscription on unmount.
- Use the established mark-read hooks/helpers so channel and thread unread state update together and rollback correctly.
- Preserve message visibility and tenant checks in the API; UI filtering is not authorization.

### Web Feature Flags

All new user-facing web features ship behind a catalogued Vercel flag in `apps/web/flags.ts` with `defaultValue: false`.

1. Use a stable `feature-area-action` key.
2. Gate server behavior and UI behavior.
3. Test OFF and ON behavior.
4. Document any maintenance-only exemption with `flag-exempt: <reason>`.
5. Remove the flag and dead branches after full rollout.

## 8. Tests And Validation

Add or update tests for every changed behavior, including failure paths and authorization boundaries where applicable. Co-locate tests according to the owning workspace's conventions and keep them deterministic.

Use the smallest useful feedback loop while editing, then validate all affected workspaces:

```bash
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
```

Run `pnpm run ci` before requesting review for code, configuration, dependency, workflow, or cross-cutting changes. For documentation-only changes, run formatting, validate local links, and run any documentation-related tests. State precisely what was and was not run.

When schema or RLS changes, also run:

```bash
supabase db reset
pnpm --filter api db:generate
```

Never bypass a failing guard or hook merely to complete a commit or push.

## 9. Git And Pull Requests

- Start a short-lived `<type>/<kebab-description>` branch from current `main`.
- Use Conventional Commits for authored commits and PR titles.
- Keep commits coherent and the PR focused on one outcome.
- Open a draft early for cross-cutting or high-risk work.
- Include exact validation, migration/environment changes, rollout and rollback notes, security impact, and UI evidence where relevant.
- Use squash merge for normal work so the validated PR title becomes the `main` commit subject.

See the [development workflow](../../getting-started/development-workflow.md) for the allowed commit types, hooks, review process, and examples.

## 10. Documentation And Repository Hygiene

- `docs/README.md` is the canonical documentation index.
- Update documentation in the same PR as behavior, commands, environment variables, architecture, or operational ownership.
- Keep durable guidance in `getting-started`, `codebase`, and `operations`.
- Keep accepted ADRs as historical records; supersede them with a new ADR when a decision changes.
- Track planned work and audit findings in GitHub issues, not long-lived `docs/todos` or `docs/reports` files.
- Remove superseded pages and all inbound links in the same change.
- Do not commit editor metadata, OS files, build output, local environment files, scratch files, or generated review artifacts.
- Use repository-relative links and validate them after renames or deletions.
- Update `Last Updated` only after reviewing the entire page.

If a document conflicts with code, correct or remove it rather than adding another document that repeats the disagreement.

## 11. Repository Skills

Repository-scoped Codex skills live in `.agents/skills` so they are available from any
workspace in this monorepo.

- Use [`pr-risk-review`](../../../.agents/skills/pr-risk-review/SKILL.md) to review a pull
  request or branch diff across requirements, correctness, architecture, tests, and security.
  It combines observed CI status with semantic findings and routes LOW risk to a human skim
  and MEDIUM/HIGH risk to targeted lead review. It does not publish or modify a PR unless that
  separate action is explicitly requested.
