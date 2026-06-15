-- Keep schedule manager RLS aligned with the app role model. Some accounts are
-- identified through accounts.primary_role or profile.kind instead of user_roles.

create or replace function public.can_manage_channel(_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.accounts a
      on a.org_id = c.org_id
     and a.deleted_at is null
    left join public.user_roles ur
      on ur.org_id = c.org_id
     and ur.account_id = a.id
     and ur.deleted_at is null
     and ur.role_key in ('staff', 'educator')
    left join public.profiles p
      on p.org_id = c.org_id
     and p.account_id = a.id
     and p.deleted_at is null
     and p.kind in ('staff', 'educator')
    where c.id = _channel_id
      and c.deleted_at is null
      and a.auth_user_id = auth.uid()
      and (
        public.is_org_admin(c.org_id)
        or ur.id is not null
        or a.primary_role in ('owner', 'admin', 'staff', 'educator')
        or p.id is not null
      )
  );
$$;

create or replace function public.can_manage_learning_space(_learning_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.learning_spaces ls
    join public.accounts a
      on a.org_id = ls.org_id
     and a.deleted_at is null
    left join public.user_roles ur
      on ur.org_id = ls.org_id
     and ur.account_id = a.id
     and ur.deleted_at is null
     and ur.role_key in ('staff', 'educator')
    left join public.profiles p
      on p.org_id = ls.org_id
     and p.account_id = a.id
     and p.deleted_at is null
     and p.kind in ('staff', 'educator')
    where ls.id = _learning_space_id
      and ls.deleted_at is null
      and a.auth_user_id = auth.uid()
      and (
        public.is_org_admin(ls.org_id)
        or ur.id is not null
        or a.primary_role in ('owner', 'admin', 'staff', 'educator')
        or p.id is not null
      )
  );
$$;

create or replace function public.can_manage_schedule(_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_schedules cs
    join public.accounts a
      on a.org_id = cs.org_id
     and a.deleted_at is null
    left join public.user_roles ur
      on ur.org_id = cs.org_id
     and ur.account_id = a.id
     and ur.deleted_at is null
     and ur.role_key in ('staff', 'educator')
    left join public.profiles p
      on p.org_id = cs.org_id
     and p.account_id = a.id
     and p.deleted_at is null
     and p.kind in ('staff', 'educator')
    where cs.id = _schedule_id
      and cs.deleted_at is null
      and a.auth_user_id = auth.uid()
      and (
        public.is_org_admin(cs.org_id)
        or ur.id is not null
        or a.primary_role in ('owner', 'admin', 'staff', 'educator')
        or p.id is not null
      )
  );
$$;
