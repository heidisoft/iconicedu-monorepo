alter table public.channel_read_state
  add column thread_id uuid references public.threads(id) on delete cascade;

alter table public.channel_read_state
  drop constraint if exists channel_read_state_org_id_channel_id_account_id_key;

create unique index channel_read_state_scope_uniq
  on public.channel_read_state (org_id, channel_id, account_id, thread_id) nulls not distinct;

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
select
  trs.org_id,
  trs.channel_id,
  trs.thread_id,
  trs.account_id,
  trs.last_read_message_id,
  trs.last_read_at,
  trs.unread_count,
  trs.created_at,
  trs.created_by,
  trs.updated_at,
  trs.updated_by,
  trs.deleted_at,
  trs.deleted_by
from public.thread_read_state trs
where trs.channel_id is not null
on conflict (org_id, channel_id, account_id, thread_id) do nothing;

drop trigger if exists trg_thread_participants_seed_read_state on public.thread_participants;
drop trigger if exists trg_messages_increment_thread_unread on public.messages;

create or replace function public.ensure_channel_read_state_for_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_last_read_message_id uuid;
  v_last_read_at timestamptz;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select p.account_id
    into v_account_id
    from public.profiles p
   where p.id = new.profile_id
     and p.org_id = new.org_id
     and p.deleted_at is null
   limit 1;

  if v_account_id is null then
    return new;
  end if;

  select m.id, m.created_at
    into v_last_read_message_id, v_last_read_at
    from public.messages m
   where m.org_id = new.org_id
     and m.channel_id = new.channel_id
     and m.deleted_at is null
   order by m.created_at desc
   limit 1;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    last_read_message_id,
    last_read_at,
    unread_count,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
  )
  values (
    new.org_id,
    new.channel_id,
    null,
    v_account_id,
    v_last_read_message_id,
    v_last_read_at,
    0,
    now(),
    now(),
    null,
    null
  )
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set last_read_message_id = excluded.last_read_message_id,
        last_read_at = excluded.last_read_at,
        unread_count = 0,
        deleted_at = null,
        deleted_by = null,
        updated_at = now();

  return new;
end;
$$;

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
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
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

create or replace function public.ensure_thread_read_state_for_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_channel_id uuid;
  v_last_read_message_id uuid;
  v_last_read_at timestamptz;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select p.account_id
    into v_account_id
    from public.profiles p
   where p.id = new.profile_id
     and p.org_id = new.org_id
     and p.deleted_at is null
   limit 1;

  if v_account_id is null then
    return new;
  end if;

  select t.channel_id
    into v_channel_id
    from public.threads t
   where t.id = new.thread_id
     and t.org_id = new.org_id
     and t.deleted_at is null
   limit 1;

  select m.id, m.created_at
    into v_last_read_message_id, v_last_read_at
    from public.messages m
   where m.org_id = new.org_id
     and m.thread_id = new.thread_id
     and m.thread_parent_id is not null
     and m.deleted_at is null
   order by m.created_at desc
   limit 1;

  if v_last_read_at is null then
    v_last_read_at := now();
  end if;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    last_read_message_id,
    last_read_at,
    unread_count,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
  )
  values (
    new.org_id,
    v_channel_id,
    new.thread_id,
    v_account_id,
    v_last_read_message_id,
    v_last_read_at,
    0,
    now(),
    now(),
    null,
    null
  )
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set channel_id = excluded.channel_id,
        last_read_message_id = excluded.last_read_message_id,
        last_read_at = excluded.last_read_at,
        unread_count = 0,
        deleted_at = null,
        deleted_by = null,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.increment_unread_for_thread_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_account_id uuid;
