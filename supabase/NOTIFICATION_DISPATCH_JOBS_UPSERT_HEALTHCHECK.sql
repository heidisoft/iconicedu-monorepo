-- Runbook: notification_dispatch_jobs ON CONFLICT health checks
-- Purpose:
-- 1) Verify idempotency unique index exists and is valid.
-- 2) Verify no duplicate key tuples remain.

-- Expected: 1 row, indisvalid = true
select
  i.schemaname,
  i.tablename,
  i.indexname,
  i.indexdef,
  x.indisvalid
from pg_indexes i
join pg_class c
  on c.relname = i.indexname
join pg_index x
  on x.indexrelid = c.oid
where i.schemaname = 'public'
  and i.tablename = 'notification_dispatch_jobs'
  and i.indexname = 'notification_dispatch_jobs_idempotency_idx';

-- Expected: 0 rows
select
  activity_event_id,
  recipient_profile_id,
  delivery_channel,
  attempt_bucket,
  count(*) as duplicate_count
from public.notification_dispatch_jobs
where activity_event_id is not null
  and recipient_profile_id is not null
  and delivery_channel is not null
  and attempt_bucket is not null
group by
  activity_event_id,
  recipient_profile_id,
  delivery_channel,
  attempt_bucket
having count(*) > 1;
