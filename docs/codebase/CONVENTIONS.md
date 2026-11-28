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

#### Web theme colors

- Use the shared `Button` for standard actions. Custom filled action links and buttons use `bg-action`, `text-action-foreground`, and `hover:bg-action/85`, including dashboard and marketing calls to action.
- Highlight live-session date pills and the current calendar date with `bg-action` and `text-action-foreground`. Nested date labels inherit the foreground so unavailable states remain readable.
- Keep `primary` tokens for positive status indicators, live badges, and supporting accents. The action and primary palettes each have light and dark values in `packages/ui-web/src/styles/global.css`.
- `flag-exempt: theme-token consistency maintenance` applies when correcting existing control colors without changing available actions or their behavior.

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

### Icons

- Use Lucide for interface icons: `lucide-react` on web and `lucide-react-native`
  on mobile. Keep brand artwork, decorative SVG patterns, and emoji content as assets.
- Reuse the same icon for the same action across toolbars, menus, and panels.
  Meeting controls use `Mic`/`MicOff`, `Video`/`VideoOff`, `MonitorUp`/`MonitorX`
  for screen sharing, `Share` for meeting invitations, `Users` for participants,
  `MessageSquare` for meeting chat, `Hand` for raised hands, `SmilePlus` for reactions,
  `Pencil` for whiteboard drawing, `Settings` for setup, `Ellipsis` for more controls,
  `Circle`/`Square` for starting/stopping recording, and `PhoneOff` for leaving.
  Use `ExternalLink` for opening another tab.
- Use `IconActionButton` from `@iconicedu/ui-web/ui/icon-action-button` for icon-only
  meeting actions. Its exported `IconActionButtonProps` interface requires an
  accessible `label` and icon content; the tooltip defaults to that label. Use
  `tooltip` to explain a disabled action or supply a more detailed description.
  Forward trigger props and refs through this primitive; do not add nested tooltip
  wrappers. Toggle actions supply `aria-pressed`; disclosure triggers retain their
  `aria-expanded`/`aria-haspopup` behavior. Visible text buttons and menu rows can
  use their visible labels directly.
- Meeting toolbar icons use 20 CSS pixels and a stroke width of 2. Compact media
  indicators and menu rows may use smaller icons appropriate to their context.

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

### Country-specific profile locations

Mobile onboarding uses `getCountryAddressFields` from `@iconicedu/shared-types` to display the supported city, region, and postal-code fields and their required status. The country-level metadata snapshot in `packages/shared-types/src/shared/country-address-metadata.ts` comes from [Google libaddressinput address metadata](https://chromium-i18n.appspot.com/ssl-address/data/US), with the upstream license alongside it. Refresh the snapshot when country formats change; preserve its attribution and validate the postal-code examples.

`PUT /profiles/:id/location` validates the complete location against the selected country's requirements using the authenticated session and RLS. Postal codes stay strings, including leading zeroes; unsupported fields are stored as null. Onboarding completeness uses the same API validation rules. This is format validation, not address or postal-code existence verification.

Administrative-area lists in `country-regions.ts` use the same upstream metadata and include aliases for provider abbreviations and local names. Where available, mobile displays a searchable state/province/emirate picker; the API normalizes recognized region values to the displayed label and rejects unknown selections.

`GET /profiles/location-hint?timezone=...` is authenticated and enriches a known timezone city through Nominatim. Requests contain the representative city/country, never device coordinates. Lookups are deduplicated, throttled, bounded, and cached; ambiguity, provider errors, and unsupported timezone IDs keep the offline city/country hint. Only returned, format-valid postal codes are suggested. Users must review these editable hints because a timezone covers more than one actual address. Device location continues to prefill native reverse-geocoding results. Country changes reset the previous country's region; asynchronous timezone hints preserve user edits and cannot supersede a newer device-location request.

### Native popup spacing

Keep existing section layouts when adding mobile editing. Page-sheet editors and
selection lists use `SheetContent` from `@iconicedu/ui-native`: a sheet-local
safe-area provider, 24-point top spacing, and left/right/bottom safe-area edges.
Do not reuse the presenting screen’s top inset inside an iOS page sheet. Use
20-point horizontal content gutters and at least 44-point action/close targets.
Custom bottom sheets include home-indicator clearance plus 16 points of breathing
room; centered dialogs include safe-area clearance and 20-point outer gutters.
Keep system photo, camera, and confirmation dialogs native. Preserve edge-to-edge
media viewers, applying safe areas to their controls rather than the media.

Native popup headers place Close/Cancel on the left and Edit/Save/Done on the
right. Center a sheet title between equally sized action areas. Keep section
Edit actions at the right of their existing heading and the photo Edit action
below the image. Do not move search-clear controls: they belong inside the
search field. Use the system-provided action order for native alerts and pickers.
