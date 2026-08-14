# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Dev
pnpm dev                    # full stack (web + mobile + api)
pnpm dev:web
pnpm dev:mobile             # preferred — keeps Expo's i/a terminal controls
pnpm dev:api
pnpm build:packages         # required after any structural package change

# Quality
pnpm lint
pnpm typecheck
pnpm test
pnpm run ci                 # full pipeline (build → lint → typecheck → test)

# Scoped
pnpm run ci:web
pnpm run ci:mobile
pnpm run ci:api
pnpm --filter web test:watch
pnpm --filter mobile test -- --testPathPattern="<pattern>"

# Database
supabase db reset
pnpm --filter api db:generate
supabase migration new <description>
```

**If you see "module not found" in lint/typecheck, run `pnpm build:packages` first.** Turborepo requires packages to be built before apps can consume them.

Local URLs: Web → `localhost:3000`, API → `localhost:3001`, Swagger → `localhost:3001/docs`. Run `supabase status` for live Supabase endpoints.

---

## Architecture

### Stack

- **Web**: Next.js 15 App Router — default to Server Components, `'use client'` only when hooks/browser APIs are needed
- **API**: NestJS 11 + Prisma 7 — owns all business logic, validation, writes, and service-role operations
- **Mobile**: Expo 55 + Expo Router v7 + React Query — file-based routing, Supabase Realtime for live updates
- **DB**: Supabase (Postgres + RLS + Realtime + Storage)
- **Shared**: `packages/shared-types`, `packages/ui-web`, `packages/ui-native`, `packages/utils`

### Hard Boundaries — Non-Negotiable

**Frontend apps (`web`, `mobile`) are UI-only.** They must not query the database directly.

| Operation                        | Allowed in FE | Notes                                      |
| -------------------------------- | ------------- | ------------------------------------------ |
| `supabase.auth.*`                | ✅            | Only correct way to manage sessions        |
| `supabase.channel(...)` Realtime | ✅            | RLS must be enforced on the channel        |
| `supabase.storage.*`             | ✅            | No server logic needed; RLS governs access |
| `supabase.from('table').*`       | ❌            | Belongs in `apps/api` only                 |
| Service-role key                 | ❌            | Never in FE; `apps/api` only               |

Any `supabase.from(...)` call in `apps/web` or `apps/mobile` is a violation. Move the table operation to an `apps/api` endpoint.

**HTTP clients:** Web calls API via `createApiClient(supabase)` from `apps/web/lib/api/http-client.ts`. Mobile uses `apiGet/apiPost/apiPut/apiDelete` from `apps/mobile/src/lib/api/http-client.ts`. No cross-app imports.

### Type System Flow

```
DB rows (snake_case, null-heavy)
  → Builder functions (assemble related rows into nested structures)
  → View Models / VMs (camelCase, UI-ready, nested)
  → Components (consume VMs only, never raw rows)
```

VMs live in `packages/shared-types`. When adding a new entity to the API, mirror the `lib/user` structure: `queries/`, `mappers/`, `builders/`, `constants/`, `derive.ts`.

Adding a shared type: add to `packages/shared-types/src/`, re-export from `index.ts`, run `pnpm build:packages`, import as `@iconicedu/shared-types`.

### Web — Data Access Pattern

- **Server Components / Route Handlers**: `createServerClient()` (anon, RLS-enforced) for reads; `createAdminClient()` (service-role) for writes requiring privilege
- **Complex business logic**: call NestJS via `createApiClient`
- **Client state**: React Query only when real-time or mutation state is needed
- **Server Actions**: preferred for mutations over API Route Handlers where possible

### Mobile — Key Patterns

- **Data**: React Query. All queries use stable keys from `queryKeys` in `apps/mobile/src/lib/api/query-keys.ts`.
- **Realtime**: Supabase Realtime channels in `useEffect`, always cleaned up on unmount.
- **Read state / unread counts**: Use `useMarkRead` hook (`apps/mobile/src/hooks/use-mark-read.ts`) for all mark-read operations — it handles optimistic cache updates, the API call, and error rollback in one place. Do not call `applyOptimisticChannelReadState` / `markThreadReadState` directly from screens or components.
- **Unread sync**: `useUnreadSync` (mounted once at tab-layout level) listens to `channel_read_state` Realtime events and does targeted cache invalidation — it checks which cached list contains the changed channel before invalidating.
- **Theme colors**: Always from `useTheme()` → `colors: AppColors`. Never hardcode.
- **NativeWind**: Use `className` for layout/spacing; `StyleSheet.create` (via `makeStyles(colors)`) for theme-dependent values. For components that don't declare `className`, use: `const Styled = View as React.ComponentType<ViewProps & { className?: string }>`.
- **Env vars**: Use `Constants.expoConfig?.extra` — not `process.env` (undefined at runtime).
- **Expo Router**: Pass simple values via search params; pass complex objects via React Query cache (load by ID in destination).

### Messages System — Domain-Specific Patterns

The messages domain is the most complex in the repo. Key concepts:

- **Polymorphic payload model**: each message `type` stores its payload in a separate table (`message_text`, `message_image`, etc.) via `TYPE_TABLE` in `messages.service.ts`.
- **Visibility types**: `all | sender-only | recipient-only | specific-users`. Support channels only use `all` or `specific-users` (built by `buildSupportVisibilityFields` in `apps/api`).
- **Read state is two-level**: channel-level (`channel_read_state` table) and thread-level (same table with `thread_id` set). Both `unread_count` and `thread_unread_count` must be zeroed when marking read.
- **Optimistic updates**: applied immediately to React Query cache, then confirmed with API. On error, invalidate the relevant query key to refetch.
- **Web sidebar**: `markDirectMessageChannelRead` and `markLearningSpaceChannelRead` in `apps/web/lib/sidebar/` handle optimistic sidebar state. Both zero `unreadCount` and `threadUnreadCount`.

### Feature Flags (Web Only)

All new user-facing web features must ship behind a Vercel Flags SDK toggle in `apps/web/flags.ts`, defaulting to `false`. Naming: `feature-area-action`. Gate both server behavior and UI. Remove stale flags after full rollout.

---

## Testing

| App                                  | Framework                   | Command            |
| ------------------------------------ | --------------------------- | ------------------ |
| `apps/web` / `packages/ui-web`       | Vitest + Testing Library    | `pnpm test:web`    |
| `apps/mobile` / `packages/ui-native` | jest-expo + Testing Library | `pnpm test:mobile` |
| `apps/api`                           | Jest (NestJS)               | `pnpm test:api`    |

Tests are co-located with the code they test (`.test.ts` / `.test.tsx` suffix). Mobile test setup: `jest.setup.js` patches `NativeModules.UIManager`; `jest.resolver.js` strips `exports` from `expo-modules-core` (pnpm hoisting fix); NativeWind babel preset excluded in test env.

---

## Local Development Credentials

| Email                              | Role     |
| ---------------------------------- | -------- |
| `iconicedudev@gmail.com`           | Owner    |
| `iconicedudev+educator1@gmail.com` | Educator |
| `iconicedudev+guardian1@gmail.com` | Guardian |
| `iconicedudev+staff1@gmail.com`    | Staff    |

Local password: `Seed123!`. For OTP login locally: `supabase start` → `supabase status` → open Mailpit URL → complete login → get OTP from Mailpit.
