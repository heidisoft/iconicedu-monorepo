begin;
create extension if not exists pgtap with schema extensions;
select plan(64);
-- Synthetic identities only: never depend on seed accounts or production data.
-- O org · E tutor · C/C2/C3/C4 children · G guardian of C
-- S1 class (E, C, C2, C3; C4 removed earlier) · S2 class (E, C2)
insert into public.orgs(id, name, slug) values ('c1000000-0000-4000-8000-000000000001', 'Archive test', 'archive-test-only');
insert into auth.users(id) values
 ('c2000000-0000-4000-8000-00000000000e'), ('c2000000-0000-4000-8000-00000000000c'), ('c2000000-0000-4000-8000-00000000000a');
insert into public.accounts(id, org_id, auth_user_id) values
 ('c3000000-0000-4000-8000-00000000000e','c1000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-00000000000e'),
 ('c3000000-0000-4000-8000-00000000000c','c1000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-00000000000c'),
 ('c3000000-0000-4000-8000-00000000000a','c1000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-00000000000a'),
 ('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',null),
 ('c3000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001',null),
 ('c3000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001',null);
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
 ('c4000000-0000-4000-8000-00000000000e','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-00000000000e','educator','Tutor','seed','UTC'),
 ('c4000000-0000-4000-8000-00000000000c','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-00000000000c','child','Child','seed','UTC'),
 ('c4000000-0000-4000-8000-00000000000a','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-00000000000a','guardian','Guardian','seed','UTC'),
 ('c4000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002','child','Child two','seed','UTC'),
 ('c4000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000003','child','Child three','seed','UTC'),
 ('c4000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000004','child','Child four','seed','UTC');
insert into public.families(id, org_id, display_name) values ('c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Family');
insert into public.family_links(org_id, family_id, guardian_account_id, child_account_id, relation) values
 ('c1000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-00000000000a','c3000000-0000-4000-8000-00000000000c','guardian');

insert into public.learning_spaces(id, org_id, kind, title) values
 ('c6000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','small_group','Class one'),
 ('c6000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','one_on_one','Class two');
insert into public.channels(id, org_id, kind, topic, visibility, purpose, primary_entity_kind, primary_entity_id) values
 ('c7000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','channel','Class one','private','learning-space','learning_space','c6000000-0000-4000-8000-000000000001'),
 ('c7000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','channel','Class two','private','learning-space','learning_space','c6000000-0000-4000-8000-000000000002');
-- S1 also has a side channel an admin archived before the class was archived.
insert into public.channels(id, org_id, kind, topic, visibility, purpose, status, archived_at) values
 ('c7000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','channel','Class one side','private','learning-space','archived','2026-03-03 00:00:00+00');
insert into public.learning_space_channels(org_id, learning_space_id, channel_id, is_primary) values
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000003',false),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001',true),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','c7000000-0000-4000-8000-000000000002',true);
insert into public.learning_space_participants(org_id, learning_space_id, profile_id, deleted_at) values
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e',null),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c',null),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',null),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000003',null),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000004','2026-01-01 00:00:00+00'),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-00000000000e',null),
 ('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000002',null);
insert into public.channel_members(org_id, channel_id, profile_id, deleted_at)
select org_id, 'c7000000-0000-4000-8000-000000000001'::uuid, profile_id, deleted_at
from public.learning_space_participants where learning_space_id = 'c6000000-0000-4000-8000-000000000001'
union all
select org_id, 'c7000000-0000-4000-8000-000000000002'::uuid, profile_id, deleted_at
from public.learning_space_participants where learning_space_id = 'c6000000-0000-4000-8000-000000000002';

-- DMs: d1 E-C (S1 only), d2 E-G (guardian of C), d3 E-C2 (S1 and S2), d5 E-C3 archived by an admin.
insert into public.channels(id, org_id, kind, topic, visibility, purpose, dm_key, status, archived_at) values
 ('c8000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','dm','Direct message','private','general','dm:test-1','active',null),
 ('c8000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','dm','Direct message','private','general','dm:test-2','active',null),
 ('c8000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','dm','Direct message','private','general','dm:test-3','active',null),
 ('c8000000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000001','dm','Direct message','private','general','dm:test-5','archived','2026-02-02 00:00:00+00');
