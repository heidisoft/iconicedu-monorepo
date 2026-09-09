-- Give schedule reconciliation its own worker so an Events backlog can no longer
-- delay creating pre-class reminder and completion-check jobs. Reconciliation
-- keeps using the existing `reminder.reconcile` event_pipeline_jobs rows and the
-- schedule-table DB triggers; only the claim path and cron change.
--
-- No table shape changes: the queue stays in event_pipeline_jobs.

-- ─── Dedicated claim for reminder.reconcile jobs ────────────────────────────────

create or replace function public.claim_due_schedule_reconciliation_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.event_pipeline_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select j.id
    from public.event_pipeline_jobs j
    where j.deleted_at is null
      and (j.status in ('pending', 'failed') or (j.status = 'leased' and j.lease_until < v_now))
      and j.job_kind = 'reminder.reconcile'
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.priority asc, j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.event_pipeline_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

create or replace function public.claim_due_org_schedule_reconciliation_jobs(
  p_org_id uuid,
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.event_pipeline_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select j.id
    from public.event_pipeline_jobs j
    where j.org_id = p_org_id
      and j.deleted_at is null
      and (j.status in ('pending', 'failed') or (j.status = 'leased' and j.lease_until < v_now))
      and j.job_kind = 'reminder.reconcile'
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.priority asc, j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.event_pipeline_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

-- ─── Exclude reconciliation from the general Events worker ──────────────────────

create or replace function public.claim_due_event_pipeline_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120,
  p_job_kinds text[] default null
)
returns setof public.event_pipeline_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select j.id
    from public.event_pipeline_jobs j
    where j.deleted_at is null
      and (j.status in ('pending', 'failed') or (j.status = 'leased' and j.lease_until < v_now))
      and (p_job_kinds is null or j.job_kind = any(p_job_kinds))
      and j.job_kind <> 'reminder.reconcile'
      and not (j.job_kind = 'notification.deliver' and coalesce(j.payload->>'deliveryChannel', '') = 'push')
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.priority asc, j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.event_pipeline_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

create or replace function public.claim_due_org_event_pipeline_jobs(
  p_org_id uuid,
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120,
  p_job_kinds text[] default null
)
returns setof public.event_pipeline_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select j.id
    from public.event_pipeline_jobs j
    where j.org_id = p_org_id
      and j.deleted_at is null
      and (j.status in ('pending', 'failed') or (j.status = 'leased' and j.lease_until < v_now))
      and (p_job_kinds is null or j.job_kind = any(p_job_kinds))
      and j.job_kind <> 'reminder.reconcile'
      and not (j.job_kind = 'notification.deliver' and coalesce(j.payload->>'deliveryChannel', '') = 'push')
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.priority asc, j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.event_pipeline_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

-- ─── Periodic repair pass: replenish missing jobs and the scheduling window ─────

-- Schedule writes enqueue a deduped reminder.reconcile job through DB triggers,
-- and each run materializes a rolling completion window. A schedule that is not
-- edited for weeks can therefore run out of materialized jobs. This finds a
-- bounded set of eligible schedules whose reminder/completion jobs are missing
-- or whose window has drifted, and re-enqueues their reconcile job onto the
-- dedicated worker. It never claims or dispatches; the worker does that next tick.
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
    pending_reconcile as (
      select distinct j.source_id
      from public.event_pipeline_jobs j
      where j.deleted_at is null
        and j.job_kind = 'reminder.reconcile'
        and j.status in ('pending', 'leased', 'failed')
        and j.source_id is not null
    )
    select e.id, e.org_id
    from eligible e
    left join active_jobs a on a.source_schedule_id = e.id
    where e.id not in (select source_id from pending_reconcile)
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

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists event_pipeline_reconcile_due_idx
  on public.event_pipeline_jobs (priority, run_at, created_at)
  where job_kind = 'reminder.reconcile' and deleted_at is null
    and status in ('pending', 'failed', 'leased');

