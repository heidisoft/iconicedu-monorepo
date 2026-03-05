# Reminders Cron Ops (Supabase Edge Function)

This sets up a Supabase scheduled Edge Function that calls:

- `POST /api/internal/reminders/dispatch`

The app endpoint performs lease-based due-job claiming and dispatching.

## 1. Required app env (web)

In your web deployment, set:

- `INTERNAL_REMINDERS_TOKEN=<long-random-secret>`

This must match the secret configured in Supabase function env below.

## 2. Required function env (Supabase)

Set these Supabase secrets for the `reminders-dispatch` function:

- `REMINDERS_DISPATCH_URL=https://<your-web-domain>/api/internal/reminders/dispatch`
- `INTERNAL_REMINDERS_TOKEN=<same-value-as-web>`

Optional:

- `REMINDERS_DISPATCH_LIMIT=100`
- `REMINDERS_DISPATCH_LEASE_SECONDS=120`
- `REMINDERS_DISPATCH_LEASE_OWNER=supabase-edge-cron`

## 3. Deploy the Edge Function

```bash
supabase functions deploy reminders-dispatch
```

If you deploy to a linked remote project, ensure `supabase link --project-ref <ref>` is already done.

## 4. Configure schedule (every minute)

In Supabase Dashboard:

1. Go to **Edge Functions**.
2. Open `reminders-dispatch`.
3. Add a **Schedule** with cron:
   - `* * * * *`
4. Save and enable.

## 5. Validate

1. Invoke function manually once from dashboard.
2. Verify web logs show requests to `/api/internal/reminders/dispatch`.
3. Verify response payload has counters like `claimed/succeeded/failed`.
4. Verify DB updates:
   - `reminder_jobs.status` transitions
   - `messages` + payload rows inserted
   - `activity_events` created and projected to `activity_feed_items`.

## 6. Operational defaults

- Keep schedule interval at 1 minute.
- Keep `limit` conservative (`100` to start).
- Use alerting if no successful invocation > 5 minutes.
- Because jobs are lease-claimed and idempotent, overlapping ticks are safe.
