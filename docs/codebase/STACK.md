# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area                | Value                                                                                              | Evidence                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Primary language    | TypeScript (strict)                                                                                | `tsconfig.base.json`                                                      |
| Runtime + version   | Node `24.x` (`.nvmrc` pins `24.19.0`)                                                              | `.nvmrc`, `.tool-versions`, `package.json:engines`                        |
| Package manager     | pnpm `10.33.0` for local development and CI; compatible pnpm 10 releases are accepted by `engines` | `.tool-versions`, `package.json:packageManager`, `package.json:engines`   |
| Module/build system | pnpm workspaces + Turborepo `^2.9.14` task pipeline                                                | `pnpm-workspace.yaml`, `turbo.json`, `package.json:devDependencies.turbo` |

### 2) Production Frameworks and Dependencies

| Dependency                                                   | Version                                     | Role in system                                                                                               | Evidence                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `next`                                                       | `^15.5.18`                                  | Web app framework (App Router)                                                                               | `apps/web/package.json`                                                                     |
| `react` / `react-dom`                                        | `19.2.4` (pinned via root `pnpm.overrides`) | UI runtime, shared web/mobile                                                                                | `pnpm-lock.yaml:overrides`                                                                  |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | 11.x                                        | API framework                                                                                                | `apps/api/package.json`                                                                     |
| `@prisma/client`, `@prisma/adapter-pg`                       | 7.x                                         | Typed ORM over Supabase Postgres                                                                             | `apps/api/package.json`                                                                     |
| `@supabase/supabase-js`, `@supabase/ssr`                     | latest                                      | Auth/Realtime/Storage client (web, mobile, API service-role)                                                 | `apps/web/package.json`, `apps/mobile/package.json`, `apps/api/src/lib/supabase/service.ts` |
| `expo`                                                       | `^55.0.0`                                   | Mobile runtime/SDK                                                                                           | `apps/mobile/package.json`                                                                  |
| `expo-router`                                                | `^55.0.0` (v7)                              | Mobile file-based routing                                                                                    | `apps/mobile/package.json`                                                                  |
| `react-native`                                               | `0.83.2`                                    | Mobile native runtime                                                                                        | `apps/mobile/package.json`                                                                  |
| `react-native-reanimated`                                    | `~4.2.1`                                    | Mobile animation                                                                                             | `apps/mobile/package.json`                                                                  |
| `nativewind`                                                 | `^4.2.1`                                    | Tailwind-style styling for RN                                                                                | `apps/mobile/package.json`                                                                  |
| `@tanstack/react-query`                                      | `^5.90.11`                                  | Client data fetching/cache (actively used in mobile; previously present but unused in web — removed in #182) | `apps/mobile/package.json`                                                                  |
| `posthog-js` / `posthog-node` / `posthog-react-native`       | latest                                      | Analytics + feature flags across all three apps                                                              | `apps/web/package.json`, `apps/api/package.json`, `apps/mobile/package.json`                |
| `@openfeature/server-sdk`                                    | latest                                      | Feature-flag evaluation abstraction over PostHog                                                             | `apps/api/package.json`, `apps/web/package.json`                                            |
| `flags` (Vercel Flags SDK)                                   | latest                                      | Web feature-flag definitions (`apps/web/flags.ts`)                                                           | `apps/web/package.json`                                                                     |
| `class-validator` / `class-transformer`                      | latest                                      | Declared for API DTO validation; largely unused in practice (see [CONCERNS.md](CONCERNS.md))                 | `apps/api/package.json`                                                                     |
| `@daily-co/daily-js`, `@daily-co/daily-react`                | latest                                      | Live video sessions (web)                                                                                    | `apps/web/package.json`                                                                     |
| `date-fns-tz`                                                | `^3.2.0`                                    | Timezone-aware date handling (root dependency)                                                               | `package.json`                                                                              |

### 3) Development Toolchain

| Tool                                                            | Purpose                                                                 | Evidence                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| ESLint `^9.39.1` (flat config) + `@typescript-eslint` `^8.48.0` | Lint                                                                    | `eslint.config.mjs`, `packages/config-eslint`                |
| Prettier `^3.7.2`                                               | Format (`singleQuote`, `semi`, `trailingComma: all`, `printWidth: 90`)  | `.prettierrc`                                                |
| TypeScript `^5.9.3`, strict mode                                | Typecheck                                                               | `tsconfig.base.json` (`"strict": true`)                      |
| Turborepo `^2.9.14`                                             | Build/task orchestration + caching                                      | `turbo.json`                                                 |
| Vitest `^4.1.0` + `@testing-library/react` `^16.3.0`            | Web/ui-web unit tests                                                   | `apps/web/vitest.config.ts`, root `package.json`             |
| Jest (NestJS default)                                           | API unit tests                                                          | `apps/api/package.json`                                      |
| jest-expo `^55.0.0` + `@testing-library/react-native`           | Mobile/ui-native unit tests                                             | `apps/mobile/jest.config.js`                                 |
| Playwright                                                      | Web E2E                                                                 | `apps/web/e2e/`                                              |
| Husky `^9.1.7` + lint-staged `^16.2.7`                          | Git hooks (pre-commit lint/typecheck, commit-msg lint, pre-push checks) | `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`  |
| Prisma CLI                                                      | DB client generation from Supabase-owned schema                         | `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts` |
| Supabase CLI                                                    | Local stack, migrations, edge functions                                 | `supabase/migrations/`, `supabase/functions/`                |
| EAS CLI                                                         | Mobile native builds/OTA updates                                        | `eas.json`, `.github/workflows/eas-*.yml`                    |

### 4) Key Commands

```bash
pnpm setup:local        # first-time setup (requires Docker running)
pnpm build:packages      # build packages/* before any app lint/typecheck/test
pnpm dev                 # run web + api + mobile dev servers together
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci               # format:check + commitlint + guards + full turbo lint/typecheck/test/build
```

### 5) Environment and Config

- Config sources: `apps/api/.env.example`, `apps/web/.env.local.example`, `apps/mobile/.env.example`, `turbo.json` (`globalDependencies`/task `env` allowlist), `scripts/setup-local.sh`.
- Required env vars (non-exhaustive, by app):
  - **API**: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `INTERNAL_REMINDERS_TOKEN`, `INTERNAL_EVENTS_TOKEN`, `INTERNAL_ACTIVITY_FEED_TOKEN`, `EXPO_ACCESS_TOKEN`, `POSTHOG_KEY`, `POSTHOG_HOST`, `PORT`.
  - **Web**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_REMINDERS_TOKEN`, `INTERNAL_EVENTS_TOKEN`, `INTERNAL_ACTIVITY_FEED_TOKEN`, `POSTHOG_KEY`, `POSTHOG_HOST`.
  - **Mobile**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY`), `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`, `POSTHOG_KEY`, `POSTHOG_HOST`.
- Deployment/runtime constraints: Web deploys to Vercel; API deploys to Railway (`apps/api/railway.toml`); mobile ships via EAS Build/Update to App Store and Play Store. `node-linker=hoisted` is required in `.npmrc` for jest-expo/pnpm compatibility.

### 6) Evidence

- `package.json` (root scripts, engines, devDependencies)
- `tsconfig.base.json`, `turbo.json`, `pnpm-workspace.yaml`
- `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json`
- `.github/workflows/ci.yml`

## Extended Sections (Optional)

Not populated — root/app package manifests and CI config above are sufficient for this repo's complexity.
