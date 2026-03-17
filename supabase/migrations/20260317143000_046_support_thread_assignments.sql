create table if not exists public.support_thread_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_kind text not null default 'required',
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint support_thread_assignments_kind_check
    check (assignment_kind in ('required', 'optional')),
  constraint support_thread_assignments_unique
    unique (org_id, thread_id, staff_profile_id)
);

create index if not exists support_thread_assignments_thread_idx
  on public.support_thread_assignments (org_id, thread_id)
  where deleted_at is null;

create index if not exists support_thread_assignments_staff_idx
  on public.support_thread_assignments (org_id, staff_profile_id)
  where deleted_at is null;

alter table public.support_thread_assignments enable row level security;

drop policy if exists "support thread assignments select support ops"
  on public.support_thread_assignments;
create policy "support thread assignments select support ops"
  on public.support_thread_assignments
  for select
  using (
    deleted_at is null
    and (
      auth.role() = 'service_role'
      or exists (
        select 1
        from public.accounts a
        left join public.user_roles ur
          on ur.org_id = a.org_id
         and ur.account_id = a.id
         and ur.role_key in ('owner', 'admin', 'staff')
         and ur.deleted_at is null
        left join public.profiles p
          on p.org_id = a.org_id
         and p.account_id = a.id
         and p.deleted_at is null
        where a.org_id = support_thread_assignments.org_id
          and a.auth_user_id = auth.uid()
          and a.deleted_at is null
          and (
            ur.id is not null
            or p.kind = 'staff'
          )
      )
    )
  );

drop policy if exists "support thread assignments manage support ops"
  on public.support_thread_assignments;
create policy "support thread assignments manage support ops"
  on public.support_thread_assignments
  for all
  using (
    deleted_at is null
    and (
      auth.role() = 'service_role'
      or exists (
        select 1
        from public.accounts a
        left join public.user_roles ur
          on ur.org_id = a.org_id
         and ur.account_id = a.id
         and ur.role_key in ('owner', 'admin', 'staff')
         and ur.deleted_at is null
        left join public.profiles p
          on p.org_id = a.org_id
         and p.account_id = a.id
         and p.deleted_at is null
        where a.org_id = support_thread_assignments.org_id
          and a.auth_user_id = auth.uid()
          and a.deleted_at is null
          and (
            ur.id is not null
            or p.kind = 'staff'
          )
      )
    )
  )
  with check (
    deleted_at is null
    and (
      auth.role() = 'service_role'
      or exists (
        select 1
        from public.accounts a
        left join public.user_roles ur
          on ur.org_id = a.org_id
         and ur.account_id = a.id
         and ur.role_key in ('owner', 'admin', 'staff')
         and ur.deleted_at is null
        left join public.profiles p
          on p.org_id = a.org_id
         and p.account_id = a.id
         and p.deleted_at is null
        where a.org_id = support_thread_assignments.org_id
          and a.auth_user_id = auth.uid()
          and a.deleted_at is null
          and (
            ur.id is not null
            or p.kind = 'staff'
          )
      )
    )
  );