insert into public.channel_members(org_id, channel_id, profile_id) values
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-00000000000e'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-00000000000a'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-00000000000e'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-000000000002'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000005','c4000000-0000-4000-8000-00000000000e'),
 ('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000005','c4000000-0000-4000-8000-000000000003');

-- Reports and history that must survive every lifecycle step.
insert into public.class_schedules(id, org_id, title, start_at, end_at, visibility, source_kind, source_learning_space_id, source_channel_id) values
 ('c9000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Class one',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','class-members','class_session','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001');
insert into public.class_session_completions(id, org_id, schedule_id, occurrence_key, profile_id, role, session_end_at, expires_at, learning_space_id, channel_id) values
 ('ca000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','c9000000-0000-4000-8000-000000000001',now()-interval '2 days','c4000000-0000-4000-8000-00000000000c','child',now()-interval '2 days',now()+interval '1 day','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001');
insert into public.channel_live_sessions(id, org_id, channel_id, provider, session_scope_key, status, started_by_profile_id, join_path) values
 ('cb000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','livekit','archive-test-scope','ended','c4000000-0000-4000-8000-00000000000e','/join');
insert into public.messages(id, org_id, channel_id, sender_profile_id, type) values
 ('cc000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e','session-summary'),
 ('cc000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c','text');
insert into public.message_saves(org_id, message_id, channel_id, profile_id) values
 ('c1000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c');
insert into public.classroom_whiteboards(org_id, channel_id, scope_key, document) values
 ('c1000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','archive-test','{}');

-- Future work that archive must stop.
insert into public.reminder_jobs(id, org_id, job_type, target_kind, target_id, source_learning_space_id, occurrence_start_at, run_at, dedupe_key, status) values
 ('cd000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','session.reminder','channel','c7000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day','archive-test:pending','pending'),
 ('cd000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','session.reminder','channel','c7000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',now()-interval '2 days',now()-interval '2 days','archive-test:sent','succeeded');
insert into public.scheduled_messages(id, org_id, channel_id, sender_profile_id, content, send_at, status) values
 ('ce000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e','class',now()+interval '1 day','pending'),
 ('ce000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e','dm',now()+interval '1 day','pending');

-- ─── Privileges ───
select ok(not has_function_privilege('authenticated','public.archive_learning_space(uuid,uuid,uuid)','execute'), 'frontend cannot archive directly');
select ok(not has_function_privilege('authenticated','public.restore_learning_space(uuid,uuid,uuid)','execute'), 'frontend cannot restore directly');
select ok(not has_function_privilege('authenticated','public.delete_learning_space(uuid,uuid,uuid)','execute'), 'frontend cannot delete directly');
select ok(not has_function_privilege('anon','public.purge_archived_learning_space_artifacts(integer,integer)','execute'), 'anonymous cannot purge');
select ok(not has_function_privilege('service_role','public.archive_learning_space_core(uuid,timestamptz,uuid)','execute'), 'cascade core is internal');
select ok(has_function_privilege('service_role','public.archive_learning_space(uuid,uuid,uuid)','execute'), 'API can archive');
select ok(not has_function_privilege('authenticated','public.reopen_class_lifecycle_dm(uuid,uuid,uuid)','execute'), 'frontend cannot reopen DMs directly');
select ok(not has_function_privilege('authenticated','public.lock_learning_space_tutor_contact_pairs(uuid)','execute'), 'frontend cannot take lifecycle locks');
select ok(has_function_privilege('service_role','public.tutor_contact_has_active_class(uuid,uuid,uuid)','execute'), 'API can check DM eligibility');
select is((select count(*) from cron.job where jobname = 'learning-space-archive-retention' and schedule = '23 3 * * *' and active), 1::bigint, 'retention job is scheduled daily');

-- ─── Before archive ───
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-00000000000c', true);
select ok(public.can_post_to_channel_as_profile('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c'), 'student can message tutor while the class is active');
select ok(public.tutor_contact_has_active_class('c1000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e','c4000000-0000-4000-8000-00000000000a'), 'guardian of a class member is connected to the tutor');

-- ─── A live class cannot be archived or deleted ───
update public.channel_live_sessions set status = 'live' where id='cb000000-0000-4000-8000-000000000001';
select throws_ok($$select public.archive_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',null)$$, '55006', null, 'archive is refused while a session is live');
select throws_ok($$select public.delete_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',null)$$, '55006', null, 'delete is refused while a session is live');
update public.channel_live_sessions set status = 'ended', ended_at = now() where id='cb000000-0000-4000-8000-000000000001';

-- ─── Archive ───
select is(public.archive_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e'), '{"archived": true}'::jsonb, 'archive succeeds');
select ok((select status = 'archived' and archived_at is not null from public.learning_spaces where id='c6000000-0000-4000-8000-000000000001'), 'class is archived');
select is((select status::text from public.channels where id='c7000000-0000-4000-8000-000000000001'), 'archived', 'class channel is archived');
select is((select archived_at from public.channels where id='c7000000-0000-4000-8000-000000000003'), '2026-03-03 00:00:00+00'::timestamptz, 'class channel archived earlier keeps its own stamp');
select is((select count(*) from public.channel_members where channel_id='c7000000-0000-4000-8000-000000000001' and deleted_at is null), 0::bigint, 'class channel members are removed');
select is((select count(*) from public.learning_space_participants where learning_space_id='c6000000-0000-4000-8000-000000000001' and deleted_at is null), 0::bigint, 'class participants are removed');
select is((select count(*) from public.learning_space_participants p join public.learning_spaces ls on ls.id=p.learning_space_id where ls.id='c6000000-0000-4000-8000-000000000001' and p.deleted_at = ls.archived_at and p.deleted_by='c4000000-0000-4000-8000-00000000000e'), 4::bigint, 'removals carry the archive stamp and actor');
select is((select count(*) from public.learning_space_participants where learning_space_id='c6000000-0000-4000-8000-000000000002' and deleted_at is null), 2::bigint, 'other classes are untouched');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000001'), 'archived', 'student DM with no other shared class is archived');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000002'), 'archived', 'guardian DM is archived with the child connection');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000003'), 'active', 'DM stays active while another class connects the pair');
select is((select archived_at from public.channels where id='c8000000-0000-4000-8000-000000000005'), '2026-02-02 00:00:00+00'::timestamptz, 'admin-archived DM keeps its own stamp');
select is((select count(*) from public.channel_members where channel_id='c8000000-0000-4000-8000-000000000001' and deleted_at is null), 2::bigint, 'archived DM keeps members for read-only history');
select ok(not public.can_post_to_channel_as_profile('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c'), 'archived DM is read-only');
select ok(not public.tutor_contact_has_active_class('c1000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e','c4000000-0000-4000-8000-00000000000c'), 'tutor and student are no longer connected');
select is((select status from public.reminder_jobs where id='cd000000-0000-4000-8000-000000000001'), 'canceled', 'pending reminder is canceled');
select is((select status from public.reminder_jobs where id='cd000000-0000-4000-8000-000000000002'), 'succeeded', 'sent reminder history is kept');
select is((select count(*) from public.scheduled_messages where id in ('ce000000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000002') and status='canceled'), 2::bigint, 'pending class and DM scheduled messages are canceled');
select is((select count(*) from public.messages where id in ('cc000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002') and deleted_at is null), 2::bigint, 'messages and session summaries are kept');
select ok(exists(select 1 from public.class_session_completions where id='ca000000-0000-4000-8000-000000000001' and deleted_at is null), 'session completion report is kept');
select ok(exists(select 1 from public.channel_live_sessions where id='cb000000-0000-4000-8000-000000000001'), 'live session report is kept');
select is(public.archive_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',null) ->> 'already_archived', 'true', 'archive is idempotent');
delete from public.event_pipeline_jobs where source_id = 'c9000000-0000-4000-8000-000000000001';
select lives_ok($$select public.enqueue_stale_schedule_reconciliation(200)$$, 'stale schedule reconciliation runs after archive');
select ok(not exists(select 1 from public.event_pipeline_jobs where source_id = 'c9000000-0000-4000-8000-000000000001' and job_kind = 'reminder.reconcile' and deleted_at is null), 'schedules of an archived class are not re-enqueued for reminders');


-- ─── Report protection ───
select throws_ok($$delete from public.learning_spaces where id='c6000000-0000-4000-8000-000000000001'$$, '42501', null, 'class cannot be hard-deleted');
select throws_ok($$delete from public.channels where id='c7000000-0000-4000-8000-000000000001'$$, '42501', null, 'class channel cannot be hard-deleted');

-- ─── Restore ───
select is(public.restore_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e'), '{"restored": true}'::jsonb, 'restore succeeds');
select is((select count(*) from public.learning_space_participants where learning_space_id='c6000000-0000-4000-8000-000000000001' and deleted_at is null), 4::bigint, 'participants removed by the archive are restored');
select ok(exists(select 1 from public.learning_space_participants where learning_space_id='c6000000-0000-4000-8000-000000000001' and profile_id='c4000000-0000-4000-8000-000000000004' and deleted_at='2026-01-01 00:00:00+00'), 'participants removed before the archive stay removed');
select is((select count(*) from public.channel_members where channel_id='c7000000-0000-4000-8000-000000000001' and deleted_at is null), 4::bigint, 'class channel members are restored');
select is((select status::text from public.channels where id='c7000000-0000-4000-8000-000000000001'), 'active', 'class channel is active again');
select is((select status::text from public.channels where id='c7000000-0000-4000-8000-000000000003'), 'archived', 'class channel archived before the class stays archived');
select is((select count(*) from public.channels where id in ('c8000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002') and status='active'), 2::bigint, 'DMs archived by the class are reopened');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000005'), 'archived', 'admin-archived DM is not reopened');
select ok(public.can_post_to_channel_as_profile('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000c'), 'student can message tutor again');

-- ─── Legacy direct writes still cascade (trigger) ───
update public.learning_spaces set status = 'archived', archived_at = now() where id = 'c6000000-0000-4000-8000-000000000002';
select is((select count(*) from public.learning_space_participants where learning_space_id='c6000000-0000-4000-8000-000000000002' and deleted_at is null), 0::bigint, 'direct status update removes connections');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000003'), 'active', 'DM stays active because the restored class still connects the pair');

-- ─── Soft delete + retention ───
select is(public.delete_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-00000000000e') ->> 'deleted', 'true', 'delete succeeds');
select ok((select deleted_at is not null and status = 'archived' from public.learning_spaces where id='c6000000-0000-4000-8000-000000000001'), 'class is soft-deleted and archived');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000003'), 'archived', 'DM is archived once no class connects the pair');
delete from public.event_pipeline_jobs where source_id = 'c9000000-0000-4000-8000-000000000001';
select lives_ok($$select public.enqueue_stale_schedule_reconciliation(200)$$, 'stale schedule reconciliation runs after delete');
select ok(not exists(select 1 from public.event_pipeline_jobs where source_id = 'c9000000-0000-4000-8000-000000000001' and job_kind = 'reminder.reconcile' and deleted_at is null), 'schedules of a deleted class are not re-enqueued for reminders');

update public.learning_spaces set deleted_at = now() - interval '31 days' where id = 'c6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.purge_archived_learning_space_artifacts(100, 5)$$, 'retention purge runs');
select ok(not exists(select 1 from public.classroom_whiteboards where channel_id='c7000000-0000-4000-8000-000000000001'), 'whiteboards of a deleted class are purged after 30 days');
select ok(not exists(select 1 from public.message_saves where channel_id='c7000000-0000-4000-8000-000000000001'), 'saves of a deleted class are purged after 30 days');
select ok(exists(select 1 from public.messages where id='cc000000-0000-4000-8000-000000000001') and exists(select 1 from public.class_session_completions where id='ca000000-0000-4000-8000-000000000001') and exists(select 1 from public.channel_live_sessions where id='cb000000-0000-4000-8000-000000000001'), 'purge keeps messages and reports');
select throws_ok($$select public.restore_learning_space('c1000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',null)$$, '55000', null, 'restore is refused after the 30-day window');

-- ─── ensure-dm reopen ───
select is(public.reopen_class_lifecycle_dm('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000005','c4000000-0000-4000-8000-00000000000e'), false, 'admin-archived DM is not reopened by ensure-dm');
select is((select status::text from public.channels where id='c8000000-0000-4000-8000-000000000005'), 'archived', 'admin-archived DM stays archived');
select is(public.reopen_class_lifecycle_dm('c1000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-00000000000e'), true, 'DM archived by the class lifecycle is reopened');

select * from finish();
rollback;
