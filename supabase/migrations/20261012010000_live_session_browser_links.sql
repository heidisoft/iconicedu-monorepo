-- Capabilities are scoped to one meeting; plaintext tokens are never persisted.
create table public.live_session_browser_links (
  token_hash text primary key,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  purpose text not null check (purpose in ('invite', 'handoff', 'access')),
  auth_user_id uuid references auth.users(id) on delete cascade,
  passcode_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((purpose = 'invite' and auth_user_id is null) or (purpose in ('handoff', 'access') and auth_user_id is not null))
);
create index live_session_browser_links_expiry_idx on public.live_session_browser_links(expires_at);
alter table public.live_session_browser_links enable row level security;
revoke all on public.live_session_browser_links from anon, authenticated;
grant all on public.live_session_browser_links to service_role;

-- Personal browser handoffs retain annotation moderation without granting an app session.
alter table public.screen_annotation_access add column auth_user_id uuid references auth.users(id) on delete cascade;
create or replace function public.screen_annotation_actor(p_session uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  (select jsonb_build_object('userId', a.auth_user_id, 'name', coalesce(p.display_name, p.first_name, 'Participant'),
    'role', case when public.live_session_can_host(p_session, p_user) then 'educator' else 'student' end)
  from public.channel_live_sessions s
  join public.accounts a on a.org_id = s.org_id and a.auth_user_id = p_user and a.deleted_at is null and a.status = 'active'
  join public.profiles p on p.account_id = a.id and p.org_id = s.org_id and p.deleted_at is null
  where s.id = p_session and exists (select 1 from public.orgs o where o.id = s.org_id and o.deleted_at is null)
    and exists (select 1 from public.channels c where c.id = s.channel_id and c.org_id = s.org_id and c.deleted_at is null)
    and s.deleted_at is null and s.provider = 'zoom' and s.status in ('starting', 'live')
    and (public.live_session_can_host(p_session, p_user) or exists (
      select 1 from public.channel_members m where m.org_id = s.org_id and m.channel_id = s.channel_id
        and m.profile_id = p.id and m.deleted_at is null))
  order by (p.id = s.started_by_profile_id) desc limit 1)
  union all
  select jsonb_build_object('userId', g.id, 'name', g.display_name, 'role', case when g.auth_user_id is not null and public.live_session_can_host(p_session, g.auth_user_id) then 'educator' else 'student' end)
  from public.screen_annotation_access g
  join public.channel_live_sessions s on s.id = g.live_session_id
  where g.id = p_user and s.id = p_session and g.expires_at > now()
    and s.deleted_at is null and s.provider = 'zoom' and s.status in ('starting', 'live')
    and exists (select 1 from public.orgs o where o.id = s.org_id and o.deleted_at is null)
    and exists (select 1 from public.channels c where c.id = s.channel_id and c.org_id = s.org_id and c.deleted_at is null)
  limit 1;
$$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-live-session-browser-links', '17 * * * *',
      'delete from public.live_session_browser_links where expires_at < now()');
  end if;
end $$;
