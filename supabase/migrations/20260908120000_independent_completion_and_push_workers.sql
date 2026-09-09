-- Isolate completion and push dispatch while preserving existing jobs and logs.
-- No table shape changes: these queues are accessed through Supabase RPCs.

create or replace function public.claim_due_reminder_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.reminder_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select r.id
    from public.reminder_jobs r
    where r.deleted_at is null
      and (r.status in ('pending', 'failed') or (r.status = 'leased' and r.lease_until < v_now))
      and r.job_type = 'session.reminder'
      and r.run_at <= v_now
      and coalesce(r.next_attempt_at, r.run_at) <= v_now
      and (r.lease_until is null or r.lease_until < v_now)
    order by r.run_at asc, r.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.reminder_jobs r
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

create or replace function public.claim_due_completion_check_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.reminder_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select r.id
    from public.reminder_jobs r
    where r.deleted_at is null
      and (r.status in ('pending', 'failed') or (r.status = 'leased' and r.lease_until < v_now))
      and r.job_type = 'session.completion_check'
      and r.run_at <= v_now
      and coalesce(r.next_attempt_at, r.run_at) <= v_now
      and (r.lease_until is null or r.lease_until < v_now)
    order by r.run_at asc, r.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.reminder_jobs r
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

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

create or replace function public.claim_due_push_notification_jobs(
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
      and j.job_kind = 'notification.deliver'
      and j.payload->>'deliveryChannel' = 'push'
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

create or replace function public.enqueue_event_pipeline_job(
  p_org_id uuid,
  p_job_kind text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_outbox_id uuid default null,
  p_source_kind text default null,
  p_source_id uuid default null,
  p_run_at timestamptz default null,
  p_priority integer default 100,
  p_created_by uuid default null,
  p_updated_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_org_id is null or p_job_kind is null or p_dedupe_key is null then
    return null;
  end if;

  -- Retry preparation reuses deliveries, including legacy keys with minute buckets.
  if p_job_kind = 'notification.deliver' then
    if nullif(p_payload->>'activityEventId', '') is null
       or nullif(p_payload->>'recipientProfileId', '') is null
       or coalesce(p_payload->>'deliveryChannel', '') not in ('push', 'email', 'sms') then
      raise exception 'Invalid notification delivery identity';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(
      p_org_id::text || ':' || (p_payload->>'activityEventId') || ':' ||
      (p_payload->>'recipientProfileId') || ':' || (p_payload->>'deliveryChannel'), 0));
    select id into v_job_id from public.event_pipeline_jobs
    where org_id = p_org_id and job_kind = p_job_kind and deleted_at is null
      and status <> 'canceled'
      and payload->>'activityEventId' = p_payload->>'activityEventId'
      and payload->>'recipientProfileId' = p_payload->>'recipientProfileId'
      and payload->>'deliveryChannel' = p_payload->>'deliveryChannel'
    order by (status = 'succeeded') desc, created_at asc
    limit 1;
    if v_job_id is not null then return v_job_id; end if;
  end if;

  insert into public.event_pipeline_jobs (
    org_id,
    outbox_id,
    job_kind,
    source_kind,
    source_id,
    dedupe_key,
    payload,
    priority,
    status,
    attempt_count,
    max_attempts,
    run_at,
    lease_owner,
    lease_until,
    next_attempt_at,
    last_error,
    dispatched_at,
    created_by,
    updated_by,
    updated_at,
    deleted_at,
    deleted_by
  )
  values (
    p_org_id,
    p_outbox_id,
    p_job_kind,
    p_source_kind,
    p_source_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_priority, 100),
    'pending',
    0,
    8,
    coalesce(p_run_at, v_now),
    null,
    null,
    null,
    null,
    null,
    p_created_by,
    coalesce(p_updated_by, p_created_by),
    v_now,
    null,
    null
  )
  on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
  do update
  set outbox_id = coalesce(excluded.outbox_id, public.event_pipeline_jobs.outbox_id),
      source_kind = excluded.source_kind,
      source_id = excluded.source_id,
      payload = excluded.payload,
      priority = excluded.priority,
      status = 'pending',
      attempt_count = 0,
      run_at = excluded.run_at,
      lease_owner = null,
      lease_until = null,
      next_attempt_at = null,
      last_error = null,
      dispatched_at = null,
      updated_at = v_now,
      updated_by = excluded.updated_by,
      deleted_at = null,
      deleted_by = null
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create index if not exists event_pipeline_delivery_identity_idx
  on public.event_pipeline_jobs (org_id, (payload->>'activityEventId'),
    (payload->>'recipientProfileId'), (payload->>'deliveryChannel'))
  where job_kind = 'notification.deliver' and deleted_at is null;

create index if not exists reminder_jobs_completion_due_idx
  on public.reminder_jobs (run_at, created_at)
  where job_type = 'session.completion_check' and deleted_at is null
    and status in ('pending', 'failed', 'leased');

create index if not exists event_pipeline_push_due_idx
  on public.event_pipeline_jobs (priority, run_at, created_at)
  where job_kind = 'notification.deliver' and payload->>'deliveryChannel' = 'push'
    and deleted_at is null and status in ('pending', 'failed', 'leased');

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
  'Schedules independent event, reminder, completion-check, push-delivery and maintenance workers.';


revoke all on function public.claim_due_reminder_jobs(integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminder_jobs(integer, text, integer) to service_role;

revoke all on function public.claim_due_completion_check_jobs(integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_completion_check_jobs(integer, text, integer) to service_role;

revoke all on function public.claim_due_event_pipeline_jobs(integer, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_due_event_pipeline_jobs(integer, text, integer, text[]) to service_role;

revoke all on function public.claim_due_push_notification_jobs(integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_push_notification_jobs(integer, text, integer) to service_role;

-- Reconcile existing eligible schedules to enqueue their independent checks.
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

-- Upgrade environments with cron already configured. Fresh setups call configure
-- explicitly after deploying the Edge Functions.
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
