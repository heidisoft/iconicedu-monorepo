-- Guard against NULL sender account_id in the unread increment trigger.
--
-- If sender_profile_id resolves to a profile with a NULL account_id (or the
-- profile doesn't exist), v_sender_account_id is NULL. In PostgreSQL,
-- "value IS DISTINCT FROM NULL" is TRUE for every non-null value, so a NULL
-- sender would cause ALL channel members — including the sender — to have
-- their unread count incremented. Adding an early return when the lookup
-- yields NULL matches the pattern already used in
-- ensure_channel_read_state_for_member and is safe: if we can't identify the
-- sender we simply skip the increment rather than corrupting counts.

create or replace function public.increment_unread_for_channel_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_account_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select p.account_id
    into v_sender_account_id
    from public.profiles p
   where p.id = new.sender_profile_id
     and p.org_id = new.org_id
     and p.deleted_at is null
   limit 1;

  -- If we can't resolve the sender's account, skip incrementing to avoid
  -- incorrectly counting the sender's own message as unread for themselves.
  if v_sender_account_id is null then
    return new;
  end if;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    account_id,
    unread_count,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
  )
  select
    new.org_id,
    new.channel_id,
    recipient.account_id,
    1,
    now(),
    now(),
    null,
    null
  from (
    select distinct p.account_id
      from public.channel_members cm
      join public.profiles p
        on p.id = cm.profile_id
       and p.org_id = cm.org_id
       and p.deleted_at is null
     where cm.org_id = new.org_id
       and cm.channel_id = new.channel_id
       and cm.deleted_at is null
       and p.account_id is not null
       and p.account_id is distinct from v_sender_account_id
  ) as recipient
  on conflict (org_id, channel_id, account_id)
  do update
    set unread_count = greatest(0, coalesce(public.channel_read_state.unread_count, 0)) + 1,
        updated_at = now(),
        deleted_at = null,
        deleted_by = null;

  return new;
end;
$$;
