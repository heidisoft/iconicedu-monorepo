# Production Improvements — IconicEdu Monorepo

A code-review pass across `apps/web`, `packages/ui-web`, and `packages/shared-types`
with supporting context from `apps/api` and `packages/utils`.
Each finding is labelled with a severity: **P0** (must fix before prod), **P1** (high value), **P2** (polish).

---

## Table of Contents

1. [Security](#1-security)
2. [API Layer — NestJS](#2-api-layer--nestjs)
3. [Data Fetching — N+1 & Waterfall Queries](#3-data-fetching--n1--waterfall-queries)
4. [Error Handling & Observability](#4-error-handling--observability)
5. [Type Safety Gaps](#5-type-safety-gaps)
6. [Server Actions — Cohesion & Size](#6-server-actions--cohesion--size)
7. [Web — Caching, Suspense & Loading States](#7-web--caching-suspense--loading-states)
8. [UI Components — Accessibility & Patterns](#8-ui-components--accessibility--patterns)
9. [Shared Types — Runtime Validation](#9-shared-types--runtime-validation)
10. [Testing Coverage](#10-testing-coverage)
11. [Monorepo / Build Health](#11-monorepo--build-health)
12. [Performance](#12-performance)
13. [Summary Checklist](#13-summary-checklist)

---

## 1. Security

### P0 — JWT tokens are decoded but never verified

**File**: [apps/api/src/modules/auth/auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts)

```ts
// Current — attacker can forge any payload
decodeToken(token: string): any {
  return jwt.decode(token);   // ← jwt.decode, NOT jwt.verify
}
```

`jwt.decode` never checks the signature. Any client can craft a JSON payload, base64-encode it, and pass a fake `sub` / `app_role`. Use `jwt.verify` with the Supabase JWKS endpoint or a symmetric secret:

```ts
// Recommended pattern
import jwksClient from 'jwks-rsa';

const client = jwksClient({ jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json` });

async function getSigningKey(kid: string) {
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
}

async verifyToken(token: string) {
  const decoded = jwt.decode(token, { complete: true });
  const signingKey = await getSigningKey(decoded?.header.kid as string);
  return jwt.verify(token, signingKey, { algorithms: ['RS256'] });
}
```

### P0 — `req.user` is untyped — role escalation surface

**File**: `apps/api/src/modules/auth/auth.guard.ts:26`

```ts
req.user = {
  id: decoded.sub,
  role: decoded.user_metadata?.app_role ?? 'guardian', // default allows broad access
};
```

- `decoded` is `any` so this is effectively unvalidated.
- Defaulting to `'guardian'` on a missing claim is fine only if guardian is the _least_ privileged role. Document this explicitly and add a guard that throws if `sub` is missing.
- Declare a `RequestUser` interface and augment Express's `Request` type so controllers are type-safe.

```ts
// types/express.d.ts
import type { RequestUser } from '@iconicedu/api/modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
```

### P1 — Service role key must never appear in client bundles

Verify no `SUPABASE_SERVICE_ROLE_KEY` references exist in client-side files:

```bash
grep -r "SERVICE_ROLE" apps/web/app --include="*.ts" --include="*.tsx"
```

Only `apps/web/lib/supabase/service.ts` and server actions may import it.

### P1 — Link preview fetches arbitrary user-supplied URLs server-side

**File**: [apps/web/lib/messages/link-preview.ts](../../apps/web/lib/messages/link-preview.ts)

A user can supply `http://169.254.169.254/latest/meta-data/` (AWS IMDS) or internal hostnames. Add an allowlist/denylist for private IP ranges before fetching, or use a dedicated sandboxed preview service.

```ts
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function isSafeUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return !BLOCKED_HOSTS.test(hostname);
}
```

---

## 2. API Layer — NestJS

### P0 — ChannelsService returns all channels regardless of user

**File**: `apps/api/src/modules/channels/channels.service.ts:8-14`

```ts
listChannelsForUser(userId: string) {
  return this.prisma.channel.findMany({
    where: {
      // relies on RLS in Supabase if used directly there; here it's simple prisma query
    },
  });
}
```

Prisma connects as the service role and **bypasses Supabase RLS**. The `where` clause is empty — every channel is returned to every authenticated user. Either:

- Add explicit `where: { channelMembers: { some: { profileId: userId } } }` filters, or
- Use the Supabase JS client with the user's JWT so RLS policies apply automatically.

### P1 — No rate limiting or throttling on any endpoint

NestJS has first-class support via `@nestjs/throttler`. Without it, the messaging and auth endpoints are open to abuse.

```ts
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
```

Then apply `@UseGuards(ThrottlerGuard)` or use it globally in `main.ts`.

### P1 — No request-level DTOs with class-validator

Controllers accept `@Req() req: any`. Input validation only happens via the global `ValidationPipe`, but there are no DTO classes for the controllers that accept bodies. Add `class-validator` DTOs:

```ts
export class ListChannelsDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
```

### P2 — Swagger responses are undocumented

The `@ApiTags` decorators are present but there are no `@ApiResponse` or `@ApiBody` decorators. Without these, the Swagger UI at `/docs` provides no useful contract for frontend developers.

---

## 3. Data Fetching — N+1 & Waterfall Queries

### P1 — `resolveProfilesById` fires one query per profile

**File**: `apps/web/lib/messages/builders/thread.builder.ts:97-111`

```ts
async function resolveProfilesById(supabase, profileIds) {
  const profiles = await Promise.all(
    profileIds.map((id) => buildUserProfileById(supabase, id)), // N round-trips
  );
}
```

`Promise.all` over N queries is parallel but still N round-trips. Supabase supports `in` filters — batch the fetch:

```ts
async function resolveProfilesById(supabase, profileIds) {
  if (!profileIds.length) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('id', profileIds);
  const map = new Map<string, UserProfileVM>();
  (data ?? []).forEach((row) => map.set(row.id, mapProfileRowToVM(row)));
  return map;
}
```

This pattern appears in several builders. Fix it consistently.

### P1 — Activity feed builder has a sequential waterfall

**File**: [apps/web/lib/activity-feed/builders/activity-feed.builder.ts](../../apps/web/lib/activity-feed/builders/activity-feed.builder.ts)

The feed builder loads items, then loads actors, then loads group members — sequentially. Use `Promise.all` where the data shapes are known upfront, or batch the second/third fetches into the initial query with Supabase `select` joins.

### P2 — `buildUserProfileById` is called in many builders independently

There is no in-memory or request-scoped cache for profile lookups. Consider a lightweight request-scoped DataLoader pattern (or just a `Map` passed through the build context) to deduplicate profile fetches within a single page render.

---

## 4. Error Handling & Observability

### P1 — No structured logging anywhere

All errors land in `console.error` / `throw`. In production you cannot search, alert on, or correlate errors. Add a lightweight structured logger:

- **Web (Next.js)**: Use `pino` with `pino-pretty` in dev, JSON in prod. Wrap it in `apps/web/lib/logger.ts`.
- **API (NestJS)**: Replace the default logger with `NestJS-pino` (`nestjs-pino` package). It auto-correlates request IDs.

Log at the service layer, not at the controller or action layer, so stack traces are preserved.

### P1 — Server action return shapes are inconsistent

Some actions return `{ error?: string; payload?: T }`, others return `{ success: boolean; error?: string }`, and the auth admin actions use a custom `runAction<T>` wrapper. Pick one shape and apply it everywhere:

```ts
// Recommended — a single discriminated union
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
```

This lets client components use a single `if (!result.ok)` pattern and enables typed error codes for i18n error messages.

### P2 — No error boundaries in the web app

Without React Error Boundaries, a rendering error in any subtree will crash the entire page. Add boundaries at route-group level at minimum:

```tsx
// app/(app)/[orgSlug]/error.tsx  (Next.js App Router convention)
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorScreen message={error.message} onRetry={reset} />;
}
```

Also add `not-found.tsx` for 404 cases within the org slug routes.

### P2 — No centralised HTTP error mapping for Supabase errors

Supabase `PostgrestError` objects are caught inconsistently. Some places check `data.error?.message`, others check `error?.code`. Create a thin wrapper:

```ts
export function assertSupabaseResult<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string,
): T {
  if (result.error) throw new DatabaseError(context, result.error);
  if (result.data === null) throw new NotFoundError(context);
  return result.data;
}
```

---

## 5. Type Safety Gaps

### P1 — `UUID` and `ISODateTime` are bare string aliases

**File**: [packages/shared-types/src/shared/shared.ts](../packages/shared-types/src/shared/shared.ts:1-3)

```ts
export type UUID = string;
export type ISODateTime = string;
```

These are structural aliases — TypeScript won't catch passing a raw string where a UUID is expected. Use nominal/branded types:

```ts
declare const UUIDBrand: unique symbol;
export type UUID = string & { readonly [UUIDBrand]: never };

declare const ISODateTimeBrand: unique symbol;
export type ISODateTime = string & { readonly [ISODateTimeBrand]: never };
```

Then expose `asUUID(s: string): UUID` and `asISODateTime(s: string): ISODateTime` cast helpers with runtime validation. This is especially important for user-supplied IDs that flow into SQL queries.

### P1 — `NotificationDefaultsVM` is an open `Record<string, ...>`

**File**: [packages/shared-types/src/vm/profile.ts](../packages/shared-types/src/vm/profile.ts:70)

```ts
export type NotificationDefaultsVM = Record<string, NotificationPreferenceVM>;
```

The keys are arbitrary strings. Define an exhaustive union of known notification keys so that typos are caught at compile time:

```ts
export type NotificationKey =
  | 'messages.mentions'
  | 'messages.replies'
  | 'homework.new'
  | 'session.reminder';

export type NotificationDefaultsVM = Partial<
  Record<NotificationKey, NotificationPreferenceVM>
>;
```

### P2 — Message content JSONB has no runtime validation

Messages are stored with a JSONB `content` column. The `mapMessageRowToVM` mapper does `as TextMessageVM` type casts without parsing. If the DB row is malformed, you get a runtime crash far from the source. Use Zod or a similar parser at the mapper boundary (see §9).

### P2 — `any` leaks in auth context and admin helpers

```ts
// auth.guard.ts
const decoded = this.authService.decodeToken(token); // any

// lib/auth/admin-actions.ts
async function runAction<T>(fn: () => Promise<T>): Promise<{ ... }> // ok
```

Narrow the guard's decoded value to a typed interface matching the Supabase JWT structure immediately after `decodeToken`.

---

## 6. Server Actions — Cohesion & Size

### P1 — `messages.ts` is a single 1000+ line file mixing multiple concerns

**File**: [apps/web/app/actions/messages.ts](../apps/web/app/actions/messages.ts)

This file handles: text sending, file uploads, reactions, saved messages, homework detection, mention notifications, link previews, and activity event publishing. Each of these is a distinct domain concern.

Suggested split (keeping `'use server'` at the top of each file):

```
app/actions/
  messages/
    send-text.ts       — sendTextMessageAction
    send-files.ts      — sendFileMessageAction, sendFilesMessageAction
    reactions.ts       — toggleReactionAction
    saved.ts           — toggleSavedMessageAction
    link-preview.ts    — fetchLinkPreviewAction
```

Internal helpers (`sanitizeMentions`, `deriveHomeworkMessageIntent`, `createMentionNotifications`) move to `lib/messages/` and are imported by the action files — this also makes them independently testable.

### P2 — Homework detection regex has a stateful `lastIndex` bug

**File**: [apps/web/app/actions/messages.ts](../apps/web/app/actions/messages.ts:55)

```ts
const HOMEWORK_TRIGGER_PATTERN = /(^|\s)@(homework|homeowork)\b/gi; // global flag

if (!HOMEWORK_TRIGGER_PATTERN.test(content)) return null; // advances lastIndex
HOMEWORK_TRIGGER_PATTERN.lastIndex = 0; // manual reset — fragile
```

Module-level mutable regex with the `g` flag is a well-known footgun in JavaScript — `test()` mutates `lastIndex`. The manual reset on line 132 handles it, but only in the happy path. If the function is called concurrently (e.g., two requests in the same Node worker at the same time — this is possible), the shared regex state is a race condition.

Fix: create the regex inside the function, or use `.test()` on a fresh instance:

```ts
function deriveHomeworkMessageIntent(content: string, ...) {
  const pattern = /(^|\s)@(homework|homeowork)\b/gi;
  if (!pattern.test(content)) return null;
  // ...
}
```

---

## 7. Web — Caching, Suspense & Loading States

### P1 — No `cache()` or `unstable_cache` on expensive server builders

Next.js 15 provides `cache()` (React's built-in request dedup) and `unstable_cache` (cross-request, segment-scoped). The builders in `lib/*/builders/` are called directly without any memoisation — the same profile or channel can be fetched multiple times within one render tree.

At minimum, wrap expensive builders in React's `cache()` for per-request deduplication:

```ts
import { cache } from 'react';

export const buildUserProfileById = cache(async (supabase, profileId) => {
  // ...
});
```

Use `unstable_cache` for data that is safe to share across requests (e.g., org metadata, class schedules that don't change mid-day).

### P1 — Pages fetch all data before streaming anything

Every protected page calls an async builder and `await`s the full result before rendering. For large data sets (thread list, activity feed), this delays Time-to-First-Byte. Use React `Suspense` with streamed segments:

```tsx
// page.tsx
export default async function InboxPage({ params }) {
  const { supabase, account } = await getDashboardAccountContext(params.orgSlug);
  return (
    <DashboardHeader title="Inbox" />
    <Suspense fallback={<InboxSkeleton />}>
      <InboxFeed supabase={supabase} account={account} />
    </Suspense>
  );
}

// inbox-feed.tsx (Server Component, can be async)
async function InboxFeed({ supabase, account }) {
  const feed = await buildActivityFeedForProfile(...);
  return <InboxClient feed={feed} />;
}
```

### P2 — `useSearchParams()` without a `Suspense` boundary in client components

React 19 / Next.js 15 require `useSearchParams()` to be inside a `Suspense` boundary. Verify every `'use client'` component using this hook is wrapped — the Next.js build may not warn about this in all cases.

---

## 8. UI Components — Accessibility & Patterns

### P1 — Interactive components missing ARIA labels in some cases

The sidebar, channel list, and message reaction components use icon-only buttons. Ensure every icon-only button has either `aria-label` or a visually-hidden `<span>`:

```tsx
// Instead of
<Button size="icon"><Bell /></Button>

// Use
<Button size="icon" aria-label="Notifications"><Bell /></Button>
```

Run `axe-core` or the Radix accessibility checker as part of the Playwright E2E suite to catch regressions.

### P1 — `forwardRef` missing on composable primitives

Several `ui-web` components pass a `ref` prop but are not wrapped in `React.forwardRef`. This means consumers using refs for focus management (e.g., auto-focus in dialogs) receive no ref. The `Button` component is fine (it uses Radix `Slot` which handles this), but verify custom wrappers.

### P2 — Tailwind content path in `ui-web` scans `apps/web`

**File**: [packages/ui-web/tailwind.config.ts](../packages/ui-web/tailwind.config.ts)

```ts
content: [
  './src/**/*.{ts,tsx}',
  '../../apps/web/app/**/*.{ts,tsx}',  // ← tight coupling
],
```

This means `ui-web` must know the structure of `apps/web` at build time. If the web app moves or is renamed, the package breaks silently (classes purged). The web app should control its own Tailwind config and import the base config from `ui-web` instead:

```ts
// apps/web/tailwind.config.ts
import baseConfig from '@iconicedu/ui-web/tailwind.config';
export default { ...baseConfig, content: ['./app/**/*.{ts,tsx}', ...baseConfig.content] };
```

### P2 — Theme CSS variables not validated at the TypeScript level

`ThemeKey` is defined in `shared-types` but the CSS variable names in `ui-web/styles/` are plain strings. A `theme-slate` class might be misspelled without a compile error. Consider generating the CSS variable map from `ThemeKey` to catch mismatches:

```ts
// lib/theme.ts (ui-web)
import type { ThemeKey } from '@iconicedu/shared-types';
type ThemeClass = `theme-${ThemeKey}`;
export function themeClass(key: ThemeKey): ThemeClass {
  return `theme-${key}`;
}
```

---

## 9. Shared Types — Runtime Validation

### P1 — No Zod schemas for mapper boundaries

The gap between DB row types (`rows/*.ts`) and VMs (`vm/*.ts`) is bridged by hand-written mappers that cast types. A malformed DB row silently produces a broken VM. Add Zod schemas at the mapper input boundary:

```ts
// rows/message.ts — add alongside the TypeScript type
import { z } from 'zod';

export const MessageRowSchema = z.object({
  id: z.string().uuid(),
  channel_id: z.string().uuid(),
  type: z.enum(['text', 'file', 'audio-recording', ...]),
  created_at: z.string().datetime(),
  // ...
});
export type MessageRow = z.infer<typeof MessageRowSchema>;
```

Parse only at the edge (when data comes from Supabase), not at every function boundary. Use `MessageRowSchema.parse(row)` in queries and let the VM be typed automatically.

### P2 — Payload types lack exhaustive input validation

`MessageSendTextInput`, `MessageSendFileInput`, and similar payload types are pure TypeScript interfaces — there is no runtime validation when they arrive in server actions. Since server actions can be called directly from the browser (they're HTTP endpoints), add Zod schemas for all payload types and validate at the action entry point.

---

## 10. Testing Coverage

### P1 — API layer has no integration tests

The NestJS `spec` files appear to be stubs. Add tests using `@nestjs/testing` + `supertest` for the happy path, auth failures, and RLS-related scenarios. This is especially important given the JWT verification gap.

### P1 — Builder functions tested in isolation but not end-to-end

`thread.builder.test.ts` and `channel.builder.test.ts` mock Supabase calls. These are valuable, but there are no tests that verify the full `page → builder → query → mapper → VM` chain even in a local Supabase environment. Add at least one integration test per major page using the local Supabase CLI.

### P2 — No snapshot or visual regression tests for UI components

The component library has unit tests but no visual regression coverage. Consider adding Storybook + Chromatic, or Playwright component tests with screenshot comparison, for the most-used primitives (Button, Dialog, Sidebar).

### P2 — E2E tests exist but cover few flows

The Playwright setup is in place (`apps/web/e2e/`). Ensure at minimum these flows have coverage:

- Login / OTP verification
- Send a text message
- Admin creates a user
- Guardian views child's schedule

---

## 11. Monorepo / Build Health

### P1 — `packages/utils` exports are minimal; duplicated helpers exist in apps

`groupBy`, `resolveProfilesById`, and date utilities appear in both `apps/web/lib/messages/builders/` and other builders. Move shared pure functions to `packages/utils/src/` and import from `@iconicedu/utils`. This prevents divergence.

### P1 — No environment variable validation at startup

Neither `apps/web` nor `apps/api` validate their required env vars at boot time. A misconfigured deployment (missing `NEXT_PUBLIC_SUPABASE_URL`, empty `DATABASE_URL`) will fail at runtime with an unhelpful error. Use a schema at startup:

```ts
// apps/web/lib/config/env.ts
import { z } from 'zod';
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
});
export const env = EnvSchema.parse(process.env);
```

```ts
// apps/api/src/config/env.ts — call in main.ts before app.listen()
const ApiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
});
```

### P2 — `turbo.json` env vars list may be incomplete

Turbo caches builds based on the declared `env` list. If a build-time env var is not declared, Turbo may serve a stale cache when the var changes. Audit `turbo.json` against the env vars actually read in `next.config.mjs` and NestJS `ConfigModule`.

### P2 — No `engines` field in root `package.json`

Pin the required Node.js version alongside the `pnpm` version to prevent CI failures when developers upgrade Node locally:

```json
"engines": {
  "node": ">=22.0.0",
  "pnpm": "9.12.0"
}
```

---

## 12. Performance

### P1 — `resolveProfilesById` makes N parallel queries — batch instead

See §3. This is the single highest-impact database fix.

### P2 — No HTTP response caching headers on API routes

The `app/api/` route handlers return data without `Cache-Control` headers. For public/shared data (org info, class schedules), add `s-maxage` and `stale-while-revalidate` to allow CDN / edge caching.

```ts
// app/api/schedules/route.ts
return NextResponse.json(data, {
  headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
});
```

### P2 — Large client component bundles not analysed

Run `next build --analyze` (requires `@next/bundle-analyzer`) to verify no large server-only modules leak into client bundles. Common culprits: `date-fns` imported without tree-shaking, icon libraries imported wholesale.

### P2 — Images served without `next/image`

Any `<img>` tags in `ui-web` components bypass Next.js image optimisation. Replace with `next/image` (or accept a render prop from the app layer) to get automatic WebP conversion and lazy loading.

---

## 13. Anti-Patterns & Structural Duplication

These findings are distinct from the architectural issues above — they are concrete, locatable code duplications and anti-patterns with exact file references.

---

### 13A. Row type audit fields copy-pasted 13 times

**File**: [packages/shared-types/src/rows/message.ts](../packages/shared-types/src/rows/message.ts:88-278)

Every single message payload row interface — `MessageTextRow`, `MessageImageRow`, `MessageFileRow`, `MessageDesignFileUpdateRow`, `MessagePaymentReminderRow`, `MessageEventReminderRow`, `MessageFeedbackRequestRow`, `MessageLessonAssignmentRow`, `MessageProgressUpdateRow`, `MessageSessionBookingRow`, `MessageSessionCompleteRow`, `MessageSessionSummaryRow`, `MessageHomeworkSubmissionRow`, `MessageLinkPreviewRow`, `MessageAudioRecordingRow`, `MessageLiveSessionStartedRow` — has an identical body:

```ts
// Repeated 13 times verbatim:
message_id: UUID;
org_id: UUID;
payload: Record<string, unknown>;
created_at: ISODateTime;
created_by?: UUID | null;
updated_at: ISODateTime;
updated_by?: UUID | null;
deleted_at?: ISODateTime | null;
deleted_by?: UUID | null;
```

That is ~9 lines × 13 types = **117 lines of pure duplication**. The types carry no additional fields — they differ only in name, which exists purely for documentation purposes.

Fix: collapse into one base type with a discriminant, or at least use inheritance:

```ts
// shared/rows/base.ts
export interface AuditRow {
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessagePayloadRow extends AuditRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
}

// rows/message.ts — all 13 become one-liners
export type MessageTextRow = MessagePayloadRow;
export type MessageImageRow = MessagePayloadRow;
// ...or a single discriminated union if the type identity matters:
export type MessagePayloadRowKind =
  | 'text' | 'image' | 'file' | 'design-file-update'
  | 'payment-reminder' | 'event-reminder' | 'audio-recording' | ...;
export type MessagePayloadRow<K extends MessagePayloadRowKind = MessagePayloadRowKind>
  = AuditRow & { message_id: UUID; org_id: UUID; payload: Record<string, unknown>; kind: K };
```

The same `AuditRow` base would also reduce duplication across `profile.ts` rows (all 9 profile-extension rows repeat the same 6 audit fields), `MessageReactionRow`, `ChannelFileRow`, `ChannelMediaRow`, and every other row file.

---

### 13B. `ChildProfileRow` has both `communication_style` and `communication_styles`

**File**: [packages/shared-types/src/rows/profile.ts](../packages/shared-types/src/rows/profile.ts:69-74)

```ts
export interface ChildProfileRow {
  // ...
  communication_style?: string | null; // line 69 — singular, a string
  // ...
  communication_styles?: string[] | null; // line 74 — plural, a string array
}
```

These are two different fields. The select constant [apps/web/lib/profile/constants/selects.ts](../apps/web/lib/profile/constants/selects.ts:84-89) fetches both. This is either:

- A migration left-behind (singular was later replaced by plural and should be dropped), or
- A real distinction (single preferred style vs a ranked list) that needs documentation.

Either way, one of them should be removed or the distinction must be documented. Having both silently is a maintenance hazard.

---

### 13C. Admin helper auth boilerplate duplicated across 6 files

**Files**: [apps/web/lib/admin/learning-space-archive.ts](../apps/web/lib/admin/learning-space-archive.ts), [learning-space-unarchive.ts](../apps/web/lib/admin/learning-space-unarchive.ts), [learning-space-delete.ts](../apps/web/lib/admin/learning-space-delete.ts), [channel-archive.ts](../apps/web/lib/admin/channel-archive.ts), [channel-unarchive.ts](../apps/web/lib/admin/channel-unarchive.ts), [channel-delete.ts](../apps/web/lib/admin/channel-delete.ts)

Lines 1-26 are **identical** across all 6 files:

```ts
const supabase = await createSupabaseServerClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) throw new Error('Unauthorized');

const accountResponse = await getAccountByAuthUserId(supabase, user.id);
if (!accountResponse.data) throw new Error('Account not found');

const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
if (!profileResponse.data) throw new Error('Profile not found');

const orgId = accountResponse.data.org_id;
const now = new Date().toISOString();
```

That is ~120 lines of identical copy-paste across 6 files. Extract once:

```ts
// lib/admin/_auth-context.ts  (underscore prefix = internal to lib/admin)
export type AdminAuthContext = {
  supabase: SupabaseServerClient;
  orgId: string;
  profileId: string;
  now: string;
};

export async function requireAdminAuthContext(): Promise<AdminAuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) throw new Error('Account not found');

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) throw new Error('Profile not found');

  return {
    supabase,
    orgId: accountResponse.data.org_id,
    profileId: profileResponse.data.id,
    now: new Date().toISOString(),
  };
}
```

Each of the 6 files then becomes ~8 lines.

---

### 13D. Archive and unarchive functions are identical except for one field value

`archiveLearningSpace` and `unarchiveLearningSpace` are character-for-character identical except for the value of `status` and `archived_at`. Same for `archiveChannel` / `unarchiveChannel`. There is no reason for 4 separate files:

```ts
// lib/admin/entity-status.ts
type ArchivableTable = 'learning_spaces' | 'channels';
type EntityStatus = 'active' | 'archived';

export async function setEntityStatus(
  table: ArchivableTable,
  entityId: string,
  status: EntityStatus,
) {
  const { supabase, orgId, profileId, now } = await requireAdminAuthContext();

  const { error } = await supabase
    .from(table)
    .update(
      status === 'archived'
        ? { status, archived_at: now, updated_at: now, updated_by: profileId }
        : { status, archived_at: null, updated_at: now, updated_by: profileId },
    )
    .eq('org_id', orgId)
    .eq('id', entityId)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
}

// 4 thin wrappers that call setEntityStatus — or just call it directly from server actions
```

---

### 13E. `groupBy` reimplemented in 3 separate builder files

The same generic groupBy utility is independently authored in:

- [apps/web/lib/messages/builders/thread.builder.ts](../apps/web/lib/messages/builders/thread.builder.ts:113-125) — `function groupBy<T, K extends string>`
- [apps/web/lib/spaces/builders/learning-space.builder.ts](../apps/web/lib/spaces/builders/learning-space.builder.ts) — another `function groupBy<T, K extends string>`, identical body
- [apps/web/lib/schedules/builders/class-schedule.builder.ts](../apps/web/lib/schedules/builders/class-schedule.builder.ts) — `groupParticipantsBySchedule` and `groupRecurrenceExceptions`, same logic but non-generic

All three do the same thing: `rows.forEach → map.get(key) ?? [] → push → map.set`. This belongs in `packages/utils/src/index.ts` and should be imported everywhere.

---

### 13F. `resolveChannels` fetches the primary channel twice

**File**: [apps/web/lib/spaces/builders/learning-space.builder.ts](../apps/web/lib/spaces/builders/learning-space.builder.ts:41-71)

```ts
// Step 1: fetch ALL channels (including primary)
const channels = await Promise.all(rows.map((row) => buildChannelById(...)));

// Step 2: fetch primary channel AGAIN from the DB
const primaryChannel = await buildChannelById(supabase, orgId, primaryRow.channel_id, ...);
```

The primary channel is fetched twice — once as part of the `Promise.all` on all rows (line 47-55), then again individually (line 60-63). This is a wasted round-trip. The fix is to pluck it from the already-fetched `channels` array:

```ts
const primaryRow = rows.find((row) => row.is_primary);
const primaryChannel =
  channels.find((ch) => ch.ids.id === primaryRow?.channel_id) ?? channels[0] ?? null;
```

---

### 13G. `PROFILE_SELECT` and `PROFILE_SUMMARY_SELECT` share 12 fields with no shared base

**File**: [apps/web/lib/profile/constants/selects.ts](../apps/web/lib/profile/constants/selects.ts:3-45)

```ts
export const PROFILE_SELECT = [
  'id',
  'org_id',
  'account_id',
  'kind',
  'display_name',
  'first_name',
  'last_name',
  'bio',
  'avatar_source',
  'avatar_url',
  'avatar_seed',
  'avatar_updated_at',
  'timezone',
  'locale',
  'languages_spoken',
  'status',
  'country_code',
  'country_name',
  'region',
  'city',
  'postal_code',
  'notes_internal',
  'lead_source',
  'ui_theme_key',
  'created_at',
  'updated_at',
].join(',');

export const PROFILE_SUMMARY_SELECT = [
  'id',
  'org_id',
  'account_id',
  'kind', // ← same 4
  'display_name',
  'first_name',
  'last_name', // ← same 3
  'avatar_source',
  'avatar_url',
  'avatar_seed',
  'avatar_updated_at', // ← same 4
  'ui_theme_key', // ← same 1
].join(',');
```

`PROFILE_SUMMARY_SELECT` is a strict subset of `PROFILE_SELECT`. Additionally, `CHILD_PROFILE_SELECT` (line 79-90) and `CHILD_PROFILE_ROWS_SELECT` (line 101-113) overlap on all 9 child-specific fields — the only difference is `CHILD_PROFILE_ROWS_SELECT` adds `profile_id`. Build from composable arrays:

```ts
const PROFILE_IDENTITY_FIELDS = ['id', 'org_id', 'account_id', 'kind'];
const PROFILE_AVATAR_FIELDS = [
  'avatar_source',
  'avatar_url',
  'avatar_seed',
  'avatar_updated_at',
];
const PROFILE_DISPLAY_FIELDS = [
  'display_name',
  'first_name',
  'last_name',
  'ui_theme_key',
];

export const PROFILE_SUMMARY_SELECT = [
  ...PROFILE_IDENTITY_FIELDS,
  ...PROFILE_DISPLAY_FIELDS,
  ...PROFILE_AVATAR_FIELDS,
].join(',');

export const PROFILE_SELECT = [
  ...PROFILE_IDENTITY_FIELDS,
  ...PROFILE_DISPLAY_FIELDS,
  ...PROFILE_AVATAR_FIELDS,
  'bio',
  'timezone',
  'locale',
  'languages_spoken',
  'status',
  'country_code',
  'country_name',
  'region',
  'city',
  'postal_code',
  'notes_internal',
  'lead_source',
  'created_at',
  'updated_at',
].join(',');
```

This also makes it immediately visible if a field is added to one but forgotten in the other.

---

### 13H. Inconsistent select constant format — string vs `.join(',')`

The codebase mixes two styles for the same concern:

| File                                       | Style                                |
| ------------------------------------------ | ------------------------------------ |
| `profile/constants/selects.ts`             | `[...].join(',')` arrays             |
| `family/constants/selects.ts`              | bare string `'id, org_id, ...'`      |
| `EDUCATOR_AVAILABILITY_SELECT` (same file) | bare string with spaces after commas |
| `spaces/constants/selects.ts`              | `[...].join(',')`                    |
| `schedules/constants/selects.ts`           | mixed — some arrays, some strings    |

Pick one format. The array form is preferable because individual fields are visible as separate tokens (easier to diff, easier to add/remove), and leading/trailing whitespace is never an issue.

---

### 13I. `CHILD_PROFILE_SELECT` and `CHILD_PROFILE_ROWS_SELECT` select the same fields except one

**File**: [apps/web/lib/profile/constants/selects.ts](../apps/web/lib/profile/constants/selects.ts:79-115)

```ts
export const CHILD_PROFILE_SELECT = [
  'birth_year',
  'school_name',
  'school_year',
  'confidence_level',
  'communication_style',
  'interests',
  'strengths',
  'learning_preferences',
  'motivation_styles',
  'communication_styles',
].join(','); // 10 fields, no profile_id

export const CHILD_PROFILE_ROWS_SELECT = [
  'profile_id', // ← only difference
  'birth_year',
  'school_name',
  'school_year',
  'confidence_level',
  'communication_style',
  'interests',
  'strengths',
  'learning_preferences',
  'motivation_styles',
  'communication_styles',
].join(','); // 11 fields, adds profile_id
```

`CHILD_PROFILE_ROWS_SELECT` should be expressed as `['profile_id', ...CHILD_PROFILE_FIELDS].join(',')` where `CHILD_PROFILE_FIELDS` is the shared base.

---

### 13J. Profile builder pattern is structurally identical but not abstracted

**Files**: [apps/web/lib/profile/builders/educator.builder.ts](../apps/web/lib/profile/builders/educator.builder.ts), [guardian.builder.ts](../apps/web/lib/profile/builders/guardian.builder.ts), [child.builder.ts](../apps/web/lib/profile/builders/child.builder.ts), [staff.builder.ts](../apps/web/lib/profile/builders/staff.builder.ts)

Every builder follows the same shape:

```ts
export async function buildXxxProfile(
  supabase,
  baseProfile,
  profileRow,
): Promise<XxxProfileVM> {
  const [relationA, relationB, ...] = await Promise.all([
    getXxxData(supabase, profileRow.profile_id ?? profileRow.id),
    // ...
  ]);
  return {
    ...baseProfile,
    kind: 'xxx',
    // map fields
  };
}
```

The only variation is which queries are fired and which fields are mapped. Normalizer functions inside each builder (`normalizeCertifications`, `normalizeSessionNotesVisibility`, `normalizeIdentityVerificationStatus`) all follow the same pattern: validate a raw string against an allowlist and return the typed value or `null`.

Extract the normalizer factory to `packages/utils`:

```ts
// packages/utils/src/normalize.ts
export function createEnumNormalizer<T extends string>(allowedValues: readonly T[]) {
  return (raw: string | null | undefined): T | null => {
    if (raw != null && (allowedValues as readonly string[]).includes(raw))
      return raw as T;
    return null;
  };
}
```

---

### 13K. `resolveParticipants` in `learning-space.builder.ts` repeats the N-query pattern

**File**: [apps/web/lib/spaces/builders/learning-space.builder.ts](../apps/web/lib/spaces/builders/learning-space.builder.ts:73-80)

```ts
async function resolveParticipants(supabase, rows) {
  const profiles = await Promise.all(
    rows.map((row) => buildUserProfileById(supabase, row.profile_id)),
  );
  return profiles.filter(Boolean);
}
```

This is the same N-query anti-pattern as `resolveProfilesById` in `thread.builder.ts` (already noted in §3), but it is a separate copy. There should be one canonical `batchLoadProfiles(supabase, profileIds)` utility used everywhere.

---

### 13L. `lib/data/` directory is a catch-all with no clear ownership

**Files**: [apps/web/lib/data/inbox-activities.ts](../apps/web/lib/data/inbox-activities.ts), [apps/web/lib/data/support-channel.ts](../apps/web/lib/data/support-channel.ts), [apps/web/lib/data/admin-menu-sections.test.ts](../apps/web/lib/data/admin-menu-sections.test.ts)

`lib/data/` contains heterogeneous files: static UI configuration (admin menu sections), business logic (inbox activities), and utility helpers (support channel). This breaks the consistent `lib/<domain>/` organization pattern used everywhere else. The files belong in:

- `lib/activity-feed/` — inbox activity data
- `lib/admin/` — admin menu sections
- `lib/channels/` — support channel logic

---

### 13M. Sidebar unread helpers duplicate immutable update logic

**Files**: [apps/web/lib/sidebar/direct-message-unread.ts](../apps/web/lib/sidebar/direct-message-unread.ts), [apps/web/lib/sidebar/learning-space-unread.ts](../apps/web/lib/sidebar/learning-space-unread.ts)

Both files contain `applyIncomingXXXUnread()` and `markXXXChannelRead()` functions that perform identical immutable channel updates — only the outer VM shape differs (DM channel vs learning space). The core logic of "given a channel ID, return a new sidebar state with an updated `unreadCount`" is duplicated. Extract a shared updater and have each file call it with a path accessor.

---

## 14. Dead Code — Unused Fields, Types & DB Columns

These are confirmed by grepping the entire codebase. Each finding has been verified against selects, mappers, and UI consumers.

---

### 14A. `EDUCATOR_AVAILABILITY_SELECT` fetches 6 audit columns that are never mapped

**File**: [apps/web/lib/profile/constants/selects.ts:76-77](../apps/web/lib/profile/constants/selects.ts#L76-L77)

```ts
export const EDUCATOR_AVAILABILITY_SELECT =
  'profile_id, org_id, class_types, weekly_commitment, availability, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by';
```

The mapper in [apps/web/lib/profile/builders/educator.builder.ts:72-77](../apps/web/lib/profile/builders/educator.builder.ts#L72-L77) only reads three fields (`class_types`, `weekly_commitment`, `availability`). The remaining 6 audit columns are fetched on every educator profile load and immediately discarded.

Fix — trim the select:

```ts
export const EDUCATOR_AVAILABILITY_SELECT =
  'profile_id, org_id, class_types, weekly_commitment, availability';
```

---

### 14B. `StaffProfileRow.working_hours_rules` and `working_hours_schedule` are defined but never selected or mapped

**File**: [packages/shared-types/src/rows/profile.ts:103-104](../packages/shared-types/src/rows/profile.ts#L103-L104)

```ts
export interface StaffProfileRow {
  working_hours_rules?: WorkingHoursSchedule | null; // never selected
  working_hours_schedule?: WorkingHoursSchedule | null; // never selected
}
```

[apps/web/lib/profile/constants/selects.ts:93-94](../apps/web/lib/profile/constants/selects.ts#L93-L94):

```ts
export const STAFF_PROFILE_SELECT =
  'department, manager_staff_id, job_title, permissions_scope, weekly_availability';
```

Neither field appears anywhere in the codebase outside its definition. They are never selected, never mapped to a VM, never rendered. The `workingHoursScheduleToDayAvailability` utility in [packages/shared-types/src/shared/working-hours.ts](../packages/shared-types/src/shared/working-hours.ts) is also never called.

**Action**: Remove from `StaffProfileRow` and drop `workingHoursScheduleToDayAvailability` if the DB columns are also unused.

---

### 14C. `UserInternalVM` fields (`notesInternal`, `leadSource`) are mapped but never displayed

**File**: [packages/shared-types/src/vm/profile.ts:81-84](../packages/shared-types/src/vm/profile.ts#L81-L84)

```ts
export interface UserInternalVM {
  notesInternal?: string | null;
  leadSource?: string | null;
}
```

These are mapped in [apps/web/lib/profile/mappers/base-profile.mapper.ts:78-81](../apps/web/lib/profile/mappers/base-profile.mapper.ts#L78-L81) and included on every `UserProfileVM`. A full codebase search across `apps/web/app/**` and `packages/ui-web/src/**` finds **zero** references to `internal.notesInternal` or `internal.leadSource` in any page, component, or admin route — only in mock data (`apps/web/lib/data/profiles.ts`).

The fields are selected from the DB on every profile load (`notes_internal`, `lead_source` are in `PROFILE_SELECT`), included in every VM, and silently discarded by the UI. Wasted bandwidth on every profile fetch.

Options:

- If admin pages will use them: build the admin UI and keep them.
- If not near-term: remove from `PROFILE_SELECT` and `mapBaseProfile` until they're needed. The VM type can stay.

---

### 14D. `UserLocationVM.streetAddress` is in the VM type but never populated from the DB

**File**: [packages/shared-types/src/vm/profile.ts:75](../packages/shared-types/src/vm/profile.ts#L75)

```ts
export interface UserLocationVM {
  countryCode?: string | null;
  countryName?: string | null;
  streetAddress?: string | null; // ← never set from DB
  region?: string | null;
  city?: string | null;
  postalCode?: string | null;
}
```

`street_address` is not in `ProfileRow`, not in `PROFILE_SELECT`, and not set in `mapBaseProfile`. The value will always be `undefined` at runtime. It only appears as ephemeral form state in the location-tab geocoding flow.

This is a type-lie — the VM says a profile _can_ have a `streetAddress`, but it structurally cannot.

Fix: either add a `street_address` DB column + migration + mapper, or remove `streetAddress` from `UserLocationVM` and keep it in a local-only form state type.

---

### 14E. `ChildProfileRow.communication_style` (singular) is fetched but never mapped

**File**: [packages/shared-types/src/rows/profile.ts:69](../packages/shared-types/src/rows/profile.ts#L69)

```ts
export interface ChildProfileRow {
  communication_style?: string | null; // line 69 — singular, fetched
  // ...
  communication_styles?: string[] | null; // line 74 — plural, fetched and mapped
}
```

`CHILD_PROFILE_SELECT` fetches both (lines 84 and 89). `child.builder.ts` maps only `communication_styles` (plural) to `ChildProfileVM.communicationStyles`. The singular `communication_style` is selected every time but never read in the mapper or VM.

If `communication_style` is a superseded column, drop it from `CHILD_PROFILE_SELECT` and from `ChildProfileRow`, and schedule a DB migration to drop the column.

---

### 14F. 12 of the 13 message payload row type aliases are structural no-ops

**File**: [packages/shared-types/src/rows/message.ts:88-278](../packages/shared-types/src/rows/message.ts#L88-L278)

The 13 `MessageXxxRow` interfaces (Text, Image, File, DesignFileUpdate, etc.) are used only as `.returns<MessageXxxRow[]>()` type annotations in [apps/web/lib/messages/queries/messages.query.ts](../apps/web/lib/messages/queries/messages.query.ts). Since all 13 interfaces have identical bodies, none of them add type safety beyond a single `MessagePayloadRow` alias. `MessageLiveSessionStartedRow` is also imported in mobile but for the same purpose.

These types do not constrain anything the others don't — swapping any one for another would not break the TypeScript compiler. Collapse as described in §13A. The `.returns<MessagePayloadRow[]>()` annotation is equally type-safe.

---

### 14G. `EducatorProfileVM.joinedDate` shadows `meta.createdAt` in most cases

**File**: [apps/web/lib/profile/builders/educator.builder.ts:88](../apps/web/lib/profile/builders/educator.builder.ts#L88)

```ts
joinedDate: educator.data?.joined_date ?? profileRow.created_at,
```

When the DB `joined_date` column is null (the common case), this falls back to `profileRow.created_at` — the same value already available as `meta.createdAt` on every profile. The field is required on `EducatorProfileVM` (`joinedDate: ISODateTime`), forcing every educator build to carry it.

Consider making it `joinedDate?: ISODateTime | null` and only setting it when the DB value is explicitly populated, reading `meta.createdAt` as a display fallback in the UI instead of duplicating it in the VM.

---

## 15. Developer Experience (DX) Improvements

These items don't affect end-user functionality but directly affect how fast and confidently developers can work. Each finding is verified against the actual files in the repo.

---

### 15A. Husky hooks are wired but empty — `lint-staged` never runs

`husky` and `lint-staged` are both installed ([package.json:63-65](../package.json)) and `"prepare": "husky"` is set, but `.husky/` contains only the internal `_/` bootstrap directory — **no actual hook files exist**.

`lint-staged` has no config (no `.lintstagedrc.*` anywhere). Result: nothing is validated before a commit, and the two packages are dead weight.

**Fix — create two files:**

```bash
# .husky/pre-commit
pnpm lint-staged
```

```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

This ensures every commit is lint-clean and formatted without running the full CI suite locally.

---

### 15B. No Supabase type generation — DB row types are written by hand

There is no auto-generated `database.types.ts`. The `supabase/` directory exists with migrations, but the Supabase CLI `gen types typescript` command is never called. Row types in `packages/shared-types/src/rows/` are hand-written and drift from the real schema whenever a migration runs.

**Fix — add a root script:**

```json
// package.json
"generate:db-types": "supabase gen types typescript --local > packages/shared-types/src/rows/database.types.ts"
```

Then import generated types in row files instead of hand-writing them, and add the step to CI after `pnpm build:packages`. The generated file should be committed (so CI doesn't need a live DB) and regenerated whenever migrations change.

---

### 15C. No `.prettierignore` — `pnpm format` formats everything

`prettier --write .` ([package.json:48](../package.json)) will format `dist/`, `.next/`, `node_modules/.cache/`, `apps/mobile/android/`, and any generated files. There is no `.prettierignore`.

**Fix — create `.prettierignore`:**

```
node_modules
dist
.next
.expo
android
ios
*.generated.ts
pnpm-lock.yaml
```

---

### 15D. `.vscode/settings.json` is nearly empty

[.vscode/settings.json](../.vscode/settings.json) contains only `"cSpell.words": ["iconicedu"]`. Missing settings that would immediately improve productivity for every developer:

```json
{
  "cSpell.words": ["iconicedu"],
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [["cn\\(([^)]*)\\)", "'([^']*)'"]],
  "search.exclude": {
    "**/.next": true,
    "**/dist": true,
    "**/android": true,
    "**/ios": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.next/**": true
  }
}
```

The `typescript.tsdk` setting is especially important in a monorepo — without it VS Code may pick the wrong TypeScript version.

---

### 15E. `.vscode/extensions.json` is missing

There is no [.vscode/extensions.json](../.vscode/extensions.json). New team members get no prompt to install the project's required extensions. Create it:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "supabase.supabase",
    "streetsidesoftware.code-spell-checker",
    "unifiedjs.vscode-mdx"
  ]
}
```

---

### 15F. `launch.json` is incomplete — only Next.js is debuggable

[.vscode/launch.json](../.vscode/launch.json) has one configuration (Next.js) and a compound that references only it. NestJS API and Expo mobile have no debug configurations.

**Add to `configurations`:**

```json
{
  "type": "node",
  "request": "launch",
  "name": "API: NestJS (debug)",
  "runtimeExecutable": "node",
  "runtimeArgs": ["--inspect=9229"],
  "program": "${workspaceFolder}/apps/api/node_modules/.bin/ts-node",
  "args": ["-r", "tsconfig-paths/register", "src/main.ts"],
  "cwd": "${workspaceFolder}/apps/api",
  "envFile": "${workspaceFolder}/apps/api/.env",
  "console": "integratedTerminal",
  "skipFiles": ["<node_internals>/**"]
},
{
  "type": "node",
  "request": "attach",
  "name": "API: Attach (running)",
  "port": 9229,
  "restart": true,
  "skipFiles": ["<node_internals>/**"]
}
```

Update the compound to include both:

```json
{
  "name": "Dev: Web + API",
  "configurations": ["Web: (Next + Turbopack)", "API: NestJS (debug)"],
  "stopAll": true
}
```

---

### 15G. No test factories — every test file re-creates its own fixtures

There are no shared test data factories anywhere in the monorepo. Each test file that needs a `UserProfileVM`, `ChannelVM`, or `ThreadVM` either inlines a giant object literal or copies from another test. This is the primary reason tests are fragile when VMs change shape.

A shared `@iconicedu/test-utils` package (or a `__fixtures__/` directory per domain) would eliminate this:

```ts
// packages/test-utils/src/factories/profile.factory.ts
export const makeEducatorProfile = (
  overrides: Partial<EducatorProfileVM> = {},
): EducatorProfileVM => ({
  ids: { id: 'educator-1', orgId: 'org-1', accountId: 'account-1' },
  kind: 'educator',
  profile: { displayName: 'Test Educator', avatar: { source: 'seed', seed: 'test' } },
  prefs: { timezone: 'UTC' },
  meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  joinedDate: '2025-01-01T00:00:00Z',
  ...overrides,
});
```

When a VM field is added or renamed, you fix the factory once — not every test file. Also means test intent is clearer: `makeEducatorProfile({ averageRating: 5 })` vs a 50-line inline object.

---

### 15H. No type-safe environment variables — `process.env.*` returns `string | undefined` everywhere

`process.env.NEXT_PUBLIC_SUPABASE_URL` and related vars are accessed without any runtime validation or type narrowing. A missing env var causes a confusing runtime error deep in the app instead of a clear startup failure. This was already flagged in §11 (P1), but the DX angle is different: developers also get no autocomplete for env var names.

**Fix** with [`@t3-oss/env-nextjs`](https://env.t3.gg/docs/nextjs):

```ts
// apps/web/lib/config/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  },
});
```

IDE autocomplete on `env.NEXT_PUBLIC_SUPABASE_URL`, and throws at startup if anything is missing.

---

### 15I. CI caches nothing beyond `pnpm install` — Turbo remote caching not configured

[.github/workflows/ci.yml](../.github/workflows/ci.yml) caches the pnpm store (`cache: pnpm`) but does not configure Turbo remote caching. Without it, every CI run rebuilds everything from scratch — packages, typecheck, test.

Turbo remote caching stores task outputs in a shared cache (Vercel or self-hosted):

```yaml
# In ci.yml env block:
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

Once configured, a PR that only touches `apps/mobile` skips the `apps/web` build entirely. This is one of the largest CI time wins available in a Turbo monorepo.

---

### 15J. CI runs the full pipeline on `push: main` — slow feedback for hotfixes

The CI workflow triggers on both `push: [main]` and `pull_request: [main]`. For hotfixes pushed directly to main, the full `lint → typecheck → test → build` runs — even though it already passed on the PR. Consider separating:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    paths-ignore: ['docs/**', '**.md']
```

Or add a faster "smoke" job (lint + typecheck only) that runs on push, and full CI only on PRs.

---

### 15K. No conventional commits enforcement — `git log` is unstructured

There is no `commitlint` or commit message convention enforced. Without structured commit messages, automated changelogs (`changesets`, `semantic-release`) are impossible and `git log --oneline` is noise.

**Fix** — add commitlint to the husky hooks:

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional -w
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.mjs
```

```bash
# .husky/commit-msg
pnpm commitlint --edit "$1"
```

This enforces `feat:`, `fix:`, `chore:`, `docs:` prefixes, enabling automatic changelog generation later.

---

### 15L. `packages/utils` and `packages/shared-types` have no test scripts

Neither package has a `test` script in its `package.json`. `pnpm test` runs tests for apps only — changes to these packages go unvalidated in the test pipeline. This is especially risky for `shared-types` because every app depends on it.

Add vitest to both packages and add test scripts. Even a few tests for the mapper utilities and derive functions would catch regressions instantly.

---

### 15M. No `@iconicedu/test-utils` package — testing utilities scattered

Mocking patterns like `vi.mock('next/navigation', ...)`, `vi.mock('@supabase/ssr', ...)`, and auth context setup are copy-pasted across test files. A shared `packages/test-utils` package (not published, workspace-only) would centralise:

- `renderWithProviders(ui, options)` — wraps in ThemeProvider, QueryClientProvider
- `mockSupabaseClient()` — returns a typed Supabase client mock
- `mockNextNavigation()` — standard router/searchParams mock
- VM factories (see §15G)
- Common test assertions (`expectToHaveRenderedWith(mock, props)`)

---

### 15N. Mobile `Constants.expoConfig?.extra` is untyped — `any` at the source

**File**: [apps/mobile/src/lib/supabase/client.ts](../apps/mobile/src/lib/supabase/client.ts)

```ts
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl; // type: any
```

The `extra` field is `Record<string, any>`. Create a typed accessor:

```ts
// apps/mobile/src/lib/config/app-config.ts
type AppExtra = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  posthogKey?: string;
};

export function getAppExtra(): AppExtra {
  const extra = Constants.expoConfig?.extra;
  if (!extra?.supabaseUrl) throw new Error('Missing supabaseUrl in app config');
  return extra as AppExtra;
}
```

One place to validate Expo config at runtime, full autocomplete everywhere else.

---

## 16. Summary Checklist

Status note: This checklist is updated incrementally as fixes land. Items should only be checked when the code change is implemented and verified by tests/typecheck/build as appropriate.

### P0 — Must fix before production

- [ ] **JWT verification**: Replace `jwt.decode` with `jwt.verify` using Supabase JWKS in `apps/api/src/modules/auth/auth.service.ts`
- [ ] **Channels RLS bypass**: Add explicit user-scoped `where` clause in `ChannelsService.listChannelsForUser`

### P1 — Dead code (safe to remove now)

- [x] **Trim `EDUCATOR_AVAILABILITY_SELECT`** — remove 6 unused audit fields (`created_at, created_by, updated_at, updated_by, deleted_at, deleted_by`) from the select constant (`selects.ts:76-77`)
- [x] **Remove `StaffProfileRow.working_hours_rules` + `.working_hours_schedule`** — never selected, never mapped, never rendered; also remove `workingHoursScheduleToDayAvailability` utility if DB columns are unused
- [x] **Investigate `notesInternal` + `leadSource`** — fetched from DB and mapped on every profile load but not rendered in any UI; remove from `PROFILE_SELECT` until admin views are built
- [ ] **Fix `UserLocationVM.streetAddress`** — either add a DB column and mapper, or remove from the VM type (it is always `undefined` at runtime)
- [x] **Drop `communication_style` (singular) from `CHILD_PROFILE_SELECT` and `ChildProfileRow`** — superseded by `communication_styles` (plural); verify DB column is also droppable
- [x] **Collapse 13 identical `MessageXxxRow` types** into `MessagePayloadRow` (no type safety lost; see §13A)

### P1 — High value (anti-patterns & duplication)

- [x] Extract `AuditRow` base interface — collapse 13 identical `MessageXxxRow` types into one `MessagePayloadRow` (`rows/message.ts`)
- [x] Extract `requireAdminAuthContext()` — remove 120 lines of copy-pasted auth boilerplate from 6 admin helper files
- [x] Merge archive/unarchive into `setEntityStatus(table, id, status)` — replace 4 near-identical files
- [x] Move `groupBy` to `packages/utils` — remove 3 independent reimplementations in builder files
- [x] Fix double-fetch of primary channel in `resolveChannels` (`learning-space.builder.ts:60-63`)
- [ ] Investigate and resolve `communication_style` vs `communication_styles` in `ChildProfileRow` (line 69 vs 74)
- [x] Compose `PROFILE_SELECT` from shared field arrays to eliminate overlap with `PROFILE_SUMMARY_SELECT`
- [ ] Move `lib/data/` files to their correct domain folders (`lib/activity-feed/`, `lib/admin/`, `lib/channels/`)
- [x] Create `createEnumNormalizer` in `packages/utils` — used by all 4 profile builders

### P1 — High value, fix in next sprint

- [x] SSRF protection on link preview URL fetch
- [ ] Rate limiting via `@nestjs/throttler`
- [ ] Controller DTOs with `class-validator`
- [x] Batch profile fetches — replace N-query `resolveProfilesById` with a single `.in()` query
- [ ] Unified `ActionResult<T>` type across all server actions
- [ ] React Error Boundaries at route group level (`error.tsx`, `not-found.tsx`)
- [ ] Structured logging (`pino` in web, `nestjs-pino` in API)
- [ ] `cache()` wrapping on expensive builders
- [ ] Zod schemas at mapper boundaries for DB rows
- [ ] Payload Zod validation in server actions
- [x] Environment variable validation at startup
- [ ] API integration tests
- [x] Move `groupBy` and shared helpers to `packages/utils`
- [x] Decouple `ui-web` Tailwind config from `apps/web` path

### P2 — Polish (anti-patterns & duplication)

- [ ] Standardize select constant format — either `[...].join(',')` arrays everywhere or bare strings (currently mixed)
- [x] Extract `CHILD_PROFILE_FIELDS` base array so `CHILD_PROFILE_SELECT` and `CHILD_PROFILE_ROWS_SELECT` share it
- [ ] Deduplicate sidebar unread immutable update logic across `direct-message-unread.ts` and `learning-space-unread.ts`
- [ ] Extract single `batchLoadProfiles(supabase, profileIds)` — used by 3+ builder files independently doing `Promise.all(ids.map(buildUserProfileById))`

### P2 — Polish / longer term

- [ ] Branded `UUID` and `ISODateTime` types
- [x] `NotificationKey` exhaustive union (replace open `Record<string, ...>`)
- [x] Fix stateful regex in `deriveHomeworkMessageIntent`
- [ ] Split `app/actions/messages.ts` by concern
- [ ] Suspense streaming for feed pages
- [ ] Verify `useSearchParams()` is inside Suspense boundaries
- [ ] Icon-only button `aria-label` audit
- [ ] `forwardRef` audit on `ui-web` primitives
- [ ] Visual regression tests (Storybook + Chromatic or Playwright screenshots)
- [ ] E2E coverage for login, messaging, admin user creation
- [ ] `Cache-Control` headers on API route handlers
- [ ] Bundle analysis (`@next/bundle-analyzer`)
- [x] `engines` field in root `package.json`
- [ ] Audit `turbo.json` env declarations for completeness
- [ ] `next/image` for all `<img>` tags
