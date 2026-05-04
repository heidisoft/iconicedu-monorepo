# AI Project Instructions

## Purpose

Canonical long-form guidance for AI assistants operating in this repository.

## Intended Audience

AI coding agents and engineers maintaining agent-facing repo guidance.

## Last Updated

2026-05-04

## Related Docs

- [Root AGENTS Entry](../../../AGENTS.md)
- [Documentation Hub](../../README.md)
- [Architecture Overview](../../architecture/overview.md)
- [Best Practices](../../standards/best-practices.md)

## 1. Project Overview

- This monorepo powers a multi-platform education platform (web, mobile, API).
- Web is the canonical UI for admin/parent workflows; mobile targets student/teacher use cases.
- Shared ViewModels (VMs) define UI-facing data contracts across apps.

## 2. Tech Stack & Versions

- Next.js (App Router) for web.
- NestJS for API and business logic.
- Supabase for Auth, DB, RLS, and Realtime.
- React Native for mobile.
- TypeScript (strict) everywhere.
- Tailwind CSS + shadcn/ui for UI.
- Turborepo + pnpm for monorepo tooling.

## 3. Monorepo Structure & Ownership Rules

- `apps/web` owns web routes, server/client components, and data wiring.
- `apps/api` (NestJS) owns all business logic, validation, and writes.
- `apps/mobile` owns native UI and mobile-only UX logic.
- `packages/shared-types` owns VM and shared types; no app-specific logic.
- `packages/ui-web` owns reusable UI components and shadcn wrappers.
- Do not bypass ownership by importing across boundaries (e.g., UI into API).
- `apps/mobile` must not depend on `apps/web` API routes. When mobile needs an HTTP endpoint, add or use it in `apps/api`.

## 4. Data Access & Security Rules

### 4.0 Migration Immutability

- Never edit an existing Supabase migration after it has been created.
- Every database, trigger, RPC, cron, policy, or storage change must be added as a new forward migration in `supabase/migrations`.
- If a recent migration needs correction, create another migration that amends or replaces the behavior; do not rewrite the earlier file.
- Every migration filename must have a unique timestamp/version prefix. Supabase stores that prefix as the migration primary key, so duplicate prefixes will fail during `supabase db push`.

### 4.1 Hard Boundary — FE Apps Are Read/Write Forbidden at the DB Layer

`apps/web` and `apps/mobile` are **frontend-only**. They must not query database tables directly.

**Permitted direct Supabase usage from FE apps:**
| Operation | Allowed | Reason |
|---|---|---|
| `supabase.auth.*` | ✅ Yes | Auth SDK is the only correct way to manage sessions |
| `supabase.channel(...)` Realtime | ✅ Yes | Supabase-specific; RLS must be enforced on the channel |
| `supabase.storage.*` uploads/downloads | ✅ Yes | No server-side logic needed; RLS governs access |
| `supabase.from('table').select/insert/update/delete` | ❌ No | Belongs in `apps/api` |
| Service-role key usage | ❌ Never in FE | Only `apps/api` may hold service-role credentials |

**Any `supabase.from(...)` call in `apps/web` or `apps/mobile` is a violation.** Move it to an `apps/api` endpoint.

### 4.2 API-First Pattern for New Features

When adding a new data-driven feature, follow this sequence:

1. **Define the types** — add VM and/or payload types to `packages/shared-types`
2. **Add the API endpoint** — implement controller + service in `apps/api`
3. **Wire the FE** — call the endpoint using the app's typed HTTP client (see §4.3)

Never skip step 2 to "speed things up" with a direct Supabase call.

### 4.3 HTTP Clients

Both FE apps have a typed HTTP client. Use it — do not add raw `fetch` calls pointing at the API.

- **Web**: `createApiClient(supabase)` from `apps/web/lib/api/http-client.ts`
  ```ts
  // Server action / server component
  const supabase = await createSupabaseServerClient();
  const api = createApiClient(supabase);
  const data = await api.get<ProfileVM>('/profiles/me');
  ```
