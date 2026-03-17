-- Ensure support-channel history is visible to operational roles even when
-- messages are scoped with visibility_type = 'specific-users'.

create or replace function public.can_access_message(_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.id = _message_id
      and m.deleted_at is null
      and c.deleted_at is null
      and (
        (
          (
            public.is_channel_member(m.channel_id)
            or (
              c.purpose = 'support'
              and public.is_org_member(m.org_id)
            )
          )
          and (
            m.visibility_type = 'all'
            or (
              m.visibility_type = 'sender-only'
              and public.is_profile_owner(m.sender_profile_id)
            )
            or (
              m.visibility_type = 'recipient-only'
              and m.visibility_user_id is not null
              and exists (
                select 1
                from public.profiles vp
                where vp.id = m.visibility_user_id
                  and vp.account_id = public.current_account_id()
                  and vp.deleted_at is null
              )
            )
            or (
              m.visibility_type = 'specific-users'
              and exists (
                select 1
                from public.profiles vp
                where vp.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                  and vp.account_id = public.current_account_id()
                  and vp.deleted_at is null
              )
            )
          )
        )
        or (
          c.purpose = 'support'
          and exists (
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
            where a.org_id = m.org_id
              and a.auth_user_id = auth.uid()
              and a.deleted_at is null
              and (
                ur.id is not null
                or p.kind = 'staff'
              )
          )
        )
      )
  );
$$;
