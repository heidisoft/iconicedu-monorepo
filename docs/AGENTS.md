# AI Project Instructions

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

## 4. Data Access & Security Rules

- All writes and business logic must go through NestJS API.
- Supabase RLS must remain enabled for all tables.
- Never use service role keys in client apps.
- Realtime is allowed only via Supabase channels with RLS policies in place.
- Avoid client-side direct DB mutations; use API contracts.
- When data must be fetched or mutated during onboarding or user settings flows, prefer server actions (e.g., `app/actions/*`) so the browser never talks directly to Supabase and we keep auth/cleanup logic centralized.
- All user/auth-related interactions—retrieval, invites, role/status changes, MFA factors, OAuth client administration, etc.—should first be routed through the shared admin actions under `apps/web/lib/auth/admin-actions.ts`. Review that file before adding new user-facing mutations and only branch outside it when the existing helpers cannot be reused.
- Admin pages should rely on curated `apps/web/lib/<domain>` helpers for data fetching, mapping and status normalization instead of embedding Supabase queries directly inside layouts. This keeps the UI layer agnostic of Supabase and lets future data source changes (e.g., migrating from Supabase to another provider) happen inside the shared lib boundary.
- When adding DB queries for any entity, follow the `apps/web/lib/user` structure: `queries/` for raw DB access, `mappers/` for row-to-VM translation, `builders/` for composition/aggregation, `constants/` for shared select lists, and `derive.ts` for computed fields. Create a matching `apps/web/lib/<entity>` folder with the same layout and place admin-only helpers in `apps/web/lib/admin/<entity>.ts` (or `apps/web/lib/admin/<entity>/` if it grows).

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
