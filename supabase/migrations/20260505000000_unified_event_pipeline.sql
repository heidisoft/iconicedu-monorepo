create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  event_kind text not null,
  source_table text null,
  source_id uuid null,
  source_kind text null,
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed', 'dead_letter', 'canceled')),
  processed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null,
  unique (org_id, dedupe_key)
);

create index if not exists event_outbox_org_status_idx
  on public.event_outbox (org_id, status, created_at desc)
  where deleted_at is null;

create index if not exists event_outbox_source_idx
  on public.event_outbox (org_id, source_table, source_id)
  where deleted_at is null;

create table if not exists public.event_pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  outbox_id uuid null references public.event_outbox(id) on delete set null,
  job_kind text not null
    check (job_kind in (
      'activity.generate',
      'activity.project',
      'notification.prepare',
      'notification.deliver',
      'reminder.reconcile',
      'reminder.dispatch'
    )),
  source_kind text null,
  source_id uuid null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'suppressed', 'failed', 'dead_letter', 'canceled')),
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
  deleted_by uuid null
);

create unique index if not exists event_pipeline_jobs_active_dedupe_idx
  on public.event_pipeline_jobs (org_id, job_kind, dedupe_key)
  where deleted_at is null and status in ('pending', 'leased', 'failed');

create index if not exists event_pipeline_jobs_due_idx
  on public.event_pipeline_jobs (status, run_at, next_attempt_at, priority, created_at)
  where deleted_at is null;

create index if not exists event_pipeline_jobs_org_kind_status_idx
  on public.event_pipeline_jobs (org_id, job_kind, status, created_at desc)
  where deleted_at is null;