begin
  if new.deleted_at is not null
     or new.thread_id is null
     or new.thread_parent_id is null
     or new.channel_id is null then
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
    thread_id,
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
    new.thread_id,
    new.channel_id,
    recipient.account_id,
    1,
    now(),
    now(),
    null,
    null
  from (
    select distinct p.account_id
      from public.thread_participants tp
      join public.profiles p
        on p.id = tp.profile_id
       and p.org_id = tp.org_id
       and p.deleted_at is null
     where tp.org_id = new.org_id
       and tp.thread_id = new.thread_id
       and tp.deleted_at is null
       and p.account_id is not null
       and p.account_id is distinct from v_sender_account_id
       and (
         new.visibility_type = 'all'
         or (
           new.visibility_type = 'recipient-only'
           and exists (
             select 1
               from public.profiles rp
              where rp.org_id = new.org_id
                and rp.id = new.visibility_user_id
                and rp.deleted_at is null
                and rp.account_id = p.account_id
           )
         )
         or (
           new.visibility_type = 'specific-users'
           and exists (
             select 1
               from public.profiles sp
              where sp.org_id = new.org_id
                and sp.id = any(coalesce(new.visibility_user_ids, '{}'::uuid[]))
                and sp.deleted_at is null
                and sp.account_id = p.account_id
           )
         )
       )
  ) as recipient
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set channel_id = excluded.channel_id,
        unread_count = greatest(0, coalesce(public.channel_read_state.unread_count, 0)) + 1,
        updated_at = now(),
        deleted_at = null,
        deleted_by = null;

  return new;
end;
$$;

create or replace function public.recompute_unread_for_account_thread(
  p_org_id uuid,
  p_channel_id uuid,
  p_thread_id uuid,
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
  select crs.last_read_message_id, crs.last_read_at
    into v_effective_last_read_message_id, v_effective_last_read_at
    from public.channel_read_state crs
   where crs.org_id = p_org_id
     and crs.channel_id = p_channel_id
     and crs.thread_id = p_thread_id
     and crs.account_id = p_account_id
     and crs.deleted_at is null
   limit 1;

  if p_last_read_message_id is not null then
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.thread_id = p_thread_id
       and m.thread_parent_id is not null
       and m.id = p_last_read_message_id
       and m.deleted_at is null
     limit 1;
  end if;

  if v_effective_last_read_message_id is null then
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.thread_id = p_thread_id
       and m.thread_parent_id is not null
       and m.deleted_at is null
       and (
         m.visibility_type = 'all'
         or (
           m.visibility_type = 'recipient-only'
           and exists (
             select 1
               from public.profiles rp
              where rp.org_id = p_org_id
                and rp.id = m.visibility_user_id
                and rp.deleted_at is null
                and rp.account_id = p_account_id
           )
         )
         or (
           m.visibility_type = 'specific-users'
           and exists (
             select 1
               from public.profiles sp
              where sp.org_id = p_org_id
                and sp.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                and sp.deleted_at is null
                and sp.account_id = p_account_id
           )
         )
       )
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
     and m.thread_id = p_thread_id
     and m.thread_parent_id is not null
     and m.deleted_at is null
     and m.created_at > v_effective_last_read_at
     and sender.account_id is distinct from p_account_id
     and (
       m.visibility_type = 'all'
       or (
         m.visibility_type = 'recipient-only'
         and exists (
           select 1
             from public.profiles rp
            where rp.org_id = p_org_id
              and rp.id = m.visibility_user_id
              and rp.deleted_at is null
              and rp.account_id = p_account_id
         )
       )
       or (
         m.visibility_type = 'specific-users'
         and exists (
           select 1
             from public.profiles sp
            where sp.org_id = p_org_id
              and sp.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
              and sp.deleted_at is null
              and sp.account_id = p_account_id
         )
       )
     );

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
    p_thread_id,
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
    set channel_id = excluded.channel_id,
        last_read_message_id = excluded.last_read_message_id,
        last_read_at = excluded.last_read_at,
        unread_count = excluded.unread_count,
        updated_at = now(),
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

  return v_unread;
end;
$$;

create trigger trg_thread_participants_seed_read_state
  after insert or update of deleted_at on public.thread_participants
  for each row execute function public.ensure_thread_read_state_for_participant();

create trigger trg_messages_increment_thread_unread
  after insert on public.messages
  for each row execute function public.increment_unread_for_thread_participants();

alter publication supabase_realtime drop table public.thread_read_state;
drop table if exists public.thread_read_state cascade;

grant execute on function public.recompute_unread_for_account_thread(uuid, uuid, uuid, uuid, uuid, timestamptz, uuid)
  to authenticated, service_role;
revoke all on function public.recompute_unread_for_account_thread(uuid, uuid, uuid, uuid, uuid, timestamptz, uuid) from public;
revoke all on function public.ensure_thread_read_state_for_participant() from public;
revoke all on function public.increment_unread_for_thread_participants() from public;