- **Mobile**: `apiGet / apiPost / apiPut / apiDelete` from `apps/mobile/src/lib/api/http-client.ts`

### 4.4 App Isolation

- `apps/mobile` must not call `apps/web` routes or import `apps/web` internals
- `apps/web` must not call `apps/mobile` internals or depend on mobile packages
- Neither app imports directly from the other — shared code lives in `packages/*`

### 4.5 Additional Data Rules

- Supabase RLS must remain enabled for all tables.
- All user/auth-related mutations (invites, role changes, MFA, OAuth admin) go through `apps/web/lib/auth/admin-actions.ts`. Review it before adding new helpers.
- Admin pages use `apps/web/lib/<domain>` helpers (not inline Supabase queries) so the UI stays DB-agnostic.
- When adding DB access for a new entity in `apps/api`, mirror the `lib/user` structure: `queries/`, `mappers/`, `builders/`, `constants/`, `derive.ts`.

## 5. TypeScript & API Design Rules

- Use strict typing and prefer explicit interfaces/types.
- VMs live in `packages/shared-types` and are the only shared UI contract.
- Avoid circular references in VM types.
- Keep API payloads separate from UI VMs unless explicitly aligned.
- Use discriminated unions for message/attachment variants.

## 6. UI & Design System Rules

- Use Tailwind CSS and shadcn/ui components consistently.
- Prefer composition of shadcn primitives over custom components.
- Reference the official shadcn component docs (https://ui.shadcn.com/docs/components) before recreating a UI pattern; strive to reuse those building blocks rather than invent new ones.
- When a layout or interaction is repeated across views, add a shared, shadcn-friendly component inside `packages/ui-web/src/components` instead of duplicating markup in multiple files.
- All new UI components, modals, or interaction patterns must be authored inside `packages/ui-web` (and exported from there); calling contexts should import from `@iconicedu/ui-web` instead of defining their own UI primitives.
- Theming uses `ThemeKey` and `theme-*` classes; avoid inline colors.
- Keep mobile responsiveness in mind for all layouts.

## 7. Naming & File Conventions

- Use `kebab-case` for files and folders.
- Components are `PascalCase`.
- VMs are suffixed with `VM`.
- Keep related code colocated; avoid duplicate utilities.

## 8. Error Handling & Validation

- Validate all inputs on the API layer (NestJS).
- Use typed errors and surface user-safe messages in UI.
- Never suppress errors silently; log with context.

## 9. Performance & Scalability Principles

- Avoid unnecessary data mapping or heavy client transforms.
- Use pagination/cursors for message and thread lists.
- Prefer server-side aggregation over client-side computation.
- Keep UI lists virtualizable and avoid deep nesting in render loops.

## 10. Testing Expectations

- For every new file and any updated file, add unit tests that cover basic usage and edge cases.
- Co-locate tests with the owning package/app conventions and keep them deterministic.
- Run relevant test suites for the changes and ensure they pass; if failures occur, fix them before finishing.
- After every code change, run `pnpm turbo run test` and fix any failures before finishing.

## 11. Feature Toggle Policy (Web)

- All new user-facing features in `apps/web` must ship behind a feature toggle and default to OFF.
- Use the Vercel Flags SDK catalog in `apps/web/flags.ts` as the source of truth.
- Do not add ad-hoc rollout checks when a feature flag is required.
- Rollout lifecycle per feature: `introduce (off)` -> `enable gradually` -> `remove stale flag`.
- Exemptions are maintenance-only and require `flag-exempt: <reason>` in PR body or commit message.

### Feature Flag Checklist

1. Add a stable key in `apps/web/flags.ts` (`feature-area-action` naming).
2. Keep `defaultValue: false` and explicit `decide()` behavior.
3. Gate server behavior and UI behavior with the flag.
4. Add/update tests for flag metadata and OFF/ON behavior.
5. Remove stale flags after full rollout.
