# External Integrations

Full detail: [docs/codebase/INTEGRATIONS.md](../docs/codebase/INTEGRATIONS.md) — Supabase (Auth, Realtime, Storage), PostHog, Vercel, EAS, and the event-pipeline outbox/queue pattern.

- Event pipeline (`event_outbox` / `event_pipeline_jobs`) is at-least-once delivery via pg_cron polling — consumers must be idempotent.
- Adding a new external integration should extend that doc in the same change.
