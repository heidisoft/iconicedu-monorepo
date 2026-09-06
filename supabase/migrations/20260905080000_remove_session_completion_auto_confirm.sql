-- Removes the "auto-confirm a still-pending completion check 3 days after the
-- session ended" behavior. A session now only resolves (confirmed/disputed)
-- through an explicit participant action — a pending row with no response
-- simply stays pending indefinitely instead of silently flipping to
-- 'auto_confirmed'.
--
-- The "flip class_schedules.status to 'completed' once every participant row
-- for a one-off occurrence is resolved" half of the sweep is untouched: it
-- already only fires once there are zero remaining 'pending' rows, so a
-- schedule whose participants never all explicitly respond simply never gets
-- marked completed by this path — which is the correct behavior once
-- auto-confirm is gone.
--
-- Same signature as the function being replaced (same params, same
-- `returns table` shape) — a plain CREATE OR REPLACE preserves the existing
-- REVOKE/GRANT lockdown (only DROP + CREATE resets grants), so no
-- REVOKE/GRANT re-application is needed here. `completions_auto_confirmed`
-- stays in the return shape (always 0 now) so the reminders-service caller
-- and its telemetry field don't need a matching signature change.
create or replace function public.run_class_session_completion_expiry_sweep(
  p_now timestamptz default now(),
  p_batch_size integer default 5000
)
returns table (
  completions_auto_confirmed integer,
  sessions_marked_completed integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions integer := 0;
begin
  if p_batch_size <= 0 then
    raise exception 'p_batch_size must be positive';
  end if;

  with resolved_occurrences as (
    select cs.id as schedule_id, cs.org_id
      from public.class_schedules cs
     where cs.deleted_at is null
       and cs.source_kind = 'class_session'
       and cs.status = 'scheduled'
       and cs.end_at < p_now
       and not exists (
         select 1
           from public.class_schedule_recurrence csr
          where csr.org_id = cs.org_id
            and csr.schedule_id = cs.id
            and csr.deleted_at is null
       )
       and exists (
         select 1
           from public.class_session_completions csc
          where csc.org_id = cs.org_id
            and csc.schedule_id = cs.id
            and csc.deleted_at is null
       )
       and not exists (
         select 1
           from public.class_session_completions csc
          where csc.org_id = cs.org_id
            and csc.schedule_id = cs.id
            and csc.deleted_at is null
            and csc.status = 'pending'
       )
  ),
  completed as (
    update public.class_schedules cs
       set status = 'completed',
           updated_at = p_now
      from resolved_occurrences ro
     where cs.id = ro.schedule_id
       and cs.org_id = ro.org_id
    returning 1
  )
  select count(*)::integer into v_sessions from completed;

  return query select 0, v_sessions;
end;
$$;

notify pgrst, 'reload schema';
