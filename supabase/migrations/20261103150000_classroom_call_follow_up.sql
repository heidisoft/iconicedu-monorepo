alter table public.classroom_call_invitations
  add column missed_processed_at timestamptz,
  add column missed_event_id uuid references public.activity_events(id) on delete set null;

-- Do not send retrospective notifications for calls that expired before rollout.
update public.classroom_call_invitations set missed_processed_at = now() where expires_at <= now();

-- Enforce the persisted occurrence boundary atomically, including requests racing the end time.
create function public.classroom_call_window_open(_session_id uuid, _now timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare s public.channel_live_sessions; finish_at timestamptz;
begin
  select * into s from public.channel_live_sessions where id = _session_id and deleted_at is null and status = 'live';
  if not found or s.occurrence_key is null then return false; end if;
  begin finish_at := (s.app_metadata->>'occurrenceEndAt')::timestamptz;
  exception when others then return false; end;
  return coalesce(s.occurrence_key <= _now and _now < finish_at and finish_at > s.occurrence_key, false);
end $$;
revoke all on function public.classroom_call_window_open(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.classroom_call_window_open(uuid,timestamptz) to service_role;

-- The optional API-verified end time also supports a scheduled lesson extension.
-- Three-argument callers remain compatible and use the persisted occurrence end.
drop function public.create_classroom_call(uuid,uuid,uuid);
create function public.create_classroom_call(_session_id uuid, _caller_id uuid, _recipient_id uuid, _window_end timestamptz default null)
returns public.classroom_call_invitations
language plpgsql security definer set search_path = '' as $$
declare result public.classroom_call_invitations; finish_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(_recipient_id::text, 0));
  if _window_end is null and not public.classroom_call_window_open(_session_id, clock_timestamp()) then
    raise exception 'Calling is available only during the scheduled class time.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.channel_live_sessions s where s.id = _session_id and s.deleted_at is null and s.status = 'live'
    and s.occurrence_key is not null and s.occurrence_key <= clock_timestamp()
    and clock_timestamp() < coalesce(_window_end, (s.app_metadata->>'occurrenceEndAt')::timestamptz)) then
    raise exception 'Calling is available only during the scheduled class time.' using errcode = 'P0002';
  end if;
  select * into result from public.classroom_call_invitations
    where recipient_profile_id = _recipient_id and created_at > now() - interval '60 seconds'
    order by created_at desc limit 1;
  if found then raise exception 'Please wait before calling this participant again' using errcode = 'P0001'; end if;
  select coalesce(_window_end, (app_metadata->>'occurrenceEndAt')::timestamptz) into finish_at from public.channel_live_sessions where id = _session_id;
  insert into public.classroom_call_invitations(live_session_id,caller_profile_id,recipient_profile_id,expires_at)
    values (_session_id,_caller_id,_recipient_id,least(clock_timestamp() + interval '45 seconds',finish_at)) returning * into result;
  return result;
end $$;

revoke all on function public.create_classroom_call(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.create_classroom_call(uuid,uuid,uuid,timestamptz) to service_role;

-- Expiry and durable missed-call publication share one transaction. API workers use
-- the existing projection/notification queue, so no foreground app is required.
create function public.finalize_classroom_missed_calls()
returns integer language plpgsql security definer set search_path = '' as $$
declare c record; event_id uuid; recipients jsonb; processed integer := 0;
begin
  for c in
    select i.*, s.org_id, s.channel_id, o.slug, coalesce(nullif(t.display_name,''),'Your tutor') as tutor_name,
      coalesce(nullif(ch.topic,''),'Classroom') as class_title, r.account_id as recipient_account_id
    from public.classroom_call_invitations i
    join public.channel_live_sessions s on s.id = i.live_session_id
    join public.orgs o on o.id = s.org_id and o.deleted_at is null
    join public.channels ch on ch.id = s.channel_id and ch.org_id = s.org_id and ch.deleted_at is null
    join public.profiles t on t.id = i.caller_profile_id and t.org_id = s.org_id and t.deleted_at is null
    join public.profiles r on r.id = i.recipient_profile_id and r.org_id = s.org_id and r.deleted_at is null
    where i.status in ('ringing','expired') and i.expires_at <= now() and i.missed_processed_at is null
    order by i.expires_at limit 500 for update of i skip locked
  loop
    if coalesce((select sr.is_enabled from public.activity_event_suppression_rules sr
      where sr.org_id = c.org_id and sr.event_type = 'classroom.call.missed' and sr.deleted_at is null
      and (sr.actor_profile_id is null or sr.actor_profile_id = c.caller_profile_id)
      order by (sr.actor_profile_id is not null) desc, sr.updated_at desc limit 1), true) = false then
      update public.classroom_call_invitations set status = 'expired',missed_processed_at = now() where id = c.id;
      continue;
    end if;
    select jsonb_agg(distinct p.id) into recipients from public.profiles p
    where p.org_id = c.org_id and p.deleted_at is null and (
      p.id = c.recipient_profile_id or p.account_id in (
        select fl.guardian_account_id from public.family_links fl where fl.org_id = c.org_id
        and fl.child_account_id = c.recipient_account_id and fl.deleted_at is null
      )
    );
    insert into public.activity_events(org_id,event_type,occurred_at,source_kind,actor_profile_id,scope,payload,audience_rules,dedupe_key)
    values (c.org_id,'classroom.call.missed',c.expires_at,'system',c.caller_profile_id,
      jsonb_build_object('kind','global'),
      jsonb_build_object('classroomCallId',c.id,'sessionId',c.live_session_id,'tutorName',c.tutor_name,'classTitle',c.class_title,'orgSlug',c.slug,
        'href','/' || c.slug || '/calls/' || c.id::text),
      jsonb_build_array(jsonb_build_object('kind','users_only','userIds',coalesce(recipients,'[]'::jsonb))),
      'classroom.call.missed:' || c.id::text)
    on conflict (org_id,dedupe_key) where dedupe_key is not null and deleted_at is null
      do update set dedupe_key = excluded.dedupe_key
    returning id into event_id;
    perform public.enqueue_event_pipeline_job(
      p_org_id => c.org_id, p_job_kind => 'activity.project',p_dedupe_key => 'activity.project:' || event_id::text,
      p_payload => jsonb_build_object('eventId',event_id),p_source_kind => 'activity_event',p_source_id => event_id,p_priority => 60);
    update public.classroom_call_invitations set status = 'expired',missed_processed_at = now(),missed_event_id = event_id where id = c.id;
    processed := processed + 1;
  end loop;
  return processed;
end $$;
revoke all on function public.finalize_classroom_missed_calls() from public, anon, authenticated;
grant execute on function public.finalize_classroom_missed_calls() to service_role;
do $jobs$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('classroom-missed-calls','* * * * *','select public.finalize_classroom_missed_calls();');
    perform cron.schedule('classroom-calls-retention','*/5 * * * *',$cleanup$
      delete from public.classroom_call_presence where last_seen_at < now() - interval '5 minutes';
      delete from public.classroom_call_invitations where created_at < now() - interval '30 days' and (missed_processed_at is not null or status not in ('ringing','expired'));
    $cleanup$);
  end if;
end $jobs$;
