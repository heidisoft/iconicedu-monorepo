# Best Practices

## Purpose

Canonical engineering standards and coding conventions for the monorepo.

## Intended Audience

Engineers implementing or reviewing production code.

## Last Updated

2026-08-14

## Related Docs

- [Documentation Hub](../README.md)
- [Architecture Overview](../architecture/overview.md)
- [Shared Packages](../architecture/packages.md)
- [Contributing](../../CONTRIBUTING.md)

Code conventions and patterns for the IconicEdu monorepo. For internal AI collaboration guidance, see [../internal/ai/agents.md](../internal/ai/agents.md).

---

## Table of Contents

- [TypeScript](#typescript)
- [Monorepo Conventions](#monorepo-conventions)
- [Web (Next.js)](#web-nextjs)
- [Mobile (Expo / React Native)](#mobile-expo--react-native)
- [Shared Packages](#shared-packages)
- [Supabase and Database](#supabase-and-database)
- [Testing](#testing)
- [Styling](#styling)

---

## TypeScript

### Strictness

The `tsconfig.base.json` enforces `"strict": true`. All new code must type-check cleanly — no `any` escapes.

When you genuinely cannot type something (third-party interop, runtime-dynamic shapes), use a named type alias with a comment explaining why, not a bare `any`.

```ts
// Avoid
const data: any = response.json();

// Prefer — be explicit about what you know and don't know
type UnknownPayload = Record<string, unknown>;
const data: UnknownPayload = await response.json();
```

### Types vs interfaces

Prefer `type` for domain objects, union types, and anything that may be composed. Use `interface` for component props and class-based contracts.

```ts
// Shared domain types — use type aliases
type MessageStatus = 'sent' | 'delivered' | 'read';
type MessageVM = { ids: ...; core: ...; social: ... };

// Component props — either works, be consistent within a file
type ButtonProps = { label: string; onPress: () => void };
```

### Discriminated unions

All message and payload types use discriminated unions on a `type` field. Always narrow with `switch` or `if` on the discriminant:

```ts
// Good — exhaustive, type-safe
switch (message.core.type) {
  case 'text':
    return message.content.text;
  case 'file':
    return message.attachment.name;
  // ...
}

// Avoid — casting without narrowing
const text = (message as TextMessageVM).content.text;
```

### Null vs undefined

- Database rows use `null` for absent values (matching PostgreSQL)
- Function parameters and optional fields use `undefined`
- Never use `null ?? false` or similar workarounds — check for null explicitly when the type requires it

```ts
// React Native accessibility note — disabled must not be null
<Pressable accessibilityState={{ disabled: isDisabled ?? false }}>
```

---

## Monorepo Conventions

### Adding a shared type

All cross-app types go in `packages/shared-types/src/`. The package exports everything from its `index.ts`.

1. Add the type to the appropriate file (or create a new one)
2. Re-export from `index.ts`
3. Run `pnpm build:packages` to make it available to apps
4. Import as `import type { MyType } from '@iconicedu/shared-types'`

### Adding a shared utility

Functions used by more than one app go in `packages/utils/src/`. Same process as shared types.

### Never cross-import between apps

Apps (`web`, `mobile`, `api`) must not import from each other. If you need to share code between apps, move it to a package.

```ts
// Wrong — apps/web importing from apps/mobile
import { something } from '../../mobile/src/utils';

// Right — move to packages/utils and import from there
import { something } from '@iconicedu/utils';
```

### Turborepo build cache

The pipeline is: `^build` (dependencies) → `build` → `lint | typecheck | test`. This means:

- You **must** build packages before running lint/typecheck/test on apps
- `pnpm run ci` handles this automatically via the dependency graph
- If you see "module not found" errors in lint or typecheck, run `pnpm build:packages` first

---

## Web (Next.js)

### Server vs Client Components

Default to **Server Components**. Only add `'use client'` when the component needs:

- `useState`, `useEffect`, or other hooks
- Browser APIs (window, document, localStorage)
- Event listeners

```tsx
// Server Component (default) — no directive needed
export default async function ChannelPage({ params }: Props) {
  const data = await fetchChannelData(params.channelId);
  return <ChannelView data={data} />;
}

// Client Component — add directive at top of file
('use client');
export function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('');
  // ...
}
```

### API access in Server Components

Use the Supabase SSR client to obtain the current session, then call `apps/api` through the repository HTTP client. Do not query a table from a Server Component or route handler:

```ts
import { createApiClient } from '@/lib/api/http-client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const api = createApiClient(supabase);
  const channels = await api.get<ChannelVM[]>('/channels/list');
  return <ChannelList channels={channels} />;
}
```

### Route handlers

Web route handlers may act as thin HTTP adapters when Next.js routing is required, but table access, validation, and business logic still live in `apps/api`. Service-role operations belong only in the API and the service-role key must never be exposed to a frontend app.

### Data fetching

Prefer server-side data fetching with `async/await` in Server Components over client-side `useEffect` + fetch. Use React Query only when you need client-side real-time updates or mutation state.

---

## Mobile (Expo / React Native)

### NativeWind className casting

NativeWind v4 requires explicit type casts when adding `className` to components that don't declare it:

```tsx
import type { ViewProps } from 'react-native';

// Correct pattern
const StyledView = View as React.ComponentType<ViewProps & { className?: string }>;

// Animated.View needs the same treatment
const StyledAnimated = Animated.View as React.ComponentType<
  Animated.ViewProps & { className?: string }
>;
```

### Styling approach

Use NativeWind (`className`) for layout and spacing. Use `StyleSheet.create` for values that depend on theme colors (`AppColors`) or for complex conditional styles. Don't mix the two for the same property on the same element.

```tsx
// Good — NativeWind for layout, StyleSheet for theme colors
<View
  className="flex-row items-center gap-2 px-4"
  style={{ backgroundColor: colors.pageBg }}
/>

// Avoid — mixing for the same property
<View style={{ paddingHorizontal: 16 }} className="px-4" />
```

### Theme colors

All theme-aware colors come from `useTheme()` → `colors: AppColors`. Never hardcode colors in components — they won't work in dark mode.

```tsx
const { colors } = useTheme();

// Correct
<Text style={{ color: colors.text }}>Hello</Text>

// Wrong
<Text style={{ color: '#1a1a1a' }}>Hello</Text>
```

### Environment variables

Mobile reads config via `Constants.expoConfig?.extra`, not `process.env`. The `app.config.js` bridges `EXPO_PUBLIC_*` variables into `extra` at build time. Don't use `process.env` in mobile code.

```ts
// Correct
import Constants from 'expo-constants';
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;

// Wrong
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; // undefined at runtime
```

### React Query

All data fetching in mobile uses React Query. Follow existing patterns:

- Queries use `useQuery` with stable query keys
- Mutations use `useMutation` and invalidate related queries on success
- Real-time Supabase subscriptions are set up in `useEffect` and torn down on unmount

### Expo Router

The route structure is:

```
app/
├── _layout.tsx           # Root layout (auth check, providers)
├── (auth)/               # Unauthenticated routes
│   ├── sign-in.tsx
│   └── verify.tsx
└── (app)/                # Authenticated routes
    ├── _layout.tsx
    ├── (tabs)/           # Tab navigator
    │   ├── index.tsx     # Home
    │   ├── messages.tsx  # Messages list
    │   └── ...
    ├── dm/[channelId].tsx
    ├── channel/[channelId].tsx
    └── ...
```

Pass data between screens via search params for simple values. For complex objects, use React Query cache (load by ID in the destination screen).

---

## Shared Packages

### `@iconicedu/shared-types`

Contains three layers:

- **Rows** — raw database shapes (what Supabase returns)
- **VMs (View Models)** — richly typed objects consumed by UI
- **Payloads** — data sent in mutations and API calls

Always import VMs in UI code, not Rows. Rows are for the query/builder layer only.

### `@iconicedu/ui-web`

Components in `ui-web` must:

- Be server-component-safe by default (no `'use client'` unless needed)
- Accept `className` for Tailwind customization
- Not depend on app-specific context or routing

### `@iconicedu/ui-native`

Components in `ui-native` must:

- Be fully compatible with React Native (no web-only APIs)
- Use NativeWind for styling with the `className` cast pattern
- Export typed props interfaces

---

## Supabase and Database

### Row Level Security

Every table must have RLS enabled and explicit policies. There is no "open" access. When creating a new table:

1. Enable RLS: `ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;`
2. Add policies for each operation (SELECT, INSERT, UPDATE, DELETE) based on `auth.uid()` and role

Never disable RLS for convenience. If you need to bypass RLS for a service operation, use the service role client, not a policy exception.

### Migrations

- One concern per migration file — don't bundle table creation, RLS, and seed data into one file
- Migrations are **irreversible** once applied to production; write `DOWN` comments for your own reference but the actual rollback process is a new forward migration
- Test migrations with `supabase db reset` before committing

### Supabase client usage

| Context                   | Approved client                            |
| ------------------------- | ------------------------------------------ |
| Web table reads/writes    | `createApiClient(supabase)`                |
| Mobile table reads/writes | `apiGet`, `apiPost`, `apiPut`, `apiDelete` |
| Web/mobile authentication | App-local Supabase Auth client             |
| Web/mobile Realtime       | App-local Supabase channel client with RLS |
| Web/mobile file transfer  | App-local Supabase Storage client with RLS |
| NestJS table access       | Prisma client (`PrismaService`)            |

### Real-time subscriptions

Realtime channels notify clients that state changed. Fetch canonical table-backed data through `apps/api`; do not turn a Realtime callback into direct table access. Follow the existing subscription lifecycle pattern:

```ts
useEffect(() => {
  const channel = supabase
    .channel(`messages:${channelId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      handler,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [channelId]);
```

Always remove the channel in the cleanup function.

---

## Testing

### Where tests live

Tests live alongside the code they test, with a `.test.ts` or `.test.tsx` suffix:

```
src/
├── components/
│   ├── MessageItem.tsx
│   └── MessageItem.test.tsx   ← co-located
```

### Web / ui-web

Uses **Vitest** + `@testing-library/react`.

```bash
pnpm test:web          # run once
pnpm --filter web test:watch  # watch mode
```

### Mobile / ui-native

Uses **jest-expo** + `@testing-library/react-native`.

```bash
pnpm test:mobile
```

Key setup details:

- `jest.setup.js` patches `NativeModules.UIManager` for test compatibility
- `jest.resolver.js` strips the `exports` field from `expo-modules-core` (pnpm hoisting fix)
- NativeWind babel preset is excluded in test environment (no native worklets in jest)

### API

Uses **Jest** (NestJS default).

```bash
pnpm test:api
```

### What to test

- **Unit tests** for pure functions, mappers, and utility logic
- **Component tests** for non-trivial UI components (rendering states, user interactions)
- **Integration tests** for API endpoints (NestJS testing module)
- Skip testing trivial wrappers, one-line helpers, and generated code

### What not to do

- Don't snapshot the entire component output — it breaks on every style change and adds no value
- Don't test third-party library behavior
- Don't mock your own domain logic just to make a test pass

---

## Styling

### Web — Tailwind CSS

Follow the existing Tailwind class ordering (layout → spacing → typography → color → state). Use `cn()` from `@iconicedu/ui-web/lib/utils` to conditionally apply classes:

```tsx
import { cn } from '@iconicedu/ui-web/lib/utils';

<div
  className={cn(
    'flex items-center gap-2',
    isActive && 'bg-primary text-primary-foreground',
  )}
/>;
```

### Mobile — NativeWind + StyleSheet

- Use `className` for static layout and spacing
- Use `StyleSheet.create` (via `makeStyles(colors)`) for theme-dependent values
- Keep `makeStyles` calls inside `useMemo` to avoid recreating on every render:

```tsx
const s = useMemo(() => makeStyles(colors), [colors]);
```

### Design tokens

Shared design decisions (colors, spacing scale) should come from the theme system, not be hardcoded. For the web, this is the shadcn/ui CSS variable system. For mobile, this is the `AppColors` object from `useTheme()`.
