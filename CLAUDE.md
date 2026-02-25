# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
pnpm dev              # All apps in parallel
pnpm dev:web          # Web + ui-web
pnpm dev:mobile       # Mobile + ui-native
pnpm dev:api          # API only
```

### Building
```bash
pnpm build:packages   # Build shared packages first (required before apps)
pnpm build            # Build everything
pnpm build:web        # Web + dependencies
pnpm build:api        # API (runs prisma generate first)
```

### Testing
```bash
pnpm test                           # All tests
pnpm test:web                       # Web tests (Vitest)
pnpm test:mobile                    # Mobile tests (Jest)
pnpm --filter web test -- path/to/file   # Single test file (web)
pnpm --filter mobile test -- path/to/file # Single test file (mobile)
pnpm --filter web test:e2e          # Playwright E2E
```

### Quality
```bash
pnpm lint             # Lint all
pnpm lint:fix         # Lint + auto-fix
pnpm typecheck        # TypeScript check all
pnpm ci               # Full pipeline: lint → typecheck → test → build
```

### API/Database
```bash
pnpm --filter api db:generate   # Generate Prisma client (required before typecheck)
pnpm --filter api db:migrate    # Run migrations
pnpm --filter api db:studio     # Prisma Studio
```

### Mobile Native
```bash
pnpm mobile:ios                 # iOS Simulator
pnpm mobile:android             # Android Emulator
pnpm --filter mobile prebuild   # Expo prebuild (generates native dirs)
```

## Architecture

### Monorepo Structure
- **`apps/web`** — Next.js 15 (App Router), Supabase SSR, admin/parent workflows
- **`apps/api`** — NestJS 11 + Prisma 7, owns all business logic and writes
- **`apps/mobile`** — Expo 54 + Expo Router, React Native 0.81.5, student/teacher UX
- **`packages/shared-types`** — ViewModels (VMs), row types, mappers, payloads — the cross-app data contract
- **`packages/ui-web`** — shadcn/ui + Radix + Tailwind component library
- **`packages/ui-native`** — NativeWind + rn-primitives component library
- **`packages/utils`** — Shared pure utilities

### Ownership Boundaries
- All writes/mutations go through NestJS API — never direct Supabase writes from client
- VMs live only in `packages/shared-types`; no app-specific logic there
- Reusable UI components belong in `packages/ui-web` (not in `apps/web`); import via `@iconicedu/ui-web`
- Do not import across ownership boundaries (e.g., UI packages into API)

### Data Layer (Web)
When adding DB access for any entity, mirror the `apps/web/lib/user` structure:
- `queries/` — raw Supabase DB queries
- `mappers/` — row → VM translation
- `builders/` — composition/aggregation
- `constants/` — shared select lists
- `derive.ts` — computed fields
- Admin-only helpers go in `apps/web/lib/admin/<entity>.ts`

All user/auth mutations should go through `apps/web/lib/auth/admin-actions.ts`. Server actions in `app/actions/` are preferred for onboarding/settings flows so browsers never talk directly to Supabase.

### Web Routing (`apps/web/app/`)
```
(app)/[orgSlug]/        # Protected routes (org-scoped)
  class-schedule/
  messages/
  inbox/
  spaces/[channelId]/
  dm/[channelId]/
  c/[channelId]/        # Channel view
  admin/                # Admin sub-routes
(marketing)/            # Public routes
actions/                # Server actions
api/                    # Route handlers (messages, channel data, etc.)
```

### Mobile Routing (`apps/mobile/app/`)
```
(auth)/    login, otp, profile-setup
(app)/
  (tabs)/  index (Home), schedule, inbox, messages, account
  spaces/[channelId], channel/[channelId], dm/[channelId]
  settings/  family, account-info, notifications, profile, preferences
```

## Key Conventions

### TypeScript
- Strict mode everywhere
- VMs suffixed with `VM` (e.g., `UserProfileVM`)
- Files and folders in `kebab-case`, components in `PascalCase`
- API payloads kept separate from UI VMs

### Testing
- Web/ui-web: Vitest + jsdom + @testing-library/react
- Mobile/ui-native: Jest (jest-expo preset) + @testing-library/react-native
- Web E2E: Playwright (Chromium only, base URL http://127.0.0.1:3000)
- Co-locate tests with code; run `pnpm turbo run test` after changes

### Mobile-Specific
- Supabase env vars via `Constants.expoConfig?.extra` (not `process.env`)
- NativeWind className props require type casts: `const StyledX = X as React.ComponentType<XProps & { className?: string }>`
- `accessibilityState={{ disabled }}` — `disabled` must not be `null` (use `disabled ?? false`)
- `Skeleton` width/height must be `number`, not `string`
- Reanimated v4: no Babel plugin needed; react-native-worklets still required for NativeWind

### Theming
- Use `ThemeKey` and `theme-*` CSS classes for colors — no inline color values
- Compose shadcn primitives rather than building custom components from scratch

## Build Infrastructure Notes

- **`node-linker=hoisted`** in `.npmrc` — required for jest-expo + pnpm compatibility; do not remove
- **Turbo pipeline**: packages must build before apps (`^build` dependency chain)
- **Prisma**: `prisma generate` must run before `apps/api` typecheck or build
- **React 19.1.0** pinned via pnpm override — required for Expo SDK 54 compatibility
- **jest-expo version** must match Expo SDK version (currently jest-expo@54 for SDK 54)
- Mobile tests use a custom `jest.resolver.js` that strips the `exports` field from `expo-modules-core` and a `jest.setup.js` that patches `NativeModules.UIManager`
- NativeWind Babel preset is excluded in test environment
