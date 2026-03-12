-- ---------------------------------------------------------------------------
-- DM / group-DM INSERT RLS policies
--
-- Any org member can start a direct message or group DM with another user.
-- Two policies are needed:
--
--   1. channels INSERT for dm/group_dm  – any org member may create one.
--
--   2. channel_members INSERT for dm/group_dm – only the channel creator may
--      populate the member list (covers adding both participants in a single
--      call right after channel creation).
--
-- These work alongside the existing:
--   • "channels insert by manager"       – staff/educators creating channels
--   • "channel members all by manager"   – staff/educators managing members
--
-- Permissive RLS: a row passes if ANY policy allows it.
-- ---------------------------------------------------------------------------

-- 1. Any org member can open a DM or group-DM channel
create policy "channels insert dm by org member"
  on public.channels for insert
  with check (
    deleted_at is null
    and kind in ('dm', 'group_dm')
    and public.is_org_member(org_id)
  );

-- 2. The DM channel creator can insert the initial member rows
--    (covers adding self + other participant immediately after channel creation)
create policy "channel members insert dm by creator"
  on public.channel_members for insert
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.channels c
      join public.profiles p  on p.id = c.created_by_profile_id
      join public.accounts  a on a.id = p.account_id
      where c.id            = channel_id
        and c.kind          in ('dm', 'group_dm')
        and a.auth_user_id  = auth.uid()
        and c.deleted_at    is null
        and p.deleted_at    is null
        and a.deleted_at    is null
    )
  );
