create table if not exists public.notification_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  activity_event_id uuid not null references public.activity_events(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  pref_key text not null,
  scope_kind text null check (scope_kind in ('channel', 'learning_space')),
  scope_id uuid null,
  delivery_channel text not null check (delivery_channel in ('push', 'email', 'sms')),
  delivery_timing text not null check (delivery_timing in ('immediate', 'delayed', 'digest')),
  attempt_bucket text not null,
  run_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'suppressed', 'failed', 'dead_letter')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
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

create unique index if not exists notification_dispatch_jobs_idempotency_idx
  on public.notification_dispatch_jobs (
    activity_event_id,
    recipient_profile_id,
    delivery_channel,
    attempt_bucket
  )
  where deleted_at is null;

create index if not exists notification_dispatch_jobs_due_idx
  on public.notification_dispatch_jobs (status, run_at, next_attempt_at)
  where deleted_at is null;

create index if not exists notification_dispatch_jobs_recipient_idx
  on public.notification_dispatch_jobs (org_id, recipient_profile_id, created_at desc)
  where deleted_at is null;

create table if not exists public.notification_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  notification_dispatch_job_id uuid not null references public.notification_dispatch_jobs(id) on delete cascade,
  result text not null check (result in ('succeeded', 'suppressed', 'retryable_failure', 'fatal_failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists notification_dispatch_logs_job_idx
  on public.notification_dispatch_logs (notification_dispatch_job_id, created_at desc)
  where deleted_at is null;

alter table public.notification_dispatch_jobs enable row level security;
alter table public.notification_dispatch_logs enable row level security;

drop policy if exists "notification dispatch jobs read by org admin" on public.notification_dispatch_jobs;
create policy "notification dispatch jobs read by org admin"
  on public.notification_dispatch_jobs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

drop policy if exists "notification dispatch jobs manage by org admin" on public.notification_dispatch_jobs;
create policy "notification dispatch jobs manage by org admin"
  on public.notification_dispatch_jobs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

drop policy if exists "notification dispatch logs read by org admin" on public.notification_dispatch_logs;
create policy "notification dispatch logs read by org admin"
  on public.notification_dispatch_logs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

drop policy if exists "notification dispatch logs manage by org admin" on public.notification_dispatch_logs;
create policy "notification dispatch logs manage by org admin"
  on public.notification_dispatch_logs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create or replace function public.claim_due_notification_dispatch_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.notification_dispatch_jobs
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
    from public.notification_dispatch_jobs j
    where j.deleted_at is null
      and j.status in ('pending', 'failed')
      and j.run_at <= v_now
      and coalesce(j.next_attempt_at, j.run_at) <= v_now
      and (j.lease_until is null or j.lease_until < v_now)
    order by j.run_at asc, j.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update skip locked
  )
  update public.notification_dispatch_jobs j
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;
