-- Deterministic per-user channel read-state + server-authoritative unread maintenance.

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
    v_account_id,
    v_last_read_message_id,
    v_last_read_at,
    0,
    now(),
    now(),
    null,
    null
  )
  on conflict (org_id, channel_id, account_id)
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

drop trigger if exists trg_channel_members_seed_read_state on public.channel_members;
create trigger trg_channel_members_seed_read_state
after insert or update of deleted_at on public.channel_members
for each row
execute function public.ensure_channel_read_state_for_member();

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

drop trigger if exists trg_messages_increment_unread on public.messages;
create trigger trg_messages_increment_unread
after insert on public.messages
for each row
execute function public.increment_unread_for_channel_members();

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
  on conflict (org_id, channel_id, account_id)
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

grant execute on function public.recompute_unread_for_account_channel(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid
) to authenticated, service_role;
revoke all on function public.recompute_unread_for_account_channel(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid
) from public;

create or replace function public.recompute_all_channel_unread_for_account(
  p_org_id uuid,
  p_account_id uuid,
  p_actor_profile_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select distinct cm.channel_id
      from public.channel_members cm
      join public.profiles p
        on p.id = cm.profile_id
       and p.org_id = cm.org_id
       and p.deleted_at is null
     where cm.org_id = p_org_id
       and cm.deleted_at is null
       and p.account_id = p_account_id
  loop
    perform public.recompute_unread_for_account_channel(
      p_org_id,
      v_row.channel_id,
      p_account_id,
      null,
      now(),
      p_actor_profile_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.recompute_all_channel_unread_for_account(
  uuid,
  uuid,
  uuid
) to authenticated, service_role;
revoke all on function public.recompute_all_channel_unread_for_account(
  uuid,
  uuid,
  uuid
) from public;

create or replace function public.recompute_all_channel_unread_for_org(
  p_org_id uuid,
  p_actor_profile_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_total integer := 0;
begin
  for v_row in
    select distinct p.account_id
      from public.channel_members cm
      join public.profiles p
        on p.id = cm.profile_id
       and p.org_id = cm.org_id
       and p.deleted_at is null
     where cm.org_id = p_org_id
       and cm.deleted_at is null
       and p.account_id is not null
  loop
    v_total :=
      v_total
      + public.recompute_all_channel_unread_for_account(
        p_org_id,
        v_row.account_id,
        p_actor_profile_id
      );
  end loop;

  return v_total;
end;
$$;

grant execute on function public.recompute_all_channel_unread_for_org(
  uuid,
  uuid
) to authenticated, service_role;
revoke all on function public.recompute_all_channel_unread_for_org(
  uuid,
  uuid
) from public;

revoke all on function public.ensure_channel_read_state_for_member() from public;
revoke all on function public.increment_unread_for_channel_members() from public;

-- Backfill deterministic channel_read_state rows and seed missing cursors.
insert into public.channel_read_state (
  org_id,
  channel_id,
  account_id,
  last_read_message_id,
  last_read_at,
  unread_count,
  created_at,
  updated_at,
  deleted_at,
  deleted_by
)
select
  cm.org_id,
  cm.channel_id,
  p.account_id,
  latest_message.id,
  latest_message.created_at,
  0,
  now(),
  now(),
  null,
  null
from public.channel_members cm
join public.profiles p
  on p.id = cm.profile_id
 and p.org_id = cm.org_id
 and p.deleted_at is null
left join lateral (
  select m.id, m.created_at
    from public.messages m
   where m.org_id = cm.org_id
     and m.channel_id = cm.channel_id
     and m.deleted_at is null
   order by m.created_at desc
   limit 1
) as latest_message on true
where cm.deleted_at is null
  and p.account_id is not null
on conflict (org_id, channel_id, account_id)
do update
  set last_read_message_id = coalesce(
        public.channel_read_state.last_read_message_id,
        excluded.last_read_message_id
      ),
      last_read_at = coalesce(public.channel_read_state.last_read_at, excluded.last_read_at),
      unread_count = coalesce(public.channel_read_state.unread_count, 0),
      deleted_at = null,
      deleted_by = null,
      updated_at = now();
