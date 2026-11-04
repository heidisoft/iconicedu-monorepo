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

update public.channel_live_sessions set occurrence_key=now()-interval '5 minutes', app_metadata=jsonb_build_object('occurrenceEndAt',now()+interval '55 minutes');

select ok((select relrowsecurity from pg_class where oid = 'public.classroom_call_invitations'::regclass), 'call invitations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.classroom_call_presence'::regclass), 'call presence has RLS');
select ok(not has_table_privilege('anon', 'public.classroom_call_invitations', 'select'), 'anonymous clients cannot read calls');
select ok(not has_table_privilege('authenticated', 'public.classroom_call_invitations', 'select'), 'clients cannot enumerate call recipients');
select ok(not has_table_privilege('authenticated', 'public.classroom_call_presence', 'insert'), 'clients cannot forge attendance directly');
select ok(not has_function_privilege('authenticated','public.create_classroom_call(uuid,uuid,uuid,timestamptz)','execute'), 'authenticated clients cannot bypass API call authorization');
select ok(not has_function_privilege('anon','public.create_classroom_call(uuid,uuid,uuid,timestamptz)','execute'), 'anonymous clients cannot ring accounts');
select ok(has_function_privilege('service_role','public.create_classroom_call(uuid,uuid,uuid,timestamptz)','execute'), 'API can create calls');
select lives_ok($$select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')$$, 'first call is created');
select ok((select expires_at > now() and expires_at <= clock_timestamp() + interval '45 seconds' from public.classroom_call_invitations where recipient_profile_id = '94000000-0000-4000-8000-000000000002'), 'ring expires within 45 seconds');
select throws_ok($$select public.create_classroom_call('96000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000002')$$, 'P0001', 'Please wait before calling this participant again', 'another teacher cannot bypass the recipient cooldown');
with updated as (update public.classroom_call_invitations set status = 'accepted' where status = 'ringing' returning id)
select is((select count(*) from updated), 1::bigint, 'first answer atomically claims the invitation');
with updated as (update public.classroom_call_invitations set status = 'declined' where status = 'ringing' returning id)
select is((select count(*) from updated), 0::bigint, 'a second device cannot answer again');
select throws_ok($$update public.classroom_call_invitations set status = 'invalid'$$, '23514', null, 'invalid call states are rejected');
select * from finish();
rollback;
