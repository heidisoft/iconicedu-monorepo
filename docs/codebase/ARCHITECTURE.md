# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: **API-first, multi-frontend monorepo** — two thin frontend clients (web, mobile) that hold no business logic, talking to one backend (`apps/api`) that owns all data access; feature-based module organization within each app rather than strict horizontal layering.
- Why this classification: enforced explicitly as ADR-004 ("API-First Frontend Data Boundary") and the "Web And Mobile Are Frontend-Only" hard rule in `AGENTS.md`; verified in practice — `apps/api` modules mix direct Prisma (`PrismaService`) and Supabase-client (`createSupabaseServiceClient`/`createSupabaseSessionClient`) access, while `apps/web`/`apps/mobile` route table-backed reads/writes through typed HTTP clients.
- Primary constraints: (1) Row Level Security enabled on every Postgres table as defense-in-depth even though API authorization is the primary boundary (`supabase/migrations/`); (2) Supabase migrations are the schema source of truth, Prisma schema is a mirror, never the reverse (`apps/api/prisma/schema.prisma`); (3) new user-facing web features must ship behind a PostHog-backed feature flag defaulting off (`apps/web/flags.ts`, `scripts/check-feature-flag-gating.mjs`).

### 2) System Flow

```text
Web/Mobile UI (Server Component or screen)
  -> typed HTTP client (createApiClient / apiGet|apiPost|...) with Supabase bearer session attached
  -> NestJS controller (@UseGuards(AuthGuard)) in apps/api/src/modules/<feature>
  -> service layer (Prisma or Supabase service/session client)
  -> Supabase Postgres (RLS enabled, service-role bypasses when the API acts on the platform's behalf)
  -> shared VM/response type from @iconicedu/shared-types
  -> UI renders VM; Realtime subscription (mobile) or refetch reconciles cache
```

### 3) Layer/Module Responsibilities

| Layer or module                                         | Owns                                                                                                             | Must not own                                                                            | Evidence                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web`, `apps/mobile`                               | Routing, rendering, calling `apps/api`, Supabase Auth/Realtime/Storage SDK use                                   | Table queries/mutations, validation, business rules, service-role credentials           | `docs/decisions/004-api-first-frontend-boundary.md`                |
| `apps/api/src/modules/*`                                | Controllers, services, business rules, authorization, per-module DTOs                                            | UI concerns                                                                             | `apps/api/src/modules/channels/`, `apps/api/src/modules/messages/` |
| `apps/api/src/lib/supabase/`                            | Supabase service-role and session-scoped client factories                                                        | —                                                                                       | `apps/api/src/lib/supabase/service.ts`, `session.ts`               |
| `apps/api/src/observability/`                           | Global exception filter, request logging interceptor, request-context propagation                                | Business logic                                                                          | `apps/api/src/observability/global-exception.filter.ts`            |
| `apps/api/src/modules/events/event-pipeline.service.ts` | Leases and dispatches `event_pipeline_jobs` rows (activity generation, notifications, reminders)                 | —                                                                                       | `apps/api/src/modules/events/event-pipeline.service.ts`            |
| `supabase/functions/*`                                  | pg_cron-triggered thin bridges that call `apps/api` internal endpoints (token-authed)                            | Direct table writes bypassing `apps/api` (explicitly forbidden in `reminders-dispatch`) | `supabase/functions/reminders-dispatch/index.ts:4-7`               |
| `packages/shared-types`                                 | Rows (snake_case, DB-facing), VMs (camelCase, UI-facing), payloads, pure shared mappers, and cross-app contracts | App-specific logic or I/O                                                               | `packages/shared-types/src/{rows,vm,payloads,mappers}`             |

### 4) Reused Patterns

| Pattern                                        | Where found                                                                                                                                            | Why it exists                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Transactional outbox + polled job queue        | `event_outbox`, `event_pipeline_jobs` tables; `apps/api/src/modules/events/event-pipeline.service.ts`; edge functions polling via pg_cron every minute | At-least-once delivery for domain events (activity feed, notifications, reminders) without a separate message broker                        |
| Guard + request-context middleware for auth    | `apps/api/src/modules/auth/auth.guard.ts`, `apps/api/src/main.ts` (request-context middleware)                                                         | Per-route (not global) auth enforcement; decodes Supabase JWT, attaches `req.user`, propagates request id/role for logging                  |
| Typed HTTP client adapter (thin fetch wrapper) | `apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`                                                                            | Single place to attach bearer auth and normalize error handling instead of scattered raw `fetch` calls                                      |
| Row → VM mapper layer                          | `packages/shared-types/src/mappers/message-mappers.ts`, `packages/shared-types/src/{rows,vm,payloads}`                                                 | Keeps DB shape (snake_case, nullable) separate from UI-ready shape (camelCase, non-null) without duplicating pure mapping logic across apps |
| Feature flag gate (server-evaluated)           | `apps/web/flags.ts` (`flag<boolean>({..., decide: evaluateWebBooleanFlag})`), enforced by `scripts/check-feature-flag-gating.mjs`                      | New web UI ships dark by default, evaluated against PostHog per-profile                                                                     |
| Discriminated unions for polymorphic content   | `messages`/`message_text`/`message_file`/`message_audio` tables and their VMs                                                                          | Messages have heterogeneous payload types (text/file/audio) sharing a common envelope                                                       |

### 5) Known Architectural Risks

- **Inconsistent data-access layer inside apps/api**: some services use `PrismaService`, others call the Supabase client directly (`createSupabaseServiceClient`/`createSupabaseSessionClient`), rather than a single uniform ORM boundary — increases the surface area for query-pattern drift between the two access paths (`apps/api/src/modules/channels/channels.service.ts` vs. `apps/api/src/modules/messages/*`).
- **DTO validation gap**: a global `ValidationPipe` is registered and `class-validator`/`class-transformer` are dependencies, but no `class-validator` decorators exist anywhere in `apps/api/src` — validation is instead hand-rolled per-DTO (e.g. `apps/api/src/modules/schedules/dto/replace-schedules.dto.ts`), so the global pipe is effectively inert and validation coverage depends on each module remembering to hand-roll checks. See [CONCERNS.md](CONCERNS.md).
- **Dual data-fetching pattern in `apps/web`**: some Server Components go through `createApiClient` (the documented/enforced path), others (e.g. `apps/web/lib/org/builders/org.builder.ts`) query Supabase directly — both patterns coexist in production code, which is exactly the "migration debt" ADR-004 acknowledges but does not fully track.

### 6) Evidence

- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.guard.ts`, `apps/api/src/modules/events/event-pipeline.service.ts`
- `apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`
- `docs/decisions/004-api-first-frontend-boundary.md`

## Extended Sections (Optional)

Not populated — the primary flow, layer table, and risks above cover this repo's architecture at the depth needed for onboarding.
