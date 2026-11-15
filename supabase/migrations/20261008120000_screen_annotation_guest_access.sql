-- Opaque meeting capabilities, issued only after existing passcode/admission checks.
create table public.screen_annotation_access (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  display_name text not null check (length(display_name) between 1 and 100),
  expires_at timestamptz not null
);
create index screen_annotation_access_session_idx on public.screen_annotation_access(live_session_id);
alter table public.screen_annotation_access enable row level security;
revoke all on public.screen_annotation_access from anon, authenticated;

create or replace function public.screen_annotation_actor(p_session uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  (select jsonb_build_object('userId', a.auth_user_id, 'name', coalesce(p.display_name, p.first_name, 'Participant'),
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
  order by (p.id = s.started_by_profile_id) desc limit 1)
  union all
  select jsonb_build_object('userId', g.id, 'name', g.display_name, 'role', 'student')
  from public.screen_annotation_access g
  join public.channel_live_sessions s on s.id = g.live_session_id
  where g.id = p_user and s.id = p_session and g.expires_at > now()
    and s.deleted_at is null and s.provider = 'zoom' and s.status in ('starting', 'live')
    and exists (select 1 from public.orgs o where o.id = s.org_id and o.deleted_at is null)
    and exists (select 1 from public.channels c where c.id = s.channel_id and c.org_id = s.org_id and c.deleted_at is null)
  limit 1;
$$;
create or replace function public.screen_annotation_context(p_session uuid, p_user uuid, p_share text)
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
  select actors || coalesce(jsonb_agg(public.screen_annotation_actor(p_session, g.id)), '[]'::jsonb) into actors
    from public.screen_annotation_access g where g.live_session_id = p_session and g.expires_at > now();
  return jsonb_build_object('actor', actor, 'actors', actors, 'snapshot', jsonb_build_object(
    'schemaVersion', 1, 'roomId', room.id, 'shareSessionId', room.id, 'revision', room.revision,
    'studentsEnabled', room.students_enabled, 'ended', false, 'objects', room.objects));
end;
$$;
create function public.screen_annotation_guest_context(p_session uuid, p_hash text, p_share text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare guest_id uuid;
begin
  select id into guest_id from public.screen_annotation_access
    where live_session_id = p_session and token_hash = p_hash and expires_at > now();
  if guest_id is null then raise exception 'annotation_guest_expired'; end if;
  return public.screen_annotation_context(p_session, guest_id, p_share);
end;
$$;
create function public.screen_annotation_guest_apply(p_room uuid, p_hash text, p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare guest_id uuid;
begin
  select g.id into guest_id from public.screen_annotation_access g
    join public.screen_annotation_sessions r on r.live_session_id = g.live_session_id
    where r.id = p_room and g.token_hash = p_hash and g.expires_at > now();
  if guest_id is null then raise exception 'annotation_guest_expired'; end if;
  return public.screen_annotation_apply(p_room, guest_id, p_operation);
end;
$$;
revoke all on function public.screen_annotation_guest_context(uuid, text, text) from public, anon, authenticated;
revoke all on function public.screen_annotation_guest_apply(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.screen_annotation_guest_context(uuid, text, text) to service_role;
grant execute on function public.screen_annotation_guest_apply(uuid, text, jsonb) to service_role;
