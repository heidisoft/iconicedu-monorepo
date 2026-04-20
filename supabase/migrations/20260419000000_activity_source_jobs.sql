create table if not exists public.activity_source_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_kind text not null
    check (job_kind in ('message', 'reaction', 'session_cancel', 'session_reschedule')),
  message_id uuid null references public.messages(id) on delete cascade,
  reaction_id uuid null references public.message_reactions(id) on delete cascade,
  exception_id uuid null references public.class_schedule_recurrence_exceptions(id) on delete cascade,
  override_id uuid null references public.class_schedule_recurrence_overrides(id) on delete cascade,
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
  unique (org_id, dedupe_key),
  constraint activity_source_jobs_job_kind_source_check check (
    (job_kind = 'message' and message_id is not null and reaction_id is null and exception_id is null and override_id is null)
    or (job_kind = 'reaction' and reaction_id is not null and message_id is null and exception_id is null and override_id is null)
    or (job_kind = 'session_cancel' and exception_id is not null and message_id is null and reaction_id is null and override_id is null)
    or (job_kind = 'session_reschedule' and override_id is not null and message_id is null and reaction_id is null and exception_id is null)
  )
);

create index if not exists activity_source_jobs_due_idx
  on public.activity_source_jobs (status, run_at, next_attempt_at)
  where deleted_at is null;

create index if not exists activity_source_jobs_org_status_idx
  on public.activity_source_jobs (org_id, status, created_at desc)
  where deleted_at is null;

alter table public.activity_source_jobs enable row level security;

create policy "activity source jobs read by org admin"
  on public.activity_source_jobs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "activity source jobs manage by org admin"
  on public.activity_source_jobs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create or replace function public.claim_due_activity_source_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.activity_source_jobs
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
    from public.activity_source_jobs j
    where j.deleted_at is null
      and j.status in ('pending', 'failed')
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.activity_source_jobs j
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
  end if;

  return new;
end;
$$;

drop trigger if exists messages_activity_source_job_enqueue on public.messages;

create trigger messages_activity_source_job_enqueue
  after insert on public.messages
  for each row
  execute function public.enqueue_message_activity_source_job();

create or replace function public.enqueue_reaction_activity_source_job()
returns trigger
language plpgsql
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

  return new;
end;
$$;

drop trigger if exists message_reactions_activity_source_job_enqueue on public.message_reactions;

create trigger message_reactions_activity_source_job_enqueue
  after insert on public.message_reactions
  for each row
  execute function public.enqueue_reaction_activity_source_job();

create or replace function public.enqueue_session_cancel_activity_source_job()
returns trigger
language plpgsql
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

  return new;
end;
$$;

drop trigger if exists session_exception_activity_source_job_enqueue on public.class_schedule_recurrence_exceptions;

create trigger session_exception_activity_source_job_enqueue
  after insert on public.class_schedule_recurrence_exceptions
  for each row
  execute function public.enqueue_session_cancel_activity_source_job();

create or replace function public.enqueue_session_reschedule_activity_source_job()
returns trigger
language plpgsql
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

  return new;
end;
$$;

drop trigger if exists session_override_activity_source_job_enqueue on public.class_schedule_recurrence_overrides;

create trigger session_override_activity_source_job_enqueue
  after insert on public.class_schedule_recurrence_overrides
  for each row
  execute function public.enqueue_session_reschedule_activity_source_job();
