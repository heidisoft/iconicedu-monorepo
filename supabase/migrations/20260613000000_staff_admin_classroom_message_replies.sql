-- Allow staff/admin/owner to reply in classroom channels without becoming
-- channel members. Membership remains the classroom roster; this function only
-- grants posting authority for authorized operational users.

create or replace function public.can_operationally_post_to_classroom_channel(
  _org_id uuid,
  _channel_id uuid,
  _profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.profiles p
      on p.id = _profile_id
     and p.org_id = _org_id
     and p.deleted_at is null
    left join public.user_roles ur
      on ur.org_id = _org_id
     and ur.account_id = public.current_account_id()
     and ur.role_key in ('owner', 'admin', 'staff')
     and ur.deleted_at is null
    left join public.accounts a
      on a.id = public.current_account_id()
     and a.org_id = _org_id
     and a.primary_role in ('owner', 'admin', 'staff')
     and a.deleted_at is null
    where c.id = _channel_id
      and c.org_id = _org_id
      and c.deleted_at is null
      and (
        c.primary_entity_kind = 'learning_space'
        or c.purpose = 'learning-space'
      )
      and (
        p.kind = 'staff'
        or ur.id is not null
        or a.id is not null
      )
  );
$$;

create or replace function public.can_post_to_channel_as_profile(
  _org_id uuid,
  _channel_id uuid,
  _profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_act_as_profile(_org_id, _profile_id)
    and (
      exists (
        select 1
        from public.channel_members cm
        where cm.org_id = _org_id
          and cm.channel_id = _channel_id
          and cm.profile_id = _profile_id
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
      or exists (
        select 1
        from public.channels c
        where c.id = _channel_id
          and c.org_id = _org_id
          and c.visibility = 'public'
          and c.deleted_at is null
          and public.is_org_member(_org_id)
      )
      or public.can_operationally_post_to_classroom_channel(
        _org_id,
        _channel_id,
        _profile_id
      )
    );
$$;

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
    or public.can_post_to_channel_as_profile(_org_id, _channel_id, _sender_profile_id);
$$;
