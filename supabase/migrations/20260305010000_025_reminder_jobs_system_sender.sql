create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_type text not null
    check (job_type in ('session.reminder', 'session.feedback_request', 'payment.reminder')),
  target_kind text not null
    check (target_kind in ('channel', 'dm', 'user_scope')),
  target_id uuid not null,
  source_learning_space_id uuid null references public.learning_spaces(id) on delete set null,
  source_schedule_id uuid null references public.class_schedules(id) on delete set null,
  source_invoice_id text null,
  occurrence_start_at timestamptz null,
  run_at timestamptz not null,
  timezone text null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'failed', 'dead_letter', 'canceled')),
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

create unique index if not exists reminder_jobs_org_dedupe_idx
  on public.reminder_jobs (org_id, dedupe_key)
  where deleted_at is null;

create index if not exists reminder_jobs_due_idx
  on public.reminder_jobs (status, run_at, next_attempt_at)
  where deleted_at is null;

create index if not exists reminder_jobs_org_space_idx
  on public.reminder_jobs (org_id, source_learning_space_id, status)
  where deleted_at is null;

create table if not exists public.reminder_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  reminder_job_id uuid not null references public.reminder_jobs(id) on delete cascade,
  message_id uuid null references public.messages(id) on delete set null,
  activity_event_id uuid null references public.activity_events(id) on delete set null,
  result text not null
    check (result in ('succeeded', 'idempotent_hit', 'retryable_failure', 'fatal_failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists reminder_dispatch_logs_job_idx
  on public.reminder_dispatch_logs (reminder_job_id, created_at desc)
  where deleted_at is null;

alter table public.reminder_jobs enable row level security;
alter table public.reminder_dispatch_logs enable row level security;

create policy "reminder jobs read by org admin"
  on public.reminder_jobs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder jobs manage by org admin"
  on public.reminder_jobs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder dispatch logs read by org admin"
  on public.reminder_dispatch_logs
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder dispatch logs manage by org admin"
  on public.reminder_dispatch_logs
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

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
      and r.status in ('pending', 'failed')
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

-- bootstrap one system profile per org (idempotent)
with missing_orgs as (
  select o.id as org_id
  from public.orgs o
  where not exists (
    select 1
    from public.profiles p
    where p.org_id = o.id
      and p.kind = 'system'
      and p.deleted_at is null
  )
),
inserted_accounts as (
  insert into public.accounts (
    org_id,
    status,
    created_at,
    updated_at
  )
  select
    mo.org_id,
    'active'::public.account_status,
    timezone('utc', now()),
    timezone('utc', now())
  from missing_orgs mo
  returning id, org_id
)
insert into public.profiles (
  org_id,
  account_id,
  kind,
  display_name,
  first_name,
  last_name,
  avatar_source,
  avatar_seed,
  timezone,
  status,
  created_at,
  updated_at
)
select
  ia.org_id,
  ia.id,
  'system'::public.profile_kind,
  'System',
  'System',
  null,
  'seed',
  'system:' || ia.org_id::text,
  'UTC',
  'active'::public.account_status,
  timezone('utc', now()),
  timezone('utc', now())
from inserted_accounts ia
where not exists (
  select 1
  from public.profiles p
  where p.org_id = ia.org_id
    and p.kind = 'system'
    and p.deleted_at is null
);

drop policy if exists "messages insert channel members" on public.messages;

create policy "messages insert channel members or system automation"
  on public.messages
  for insert
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        auth.role() = 'service_role'
        and type in ('event-reminder', 'feedback-request', 'payment-reminder')
        and exists (
          select 1
          from public.profiles p
          where p.id = sender_profile_id
            and p.org_id = org_id
            and p.kind = 'system'
            and p.deleted_at is null
        )
      )
    )
  );
