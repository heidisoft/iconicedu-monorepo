# Architecture Overview

## Purpose

High-level guide to how IconicEdu is structured and how the pieces connect.

## Intended Audience

Engineers who need a system-level mental model before changing features or infrastructure.

## Last Updated

2026-03-23

## Related Docs

- [Documentation Hub](../README.md)
- [Shared Packages](packages.md)
- [Database](database.md)
- [ADR Index](../decisions/README.md)
- [Canonical AI Guidance](../internal/ai/agents.md)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│                                                             │
│   ┌─────────────────┐       ┌─────────────────────────┐    │
│   │   Web App        │       │     Mobile App           │    │
│   │   Next.js 15     │       │     Expo 54 / RN 0.81   │    │
│   │   (App Router)   │       │     (Expo Router)        │    │
│   └────────┬────────┘       └────────────┬────────────┘    │
│            │                             │                  │
└────────────┼─────────────────────────────┼──────────────────┘
             │                             │
             │  HTTPS / WebSocket          │  HTTPS / WebSocket
             │                             │
┌────────────▼─────────────────────────────▼──────────────────┐
│                     Supabase                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL   │  │     Auth     │  │     Storage      │  │
│  │  + RLS        │  │  (JWT/OAuth) │  │  (avatars, files)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Realtime (WebSocket)                    │   │
│  │          (live message updates for mobile)            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
             │
             │  Postgres (Prisma)
             │
┌────────────▼──────────────────────────────────────────────┐
│                    NestJS API                              │
│              (server-side business logic)                  │
│         http://localhost:3001 / Swagger at /docs           │
└───────────────────────────────────────────────────────────┘
```

---

## Apps

### Web (`apps/web`)

- **Framework:** Next.js 15 with App Router
- **Rendering:** Default to React Server Components; `'use client'` only where needed
- **Data access:** Supabase SSR client directly in Server Components and Route Handlers
- **Auth:** Supabase Auth with cookie-based sessions via `@supabase/ssr`
- **UI:** `@iconicedu/ui-web` (shadcn/Radix components + Tailwind CSS)
- **Deployed to:** Vercel

The web app talks directly to Supabase for most operations. The NestJS API is called for complex business logic that requires the service role or cross-table transactions.

### Mobile (`apps/mobile`)

- **Framework:** Expo 54 with Expo Router (file-based routing)
- **Data access:** React Query + Supabase JS client with `expo-secure-store` for session persistence
- **Real-time:** Supabase Realtime WebSocket subscriptions for live message updates
- **Auth:** Supabase OTP (email) and Google OAuth (via `expo-web-browser`)
- **UI:** `@iconicedu/ui-native` (NativeWind v4 components)
- **Built with:** EAS Build; distributed via App Store and Play Store

### API (`apps/api`)

- **Framework:** NestJS 11
- **ORM:** Prisma 7 (type-safe queries against Supabase Postgres)
- **Auth:** Validates Supabase JWTs via `@nestjs/passport` + `jsonwebtoken`
- **API docs:** Swagger at `/docs`
- **Used for:** Operations requiring the service role, scheduled jobs, complex business logic

---

## Shared Packages

```
packages/
├── shared-types/    Type definitions shared across all apps
├── ui-web/          React component library for the web app
├── ui-native/       React Native component library for the mobile app
├── utils/           Pure utility functions
├── config-eslint/   Shared ESLint config
└── config-tsconfig/ Shared TypeScript config base
```

See [packages.md](packages.md) for a full breakdown.

---

## Type System

A core design principle is that **each layer of the stack uses a different type shape**:

```
Database (Supabase)
    │
    ▼ supabase.from('messages').select(...)
  Row types          — raw DB shapes, null-heavy, snake_case
    │
    ▼ Builder functions (e.g. buildMessageVM)
  View Model (VM)    — rich UI-ready types, camelCase, nested objects
    │
    ▼ Props / render
  Components         — consume VMs, never Rows directly
```

UI components consume **VMs** (`MessageVM`, `ChannelVM`, etc.). Raw **Rows** are the query layer's internal concern only. **Payloads** are the types sent in mutations.

All shared types live in `@iconicedu/shared-types`.

---

## Authentication Flow

### Web

```
Browser → Supabase Auth (email OTP or OAuth)
       → Supabase sets HttpOnly cookie
       → Next.js middleware reads cookie on every request
       → Server Components get authenticated Supabase client
```

### Mobile

```
Device → Supabase Auth (email OTP or Google OAuth via expo-web-browser)
       → Supabase returns JWT session
       → Session stored in expo-secure-store
       → Supabase client auto-refreshes tokens
       → On login: accounts.status set to 'active'
```

---

## Data Flow — Sending a Message

```
User types message
       │
       ▼ (mobile: React Query mutation / web: Server Action)
sendTextMessage(channelId, profileId, orgId, text)
       │
       ▼ Supabase JS client
INSERT into messages (type='text', channel_id, profile_id, ...)
INSERT into message_text (message_id, payload={text})
       │
       ├──▶ (mobile) Realtime subscription fires
       │            → new message appended to React Query cache
       │            → UI updates instantly
       │
       └──▶ (web) Polling / manual refetch
                   → message list refreshes
```

---

## Multi-role Model

Users belong to exactly one organisation. Within that org, an account has a `role`:

| Role       | Abbr | Can see                                               |
| ---------- | ---- | ----------------------------------------------------- |
| `guardian` | G    | Own data + their children's data (via `family_links`) |
| `educator` | E    | Own data + enrolled students' data                    |
| `student`  | S    | Own data                                              |
| `advisor`  | A    | Assigned families' data                               |
| `staff`    | ST   | Broad read for admin operations                       |

RLS policies enforce these boundaries at the database level — not just in application code.

---

## Key Design Decisions

For the reasoning behind significant choices, see the Architecture Decision Records:

- [ADR-001 — Monorepo with Turborepo + pnpm](../decisions/001-monorepo-turborepo-pnpm.md)
- [ADR-002 — Supabase as database and auth platform](../decisions/002-supabase.md)
- [ADR-003 — Expo for cross-platform mobile](../decisions/003-expo-react-native.md)
