begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
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
select ok(public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001'), 'starter keeps host access');
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002'), 'signed-in student is not host');
update public.profiles set kind = 'educator' where id = '94000000-0000-4000-8000-000000000003';
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003'), 'unrelated teacher is not host');
insert into public.channel_members(org_id, channel_id, profile_id) values ('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003');
select ok(public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003'), 'classroom teacher is host regardless of starter');
select is(public.screen_annotation_actor('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003')->>'role','educator','teacher can moderate annotations');
select lives_ok($$select public.screen_annotation_context('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','teacher-share')$$,'teacher can open annotation room');
update public.channel_members set deleted_at = now() where profile_id = '94000000-0000-4000-8000-000000000003';
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003'), 'removed teacher loses access');
update public.channel_members set deleted_at = null where profile_id = '94000000-0000-4000-8000-000000000003';
update public.accounts set deleted_at = now() where id = '93000000-0000-4000-8000-000000000003';
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003'), 'deleted account loses host access');
update public.accounts set deleted_at = null where id = '93000000-0000-4000-8000-000000000003';
update public.channel_live_sessions set status = 'ended' where id = '96000000-0000-4000-8000-000000000001';
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003'), 'ended session cannot issue host credentials');
select ok(not has_function_privilege('authenticated','public.live_session_can_host(uuid,uuid)','execute'),'frontend cannot invoke privileged host RPC');
select ok(not has_function_privilege('anon','public.live_session_can_host(uuid,uuid)','execute'),'anonymous cannot invoke privileged host RPC');
select ok(has_function_privilege('service_role','public.live_session_can_host(uuid,uuid)','execute'),'API can verify host access');
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001'),'user outside organization cannot host');
select ok(not public.live_session_can_host('96000000-0000-4000-8000-000000000009','92000000-0000-4000-8000-000000000001'),'host permission does not transfer to another session');
select * from finish();
rollback;
