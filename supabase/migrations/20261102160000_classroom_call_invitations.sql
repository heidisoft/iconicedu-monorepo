-- API-owned presence and expiring class invitations. No client table access.
create table public.classroom_call_presence (
  connection_id uuid not null,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (connection_id, live_session_id, profile_id)
);
create index classroom_call_presence_session_idx on public.classroom_call_presence(live_session_id, last_seen_at);
create table public.classroom_call_invitations (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  caller_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds')
);
create index classroom_call_invitations_recipient_idx on public.classroom_call_invitations(recipient_profile_id, created_at desc);
alter table public.classroom_call_presence enable row level security;
alter table public.classroom_call_invitations enable row level security;
revoke all on public.classroom_call_presence, public.classroom_call_invitations from anon, authenticated;
grant all on public.classroom_call_presence, public.classroom_call_invitations to service_role;
-- Serialize calls to one recipient, across sessions/teachers, to enforce a cooldown.
create function public.create_classroom_call(_session_id uuid, _caller_id uuid, _recipient_id uuid)
returns public.classroom_call_invitations
language plpgsql security definer set search_path = '' as $$
declare result public.classroom_call_invitations;
begin
  perform pg_advisory_xact_lock(hashtextextended(_recipient_id::text, 0));
  select * into result from public.classroom_call_invitations
    where recipient_profile_id = _recipient_id and created_at > now() - interval '60 seconds'
    order by created_at desc limit 1;
  if found then
    raise exception 'Please wait before calling this participant again' using errcode = 'P0001';
  end if;
  insert into public.classroom_call_invitations(live_session_id,caller_profile_id,recipient_profile_id)
    values (_session_id,_caller_id,_recipient_id) returning * into result;
  return result;
end $$;
revoke all on function public.create_classroom_call(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_classroom_call(uuid,uuid,uuid) to service_role;

-- Keep transient call data short-lived; no phone numbers or join secrets are stored.
do $retention$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('classroom-calls-retention', '*/5 * * * *', $job$
      update public.classroom_call_invitations set status = 'expired' where status = 'ringing' and expires_at <= now();
      delete from public.classroom_call_presence where last_seen_at < now() - interval '5 minutes';
      delete from public.classroom_call_invitations where created_at < now() - interval '1 day';
    $job$);
  end if;
end $retention$;
