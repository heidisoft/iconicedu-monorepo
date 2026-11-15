begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
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

select ok(not has_table_privilege('anon', 'public.live_session_browser_links', 'select'), 'anonymous browser cannot read capability hashes');
select ok(not has_table_privilege('authenticated', 'public.live_session_browser_links', 'select'), 'signed-in browser cannot read capability hashes');
select ok(not has_table_privilege('authenticated', 'public.live_session_browser_links', 'insert'), 'frontend cannot mint meeting identities');
select ok(has_table_privilege('service_role', 'public.live_session_browser_links', 'delete'), 'API can atomically redeem handoffs');
select ok((select relrowsecurity from pg_class where oid = 'public.live_session_browser_links'::regclass), 'capability table has RLS enabled');
insert into public.live_session_browser_links(token_hash, live_session_id, purpose, auth_user_id, expires_at) values
 (repeat('a',64), '96000000-0000-4000-8000-000000000001', 'handoff', '92000000-0000-4000-8000-000000000001', now() + interval '60 seconds');
with consumed as (delete from public.live_session_browser_links where token_hash = repeat('a',64) and purpose = 'handoff' and expires_at > now() returning auth_user_id)
select is((select count(*) from consumed), 1::bigint, 'first handoff redemption returns the verified identity');
with consumed as (delete from public.live_session_browser_links where token_hash = repeat('a',64) and purpose = 'handoff' and expires_at > now() returning auth_user_id)
select is((select count(*) from consumed), 0::bigint, 'handoff cannot be redeemed a second time');
select * from finish();
rollback;
