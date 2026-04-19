# Reminders Cron Ops (Supabase Edge Function -> API)

## Purpose

Operational runbook for the reminders dispatch pipeline.

## Intended Audience

Engineers operating or debugging scheduled reminder delivery.

## Last Updated

2026-04-18

## Related Docs

- [Documentation Hub](../README.md)
- [Deployment](deployment.md)

This sets up a Supabase scheduled Edge Function that calls:

- `POST /internal/reminders/dispatch` on the API service.

The API endpoint performs lease-based due-job claiming and dispatching.

Current class-session timing behavior:

- `session.reminder` jobs: 30 minutes and 5 minutes before session start.
- `session.feedback_request` jobs: 15 minutes after session end
  (falls back to 15 minutes after start if end time is invalid).

## 1. Required API env (`apps/api`)

In your API deployment, set:

- `INTERNAL_REMINDERS_TOKEN_API=<long-random-secret>`
- `SUPABASE_URL=<https://<project-ref>.supabase.co>`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
- `POSTHOG_API_KEY=<optional-posthog-key>`
- `POSTHOG_HOST=https://us.i.posthog.com`

`INTERNAL_REMINDERS_TOKEN_API` must match the secret configured in Supabase function env below.

## 2. Required function env (Supabase)

Set these Supabase secrets for the `reminders-dispatch` function:

- `REMINDERS_DISPATCH_URL=https://<your-api-domain>/internal/reminders/dispatch`
- `INTERNAL_REMINDERS_TOKEN=<same-value-as-INTERNAL_REMINDERS_TOKEN_API>`

Optional:

- `REMINDERS_DISPATCH_LIMIT=100`
- `REMINDERS_DISPATCH_LEASE_SECONDS=120`
- `REMINDERS_DISPATCH_LEASE_OWNER=supabase-edge-cron`

## 3. Deploy the Edge Function

```bash
supabase functions deploy reminders-dispatch
```

If you deploy to a linked remote project, ensure `supabase link --project-ref <ref>` is already done.

## API service health checks

`apps/api/railway.toml` configures Railway deployment health checks to hit:

- `GET /healthz`

Ensure your Railway service uses `apps/api` as the service root so this config is applied.

## 4. Configure cron jobs

Cron schedules are repo-managed by `public.configure_edge_function_cron()` from:

- `supabase/migrations/20260417000000_edge_function_cron.sql`

Apply migrations to the target environment, then configure the jobs with that environment's own Supabase URL:

```sql
select public.configure_edge_function_cron('https://<project-ref>.supabase.co');
```

Preview branches created by `.github/workflows/ci.yml` run this automatically after branch migrations, function secrets, and function deployment.

## 5. Validate

1. Invoke function manually once from dashboard.
2. Verify `cron.job` contains `edge-function-reminders-dispatch`.
3. Verify API logs show requests to `/internal/reminders/dispatch`.
4. Verify response payload has counters like `claimed/succeeded/failed`.
5. Verify DB updates:
   - `reminder_jobs.status` transitions
   - `messages` + payload rows inserted
   - `activity_events` created and projected to `activity_feed_items`.

## 6. Operational defaults

- Keep schedule interval at 1 minute.
- Keep `limit` conservative (`100` to start).
- Use alerting if no successful invocation > 5 minutes.
- Because jobs are lease-claimed and idempotent, overlapping ticks are safe.
- 1-minute cron cadence is expected so 30m/5m reminders and +15m feedback fire on time.

## 7. Dispatch URL Sanity Check

After the API-owned migration, reminders and notifications should both target `apps/api`:

- `REMINDERS_DISPATCH_URL=https://<your-api-domain>/internal/reminders/dispatch`
- `NOTIFICATIONS_DISPATCH_URL=https://<your-api-domain>/internal/notifications/dispatch`

The legacy web endpoint (`/api/internal/reminders/dispatch`) should not be used anymore.

Notification-producing reminder flows are API-owned. Web and mobile may choose the acting profile context for a user, but only `apps/api` authorizes that profile selection before reminder activity and downstream notification dispatch proceed.
