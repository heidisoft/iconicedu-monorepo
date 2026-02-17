-- Patch staff observer access to allow staff users identified either by role assignment
-- OR by a staff profile kind in the same org.

create or replace function public.can_staff_observe_channel(_channel_id uuid)
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
     and ur.role_key = 'staff'
    left join public.profiles p
      on p.org_id = c.org_id
     and p.account_id = a.id
     and p.deleted_at is null
    where c.id = _channel_id
      and c.deleted_at is null
      and a.auth_user_id = auth.uid()
      and (
        ur.id is not null
        or p.kind = 'staff'
      )
      and not public.is_channel_member(c.id)
  );
$$;
