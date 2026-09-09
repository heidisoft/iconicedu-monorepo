-- Admin-triggered runs must only claim jobs in their authorized organization.

create or replace function public.claim_due_org_reminder_jobs(
  p_org_id uuid,
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
    where r.org_id = p_org_id
      and r.deleted_at is null
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

revoke all on function public.claim_due_org_reminder_jobs(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_org_reminder_jobs(uuid, integer, text, integer) to service_role;

create or replace function public.claim_due_org_completion_check_jobs(
  p_org_id uuid,
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
    where r.org_id = p_org_id
      and r.deleted_at is null
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

revoke all on function public.claim_due_org_completion_check_jobs(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_org_completion_check_jobs(uuid, integer, text, integer) to service_role;

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

revoke all on function public.claim_due_org_event_pipeline_jobs(uuid, integer, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_due_org_event_pipeline_jobs(uuid, integer, text, integer, text[]) to service_role;

create or replace function public.claim_due_org_push_notification_jobs(
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

revoke all on function public.claim_due_org_push_notification_jobs(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_org_push_notification_jobs(uuid, integer, text, integer) to service_role;
