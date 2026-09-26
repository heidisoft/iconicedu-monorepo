-- Issue #264 (messaging P1, capability 10) says "mark a conversation unread
-- from a selected message" — the original mark_channel_unread implementation
-- dropped which message was selected and only flipped a channel-level flag,
-- so clients had no anchor to render an unread indicator from, and no way to
-- resume the read-position search (findUnreadStartMessageId walks forward
-- from last_read_message_id, which mark-unread never moves, so it always
-- searched past the end of the message list and found nothing to show).
alter table public.channel_read_state
  add column if not exists manually_marked_unread_from_message_id uuid
    references public.messages(id) on delete set null;

-- `create or replace` does not replace a function whose parameter list
-- differs (it would instead create a second, ambiguity-prone overload), so
-- drop the old 4-arg signature explicitly before defining the 5-arg one.
drop function if exists public.mark_channel_unread(uuid, uuid, uuid, uuid);

create or replace function public.mark_channel_unread(
  p_org_id uuid,
  p_channel_id uuid,
  p_account_id uuid,
  p_actor_profile_id uuid default null,
  p_from_message_id uuid default null
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
    manually_marked_unread_from_message_id,
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
    p_from_message_id,
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
        manually_marked_unread_from_message_id = p_from_message_id,
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
  uuid,
  uuid
) to service_role;
revoke all on function public.mark_channel_unread(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
) from public, authenticated;

-- Recompute always reflects a genuine "the user read this channel" signal, so
-- clear the manual-unread anchor here too, alongside the flag it already clears.
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
    manually_marked_unread_from_message_id,
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
        manually_marked_unread_from_message_id = null,
        updated_at = now(),
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

  return v_unread;
end;
$$;
