-- Allow reminder reconciliation to keep both the 30-minute and 5-minute
-- reminder jobs active for the same schedule occurrence.

drop index if exists public.reminder_jobs_active_per_schedule_idx;

create index if not exists reminder_jobs_active_schedule_due_idx
  on public.reminder_jobs (org_id, source_schedule_id, run_at)
  where deleted_at is null
    and status not in ('succeeded', 'canceled', 'dead_letter')
    and source_schedule_id is not null;
