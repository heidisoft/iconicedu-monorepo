begin;
create extension if not exists pgtap with schema extensions;
select plan(25);
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
create temporary table annotation_test_context as select public.screen_annotation_context('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','123') as value;
create function pg_temp.annotation_room() returns uuid language sql as $$ select (value->'snapshot'->>'roomId')::uuid from annotation_test_context $$;
create function pg_temp.annotation_op(kind text, extra jsonb default '{}'::jsonb) returns jsonb language sql as $$ select jsonb_build_object('eventId', gen_random_uuid(), 'kind', kind) || extra $$;
select is((select value->'actor'->>'role' from annotation_test_context), 'educator', 'starter owns tutor rights without trusting client roles');
select is((select value->'snapshot'->>'studentsEnabled' from annotation_test_context), 'false', 'student drawing defaults off');
select throws_ok($$select public.screen_annotation_context('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','123')$$, 'P0001', 'annotation_forbidden', 'outsider cannot load snapshot');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',pg_temp.annotation_op('clear','{"scope":"mine"}'))$$, 'P0001', 'annotation_forbidden', 'disabled student cannot mutate');
select lives_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000001',pg_temp.annotation_op('permissions','{"enabled":true}'))$$, 'tutor enables student drawing');
create temporary table annotation_test_operation as select pg_temp.annotation_op('put', '{"baseVersion":0,"object":{"id":"97000000-0000-4000-8000-000000000001","creatorId":"forged-tutor","creatorRole":"educator","type":"pen","points":[{"x":0.1,"y":0.2}],"style":{"color":"#ff0000","width":3,"opacity":1,"fontSize":24,"bold":false,"italic":false},"rotation":0}}') as value;
select lives_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',(select value from annotation_test_operation))$$, 'enabled student creates own object');
select is((select objects->0->>'creatorId' from public.screen_annotation_sessions where id = pg_temp.annotation_room()), '92000000-0000-4000-8000-000000000002', 'server replaces forged creator identity');
select lives_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',(select value from annotation_test_operation))$$, 'duplicate operation is idempotent');
select is((select revision from public.screen_annotation_sessions where id = pg_temp.annotation_room()), 2, 'retry does not increment revision');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',pg_temp.annotation_op('permissions','{"enabled":false}'))$$, 'P0001', 'annotation_forbidden', 'student cannot change permissions');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',pg_temp.annotation_op('clear','{"scope":"all"}'))$$, 'P0001', 'annotation_forbidden', 'student cannot clear all');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000002',pg_temp.annotation_op('delete','{"id":"97000000-0000-4000-8000-000000000001","baseVersion":0}'))$$, 'P0001', 'annotation_conflict', 'stale versions are rejected');
insert into public.channel_members(org_id, channel_id, profile_id) values ('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000003',pg_temp.annotation_op('delete','{"id":"97000000-0000-4000-8000-000000000001","baseVersion":1}'))$$, 'P0001', 'annotation_forbidden', 'one student cannot delete another student object');
select throws_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000003',pg_temp.annotation_op('put',(select (value - 'eventId' - 'kind') || '{"baseVersion":1}'::jsonb from annotation_test_operation)))$$, 'P0001', 'annotation_forbidden', 'one student cannot edit another student object');
select lives_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000001',pg_temp.annotation_op('clear','{"scope":"students"}'))$$, 'tutor moderates student objects');
select is((select objects->0->>'deleted' from public.screen_annotation_sessions where id = pg_temp.annotation_room()), 'true', 'moderation persists tombstones');
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select ok(public.screen_annotation_topic_access('annotation:room:' || pg_temp.annotation_room() || ':user:92000000-0000-4000-8000-000000000002', true), 'student can broadcast on own topic');
select ok(not public.screen_annotation_topic_access('annotation:room:' || pg_temp.annotation_room() || ':user:92000000-0000-4000-8000-000000000001', true), 'student cannot impersonate tutor topic');
select ok(not public.screen_annotation_topic_access('annotation:room:' || pg_temp.annotation_room(), true), 'clients cannot forge permanent commits');
select ok(not has_function_privilege('authenticated','public.screen_annotation_apply(uuid,uuid,jsonb)','execute'), 'frontend cannot bypass API validation through RPC');
select lives_ok($$select public.screen_annotation_apply(pg_temp.annotation_room(),'92000000-0000-4000-8000-000000000001',pg_temp.annotation_op('end'))$$, 'share end saves the final snapshot');
create temporary table annotation_restarted_context as select public.screen_annotation_context('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','123') as value;
select isnt((select value->'snapshot'->>'roomId' from annotation_restarted_context), pg_temp.annotation_room()::text, 'a restarted share has a new session identity');
select set_config('annotation.test.room', pg_temp.annotation_room()::text, true);
set local role authenticated;
select throws_ok($$select * from public.screen_annotation_sessions$$, '42501', 'permission denied for table screen_annotation_sessions', 'frontend cannot directly read snapshots');
select throws_ok($$select public.screen_annotation_apply(current_setting('annotation.test.room')::uuid,'92000000-0000-4000-8000-000000000002','{}'::jsonb)$$, '42501', 'permission denied for function screen_annotation_apply', 'frontend cannot invoke mutation RPC directly');
reset role;
update public.channel_live_sessions set status = 'ended' where id = '96000000-0000-4000-8000-000000000001';
select ok((select ended_at is not null from public.screen_annotation_sessions where id = (select (value->'snapshot'->>'roomId')::uuid from annotation_restarted_context)), 'ending a class closes any remaining annotation session');
select * from finish();
rollback;
