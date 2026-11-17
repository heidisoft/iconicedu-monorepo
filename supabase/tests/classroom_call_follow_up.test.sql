begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
-- Synthetic identities: never depend on seed accounts or production data.
insert into public.orgs(id, name, slug) values ('91000000-0000-4000-8000-000000000001', 'Annotation test', 'annotation-test-only');
insert into auth.users(id) values ('92000000-0000-4000-8000-000000000001'), ('92000000-0000-4000-8000-000000000002'), ('92000000-0000-4000-8000-000000000003');
insert into public.accounts(id, org_id, auth_user_id) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002'),
 ('93000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003');
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
 ('94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','educator','Test tutor','seed','UTC'),
 ('94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','child','Test student','seed','UTC'),
 ('94000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000003','child','Test outsider','seed','UTC');
insert into public.channels(id, org_id, kind, topic, visibility, purpose) values ('95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','channel','Test','private','learning-space');
insert into public.channel_members(org_id, channel_id, profile_id) values ('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002');
insert into public.channel_live_sessions(id, org_id, channel_id, provider, status, session_scope_key, started_by_profile_id, join_path)
 values ('96000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','zoom','live','annotation-test','94000000-0000-4000-8000-000000000001','/live/test');

update public.channel_live_sessions set occurrence_key=now()-interval '5 minutes', app_metadata=jsonb_build_object('occurrenceEndAt',now()+interval '55 minutes');

update public.profiles set kind='guardian' where id='94000000-0000-4000-8000-000000000003';
insert into public.families(id,org_id,display_name) values ('97000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Synthetic family');
insert into public.family_links(org_id,family_id,guardian_account_id,child_account_id,relation) values ('91000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000002','guardian');

select ok(public.classroom_call_window_open('96000000-0000-4000-8000-000000000001'), 'calls allowed within the scheduled occurrence');
select ok(not public.classroom_call_window_open('96000000-0000-4000-8000-000000000001',now()-interval '6 minutes'), 'no early calling grace');
select ok(not public.classroom_call_window_open('96000000-0000-4000-8000-000000000001',now()+interval '55 minutes'), 'exact class end closes calling');
update public.channel_live_sessions set status='ended';
select ok(not public.classroom_call_window_open('96000000-0000-4000-8000-000000000001'), 'ended classes cannot ring');
update public.channel_live_sessions set status='live';
select lives_ok($$select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')$$,'call starts during class');
update public.classroom_call_invitations set expires_at=now()-interval '1 second';
select is(public.finalize_classroom_missed_calls(),1,'missed call is processed without an app connected');
select is(public.finalize_classroom_missed_calls(),0,'missed calls are processed once');
select is((select count(*) from public.activity_events where event_type='classroom.call.missed'),1::bigint,'one durable inbox event');
select ok((select audience_rules->0->'userIds' @> '["94000000-0000-4000-8000-000000000002"]'::jsonb from public.activity_events where event_type='classroom.call.missed'),'child receives missed-call notification');
select ok((select audience_rules->0->'userIds' @> '["94000000-0000-4000-8000-000000000003"]'::jsonb from public.activity_events where event_type='classroom.call.missed'),'linked guardian receives missed-call notification');
select is((select jsonb_array_length(audience_rules->0->'userIds') from public.activity_events where event_type='classroom.call.missed'),2,'missed calls never notify the whole class');
select is((select count(*) from public.event_pipeline_jobs where job_kind='activity.project' and source_id in(select id from public.activity_events where event_type='classroom.call.missed')),1::bigint,'projection queued durably');
insert into public.classroom_call_invitations(live_session_id,caller_profile_id,recipient_profile_id,status,expires_at) select '96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002',state,now()-interval '1 second' from unnest(array['declined','accepted','cancelled']) state;
select is(public.finalize_classroom_missed_calls(),0,'answered, declined and cancelled calls are not missed');
select is((select count(*) from public.activity_events where event_type='classroom.call.missed'),1::bigint,'no duplicate notifications');
update public.classroom_call_invitations set created_at=now()-interval '61 seconds';
update public.channel_live_sessions set app_metadata=jsonb_build_object('occurrenceEndAt',now()+interval '10 seconds');
select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002');
select ok((select max(expires_at) <= now()+interval '10 seconds' from public.classroom_call_invitations),'ringing is capped at the scheduled end');
update public.channel_live_sessions set occurrence_key=now()+interval '1 minute';
select throws_ok($$select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')$$,'P0002',null,'calling before class is rejected atomically');
update public.channel_live_sessions set occurrence_key=null;
select throws_ok($$select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')$$,'P0002',null,'unscheduled calls are rejected');
select ok(not has_function_privilege('authenticated','public.finalize_classroom_missed_calls()','execute'),'frontend cannot manufacture missed-call notifications');
select ok(not has_function_privilege('anon','public.finalize_classroom_missed_calls()','execute'),'anonymous clients cannot invoke missed-call worker');
insert into public.activity_event_suppression_rules(org_id,event_type,is_enabled) values ('91000000-0000-4000-8000-000000000001','classroom.call.missed',false);
insert into public.classroom_call_invitations(id,live_session_id,caller_profile_id,recipient_profile_id,expires_at) values ('98000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002',now()-interval '1 second');
select is(public.finalize_classroom_missed_calls(),0,'notification suppression is honored');
select ok((select missed_processed_at is not null from public.classroom_call_invitations where id='98000000-0000-4000-8000-000000000001'),'suppressed calls are not repeatedly retried');
insert into public.activity_event_suppression_rules(org_id,event_type,actor_profile_id,is_enabled) values ('91000000-0000-4000-8000-000000000001','classroom.call.missed','94000000-0000-4000-8000-000000000001',true);
insert into public.classroom_call_invitations(live_session_id,caller_profile_id,recipient_profile_id,expires_at) values ('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002',now()-interval '1 second');
select is(public.finalize_classroom_missed_calls(),1,'actor suppression override matches API publisher rules');
select * from finish();
rollback;
