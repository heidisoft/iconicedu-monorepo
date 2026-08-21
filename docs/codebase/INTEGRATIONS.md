# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System                            | Type                      | Purpose                                                                                             | Auth model                                                                   | Criticality                       | Evidence                                                                                                                              |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Postgres                 | DB                        | Primary relational store (all app data)                                                             | Service-role key (API) / RLS-scoped session (frontend)                       | High                              | `apps/api/src/lib/supabase/service.ts`, `session.ts`                                                                                  |
| Supabase Auth                     | Auth                      | Email OTP + Google/Apple OAuth sessions                                                             | Supabase JWT, verified against `SUPABASE_JWT_SECRET` in API guard            | High                              | `apps/api/src/modules/auth/auth.guard.ts`, `apps/mobile/src/providers/auth-provider.tsx`                                              |
| Supabase Realtime                 | WebSocket                 | Live message updates (mobile)                                                                       | RLS-scoped channel subscription                                              | Medium                            | `docs/architecture/database.md` (Realtime section)                                                                                    |
| Supabase Storage                  | File storage              | Message attachments, avatars, thumbnails                                                            | Bucket RLS policies                                                          | Medium                            | `docs/architecture/database.md` (Storage section)                                                                                     |
| Supabase Edge Functions           | Serverless (Deno)         | pg_cron-triggered dispatchers: `events-dispatch`, `reminders-dispatch`, `channel-read-state-repair` | Internal bearer tokens (`INTERNAL_EVENTS_TOKEN`, `INTERNAL_REMINDERS_TOKEN`) | High                              | `supabase/functions/*/index.ts`                                                                                                       |
| PostHog                           | Analytics + feature flags | Product analytics and flag evaluation across web, API, mobile                                       | `POSTHOG_KEY`/`POSTHOG_HOST`                                                 | High (flags gate feature rollout) | `apps/api/src/analytics/analytics.service.ts`, `apps/web/lib/flags/posthog-flags`, `apps/mobile/src/providers/analytics-provider.tsx` |
| Expo Push API                     | Push notifications        | Delivers push notifications to mobile devices                                                       | `EXPO_ACCESS_TOKEN`                                                          | Medium                            | `apps/api/src/lib/notifications/providers/push-provider.ts`                                                                           |
| Daily.co                          | Video                     | Live tutoring/session video calls (web only)                                                        | Daily API (client SDK)                                                       | Medium                            | `apps/web/package.json` (`@daily-co/daily-js`, `@daily-co/daily-react`)                                                               |
| Vercel Analytics / Speed Insights | Observability             | Web performance/usage telemetry                                                                     | Vercel-managed                                                               | Low                               | `apps/web/package.json`                                                                                                               |
| Vercel Flags SDK (`flags`)        | Feature flags             | Defines/serves web flag catalogue, backed by PostHog evaluation                                     | N/A                                                                          | High                              | `apps/web/flags.ts`                                                                                                                   |
| Email provider                    | Notifications             | **Stubbed** — `sendEmailNotification` is an empty no-op                                             | N/A                                                                          | N/A (not live)                    | `apps/api/src/lib/notifications/providers/email-provider.ts`                                                                          |

### 2) Data Stores

| Store                                                          | Role                                                                                           | Access layer                                                                                                                                                | Key risk                                                                                                            | Evidence                                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Supabase Postgres (`supabase/migrations/`, 158 files)          | System of record for all domain data (accounts, channels, messages, classes, event pipeline)   | `apps/api` via Prisma (`PrismaService`) for some modules, Supabase service/session client for others (mixed — see [ARCHITECTURE.md](ARCHITECTURE.md))       | Mixed access layer inside the API increases risk of inconsistent query/authorization patterns between the two paths | `apps/api/prisma/schema.prisma`, `apps/api/src/lib/supabase/service.ts` |
| `event_outbox` / `event_pipeline_jobs` / `event_pipeline_logs` | Transactional outbox + polled job queue for domain events (activity, notifications, reminders) | `apps/api/src/modules/events/event-pipeline.service.ts` (claims jobs via `claim_due_event_pipeline_jobs` RPC), edge functions poll via pg_cron every minute | At-least-once delivery — consumers must be idempotent                                                               | `docs/architecture/database.md`                                         |

### 3) Secrets and Credentials Handling

- Credential sources: per-app `.env`/`.env.example` files, injected as CI/CD secrets in `.github/workflows/ci.yml` and Turborepo's `env` allowlist in `turbo.json`.
- Hardcoding checks: grepped tracked `apps/`, `packages/`, `supabase/` (excluding `node_modules`/`Pods`) for `sk_(live|test)_...`, `AIza...`, and PEM private-key headers — **no hits found**.
- Rotation/lifecycle notes: `[TODO]` — no rotation policy or schedule found in tracked docs; `AGENTS.md` states service-role credentials/tokens must never appear in code, logs, docs, or PRs, but does not document a rotation cadence.

### 4) Reliability and Failure Behavior

- Retry/backoff: implemented for the event pipeline — `apps/api/src/modules/events/event-pipeline.service.ts` has exponential-backoff retry logic (`resolveRetryDelayMs`, `isRetryableError`) for job dispatch failures.
- Retry/backoff: **not implemented** in the web/mobile HTTP clients (`apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`) — a failed API call throws immediately with no retry.
- Timeout policy: `[TODO]` — no explicit request timeout configuration found in the HTTP clients or NestJS bootstrap during this pass.
- Circuit-breaker/fallback: none found; `apps/api/src/lib/notifications/providers/email-provider.ts` is a no-op stub rather than a guarded fallback, which silently drops email notifications if ever relied upon.

### 5) Observability for Integrations

- Logging around external calls: `RequestLoggingInterceptor` logs every inbound API request and captures analytics via PostHog; the global exception filter logs and reports every unhandled error with request context. No dedicated logging wrapper was found around outbound Supabase/PostHog/Expo Push calls specifically.
- Metrics/tracing: PostHog serves as both analytics and (via `@openfeature/server-sdk`) the feature-flag evaluation backend — no separate APM/tracing tool (no Sentry SDK found anywhere in the repo).
- Missing visibility gaps: no crash reporting on mobile (no `@sentry/*` or equivalent dependency); email notification path has no delivery observability since it is unimplemented.

### 6) Evidence

- `apps/api/src/lib/supabase/service.ts`, `session.ts`
- `apps/api/src/lib/notifications/providers/push-provider.ts`, `email-provider.ts`
- `apps/api/.env.example`, `apps/web/.env.local.example`, `apps/mobile/.env.example`
- `apps/api/src/observability/global-exception.filter.ts`

## Extended Sections (Optional)

Not populated — the inventory above covers every integration point surfaced by the investigation; a deeper per-endpoint catalog was not required for onboarding purposes.
