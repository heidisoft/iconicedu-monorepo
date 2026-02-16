-- Fix the messages update policy to allow soft deletion
-- The issue: the with check clause prevents setting deleted_at because it requires deleted_at to remain null

drop policy if exists "messages update sender or manager" on public.messages;

-- Updated policy that allows setting deleted_at for soft deletion
create policy "messages update sender or manager"
  on public.messages
  for update
  using (
    deleted_at is null
    and (
      -- Allow message sender to update their own message
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      -- Or allow channel managers to update any message
      or public.can_manage_channel(channel_id)
    )
  )
  with check (
    -- After update, either the message should still be active (deleted_at is null)
    -- OR it should be soft-deleted (deleted_at is not null)
    -- This allows soft deletion while still preventing other unauthorized modifications
    (
      -- Allow setting deleted_at for soft deletion
      deleted_at is not null
      and exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
    )
    or (
      -- Allow other updates if message is still active
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
