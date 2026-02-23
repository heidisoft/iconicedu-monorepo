# Shared Packages

Documentation for each package in the `packages/` directory.

Packages are internal libraries consumed by apps via `workspace:*` dependencies. They are built by Turborepo before any app can import from them (`pnpm build:packages`).

---

## `@iconicedu/shared-types`

**Location:** `packages/shared-types/`
**Used by:** `web`, `mobile`, `api`, `ui-web`, `ui-native`

Central repository for all cross-app TypeScript types. The type system has three layers:

### Rows

Raw database shapes — what Supabase query results look like. Properties are `snake_case` and match column names exactly. Values are nullable where the DB column is nullable.

```ts
import type { MessageRow } from '@iconicedu/shared-types';
```

Only the query/builder layer should use Row types. Components receive VMs.

### View Models (VMs)

Richly typed objects ready for UI consumption. Properties are `camelCase`, nested, and rarely null (nulls are collapsed at the mapping layer). VMs use discriminated unions on a `type` field.

```ts
import type { MessageVM, ChannelVM, ProfileVM } from '@iconicedu/shared-types';
```

### Payloads

Data shapes for mutations and API calls.

```ts
import type { SendMessagePayload, UpdateProfilePayload } from '@iconicedu/shared-types';
```

### Enums and constants

```ts
import type { AccountRole, AccountStatus, MessageType } from '@iconicedu/shared-types';
```

### Adding a type

1. Add to the appropriate file in `packages/shared-types/src/`
2. Re-export from `packages/shared-types/src/index.ts`
3. Run `pnpm build:packages`

---

## `@iconicedu/ui-web`

**Location:** `packages/ui-web/`
**Used by:** `web`

Web UI component library built on [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives + Tailwind CSS).

### What's inside

- **`src/components/ui/`** — shadcn/ui base components (`Button`, `Input`, `Dialog`, `Dropdown`, etc.)
- **`src/components/messages/`** — domain-specific messaging components (`MessageItem`, `MessageList`, `ThreadSheet`, `EmojiPicker`, `MessageActions`, etc.)
- **`src/lib/`** — utilities (`cn()` for class merging, `display-name.ts`, etc.)

### Usage

```ts
import { Button } from '@iconicedu/ui-web/ui/button';
import { MessageItem } from '@iconicedu/ui-web/components/messages/message-item';
import { cn } from '@iconicedu/ui-web/lib/utils';
```

### Rules for components in this package

- Server-component-safe by default — no `'use client'` unless the component genuinely needs it
- Accept `className` for Tailwind customization at the call site
- No dependency on `apps/web` routing or context — components must be portable

### Testing

```bash
pnpm --filter @iconicedu/ui-web test
```

Uses Vitest + `@testing-library/react`.

---

## `@iconicedu/ui-native`

**Location:** `packages/ui-native/`
**Used by:** `mobile`

React Native component library using [NativeWind v4](https://www.nativewind.dev/) for Tailwind-based styling.

### What's inside

- **`src/components/`** — primitive and composite native components
- **`src/theme/`** — `AppColors` type, light/dark color tokens

### Usage

```ts
import { Button } from '@iconicedu/ui-native/components/button';
import type { AppColors } from '@iconicedu/ui-native/theme';
```

### NativeWind className pattern

Components that accept `className` must cast the base RN component to include the prop:

```tsx
import type { ViewProps } from 'react-native';

const StyledView = View as React.ComponentType<ViewProps & { className?: string }>;
```

See [docs/best-practices.md#nativewind-classname-casting](best-practices.md) for details.

### Testing

```bash
pnpm --filter @iconicedu/ui-native test
```

Uses jest-expo + `@testing-library/react-native`.

---

## `@iconicedu/utils`

**Location:** `packages/utils/`
**Used by:** All apps and packages

Pure utility functions with no side effects and no framework dependencies. Functions here must work in any JavaScript environment (Node, browser, React Native).

### Usage

```ts
import { formatDate, truncate } from '@iconicedu/utils';
```

### Rules

- No side effects
- No framework-specific imports (no React, no RN, no Next.js)
- Every function should be easily unit-testable in isolation

---

## `packages/config-eslint`

**Location:** `packages/config-eslint/`
**Used by:** All apps (via `eslint.config.js`)

Shared ESLint configuration. Exports named configs for different environments:

- `base` — TypeScript + general rules
- `next` — Next.js specific rules
- `react-native` — React Native specific rules

Apps extend these rather than maintaining their own full configs.

---

## `packages/config-tsconfig`

**Location:** `packages/config-tsconfig/`
**Used by:** All apps and packages (via `tsconfig.json` `extends`)

Shared TypeScript configuration base (`tsconfig.base.json`). Sets `"strict": true`, `"target": "ES2020"`, module resolution, and path aliases.

Individual apps extend this and add app-specific settings (JSX transform, path aliases for `@/*`, etc.).

---

## Adding a new package

If you need a new shared package:

1. Create the directory under `packages/my-package/`
2. Add a `package.json` with `"name": "@iconicedu/my-package"` and `"main": "src/index.ts"`
3. Add a `tsconfig.json` that extends `../../packages/config-tsconfig/tsconfig.base.json`
4. Add `"@iconicedu/my-package": "workspace:*"` to the consuming app's `package.json`
5. Run `pnpm install` to link the workspace
6. Run `pnpm build:packages` to build

The package will be picked up by Turborepo's dependency graph automatically.
