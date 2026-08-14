# Architecture Overview

## Purpose

High-level guide to how IconicEdu is structured and how the pieces connect.

## Intended Audience

Engineers who need a system-level mental model before changing features or infrastructure.

## Last Updated

2026-08-14

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
│   │   Next.js 15     │       │     Expo 55 / RN 0.83.2 │    │
│   │   (App Router)   │       │     (Expo Router)        │    │
│   └────────┬────────┘       └────────────┬────────────┘    │
│            │                             │                  │
└────────────┼─────────────────────────────┼──────────────────┘
             │ HTTPS (Bearer session)       │
             ├──────────────────────────────┤
             ▼                              ▼
┌───────────────────────────────────────────────────────────┐
│                    NestJS API                              │
│       validation · business logic · all table access       │
│         http://localhost:3001 / Swagger at /docs           │
└────────────────────────────┬──────────────────────────────┘
                             │ Postgres (Prisma)
                             ▼
┌───────────────────────────────────────────────────────────┐
│ Supabase: PostgreSQL + RLS · Auth · Realtime · Storage     │
└───────────────────────────────────────────────────────────┘

Web and mobile also connect directly to Supabase Auth, Realtime, and Storage.
They never use the Supabase table API directly.
```

---

## Apps

### Web (`apps/web`)

- **Framework:** Next.js 15 with App Router
- **Rendering:** Default to React Server Components; `'use client'` only where needed
- **Data access:** `createApiClient` for all table-backed reads and writes
- **Auth:** Supabase Auth with cookie-based sessions via `@supabase/ssr`
- **Direct Supabase:** Auth, Realtime, and Storage only
- **UI:** `@iconicedu/ui-web` (shadcn/Radix components + Tailwind CSS)
- **Deployed to:** Vercel

### Mobile (`apps/mobile`)

- **Framework:** Expo 55 with Expo Router v7 (file-based routing)
- **Data access:** React Query + typed NestJS API helpers
- **Real-time:** Supabase Realtime WebSocket subscriptions for live message updates
- **Auth:** Supabase OTP (email) and Google OAuth (via `expo-web-browser`)
- **UI:** `@iconicedu/ui-native` (NativeWind v4 components)
- **Built with:** EAS Build; distributed via App Store and Play Store

### API (`apps/api`)

- **Framework:** NestJS 11
- **ORM:** Prisma 7 (type-safe queries against Supabase Postgres)
- **Auth:** Receives Supabase bearer sessions and establishes request identity in the API guard
- **API docs:** Swagger at `/docs`
- **Used for:** All table reads and writes, input validation, business logic, scheduled jobs, and privileged operations

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
Database (Supabase Postgres)
    │
    ▼ Prisma inside apps/api
  API model/result   — database-facing shapes
    │
    ▼ API service + mapper
  View Model (VM)    — rich UI-ready types, camelCase, nested objects
    │
    ▼ typed HTTP response
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
       → Server Components use the session when calling apps/api
```

### Mobile

```
Device → Supabase Auth (email OTP or Google OAuth via expo-web-browser)
       → Supabase returns JWT session
       → Session stored in expo-secure-store
       → Supabase client auto-refreshes tokens
       → On login: apps/api activates and returns the account
```

---

## Data Flow — Sending a Message

```
User types message
       │
       ▼ web/mobile typed API client
POST /messages/text with validated payload + bearer session
       │
       ▼ NestJS controller → service → Prisma transaction
INSERT messages + message_text and emit the domain event
       │
       ├──▶ (mobile) Realtime subscription fires
       │            → new message appended to React Query cache
       │            → UI updates instantly
       │
       └──▶ API response returns a shared MessageVM
                    → client cache/UI reconciles
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

API authorization is the primary application boundary. RLS remains enabled as defense in depth for permitted Supabase Realtime and Storage access.

---

## Key Design Decisions

For the reasoning behind significant choices, see the Architecture Decision Records:

- [ADR-001 — Monorepo with Turborepo + pnpm](../decisions/001-monorepo-turborepo-pnpm.md)
- [ADR-002 — Supabase as database and auth platform](../decisions/002-supabase.md)
- [ADR-003 — Expo for cross-platform mobile](../decisions/003-expo-react-native.md)
