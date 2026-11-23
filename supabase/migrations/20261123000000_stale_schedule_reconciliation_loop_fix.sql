-- Stop the stale-schedule repair pass from re-enqueueing the same schedules
-- forever.
--
-- Same as the 20261113000000_learning_space_archive_cascade.sql version plus
-- two guards:
--
-- 1. Finished schedules are not eligible. A one-off session that ended more
--    than 3 days ago, or a series whose recurrence `until` passed more than 3
--    days ago, can never gain new reminder or completion jobs: the reconciler
--    only expands occurrences from now() - 3 days. "No active jobs" is its
--    normal end state, not staleness. Inside that 3-day look-back the repair
--    pass still runs, so a lost completion check (feedback prompt) for a
--    session that just ended is still recovered, exactly as before. Before this guard every
--    such schedule left in status 'scheduled' was re-enqueued on every pass,
--    which produced ~1.8M succeeded reminder.reconcile jobs (and as many
--    event_pipeline_logs rows) in production.
-- 2. A schedule reconciled in the last 6 hours is not re-enqueued by the
--    repair pass. This bounds the cost of any other shape that a reconcile run
--    cannot satisfy to 4 runs a day. Schedule edits are unaffected: the DB
--    triggers call enqueue_reminder_reconcile_job() directly, not this pass.

-- Supports guard 2's "created in the last 6 hours" probe. The active-status
-- half is already covered by event_pipeline_reconcile_due_idx.
create index if not exists event_pipeline_jobs_reconcile_created_idx
  on public.event_pipeline_jobs (created_at, source_id)
  where job_kind = 'reminder.reconcile' and deleted_at is null;

create or replace function public.enqueue_stale_schedule_reconciliation(
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_count integer := 0;
  v_schedule record;
begin
  for v_schedule in
    with eligible as (
      select cs.id, cs.org_id
      from public.class_schedules cs
      where cs.deleted_at is null
        and cs.source_kind = 'class_session'
        and cs.status not in ('cancelled', 'completed', 'rescheduled')
        and not exists (
          select 1
          from public.learning_spaces ls
          where ls.id = cs.source_learning_space_id
            and public.is_learning_space_archived(ls.status, ls.archived_at, ls.deleted_at)
        )
        -- Guard 1: skip schedules with no possible future occurrence.
        and not (
          (
            cs.end_at < v_now - interval '3 days'
            and not exists (
              select 1
              from public.class_schedule_recurrence r
              where r.schedule_id = cs.id
                and r.deleted_at is null
            )
          )
          or exists (
            select 1
            from public.class_schedule_recurrence r
            where r.schedule_id = cs.id
              and r.deleted_at is null
              and r.until is not null
              and r.until < v_now - interval '3 days'
          )
        )
    ),
    active_jobs as (
      select rj.source_schedule_id,
             count(*) as active_count,
             max(rj.run_at) filter (
               where rj.job_type = 'session.completion_check'
             ) as latest_completion_run_at
      from public.reminder_jobs rj
      where rj.deleted_at is null
        and rj.status in ('pending', 'leased', 'failed')
        and rj.source_schedule_id is not null
      group by rj.source_schedule_id
    ),
    -- Guard 2 (and the original idempotency check): any reconcile job that is
    -- still active, or was created in the last 6 hours, blocks a repair.
    recent_reconcile as (
      select distinct j.source_id
      from public.event_pipeline_jobs j
      where j.deleted_at is null
        and j.job_kind = 'reminder.reconcile'
        and j.source_id is not null
        and (
          j.status in ('pending', 'leased', 'failed')
          or j.created_at > v_now - interval '6 hours'
        )
    )
    select e.id, e.org_id
    from eligible e
    left join active_jobs a on a.source_schedule_id = e.id
    where e.id not in (select source_id from recent_reconcile)
      and (
        coalesce(a.active_count, 0) = 0
        or (
          a.latest_completion_run_at is not null
          and a.latest_completion_run_at < v_now + interval '23 days'
        )
      )
    order by coalesce(a.active_count, 0) asc,
             coalesce(a.latest_completion_run_at, v_now) asc,
             e.id asc
    limit v_limit
  loop
    perform public.enqueue_reminder_reconcile_job(v_schedule.org_id, v_schedule.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_stale_schedule_reconciliation(integer) from public, anon, authenticated;
grant execute on function public.enqueue_stale_schedule_reconciliation(integer) to service_role;
