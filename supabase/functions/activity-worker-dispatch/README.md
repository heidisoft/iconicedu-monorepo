# activity-worker-dispatch (legacy Supabase Edge Function)

Compatibility bridge for the older `activity_source_jobs` worker. The normal
activity and notification pipeline now runs through `events-dispatch` and
`POST /internal/events/dispatch`, which claims `event_pipeline_jobs`.

This legacy function calls:

- `POST /internal/activity-worker/dispatch`

Required environment variables:

- `ACTIVITY_WORKER_DISPATCH_URL`
- `INTERNAL_ACTIVITY_WORKER_TOKEN`

Optional environment variables:

- `ACTIVITY_WORKER_DISPATCH_LIMIT`
- `ACTIVITY_WORKER_DISPATCH_LEASE_SECONDS`
- `ACTIVITY_WORKER_DISPATCH_LEASE_OWNER`

Do not add new product flows that depend on this function. New source-of-truth
changes should enqueue `event_outbox` signals and `event_pipeline_jobs`
`activity.generate` work.