-- ─── Grants (service-role-only, like the other claim/enqueue RPCs) ─────────────

revoke all on function public.claim_due_schedule_reconciliation_jobs(integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_schedule_reconciliation_jobs(integer, text, integer) to service_role;

revoke all on function public.claim_due_org_schedule_reconciliation_jobs(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_org_schedule_reconciliation_jobs(uuid, integer, text, integer) to service_role;

revoke all on function public.claim_due_event_pipeline_jobs(integer, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_due_event_pipeline_jobs(integer, text, integer, text[]) to service_role;

revoke all on function public.claim_due_org_event_pipeline_jobs(uuid, integer, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_due_org_event_pipeline_jobs(uuid, integer, text, integer, text[]) to service_role;

revoke all on function public.enqueue_stale_schedule_reconciliation(integer) from public, anon, authenticated;
grant execute on function public.enqueue_stale_schedule_reconciliation(integer) to service_role;

-- ─── Cron: add the dedicated schedule-reconciliation worker ────────────────────

create or replace function public.configure_edge_function_cron(p_project_url text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_project_url text;
  v_job record;
begin
  v_project_url := trim(coalesce(p_project_url, ''));

  if v_project_url = '' then
    raise exception 'p_project_url is required';
  end if;

  v_project_url := regexp_replace(v_project_url, '/+$', '');

  perform cron.unschedule(existing.jobid)
  from cron.job existing
  where existing.jobname in (
    'edge-function-reminders-reconcile-dispatch',
    'edge-function-activity-worker-dispatch',
    'edge-function-activity-projector-dispatch',
    'edge-function-notifications-dispatch'
  );

  for v_job in
    select *
    from (
      values
        (
          'edge-function-events-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/events-dispatch'
        ),
        (
          'edge-function-reminders-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/reminders-dispatch'
        ),
        (
          'edge-function-session-completions-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/session-completions-dispatch'
        ),
        (
          'edge-function-push-notifications-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/push-notifications-dispatch'
        ),
        (
          'edge-function-schedule-reconciliation-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/schedule-reconciliation-dispatch'
        ),
        (
          'edge-function-channel-read-state-repair',
          '0 3 * * *',
          v_project_url || '/functions/v1/channel-read-state-repair'
        )
    ) as jobs(job_name, cron_schedule, target_url)
  loop
    perform cron.unschedule(existing.jobid)
    from cron.job existing
    where existing.jobname = v_job.job_name;

    perform cron.schedule(
      v_job.job_name,
      v_job.cron_schedule,
      format(
        $sql$
          select net.http_post(
            url := %L,
            body := '{}'::jsonb
          ) as request_id;
        $sql$,
        v_job.target_url
      )
    );
  end loop;
end;
$function$;

comment on function public.configure_edge_function_cron(text) is
  'Schedules independent event, reminder, completion-check, push-delivery, schedule-reconciliation and maintenance workers.';

-- Re-enqueue reconciliation for existing eligible schedules so the dedicated
-- worker has work immediately after deploy, independent of the Events queue.
do $$
declare v_schedule record;
begin
  for v_schedule in
    select id, org_id from public.class_schedules
    where deleted_at is null and source_kind = 'class_session'
      and status not in ('cancelled', 'completed', 'rescheduled')
  loop
    perform public.enqueue_reminder_reconcile_job(v_schedule.org_id, v_schedule.id);
  end loop;
end;
$$;

-- Upgrade environments where cron is already configured. Fresh setups call
-- configure explicitly after deploying the Edge Functions.
do $$
declare v_project_url text;
begin
  select substring(command from '(https?://[^'']+)/functions/v1/events-dispatch')
    into v_project_url from cron.job where jobname = 'edge-function-events-dispatch' limit 1;
  if v_project_url is not null then
    perform public.configure_edge_function_cron(v_project_url);
  end if;
end;
$$;
