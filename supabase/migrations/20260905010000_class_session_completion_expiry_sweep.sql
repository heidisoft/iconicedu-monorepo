-- Replaces the completion-related duties of run_stale_activity_cleanup()
-- (supabase/migrations/20260630090000_auto_close_stale_activity.sql) now that
-- class_session_completions is the single source of truth: auto-confirms
-- pending rows past their explicit expires_at, then flips the parent
-- class_schedules.status to 'completed' once every participant row for an
-- occurrence is resolved.
--
-- Two corrections versus the old function, both confirmed by reading it directly:
--   1. The old function only ever auto-confirmed/completed NON-recurring schedules
--      (it explicitly excluded any schedule with a class_schedule_recurrence row) —
--      recurring occurrences were never auto-confirmed at all. This function's
--      auto-confirm step covers both recurring and non-recurring rows, since
--      class_session_completions doesn't need to reason about recurrence at all
--      (the dispatcher already resolved the correct occurrence_key/session_end_at
--      when the row was created).
--   2. The "flip class_schedules.status to completed" step, unlike auto-confirm,
--      correctly KEEPS the non-recurring-only restriction: completing one occurrence
--      of a recurring series must never mark the whole series 'completed', since
--      there are future occurrences still to happen.
--
-- Runs in bounded batches (SKIP LOCKED) per row count, not one unbounded statement,
-- so lock duration stays flat as row count grows with tenant count at scale.

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
  v_confirmed integer := 0;
  v_batch_confirmed integer;
  v_sessions integer := 0;
begin
  if p_batch_size <= 0 then
    raise exception 'p_batch_size must be positive';
  end if;

  loop
    with batch as (
      select id
        from public.class_session_completions
       where deleted_at is null
         and status = 'pending'
         and expires_at < p_now
       order by expires_at
       limit p_batch_size
       for update skip locked
    ),
    updated as (
      update public.class_session_completions csc
         set status = 'auto_confirmed',
             confirmed_at = p_now,
             resolved_at = p_now,
             updated_at = p_now
        from batch
       where csc.id = batch.id
      returning 1
    )
    select count(*)::integer into v_batch_confirmed from updated;

    v_confirmed := v_confirmed + v_batch_confirmed;
    exit when v_batch_confirmed < p_batch_size;
  end loop;

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

  return query select v_confirmed, v_sessions;
end;
$$;
