-- Thread replies were being counted twice in the channel-level unread badge:
-- once by increment_unread_for_channel_members (all messages) and once by
-- increment_unread_for_thread_participants (thread replies only). Both
-- recompute_unread_for_account_channel and the increment trigger lacked a
-- `thread_parent_id IS NULL` guard, so a single thread reply produced
-- unread_count=1 on the channel-level row AND unread_count=1 on the
-- thread-level row, which the API summed to badge=2 for a single message.
--
-- Fix: channel-level unread must only count direct channel messages.
-- Thread replies are tracked exclusively via thread-level rows.

-- 1. Fix the increment trigger: skip thread replies
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

  -- Only channel-level messages increment channel unread.
  -- Thread replies are tracked by increment_unread_for_thread_participants.
  if new.thread_parent_id is not null then
    return new;
  end if;

  select p.account_id
    into v_sender_account_id
    from public.profiles p
   where p.id = new.sender_profile_id
     and p.org_id = new.org_id
     and p.deleted_at is null
   limit 1;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
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
    null,
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
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set unread_count = greatest(0, coalesce(public.channel_read_state.unread_count, 0)) + 1,
        updated_at = now(),
        deleted_at = null,
        deleted_by = null;

  return new;
end;
$$;

-- 2. Fix the recompute RPC: only count channel-level messages (thread_parent_id IS NULL)
create or replace function public.recompute_unread_for_account_channel(
  p_org_id uuid,
  p_channel_id uuid,
  p_account_id uuid,
  p_last_read_message_id uuid default null,
  p_last_read_at timestamptz default null,
  p_actor_profile_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_last_read_message_id uuid;
  v_effective_last_read_at timestamptz;
  v_unread integer;
begin
  if p_last_read_message_id is not null then
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.id = p_last_read_message_id
       and m.deleted_at is null
     limit 1;
  end if;

  if v_effective_last_read_message_id is null then
    -- Fall back to the latest channel-level message (not thread replies)
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.thread_parent_id is null
       and m.deleted_at is null
     order by m.created_at desc
     limit 1;
  end if;

  if v_effective_last_read_at is null then
    v_effective_last_read_at := coalesce(p_last_read_at, now());
  end if;

  select count(*)
    into v_unread
    from public.messages m
    join public.profiles sender
      on sender.id = m.sender_profile_id
     and sender.org_id = m.org_id
     and sender.deleted_at is null
   where m.org_id = p_org_id
     and m.channel_id = p_channel_id
     and m.thread_parent_id is null
     and m.deleted_at is null
     and m.created_at > v_effective_last_read_at
     and sender.account_id is distinct from p_account_id;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    last_read_message_id,
    last_read_at,
    unread_count,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
  values (
    p_org_id,
    p_channel_id,
    null,
    p_account_id,
    v_effective_last_read_message_id,
    v_effective_last_read_at,
    v_unread,
    now(),
    p_actor_profile_id,
    now(),
    p_actor_profile_id,
    null,
    null
  )
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set last_read_message_id = excluded.last_read_message_id,
        last_read_at = excluded.last_read_at,
        unread_count = excluded.unread_count,
        updated_at = now(),
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

  return v_unread;
end;
$$;

-- 3. Repair existing over-counted channel-level unread rows.
-- For each account+channel, recompute the correct count of channel-level
-- messages sent after last_read_at (excluding the account owner and thread replies).
update public.channel_read_state crs
   set unread_count = (
         select count(*)
           from public.messages m
           join public.profiles sender
             on sender.id = m.sender_profile_id
            and sender.org_id = m.org_id
            and sender.deleted_at is null
          where m.org_id = crs.org_id
            and m.channel_id = crs.channel_id
            and m.thread_parent_id is null
            and m.deleted_at is null
            and m.created_at > coalesce(crs.last_read_at, '-infinity'::timestamptz)
            and sender.account_id is distinct from crs.account_id
       ),
       updated_at = now()
 where crs.thread_id is null
   and crs.deleted_at is null;
