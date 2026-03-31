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
    );
$$;
