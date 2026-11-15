create table public.live_session_admissions (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  token_hash text not null unique,
  identity_hash text not null,
  display_name text not null check(length(display_name) between 1 and 80),
  status text not null default 'waiting' check(status in ('waiting', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);
create index live_session_admissions_waiting_idx on public.live_session_admissions(live_session_id, status, expires_at);
alter table public.live_session_admissions enable row level security;
revoke all on public.live_session_admissions from anon, authenticated;
grant all on public.live_session_admissions to service_role;

create function public.request_meeting_admission(p_session uuid, p_token_hash text, p_identity_hash text, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_row public.live_session_admissions%rowtype;
begin
  if not exists(select 1 from public.channel_live_sessions where id=p_session and deleted_at is null and status in ('starting','live')) then return 'ended'; end if;
  insert into public.live_session_admissions(live_session_id, token_hash, identity_hash, display_name)
    values(p_session,p_token_hash,p_identity_hash,p_name) on conflict(token_hash) do nothing;
  select * into v_row from public.live_session_admissions where token_hash=p_token_hash;
  if v_row.live_session_id <> p_session or v_row.identity_hash <> p_identity_hash or v_row.expires_at <= now() then return 'denied'; end if;
  return v_row.status;
end;
$$;
revoke all on function public.request_meeting_admission(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.request_meeting_admission(uuid,text,text,text) to service_role;
select cron.schedule('expired-meeting-admissions', '19 * * * *', $$delete from public.live_session_admissions where expires_at < now()$$);
