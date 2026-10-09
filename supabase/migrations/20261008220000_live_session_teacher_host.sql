-- Host authorization follows verified classroom membership, not sign-in alone.
create function public.live_session_can_host(p_session uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channel_live_sessions s
    join public.orgs o on o.id = s.org_id and o.deleted_at is null
    join public.channels c on c.id = s.channel_id and c.org_id = s.org_id and c.deleted_at is null
    join public.accounts a on a.org_id = s.org_id and a.auth_user_id = p_user
      and a.deleted_at is null and a.status = 'active'
    join public.profiles p on p.account_id = a.id and p.org_id = s.org_id and p.deleted_at is null
    where s.id = p_session and s.deleted_at is null and s.provider = 'zoom'
      and s.status in ('starting', 'live')
      and (p.id = s.started_by_profile_id or (
        p.kind = 'educator' and exists (
          select 1 from public.channel_members m where m.org_id = s.org_id
            and m.channel_id = s.channel_id and m.profile_id = p.id and m.deleted_at is null
        )
      ))
  );
$$;
revoke all on function public.live_session_can_host(uuid, uuid) from public, anon, authenticated;
grant execute on function public.live_session_can_host(uuid, uuid) to service_role;

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
