create or replace function public.can_insert_message(
  _org_id uuid,
  _channel_id uuid,
  _sender_profile_id uuid,
  _type public.message_type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      auth.role() = 'service_role'
      and _type in ('event-reminder', 'feedback-request', 'payment-reminder')
      and exists (
        select 1
        from public.profiles p
        where p.id = _sender_profile_id
          and p.org_id = _org_id
          and p.kind = 'system'
          and p.deleted_at is null
      )
    )
    or
    (
      exists (
        select 1
        from public.profiles p
        where p.id = _sender_profile_id
          and p.org_id = _org_id
          and p.deleted_at is null
          and (
            public.is_profile_owner(p.id)
            or exists (
              select 1
              from public.family_links fl
              where fl.org_id = _org_id
                and fl.child_account_id = p.account_id
                and fl.guardian_account_id = public.current_account_id()
                and fl.deleted_at is null
            )
          )
      )
      and (
        exists (
          select 1
          from public.channel_members cm
          where cm.channel_id = _channel_id
            and cm.profile_id = _sender_profile_id
            and cm.deleted_at is null
        )
        or exists (
          select 1
          from public.channels c
          where c.id = _channel_id
            and c.org_id = _org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(_org_id)
        )
      )
    );
$$;
