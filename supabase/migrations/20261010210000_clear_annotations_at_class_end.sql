-- Class completion owns cleanup; reconnecting never clears an active room.
create or replace function public.screen_annotation_end_live_session()
returns trigger language plpgsql security definer set search_path = '' as $$
declare room public.screen_annotation_sessions;
begin
  for room in update public.screen_annotation_sessions
    set ended_at = coalesce(ended_at, now()), revision = revision + 1,
        objects = '[]'::jsonb, students_enabled = false
    where live_session_id = new.id returning * loop
    delete from public.screen_annotation_receipts where session_id = room.id;
    delete from public.screen_annotation_pointers where room_id = room.id;
    delete from public.screen_annotation_lasers where room_id = room.id;
    perform realtime.send(jsonb_build_object('eventId', gen_random_uuid(), 'roomId', room.id,
      'revision', room.revision, 'objects', '[]'::jsonb, 'studentsEnabled', false, 'ended', true),
      'annotation.commit', 'annotation:room:' || room.id::text, true);
  end loop;
  return new;
end;
$$;
revoke all on function public.screen_annotation_end_live_session() from public, anon, authenticated;

create or replace function public.screen_annotation_context(p_session uuid, p_user uuid, p_share text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor jsonb; room public.screen_annotation_sessions; actors jsonb;
begin
  -- Serialize room creation with class completion so an end cannot miss a new room.
  perform 1 from public.channel_live_sessions where id = p_session for share;
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
  select actors || coalesce(jsonb_agg(public.screen_annotation_actor(p_session, g.id)), '[]'::jsonb) into actors
    from public.screen_annotation_access g where g.live_session_id = p_session and g.expires_at > now();
  return jsonb_build_object('actor', actor, 'actors', actors, 'snapshot', jsonb_build_object(
    'schemaVersion', 1, 'roomId', room.id, 'shareSessionId', room.id, 'revision', room.revision,
    'studentsEnabled', room.students_enabled, 'ended', false, 'objects', room.objects));
end;
$$;

-- Remove previously retained payloads for classes that have already finished.
delete from public.screen_annotation_receipts r using public.screen_annotation_sessions a,
  public.channel_live_sessions s
where r.session_id = a.id and a.live_session_id = s.id
  and (s.status not in ('starting', 'live') or s.deleted_at is not null);
delete from public.screen_annotation_pointers p using public.screen_annotation_sessions a,
  public.channel_live_sessions s
where p.room_id = a.id and a.live_session_id = s.id
  and (s.status not in ('starting', 'live') or s.deleted_at is not null);
delete from public.screen_annotation_lasers l using public.screen_annotation_sessions a,
  public.channel_live_sessions s
where l.room_id = a.id and a.live_session_id = s.id
  and (s.status not in ('starting', 'live') or s.deleted_at is not null);
update public.screen_annotation_sessions a
set objects = '[]'::jsonb, students_enabled = false, ended_at = coalesce(a.ended_at, now())
from public.channel_live_sessions s where a.live_session_id = s.id
  and (s.status not in ('starting', 'live') or s.deleted_at is not null);
