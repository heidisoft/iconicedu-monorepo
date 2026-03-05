-- Fix PostgREST upsert on reminder_jobs:
-- ON CONFLICT (org_id, dedupe_key) requires a non-partial unique index/constraint.

-- If duplicate dedupe keys exist (unlikely), keep one and rewrite older duplicates.
with ranked as (
  select
    id,
    org_id,
    dedupe_key,
    row_number() over (
      partition by org_id, dedupe_key
      order by updated_at desc, created_at desc, id desc
    ) as rn
  from public.reminder_jobs
)
update public.reminder_jobs r
set dedupe_key = r.dedupe_key || ':dupe:' || r.id::text,
    updated_at = timezone('utc', now())
from ranked x
where r.id = x.id
  and x.rn > 1;

drop index if exists reminder_jobs_org_dedupe_idx;

create unique index if not exists reminder_jobs_org_dedupe_idx
  on public.reminder_jobs (org_id, dedupe_key);
