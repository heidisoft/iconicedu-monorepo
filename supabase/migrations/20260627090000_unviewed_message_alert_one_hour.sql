create or replace function public.message_unviewed_check_threshold_hours()
returns integer
language sql
stable
set search_path = public
as $$
  with raw_setting as (
    select nullif(current_setting('app.message_unviewed_check_threshold_hours', true), '') as value
  )
  select case
    when value ~ '^[0-9]+(\.[0-9]+)?$' and value::numeric > 0 then
      least(168, greatest(1, ceiling(value::numeric)::integer))
    else 1
  end
  from raw_setting;
$$;

comment on function public.message_unviewed_check_threshold_hours() is
  'Returns the classroom unviewed-message staff alert threshold in hours. Configure with ALTER DATABASE ... SET app.message_unviewed_check_threshold_hours = ''1''.';

update public.event_pipeline_jobs j
set
  payload = jsonb_set(coalesce(j.payload, '{}'::jsonb), '{thresholdHours}', '1'::jsonb, true),
  run_at = m.created_at + interval '1 hour',
  updated_at = timezone('utc', now())
from public.messages m
where j.job_kind = 'activity.generate'
  and j.source_kind = 'message_unviewed_check'
  and j.source_id = m.id
  and j.status = 'pending'
  and j.dispatched_at is null
  and j.deleted_at is null
  and m.deleted_at is null;
