-- Fix messages UPDATE (soft-delete) policy to allow staff/educator to delete any message.
--
-- Root cause: the policy used is_org_admin(org_id) which only covers owner/admin roles.
-- can_manage_channel(channel_id) also covers staff and educator roles, which matches
-- the intended permission model: staff can moderate / delete any message in their channels.

drop policy if exists "messages update by sender or manager" on public.messages;
drop policy if exists "messages update sender or manager"    on public.messages;

create policy "messages update by sender or manager"
  on public.messages
  for update
  using (
    deleted_at is null
    and (
      -- message sender can update / soft-delete their own message
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      -- org admin, staff, or educator can update / soft-delete any message
      or public.can_manage_channel(channel_id)
    )
  )
  with check (
    -- soft-delete (deleted_at set to non-null): sender or channel manager
    (
      deleted_at is not null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.can_manage_channel(channel_id)
      )
    )
    or (
      -- other updates on active messages: sender or channel manager
      deleted_at is null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.can_manage_channel(channel_id)
      )
    )
  );
