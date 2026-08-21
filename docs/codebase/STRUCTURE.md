# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path                        | Purpose                                                                                                                                 | Evidence                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------- |
| `apps/web/`                 | Next.js 15 frontend (guardian/educator/admin web UI)                                                                                    | `apps/web/package.json`                                     |
| `apps/mobile/`              | Expo 55 / React Native 0.83.2 mobile app                                                                                                | `apps/mobile/package.json`                                  |
| `apps/api/`                 | NestJS 11 backend — owns all table access, validation, business logic                                                                   | `apps/api/package.json`                                     |
| `packages/shared-types/`    | Cross-app TypeScript types: `rows/`, `vm/`, `payloads/`, `shared/`                                                                      | `packages/shared-types/src/`                                |
| `packages/ui-web/`          | Shared web UI library (shadcn/Radix + Tailwind)                                                                                         | `packages/ui-web/src/`                                      |
| `packages/ui-native/`       | Shared native UI library (NativeWind)                                                                                                   | `packages/ui-native/src/`                                   |
| `packages/utils/`           | Framework-neutral shared utilities                                                                                                      | `packages/utils/src/`                                       |
| `packages/config-eslint/`   | Shared ESLint flat-config presets (`base`, `next`, `react-native`)                                                                      | `packages/config-eslint/`                                   |
| `packages/config-tsconfig/` | Shared `tsconfig.base.json` extended by all apps/packages                                                                               | `packages/config-tsconfig/`                                 |
| `supabase/migrations/`      | 158 timestamped SQL migrations — schema source of truth                                                                                 | `supabase/migrations/` (`ls                                 | wc -l`) |
| `supabase/functions/`       | 3 Deno edge functions: `channel-read-state-repair`, `events-dispatch`, `reminders-dispatch` (pg_cron-triggered callers into `apps/api`) | `supabase/functions/*/index.ts`                             |
| `supabase/seed.sql`         | Local seed data                                                                                                                         | `supabase/seed.sql`                                         |
| `docs/`                     | Canonical engineering documentation hub                                                                                                 | `docs/README.md`                                            |
| `scripts/`                  | Repo automation: local setup, guards, commit/PR helpers                                                                                 | `scripts/*.mjs`                                             |
| `.github/workflows/`        | CI (`ci.yml`) + manual EAS/native build workflows                                                                                       | `.github/workflows/`                                        |
| `.husky/`                   | Git hooks: pre-commit (lint-staged + affected lint/typecheck), commit-msg (commitlint), pre-push (`prepush:check`)                      | `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push` |

### 2) Entry Points

- Web: `apps/web/app/layout.tsx` (root layout) via Next.js App Router; no `middleware.ts` exists.
- Mobile: `expo-router/entry` (declared as `"main"` in `apps/mobile/package.json`) → `apps/mobile/app/_layout.tsx` (root layout).
- API: `apps/api/src/main.ts` — bootstraps `AppModule`, applies request-context middleware, global `ValidationPipe`, mounts Swagger at `/docs`, listens on `PORT` (default 3001 locally).
- Secondary entry points: Supabase edge functions (`supabase/functions/*/index.ts`), root dev orchestrator `scripts/dev.mjs` (`pnpm dev`), API script `apps/api/scripts/dev.mjs`.
- Entry selection: root `package.json` scripts dispatch to `turbo run <task> --filter=<app>`; Turborepo resolves each workspace's own `package.json` script.

### 3) Module Boundaries

| Boundary                                 | What belongs here                                                                                              | What must not be here                                                                   | Evidence                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web`, `apps/mobile`                | Routes/screens, UI composition, calling `apps/api` via typed HTTP clients, Supabase Auth/Realtime/Storage only | Direct `supabase.from(...)` table access, business validation, service-role credentials | `docs/decisions/004-api-first-frontend-boundary.md`, `AGENTS.md` |
| `apps/api`                               | All table reads/writes, DTO validation, business logic, privileged operations, scheduled/event-pipeline jobs   | UI rendering                                                                            | `apps/api/src/modules/*`                                         |
| `packages/shared-types`                  | Cross-app Rows/VMs/Payloads/enums                                                                              | App-specific or framework-specific logic                                                | `packages/shared-types/src/`                                     |
| `packages/ui-web` / `packages/ui-native` | Reusable, portable UI components (no app routing/context deps)                                                 | Business logic, direct API calls                                                        | `packages/ui-web/src/`, `packages/ui-native/src/`                |
| `packages/utils`                         | Pure, side-effect-free, framework-neutral helpers                                                              | React/RN/Next-specific code                                                             | `packages/utils/src/`                                            |
| `apps/web` ↔ `apps/mobile`               | —                                                                                                              | Neither app may import from or call the other's routes                                  | `AGENTS.md`                                                      |

### 4) Naming and Organization Rules

- File naming: kebab-case throughout all apps and packages (e.g. `apps/mobile/src/providers/auth-provider.tsx`, `apps/api/src/modules/schedules/dto/replace-schedules.dto.ts`, `apps/web/app/(app)/[orgSlug]/admin/users/page.tsx`). No PascalCase filenames found in a sample sweep.
- Directory organization: feature-based within each app (`apps/api/src/modules/<feature>/`, `apps/web/lib/<feature>/`, `apps/mobile/src/components/<feature>/`), not layer-based at the top level.
- API modules follow `*.controller.ts` / `*.service.ts` / `*.module.ts` / `*.guard.ts` with a per-module `dto/` subfolder.
- Web routes use Next.js App Router conventions: route groups `(auth)`, `(app)`, `(marketing)`, `(public)`, dynamic segments `[orgSlug]`, `api/` route handlers, `actions/` for server actions.
- Mobile routes mirror this via Expo Router: `(auth)/`, `(app)/(tabs)/`, dynamic segments `[channelId]`.
- Import aliasing: `tsconfig.base.json` defines `@iconicedu/web/*`, `@iconicedu/api/*`, `@iconicedu/mobile/*`, `@iconicedu/ui-web/*`, `@iconicedu/ui-native/*`, `@iconicedu/shared-types(/*)`, `@iconicedu/utils(/*)`; mobile additionally uses local `@/*` → `./src/*`.

### 5) Evidence

- `docs/codebase/.codebase-scan.txt` (directory tree, monorepo signals)
- `tsconfig.base.json` (path aliases)
- `apps/api/src/main.ts`, `apps/web/app/layout.tsx`, `apps/mobile/app/_layout.tsx`
- `AGENTS.md`, `docs/decisions/004-api-first-frontend-boundary.md`

## Extended Sections (Optional)

### Mobile route tree (verified, corrects prior assumption of "Schedule" tab)

```
app/
├── _layout.tsx, index.tsx
├── (auth)/            login.tsx, otp.tsx, profile-setup.tsx
└── (app)/
    ├── (tabs)/         index (Home), messages, inbox (Notifications), account
    ├── profile/index.tsx
    ├── channel/[channelId].tsx
    ├── dm/[channelId].tsx
    ├── spaces/index.tsx, spaces/[channelId].tsx
    └── settings/       account-info, family, location, notifications, preferences, profile, privacy-data
```

Tab bar is **Home / Messages / Notifications (inbox) / Account** — verified in `apps/mobile/app/(app)/(tabs)/_layout.tsx`.

### apps/api/src top-level

`modules/` (26 feature modules), `lib/` (activity-feed, notifications, flags, mobile-data, supabase clients, http helpers), `prisma/`, `observability/` (request context, logging interceptor, global exception filter), `analytics/` (PostHog wrapper).
