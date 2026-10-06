-- Snapshot and completed operations only. Pointer traffic stays in Broadcast.
create table public.screen_annotation_sessions (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  share_key text not null check (length(share_key) between 1 and 80),
  revision integer not null default 0,
  students_enabled boolean not null default false,
  objects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index screen_annotation_active_share_idx
  on public.screen_annotation_sessions(live_session_id, share_key) where ended_at is null;
create table public.screen_annotation_receipts (
  session_id uuid not null references public.screen_annotation_sessions(id) on delete cascade,
  event_id uuid not null,
  user_id uuid not null,
  result jsonb not null,
  primary key(session_id, event_id)
);
alter table public.screen_annotation_sessions enable row level security;
alter table public.screen_annotation_receipts enable row level security;
-- No frontend table policies. All state access goes through apps/api.

create function public.screen_annotation_actor(p_session uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('userId', a.auth_user_id, 'name', coalesce(p.display_name, p.first_name, 'Participant'),
    'role', case when p.id = s.started_by_profile_id then 'educator' else 'student' end)
  from public.channel_live_sessions s
  join public.accounts a on a.org_id = s.org_id and a.auth_user_id = p_user and a.deleted_at is null and a.status = 'active'
  join public.profiles p on p.account_id = a.id and p.org_id = s.org_id and p.deleted_at is null
  where s.id = p_session and exists (select 1 from public.orgs o where o.id = s.org_id and o.deleted_at is null)
    and exists (select 1 from public.channels c where c.id = s.channel_id and c.org_id = s.org_id and c.deleted_at is null)
    and s.deleted_at is null and s.provider = 'zoom' and s.status in ('starting', 'live')
    and (p.id = s.started_by_profile_id or exists (
      select 1 from public.channel_members m where m.org_id = s.org_id and m.channel_id = s.channel_id
        and m.profile_id = p.id and m.deleted_at is null))
  order by (p.id = s.started_by_profile_id) desc limit 1;
$$;
revoke all on function public.screen_annotation_actor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.screen_annotation_actor(uuid, uuid) to service_role;

create function public.screen_annotation_context(p_session uuid, p_user uuid, p_share text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor jsonb; room public.screen_annotation_sessions; actors jsonb;
begin
  actor := public.screen_annotation_actor(p_session, p_user);
  if actor is null then raise exception 'annotation_forbidden'; end if;
  if actor->>'role' = 'educator' then
    insert into public.screen_annotation_sessions(live_session_id, share_key) values(p_session, p_share)
      on conflict (live_session_id, share_key) where ended_at is null do nothing;
  end if;
  select * into room from public.screen_annotation_sessions where live_session_id = p_session and share_key = p_share and ended_at is null;
  if room.id is null then raise exception 'annotation_not_started'; end if;
  select coalesce(jsonb_agg(distinct public.screen_annotation_actor(p_session, a.auth_user_id)), '[]'::jsonb) into actors
    from public.accounts a join public.channel_live_sessions s on s.org_id = a.org_id
    where s.id = p_session and a.deleted_at is null and a.auth_user_id is not null
      and public.screen_annotation_actor(p_session, a.auth_user_id) is not null;
  return jsonb_build_object('actor', actor, 'actors', actors, 'snapshot', jsonb_build_object(
    'schemaVersion', 1, 'roomId', room.id, 'shareSessionId', room.id, 'revision', room.revision,
    'studentsEnabled', room.students_enabled, 'ended', false, 'objects', room.objects));
end;
$$;
revoke all on function public.screen_annotation_context(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.screen_annotation_context(uuid, uuid, text) to service_role;

create function public.screen_annotation_apply(p_room uuid, p_user uuid, p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  room public.screen_annotation_sessions; actor jsonb; item jsonb; previous jsonb;
  changed jsonb := '[]'::jsonb; next_objects jsonb := '[]'::jsonb; result jsonb;
  v_event_id uuid := (p_operation->>'eventId')::uuid; is_tutor boolean; object_id text;
  kind text := p_operation->>'kind'; base integer := coalesce((p_operation->>'baseVersion')::integer, 0);
begin
  select * into room from public.screen_annotation_sessions where id = p_room for update;
  if room.id is null then raise exception 'annotation_forbidden'; end if;
  actor := public.screen_annotation_actor(room.live_session_id, p_user);
  if actor is null then raise exception 'annotation_forbidden'; end if;
  select r.result into result from public.screen_annotation_receipts r
    where session_id = p_room and r.event_id = v_event_id and user_id = p_user;
  if result is not null then return result; end if;
  if room.ended_at is not null then raise exception 'annotation_ended'; end if;
  is_tutor := actor->>'role' = 'educator';
  if not is_tutor and not room.students_enabled then raise exception 'annotation_forbidden'; end if;
  if kind in ('permissions', 'end') or (kind = 'clear' and p_operation->>'scope' <> 'mine') then
    if not is_tutor then raise exception 'annotation_forbidden'; end if;
  end if;
  if kind in ('put', 'delete') then
    object_id := case when kind = 'put' then p_operation->'object'->>'id' else p_operation->>'id' end;
    select value into previous from jsonb_array_elements(room.objects) where value->>'id' = object_id;
    if coalesce((previous->>'version')::integer, 0) <> base then raise exception 'annotation_conflict'; end if;
    if previous is not null and previous->>'creatorId' <> p_user::text and not is_tutor then raise exception 'annotation_forbidden'; end if;
    if kind = 'delete' then
      if previous is null then raise exception 'annotation_conflict'; end if;
      item := previous || jsonb_build_object('deleted', true, 'version', base + 1, 'updatedAt', floor(extract(epoch from now()) * 1000));
    else
      if previous is null and jsonb_array_length(room.objects) >= 2000 then raise exception 'annotation_capacity'; end if;
      item := (p_operation->'object') || jsonb_build_object('roomId', p_room, 'shareSessionId', p_room,
        'creatorId', coalesce(previous->>'creatorId', p_user::text),
        'creatorName', coalesce(previous->>'creatorName', actor->>'name'),
        'creatorRole', coalesce(previous->>'creatorRole', actor->>'role'),
        'createdAt', coalesce(previous->'createdAt', to_jsonb(floor(extract(epoch from now()) * 1000))),
        'updatedAt', floor(extract(epoch from now()) * 1000), 'version', base + 1, 'deleted', false);
    end if;
    select coalesce(jsonb_agg(value), '[]'::jsonb) into next_objects from jsonb_array_elements(room.objects) where value->>'id' <> object_id;
    next_objects := next_objects || jsonb_build_array(item); changed := jsonb_build_array(item);
  elsif kind = 'clear' then
    for item in select value from jsonb_array_elements(room.objects) loop
      if coalesce((item->>'deleted')::boolean, false) = false and
        (p_operation->>'scope' = 'all' or (p_operation->>'scope' = 'mine' and item->>'creatorId' = p_user::text)
          or (p_operation->>'scope' = 'students' and item->>'creatorRole' = 'student')) then
        item := item || jsonb_build_object('deleted', true, 'version', (item->>'version')::integer + 1,
          'updatedAt', floor(extract(epoch from now()) * 1000));
        changed := changed || jsonb_build_array(item);
      end if;
      next_objects := next_objects || jsonb_build_array(item);
    end loop;
  elsif kind in ('permissions', 'end') then next_objects := room.objects;
  else raise exception 'annotation_invalid_operation'; end if;
  if octet_length(next_objects::text) > 8000000 then raise exception 'annotation_capacity'; end if;
  update public.screen_annotation_sessions set objects = next_objects, revision = revision + 1,
    students_enabled = case when kind = 'permissions' then (p_operation->>'enabled')::boolean else students_enabled end,
    ended_at = case when kind = 'end' then now() else ended_at end where id = p_room returning * into room;
  result := jsonb_build_object('eventId', v_event_id, 'roomId', room.id, 'revision', room.revision,
    'objects', changed, 'studentsEnabled', room.students_enabled, 'ended', room.ended_at is not null);
  insert into public.screen_annotation_receipts values(p_room, v_event_id, p_user, result);
  perform realtime.send(case when octet_length(result::text) > 180000 then result || jsonb_build_object('objects', '[]'::jsonb, 'requiresSnapshot', true) else result end, 'annotation.commit', 'annotation:room:' || p_room::text, true);
  return result;
end;
$$;
revoke all on function public.screen_annotation_apply(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.screen_annotation_apply(uuid, uuid, jsonb) to service_role;

-- Authorization is checked on channel join. Receivers also discard previews after permissions change.
create function public.screen_annotation_topic_access(topic text, sending boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare parts text[] := string_to_array(topic, ':'); room public.screen_annotation_sessions; actor jsonb;
begin
  if array_length(parts, 1) not in (3, 5) or parts[1] <> 'annotation' or parts[2] <> 'room' then return false; end if;
  if array_length(parts, 1) = 5 and parts[4] <> 'user' then return false; end if;
  select * into room from public.screen_annotation_sessions where id::text = parts[3] and ended_at is null;
  if room.id is null then return false; end if;
  actor := public.screen_annotation_actor(room.live_session_id, auth.uid());
  if actor is null then return false; end if;
  if sending then
    return array_length(parts, 1) = 5 and parts[5] = auth.uid()::text
      and (actor->>'role' = 'educator' or room.students_enabled);
  end if;
  return true;
end;
$$;
revoke all on function public.screen_annotation_topic_access(text, boolean) from public, anon;
grant execute on function public.screen_annotation_topic_access(text, boolean) to authenticated;
create policy "annotation participants receive broadcasts" on realtime.messages for select to authenticated
  using (extension in ('broadcast', 'presence') and public.screen_annotation_topic_access(realtime.topic(), false));
create policy "annotation participants send own previews" on realtime.messages for insert to authenticated
  with check (extension in ('broadcast', 'presence') and public.screen_annotation_topic_access(realtime.topic(), true));
-- Restrictive policies protect this namespace even if a broader permissive policy is added elsewhere.
create policy "annotation namespace read boundary" on realtime.messages as restrictive for select to authenticated
  using (realtime.topic() not like 'annotation:%' or public.screen_annotation_topic_access(realtime.topic(), false));
create policy "annotation namespace write boundary" on realtime.messages as restrictive for insert to authenticated
  with check (realtime.topic() not like 'annotation:%' or public.screen_annotation_topic_access(realtime.topic(), true));

create function public.screen_annotation_end_live_session()
returns trigger language plpgsql security definer set search_path = '' as $$
declare room public.screen_annotation_sessions;
begin
  for room in update public.screen_annotation_sessions set ended_at = now(), revision = revision + 1
    where live_session_id = new.id and ended_at is null returning * loop
    perform realtime.send(jsonb_build_object('eventId', gen_random_uuid(), 'roomId', room.id,
      'revision', room.revision, 'objects', '[]'::jsonb, 'studentsEnabled', false, 'ended', true),
      'annotation.commit', 'annotation:room:' || room.id::text, true);
  end loop;
  return new;
end;
$$;
revoke all on function public.screen_annotation_end_live_session() from public, anon, authenticated;
create trigger screen_annotation_live_session_ended after update of status, deleted_at on public.channel_live_sessions
  for each row when (new.status not in ('starting', 'live') or new.deleted_at is not null)
  execute function public.screen_annotation_end_live_session();
