# notifications-dispatch (Supabase Edge Function)

Calls the internal app endpoint:

- `POST /api/internal/notifications/dispatch`

Scheduler source of truth:

- **Supabase Scheduled Functions only** for notifications dispatch.
- No GitHub Actions cron workflow is used for notifications dispatch.

## Required environment variables

- `NOTIFICATIONS_DISPATCH_URL`
- `INTERNAL_NOTIFICATIONS_TOKEN`

## Optional environment variables

- `NOTIFICATIONS_DISPATCH_LIMIT` (default handled by API)
- `NOTIFICATIONS_DISPATCH_LEASE_SECONDS` (default handled by API)
- `NOTIFICATIONS_DISPATCH_LEASE_OWNER` (default: `supabase-edge-cron`)

## Deploy

```bash
supabase functions deploy notifications-dispatch
```

## Example schedule (Supabase Dashboard)

Use scheduled invocations to run every minute and update the schedule in the Supabase Dashboard under Scheduled Functions:

- Function: `notifications-dispatch`
- Cron: `*/1 * * * *`
