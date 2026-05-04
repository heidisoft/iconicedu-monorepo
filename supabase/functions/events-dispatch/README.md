# events-dispatch

Supabase Edge Function cron bridge for the unified event pipeline.

Calls:

- `POST /internal/events/dispatch`

The API dispatcher claims due `event_pipeline_jobs` and runs the appropriate
service for:

- `activity.generate`
- `activity.project`
- `notification.prepare`
- `notification.deliver`
- `reminder.reconcile`
- `reminder.dispatch`

Required secrets:

- `EVENTS_DISPATCH_URL`
- `INTERNAL_EVENTS_TOKEN`

Optional secrets:

- `EVENTS_DISPATCH_LIMIT`
- `EVENTS_DISPATCH_LEASE_SECONDS`
- `EVENTS_DISPATCH_LEASE_OWNER`
