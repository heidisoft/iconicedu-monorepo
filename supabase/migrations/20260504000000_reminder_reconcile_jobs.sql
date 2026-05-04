create table if not exists public.reminder_reconcile_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  schedule_id uuid not null,
  dedupe_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'failed', 'dead_letter', 'canceled')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  run_at timestamptz not null default timezone('utc', now()),
  lease_owner text null,
  lease_until timestamptz null,
  next_attempt_at timestamptz null,
  last_error text null,
  dispatched_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null,
  unique (org_id, dedupe_key)
);

create index if not exists reminder_reconcile_jobs_due_idx
  on public.reminder_reconcile_jobs (status, run_at, next_attempt_at)
  where deleted_at is null;

create index if not exists reminder_reconcile_jobs_org_status_idx
  on public.reminder_reconcile_jobs (org_id, status, created_at desc)
  where deleted_at is null;

create index if not exists reminder_reconcile_jobs_schedule_idx
  on public.reminder_reconcile_jobs (org_id, schedule_id)
  where deleted_at is null;

alter table public.reminder_reconcile_jobs enable row level security;

create policy "reminder reconcile jobs read by org admin"
  on public.reminder_reconcile_jobs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder reconcile jobs manage by org admin"
  on public.reminder_reconcile_jobs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create or replace function public.claim_due_reminder_reconcile_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.reminder_reconcile_jobs
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
    from public.reminder_reconcile_jobs j
    where j.deleted_at is null
      and j.status in ('pending', 'failed')
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.reminder_reconcile_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

create or replace function public.enqueue_reminder_reconcile_job(
  p_org_id uuid,
  p_schedule_id uuid,
  p_created_by uuid default null,
  p_updated_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if p_org_id is null or p_schedule_id is null then
    return;
  end if;

  insert into public.reminder_reconcile_jobs (
    org_id,
    schedule_id,
    dedupe_key,
    status,
    attempt_count,
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
    p_schedule_id,
    'schedule:' || p_schedule_id::text,
    'pending',
    0,
    v_now,
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
  on conflict (org_id, dedupe_key) do update
  set schedule_id = excluded.schedule_id,
      status = 'pending',
      attempt_count = 0,
      run_at = v_now,
      lease_owner = null,
      lease_until = null,
      next_attempt_at = null,
      last_error = null,
      dispatched_at = null,
      updated_at = v_now,
      updated_by = excluded.updated_by,
      deleted_at = null,
      deleted_by = null;
end;
$$;

create or replace function public.enqueue_class_schedule_reminder_reconcile_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_reminder_reconcile_job(
      old.org_id,
      old.id,
      old.created_by,
      old.updated_by
    );
    return old;
  end if;

  perform public.enqueue_reminder_reconcile_job(
    new.org_id,
    new.id,
    new.created_by,
    new.updated_by
  );
  return new;
end;
$$;

create or replace function public.enqueue_schedule_child_reminder_reconcile_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_reminder_reconcile_job(
      old.org_id,
      old.schedule_id,
      old.created_by,
      old.updated_by
    );
    return old;
  end if;

  perform public.enqueue_reminder_reconcile_job(
    new.org_id,
    new.schedule_id,
    new.created_by,
    new.updated_by
  );
  return new;
end;
$$;

create or replace function public.enqueue_recurrence_detail_reminder_reconcile_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_recurrence_id uuid;
  v_schedule_id uuid;
  v_created_by uuid;
  v_updated_by uuid;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.org_id;
    v_recurrence_id := old.recurrence_id;
    v_created_by := old.created_by;
    v_updated_by := old.updated_by;
  else
    v_org_id := new.org_id;
    v_recurrence_id := new.recurrence_id;
    v_created_by := new.created_by;
    v_updated_by := new.updated_by;
  end if;

  select cr.schedule_id
    into v_schedule_id
  from public.class_schedule_recurrence cr
  where cr.id = v_recurrence_id
    and cr.org_id = v_org_id;

  perform public.enqueue_reminder_reconcile_job(
    v_org_id,
    v_schedule_id,
    v_created_by,
    v_updated_by
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists class_schedules_reminder_reconcile_enqueue on public.class_schedules;
create trigger class_schedules_reminder_reconcile_enqueue
  after insert or update or delete on public.class_schedules
  for each row
  execute function public.enqueue_class_schedule_reminder_reconcile_job();

drop trigger if exists class_schedule_participants_reminder_reconcile_enqueue on public.class_schedule_participants;
create trigger class_schedule_participants_reminder_reconcile_enqueue
  after insert or update or delete on public.class_schedule_participants
  for each row
  execute function public.enqueue_schedule_child_reminder_reconcile_job();

drop trigger if exists class_schedule_recurrence_reminder_reconcile_enqueue on public.class_schedule_recurrence;
create trigger class_schedule_recurrence_reminder_reconcile_enqueue
  after insert or update or delete on public.class_schedule_recurrence
  for each row
  execute function public.enqueue_schedule_child_reminder_reconcile_job();

drop trigger if exists class_schedule_recurrence_exceptions_reminder_reconcile_enqueue on public.class_schedule_recurrence_exceptions;
create trigger class_schedule_recurrence_exceptions_reminder_reconcile_enqueue
  after insert or update or delete on public.class_schedule_recurrence_exceptions
  for each row
  execute function public.enqueue_recurrence_detail_reminder_reconcile_job();

drop trigger if exists class_schedule_recurrence_overrides_reminder_reconcile_enqueue on public.class_schedule_recurrence_overrides;
create trigger class_schedule_recurrence_overrides_reminder_reconcile_enqueue
  after insert or update or delete on public.class_schedule_recurrence_overrides
  for each row
  execute function public.enqueue_recurrence_detail_reminder_reconcile_job();

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

  for v_job in
    select *
    from (
      values
        (
          'edge-function-reminders-reconcile-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/reminders-reconcile-dispatch'
        ),
        (
          'edge-function-reminders-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/reminders-dispatch'
        ),
        (
          'edge-function-notifications-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/notifications-dispatch'
        ),
        (
          'edge-function-activity-worker-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/activity-worker-dispatch'
        ),
        (
          'edge-function-activity-projector-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/activity-projector-dispatch'
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
  'Schedules Supabase edge functions for reminder reconciliation, reminder dispatch, activity source jobs, activity projection retries, notifications, and maintenance jobs.';