create table if not exists public.event_pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid null references public.event_pipeline_jobs(id) on delete set null,
  outbox_id uuid null references public.event_outbox(id) on delete set null,
  job_kind text null,
  result text not null
    check (result in ('succeeded', 'suppressed', 'retryable_failure', 'fatal_failure', 'canceled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists event_pipeline_logs_job_idx
  on public.event_pipeline_logs (job_id, created_at desc)
  where deleted_at is null;

alter table public.event_outbox enable row level security;
alter table public.event_pipeline_jobs enable row level security;
alter table public.event_pipeline_logs enable row level security;

create policy "event outbox read by org admin"
  on public.event_outbox
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "event outbox manage by org admin"
  on public.event_outbox
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "event pipeline jobs read by org admin"
  on public.event_pipeline_jobs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "event pipeline jobs manage by org admin"
  on public.event_pipeline_jobs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "event pipeline logs read by org admin"
  on public.event_pipeline_logs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "event pipeline logs manage by org admin"
  on public.event_pipeline_logs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

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

create or replace function public.enqueue_event_outbox(
  p_org_id uuid,
  p_event_kind text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_source_table text default null,
  p_source_id uuid default null,
  p_source_kind text default null,
  p_actor_profile_id uuid default null,
  p_run_at timestamptz default null,
  p_created_by uuid default null,
  p_updated_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_org_id is null or p_event_kind is null or p_dedupe_key is null then
    return null;
  end if;

  insert into public.event_outbox (
    org_id,
    event_kind,
    source_table,
    source_id,
    source_kind,
    actor_profile_id,
    payload,
    dedupe_key,
    status,
    processed_at,
    last_error,
    created_by,
    updated_by,
    updated_at,
    deleted_at,
    deleted_by
  )
  values (
    p_org_id,
    p_event_kind,
    p_source_table,
    p_source_id,
    p_source_kind,
    p_actor_profile_id,
    coalesce(p_payload, '{}'::jsonb),
    p_dedupe_key,
    'pending',
    null,
    null,
    p_created_by,
    coalesce(p_updated_by, p_created_by),
    v_now,
    null,
    null
  )
  on conflict (org_id, dedupe_key) do update
  set event_kind = excluded.event_kind,
      source_table = excluded.source_table,
      source_id = excluded.source_id,
      source_kind = excluded.source_kind,
      actor_profile_id = excluded.actor_profile_id,
      payload = excluded.payload,
      status = 'pending',
      processed_at = null,
      last_error = null,
      updated_at = v_now,
      updated_by = excluded.updated_by,
      deleted_at = null,
      deleted_by = null
  returning id into v_outbox_id;

  perform public.enqueue_event_pipeline_job(
    p_org_id,
    'activity.generate',
    p_dedupe_key,
    jsonb_build_object(
      'eventKind', p_event_kind,
      'sourceTable', p_source_table,
      'sourceId', p_source_id,
      'sourceKind', p_source_kind,
      'actorProfileId', p_actor_profile_id,
      'payload', coalesce(p_payload, '{}'::jsonb)
    ),
    v_outbox_id,
    p_source_kind,
    p_source_id,
    p_run_at,
    50,
    p_created_by,
    p_updated_by
  );

  return v_outbox_id;
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
      and j.status in ('pending', 'failed')
      and (p_job_kinds is null or j.job_kind = any(p_job_kinds))
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

create or replace function public.enqueue_message_activity_source_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if new.type not in (
    'event-reminder',
    'payment-reminder',
    'feedback-request',
    'session-booking',
    'session-complete',
    'session-summary',
    'progress-update'
  ) then
    insert into public.activity_source_jobs (
      org_id,
      job_kind,
      message_id,
      dedupe_key,
      created_by,
      updated_by
    )
    values (
      new.org_id,
      'message',
      new.id,
      'message:' || new.id::text,
      new.created_by,
      new.updated_by
    )
    on conflict (org_id, dedupe_key) do nothing;

    perform public.enqueue_event_outbox(
      new.org_id,
      'message',
      'message:' || new.id::text,
      jsonb_build_object('messageId', new.id),
      'messages',
      new.id,
      'message',
      new.sender_profile_id,
      timezone('utc', now()),
      new.created_by,
      new.updated_by
    );
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_reaction_activity_source_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.activity_source_jobs (
    org_id,
    job_kind,
    reaction_id,
    dedupe_key,
    created_by,
    updated_by
  )
  values (
    new.org_id,
    'reaction',
    new.id,
    'reaction:' || new.id::text,
    new.created_by,
    new.updated_by
  )
  on conflict (org_id, dedupe_key) do nothing;

  perform public.enqueue_event_outbox(
    new.org_id,
    'reaction',
    'reaction:' || new.id::text,
    jsonb_build_object('reactionId', new.id),
    'message_reactions',
    new.id,
    'reaction',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.enqueue_session_cancel_activity_source_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.activity_source_jobs (
    org_id,
    job_kind,
    exception_id,
    dedupe_key,
    created_by,
    updated_by
  )
  values (
    new.org_id,
    'session_cancel',
    new.id,
    'session_cancel:' || new.id::text,
    new.created_by,
    new.updated_by
  )
  on conflict (org_id, dedupe_key) do nothing;

  perform public.enqueue_event_outbox(
    new.org_id,
    'session_cancel',
    'session_cancel:' || new.id::text,
    jsonb_build_object('exceptionId', new.id),
    'class_schedule_recurrence_exceptions',
    new.id,
    'session_cancel',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.enqueue_session_reschedule_activity_source_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.activity_source_jobs (
    org_id,
    job_kind,
    override_id,
    dedupe_key,
    created_by,
    updated_by
  )
  values (
    new.org_id,
    'session_reschedule',
    new.id,
    'session_reschedule:' || new.id::text,
    new.created_by,
    new.updated_by
  )
  on conflict (org_id, dedupe_key) do nothing;

  perform public.enqueue_event_outbox(
    new.org_id,
    'session_reschedule',
    'session_reschedule:' || new.id::text,
    jsonb_build_object('overrideId', new.id),
    'class_schedule_recurrence_overrides',
    new.id,
    'session_reschedule',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
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

  perform public.enqueue_event_pipeline_job(
    p_org_id,
    'reminder.reconcile',
    'schedule:' || p_schedule_id::text,
    jsonb_build_object('scheduleId', p_schedule_id),
    null,
    'schedule',
    p_schedule_id,
    v_now,
    40,
    p_created_by,
    p_updated_by
  );
end;
$$;

insert into public.event_outbox (
  org_id,
  event_kind,
  source_table,
  source_id,
  source_kind,
  payload,
  dedupe_key,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  j.job_kind,
  case
    when j.job_kind = 'message' then 'messages'
    when j.job_kind = 'reaction' then 'message_reactions'
    when j.job_kind = 'session_cancel' then 'class_schedule_recurrence_exceptions'
    when j.job_kind = 'session_reschedule' then 'class_schedule_recurrence_overrides'
    else null
  end,
  coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
  j.job_kind,
  jsonb_strip_nulls(jsonb_build_object(
    'messageId', j.message_id,
    'reactionId', j.reaction_id,
    'exceptionId', j.exception_id,
    'overrideId', j.override_id
  )),
  j.dedupe_key,
  'pending',
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.activity_source_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, dedupe_key) do nothing;

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
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  o.id,
  'activity.generate',
  j.job_kind,
  coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
  j.dedupe_key,
  jsonb_build_object(
    'eventKind', j.job_kind,
    'sourceTable',
      case
        when j.job_kind = 'message' then 'messages'
        when j.job_kind = 'reaction' then 'message_reactions'
        when j.job_kind = 'session_cancel' then 'class_schedule_recurrence_exceptions'
        when j.job_kind = 'session_reschedule' then 'class_schedule_recurrence_overrides'
        else null
      end,
    'sourceId', coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
    'sourceKind', j.job_kind,
    'payload', jsonb_strip_nulls(jsonb_build_object(
      'messageId', j.message_id,
      'reactionId', j.reaction_id,
      'exceptionId', j.exception_id,
      'overrideId', j.override_id
    ))
  ),
  50,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.activity_source_jobs j
join public.event_outbox o
  on o.org_id = j.org_id
 and o.dedupe_key = j.dedupe_key
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

insert into public.event_pipeline_jobs (
  org_id,
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
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  e.org_id,
  'activity.project',
  'activity_event',
  e.id,
  'activity.project:' || e.id::text,
  jsonb_build_object('eventId', e.id),
  60,
  case when e.projection_status = 'failed' then 'failed' else 'pending' end,
  e.projection_attempts,
  8,
  timezone('utc', now()),
  null,
  e.last_projection_error,
  e.created_by,
  e.updated_by,
  e.created_at,
  timezone('utc', now())
from public.activity_events e
where e.deleted_at is null
  and e.projection_status in ('pending', 'failed')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

insert into public.event_pipeline_jobs (
  org_id,
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
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  'notification.deliver',
  'activity_event',
  j.activity_event_id,
  'notification.deliver:' || j.activity_event_id::text || ':' || j.recipient_profile_id::text || ':' || j.delivery_channel || ':' || j.attempt_bucket,
  jsonb_build_object(
    'activityEventId', j.activity_event_id,
    'recipientProfileId', j.recipient_profile_id,
    'prefKey', j.pref_key,
    'scopeKind', j.scope_kind,
    'scopeId', j.scope_id,
    'deliveryChannel', j.delivery_channel,
    'deliveryTiming', j.delivery_timing,
    'attemptBucket', j.attempt_bucket,
    'title', j.payload->>'title',
    'summary', j.payload->>'summary',
    'threadId', j.payload->>'threadId',
    'rawEventPayload', coalesce(j.payload->'rawEventPayload', '{}'::jsonb)
  ),
  case when j.delivery_timing = 'immediate' then 80 else 100 end,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.notification_dispatch_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

insert into public.event_pipeline_jobs (
  org_id,
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
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  'reminder.reconcile',
  'schedule',
  j.schedule_id,
  j.dedupe_key,
  jsonb_build_object('scheduleId', j.schedule_id),
  40,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.reminder_reconcile_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

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
          'edge-function-events-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/events-dispatch'
        ),
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
  'Schedules Supabase edge functions for the unified event pipeline, legacy compatibility dispatchers, and maintenance jobs.';
