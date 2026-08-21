# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test frameworks: **Vitest `^4.1.0`** (web, `ui-web`), **Jest** — NestJS default (API), **jest-expo `^55.0.0`** (mobile, `ui-native`).
- Assertion/mocking tools: `@testing-library/react` `^16.3.0` + `@testing-library/jest-dom` `^6.9.0` (web/ui-web), `@testing-library/react-native` (mobile/ui-native), built-in Jest `expect` (API), Playwright (web E2E).
- Commands:

```bash
pnpm test                # commitlint + guards + turbo run test (all workspaces)
pnpm test:web             # web + ui-web
pnpm test:mobile          # mobile + ui-native
pnpm test:api             # api
pnpm test:affected        # only changed workspaces
pnpm test:coverage
pnpm --filter web test:e2e   # Playwright
```

### 2) Test Layout

- Test file placement: co-located next to source — `*.test.ts(x)` (web, mobile, ui-web, ui-native) or `*.spec.ts` (API) — not a separate `tests/` tree. Mobile also has a small `apps/mobile/src/__tests__/` catch-all for cases not tied to one module.
- Naming convention: mirrors the source file name exactly (e.g. `channels.service.ts` → `channels.service.spec.ts`; `flags.ts` → `flags.test.ts`).
- Setup files: `apps/web/vitest.setup.ts` (Vitest global setup, `environment: 'jsdom'`); `apps/mobile/jest.setup.js` (patches `NativeModules.UIManager`, hand-mocks `expo-audio`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-webview`, `react-native-pdf`); `apps/mobile/jest.resolver.js` (strips the `exports` field from `react-native`/`expo-modules-core`/`expo` so deep internal import paths resolve under pnpm hoisting).

### 3) Test Scope Matrix

| Scope        | Covered?       | Typical target                                                              | Notes                                                                                                                                                                                                                                                                  |
| ------------ | -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Yes            | Services, mappers, pure functions, hooks                                    | e.g. `apps/api/src/modules/messages/messages.service.spec.ts`, `apps/api/src/lib/notifications/decision-engine.spec.ts`                                                                                                                                                |
| Component    | Yes            | Non-trivial UI components (web, mobile)                                     | e.g. `apps/mobile/src/components/activity/activity-item.test.tsx`, `packages/ui-web/src/components/marketing/marketing-components.test.tsx` — both high-churn per git history                                                                                          |
| Integration  | Partial        | API endpoints via NestJS testing module                                     | `apps/api/package.json` defines `test:e2e` → `./test/jest-e2e.json`, but **no `apps/api/test/` directory exists** — e2e is configured but unimplemented                                                                                                                |
| E2E          | Yes (web only) | User flows (marketing smoke, sidebar navigation, supervised read-only mode) | `apps/web/e2e/{marketing-smoke,sidebar-learning-spaces,supervised-readonly}.spec.ts`, requires local Supabase + API running; env vars `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_SKIP_WEBSERVER`, `PLAYWRIGHT_AUTH_STATE`, `PLAYWRIGHT_ORG_SLUG`, `PLAYWRIGHT_SUPERVISED_PATH` |
| E2E (mobile) | No             | —                                                                           | `[TODO]` — no Detox/Maestro or equivalent mobile E2E harness found                                                                                                                                                                                                     |

### 4) Mocking and Isolation Strategy

- API specs mock the Supabase client factories directly (`jest.mock('.../lib/supabase/service')`, etc.) rather than bootstrapping a full `@nestjs/testing` `TestingModule` — `@nestjs/testing` is a devDependency but was not observed in use in sampled specs.
- Web/mobile tests mock the typed API client modules and Supabase client modules (`vi.mock`/`jest.mock`) rather than hitting real network calls; `apps/web/flags.test.ts` mocks `evaluatePosthogBooleanFlag` via `vi.mock` and asserts each flag's `.key`/`.defaultValue`.
- Common failure mode: pnpm's hoisted linker plus Expo's package `exports` fields is the recurring source of mobile test breakage — hence the two dedicated workaround files (`jest.setup.js`, `jest.resolver.js`); any Expo SDK bump risks re-breaking this and requires re-verifying jest-expo version alignment (`jest-expo` must match the Expo SDK major version).

### 5) Coverage and Quality Signals

- Coverage tool: `@vitest/coverage-v8` (web, `apps/web/vitest.config.ts:57-63` — reports text/json-summary/html, no threshold set), Jest `collectCoverageFrom` (mobile, `apps/mobile/jest.config.js:27-29` — reporting only, no threshold), API `apps/api/package.json` Jest config (no `coverageThreshold` key present). **No workspace enforces a minimum coverage percentage** — all three configs report coverage but do not gate on it.
- Current reported coverage: `[TODO]` — not measured in this pass (would require running `pnpm test:coverage`).
- Known gaps/flaky areas: `apps/api/test/` (e2e) is absent despite being configured — integration-level API testing is a coverage gap; no mobile E2E coverage at all. High-churn test files (`apps/web/vitest.config.ts`, `apps/mobile/src/components/activity/activity-item.test.tsx`, `apps/web/flags.test.ts`) suggest these areas change frequently and may be worth watching for flakiness — see [CONCERNS.md](CONCERNS.md).

### 6) Evidence

- `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`
- `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.js`, `apps/mobile/jest.resolver.js`
- `apps/api/package.json` (`test:e2e` script, missing `test/` dir)
- `apps/web/e2e/README.md`
- `docs/testing/mobile-test-plan.md` (manual test plan, not automated)

## Extended Sections (Optional)

Not populated — the scope matrix and mocking notes above are sufficient for this repo's testing maturity level.
