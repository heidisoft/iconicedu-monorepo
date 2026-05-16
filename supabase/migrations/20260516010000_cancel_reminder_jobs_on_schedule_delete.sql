create or replace function public.cancel_reminder_jobs_for_deleted_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reminder_jobs
  set
    status = 'canceled',
    lease_owner = null,
    lease_until = null,
    updated_at = timezone('utc', now())
  where org_id = old.org_id
    and source_schedule_id = old.id
    and status not in ('succeeded', 'canceled', 'dead_letter')
    and deleted_at is null;

  return old;
end;
$$;

drop trigger if exists class_schedules_cancel_reminder_jobs on public.class_schedules;

create trigger class_schedules_cancel_reminder_jobs
  before delete on public.class_schedules
  for each row
  execute function public.cancel_reminder_jobs_for_deleted_schedule();
