-- Issue #264 (messaging P1): let a user manually mark a channel unread from
-- a selected message. The existing read-state machinery (increment trigger +
-- recompute_unread_for_account_channel) is entirely server-authoritative and
-- would otherwise fight a naive "set unread_count" approach: any subsequent
-- recompute (which runs whenever the user actually opens/reads the channel)
-- would immediately recompute unread_count from last_read_at and zero it
-- back out. So this is modeled as an explicit flag that recompute clears
-- whenever it runs (recompute only runs on a genuine "user read this" call),
-- rather than trying to fight the count itself.

alter table public.channel_read_state
  add column if not exists manually_marked_unread boolean not null default false,
  add column if not exists manually_marked_unread_at timestamptz;

create or replace function public.mark_channel_unread(
  p_org_id uuid,
  p_channel_id uuid,
  p_account_id uuid,
  p_actor_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    unread_count,
    manually_marked_unread,
    manually_marked_unread_at,
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
    1,
    true,
    now(),
    now(),
    p_actor_profile_id,
    now(),
    p_actor_profile_id,
    null,
    null
  )
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set unread_count = greatest(1, coalesce(public.channel_read_state.unread_count, 0)),
        manually_marked_unread = true,
        manually_marked_unread_at = now(),
        updated_at = now(),
        updated_by = p_actor_profile_id,
        deleted_at = null,
        deleted_by = null;
end;
$$;

grant execute on function public.mark_channel_unread(
  uuid,
  uuid,
  uuid,
  uuid
) to authenticated, service_role;
revoke all on function public.mark_channel_unread(
  uuid,
  uuid,
  uuid,
  uuid
) from public;

-- Recompute always reflects a genuine "the user read this channel" signal
-- (it's only invoked from the mark-read API path), so it's the right place
-- to clear a manual unread mark.
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
    manually_marked_unread,
    manually_marked_unread_at,
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
    false,
    null,
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
        manually_marked_unread = false,
        manually_marked_unread_at = null,
        updated_at = now(),
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

  return v_unread;
end;
$$;
