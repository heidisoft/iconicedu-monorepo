-- Fix ON CONFLICT support for notification_dispatch_jobs upserts.
-- PostgREST upsert uses:
--   ON CONFLICT (activity_event_id, recipient_profile_id, delivery_channel, attempt_bucket)
-- which requires a matching non-partial unique index.

-- If duplicates exist on the idempotency key, keep the newest row and preserve older rows by
-- soft-deleting and rewriting attempt_bucket so key uniqueness can be enforced.
with ranked as (
  select
    id,
    row_number() over (
      partition by activity_event_id, recipient_profile_id, delivery_channel, attempt_bucket
      order by created_at desc, id desc
    ) as rn
  from public.notification_dispatch_jobs
  where activity_event_id is not null
    and recipient_profile_id is not null
    and delivery_channel is not null
    and attempt_bucket is not null
)
update public.notification_dispatch_jobs ndj
set
  deleted_at = coalesce(ndj.deleted_at, timezone('utc', now())),
  attempt_bucket = ndj.attempt_bucket || ':dedup:' || ndj.id::text,
  updated_at = timezone('utc', now())
from ranked r
where ndj.id = r.id
  and r.rn > 1;

-- Recreate idempotency index as non-partial unique index so ON CONFLICT can use it.
drop index if exists public.notification_dispatch_jobs_idempotency_idx;

create unique index if not exists notification_dispatch_jobs_idempotency_idx
  on public.notification_dispatch_jobs (
    activity_event_id,
    recipient_profile_id,
    delivery_channel,
    attempt_bucket
  );
