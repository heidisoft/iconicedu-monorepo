do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_role_status') then
    create type public.account_role_status as enum ('unassigned', 'active', 'pending', 'blocked');
  end if;
end $$;

alter table public.accounts
  add column if not exists primary_role public.role_key,
  add column if not exists role_status public.account_role_status not null default 'unassigned',
  add column if not exists onboarding_completed_at timestamptz;

with ranked_roles as (
  select
    ur.account_id,
    ur.org_id,
    ur.role_key,
    row_number() over (
      partition by ur.org_id, ur.account_id
      order by case ur.role_key
        when 'owner' then 1
        when 'admin' then 2
        when 'staff' then 3
        when 'educator' then 4
        when 'child' then 5
        when 'guardian' then 6
        else 99
      end
    ) as rank_order
  from public.user_roles ur
  where ur.deleted_at is null
)
update public.accounts a
set
  primary_role = rr.role_key,
  role_status = 'active',
  onboarding_completed_at = coalesce(a.onboarding_completed_at, now()),
  updated_at = now()
from ranked_roles rr
where rr.rank_order = 1
  and rr.org_id = a.org_id
  and rr.account_id = a.id
  and a.deleted_at is null
  and (a.primary_role is null or a.role_status = 'unassigned');

create table if not exists public.student_access_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  guardian_account_id uuid references public.accounts(id) on delete set null,
  code_hash text not null,
  status text not null default 'active',
  expires_at timestamptz,
  max_uses int not null default 1,
  uses int not null default 0,
  created_by_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  unique (org_id, code_hash)
);

create index if not exists idx_student_access_codes_org_status
  on public.student_access_codes (org_id, status)
  where deleted_at is null;

alter table public.student_access_codes enable row level security;

drop policy if exists "student access codes read by admin" on public.student_access_codes;
create policy "student access codes read by admin"
  on public.student_access_codes
  for select
  using (
    deleted_at is null
    and public.is_org_admin(org_id)
  );

drop policy if exists "student access codes manage by admin" on public.student_access_codes;
create policy "student access codes manage by admin"
  on public.student_access_codes
  for all
  using (
    deleted_at is null
    and public.is_org_admin(org_id)
  )
  with check (
    deleted_at is null
    and public.is_org_admin(org_id)
  );

create table if not exists public.auth_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  auth_user_id uuid,
  event_key text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.auth_telemetry_events enable row level security;
