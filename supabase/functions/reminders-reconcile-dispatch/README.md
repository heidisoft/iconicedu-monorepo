# reminders-reconcile-dispatch (legacy Supabase Edge Function)

Compatibility bridge for the older dedicated reminder reconciliation queue. New
schedule-table changes enqueue `event_pipeline_jobs` with
`job_kind='reminder.reconcile'`, and `events-dispatch` calls
`POST /internal/events/dispatch` to process them.

This legacy function calls:

- `POST /internal/reminders/reconcile-dispatch`

Required secrets:

- `REMINDERS_RECONCILE_DISPATCH_URL=https://<your-api-domain>/internal/reminders/reconcile-dispatch`
- `INTERNAL_REMINDERS_TOKEN=<same-value-as-INTERNAL_REMINDERS_TOKEN_API>`

Optional:

- `REMINDERS_RECONCILE_DISPATCH_LIMIT=100`
- `REMINDERS_RECONCILE_DISPATCH_LEASE_SECONDS=120`
- `REMINDERS_RECONCILE_DISPATCH_LEASE_OWNER=supabase-edge-cron`

Deploy:

```bash
supabase functions deploy reminders-reconcile-dispatch
```
