-- Keep one active override per recurring schedule occurrence.
-- If historical duplicates exist, preserve the most recently updated row and
-- remove older active duplicates before adding the uniqueness guard.

with ranked_overrides as (
  select
    id,
    row_number() over (
      partition by org_id, recurrence_id, occurrence_key
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_rank
  from public.class_schedule_recurrence_overrides
  where deleted_at is null
)
delete from public.class_schedule_recurrence_overrides overrides
using ranked_overrides ranked
where overrides.id = ranked.id
  and ranked.row_rank > 1;

create unique index if not exists class_schedule_recurrence_overrides_active_occurrence_idx
  on public.class_schedule_recurrence_overrides (
    org_id,
    recurrence_id,
    occurrence_key
  )
  where deleted_at is null;
