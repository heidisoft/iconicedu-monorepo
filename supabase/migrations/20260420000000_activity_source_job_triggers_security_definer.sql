-- Trigger functions must use SECURITY DEFINER so they can insert into
-- activity_source_jobs as the function owner (postgres), bypassing RLS.
-- Without this, inserts by authenticated users (non-admins) are blocked by
-- the "manage by org admin" RLS policy on activity_source_jobs.

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

  return new;
end;
$$;
