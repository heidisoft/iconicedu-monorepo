# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item               | Rule                                                                                         | Example                                                                                                      | Evidence                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Files              | kebab-case everywhere (routes, components, services, hooks)                                  | `apps/mobile/src/providers/auth-provider.tsx`, `apps/api/src/modules/schedules/dto/replace-schedules.dto.ts` | Cross-app file sweep                                                                       |
| API modules        | `*.controller.ts` / `*.service.ts` / `*.module.ts` / `*.guard.ts`, DTOs in per-module `dto/` | `apps/api/src/modules/channels/channels.controller.ts`                                                       | `apps/api/src/modules/*`                                                                   |
| Functions/methods  | camelCase, verb-first for actions                                                            | `extractBearerToken()`, `resolveApiBaseUrl()`                                                                | `apps/api/src/lib/http/authenticated-request.ts`, `apps/mobile/src/lib/api/http-client.ts` |
| Types/interfaces   | `type` preferred for domain objects/unions; `interface` for component props/class contracts  | `type MessageVM = {...}` vs `type ButtonProps = {...}`                                                       | `packages/shared-types/src/vm/`                                                            |
| Constants/env vars | `SCREAMING_SNAKE_CASE` for env vars; grouped per-app `.env.example`                          | `INTERNAL_EVENTS_TOKEN`, `EXPO_PUBLIC_API_URL`                                                               | `apps/api/.env.example`, `apps/mobile/.env.example`                                        |

### 2) Formatting and Linting

- Formatter: Prettier `^3.7.2` — `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 90`. Config: `.prettierrc`.
- Linter: ESLint `^9.39.1` flat config (`eslint.config.mjs`) built on shared presets in `packages/config-eslint` (`base`, `next`, `react-native`); `@typescript-eslint` `^8.48.0`.
- Most relevant enforced rules (from `eslint.config.mjs`): TypeScript parser with ES2020/module source type, React + React Hooks plugins active, `ignores` excludes `node_modules`, `dist`, `coverage`, `.next`, generated Next files.
- Run commands: `pnpm lint`, `pnpm lint:affected`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`.

### 3) Import and Module Conventions

- Path aliases (not relative-only): `@iconicedu/web/*`, `@iconicedu/api/*`, `@iconicedu/mobile/*`, `@iconicedu/ui-web/*`, `@iconicedu/ui-native/*`, `@iconicedu/shared-types(/*)`, `@iconicedu/utils(/*)` defined in `tsconfig.base.json`; mobile additionally uses `@/*` → `./src/*`.
- Alias vs relative: cross-package imports always use the `@iconicedu/*` alias (workspace packages are consumed via `workspace:*` dependency + alias, never relative `../../packages/...` reach-through).
- Cross-app import policy: **hard-forbidden** — `apps/web` and `apps/mobile` must never import from each other; shared code must move into a `packages/*` workspace (`AGENTS.md`).
- Public exports/barrel policy: `packages/shared-types` re-exports everything through `src/index.ts`; `packages/ui-web`/`packages/ui-native` are imported via subpath exports (e.g. `@iconicedu/ui-web/ui/button`) rather than one flat barrel.

### 4) Error and Logging Conventions

- API error strategy: single global `@Catch()` exception filter (`apps/api/src/observability/global-exception.filter.ts`) normalizes `HttpException` vs. unknown errors, attaches `requestId`/route/user context, calls `reportObservedError` (`@iconicedu/utils`) and `AnalyticsService.capture('api request failed', ...)`, and returns `{statusCode, message, timestamp, path, requestId}` to the client — no raw stack traces leave the API.
- API logging: plain NestJS `Logger` (no Winston/Pino) — `error` level for 5xx, `warn` otherwise; `RequestLoggingInterceptor` (`apps/api/src/observability/request-logging.interceptor.ts`) logs and captures analytics per request, flags slow requests via `API_SLOW_REQUEST_THRESHOLD_MS`.
- Web/mobile HTTP clients: throw a plain `Error` on non-OK responses (`API error {status}` or server-provided `message`); 204/empty/non-JSON responses resolve to `undefined` — no client-side retry/backoff observed.
- Sensitive-data redaction: `AGENTS.md` mandates user-safe error messages to clients with diagnostic detail retained server-side only; service-role keys and JWT secrets must never appear in logs, fixtures, or PRs.
- TypeScript null policy: database rows use `null` (matching Postgres), function parameters/optional fields use `undefined`; explicit `?? false` required where RN accessibility props reject `null`.

### 5) Testing Conventions

- Test file naming/location: co-located `*.test.ts(x)` (web, mobile) or `*.spec.ts` (API), next to the source file — not a separate `tests/` tree, with a small `apps/mobile/src/__tests__/` catch-all for cross-cutting cases.
- Mocking strategy: API specs `jest.mock(...)` the Supabase client factories rather than bootstrapping a full NestJS `TestingModule` (`@nestjs/testing` is a devDependency but not used in sampled specs); web/mobile tests use `vi.mock`/`jest.mock` for API clients and Supabase clients.
- Coverage expectation: `pnpm test:coverage` / `test:coverage:affected` exist at the root; no enforced numeric threshold found in `vitest.config.ts` or `jest.config.js` — `[TODO]` confirm whether one is enforced in CI beyond running the command.

### 6) Evidence

- `eslint.config.mjs`, `.prettierrc`, `tsconfig.base.json`
- `apps/api/src/observability/global-exception.filter.ts`, `apps/api/src/observability/request-logging.interceptor.ts`
- `apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`

## Extended Sections (Optional)

### Known convention violations to clean up

- Global `ValidationPipe` registered in `apps/api/src/main.ts` but zero `class-validator` decorator usage found in `apps/api/src` — the declared validation convention (decorator-based DTOs) does not match actual practice (hand-rolled per-field checks). See [CONCERNS.md](CONCERNS.md).
- `apps/mobile/.env.example` comments say config is read via `Constants.expoConfig?.extra`, but `apps/mobile/src/lib/api/http-client.ts` and `apps/mobile/src/lib/supabase/client.ts` read `process.env.EXPO_PUBLIC_*` directly — both patterns coexist (`apps/mobile/src/providers/analytics-provider.tsx` uses `Constants.expoConfig?.extra` with a `process.env` fallback, which is the only file following the documented convention).
