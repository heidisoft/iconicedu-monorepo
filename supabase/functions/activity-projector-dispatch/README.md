# activity-projector-dispatch (Supabase Edge Function)

Calls the internal app endpoint:

- `POST /internal/activity-feed/project`

This function retries pending and failed `activity_events` projection work so
durable activity events eventually fan out to `activity_feed_items` and
`notification_dispatch_jobs`.

Scheduler source of truth:

- `public.configure_edge_function_cron('<project-url>')` in
  `supabase/migrations/20260427000100_activity_projector_edge_function_cron.sql`

## Required environment variables

- `ACTIVITY_PROJECTOR_DISPATCH_URL`
- `INTERNAL_ACTIVITY_PROJECTOR_TOKEN`

Recommended values:

- `ACTIVITY_PROJECTOR_DISPATCH_URL=https://<your-api-domain>/internal/activity-feed/project`
- `INTERNAL_ACTIVITY_PROJECTOR_TOKEN=<same-value-as-INTERNAL_ACTIVITY_PROJECTOR_TOKEN in apps/api>`

## Optional environment variables

- `ACTIVITY_PROJECTOR_DISPATCH_LIMIT` (default handled by API)

## Deploy

```bash
supabase functions deploy activity-projector-dispatch
```

## Configure cron

After migrations are applied to an environment, configure its cron jobs with that
environment's own project URL:

```sql
select public.configure_edge_function_cron('https://<project-ref>.supabase.co');
```
