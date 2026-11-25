begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
-- Synthetic identities: never depend on seed accounts or production data.
insert into public.orgs(id, name, slug) values ('a1000000-0000-4000-8000-000000000001', 'Retention test', 'retention-test-only');
insert into auth.users(id) values ('a2000000-0000-4000-8000-000000000001');
insert into public.accounts(id, org_id, auth_user_id) values ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001');
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
 ('a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','educator','Test tutor','seed','UTC');
insert into public.channels(id, org_id, kind, topic, visibility, purpose) values ('a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','channel','Test','private','learning-space');

-- Outbox: old processed (purge), old processed but still referenced by a live job (keep), recent processed (keep), old pending (keep).
insert into public.event_outbox(id, org_id, event_kind, dedupe_key, status, created_at, updated_at) values
 ('a6000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','message','ret:outbox:old','processed',now()-interval '40 days',now()-interval '40 days'),
 ('a6000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','message','ret:outbox:live-job','processed',now()-interval '40 days',now()-interval '40 days'),
 ('a6000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','message','ret:outbox:recent','processed',now()-interval '5 days',now()-interval '5 days'),
 ('a6000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','message','ret:outbox:pending','pending',now()-interval '40 days',now()-interval '40 days');

insert into public.event_pipeline_jobs(id, org_id, outbox_id, job_kind, dedupe_key, payload, status, created_at, updated_at) values
 ('a7000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',null,'activity.project','ret:job:old-succeeded','{}','succeeded',now()-interval '40 days',now()-interval '40 days'),
 ('a7000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',null,'activity.project','ret:job:recent-succeeded','{}','succeeded',now()-interval '5 days',now()-interval '5 days'),
 ('a7000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002','activity.project','ret:job:old-pending','{}','pending',now()-interval '40 days',now()-interval '40 days'),
 ('a7000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001',null,'activity.project','ret:job:old-failed','{}','failed',now()-interval '40 days',now()-interval '40 days'),
 ('a7000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',null,'notification.deliver','ret:job:deliver-45d','{}','succeeded',now()-interval '45 days',now()-interval '45 days'),
 ('a7000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000001',null,'notification.deliver','ret:job:deliver-100d','{}','succeeded',now()-interval '100 days',now()-interval '100 days'),
 ('a7000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001',null,'activity.project','ret:job:dead-45d','{}','dead_letter',now()-interval '45 days',now()-interval '45 days'),
 ('a7000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000001',null,'reminder.reconcile','ret:job:reconcile-10d','{}','succeeded',now()-interval '10 days',now()-interval '10 days'),
 ('a7000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000001',null,'reminder.reconcile','ret:job:reconcile-3d','{}','succeeded',now()-interval '3 days',now()-interval '3 days'),
 ('a7000000-0000-4000-8000-00000000000a','a1000000-0000-4000-8000-000000000001',null,'activity.project','ret:job:project-10d','{}','succeeded',now()-interval '10 days',now()-interval '10 days');

insert into public.event_pipeline_logs(id, org_id, job_id, result, created_at) values
 ('a8000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002','succeeded',now()-interval '40 days'),
 ('a8000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002','succeeded',now()-interval '1 day'),
 ('a8000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002','retryable_failure',now()-interval '10 days');

insert into public.reminder_jobs(id, org_id, job_type, target_kind, target_id, occurrence_start_at, run_at, dedupe_key, status, created_at, updated_at) values
 ('a9000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','session.reminder','channel','a5000000-0000-4000-8000-000000000001',now()-interval '100 days',now()-interval '100 days','ret:rem:old-succeeded','succeeded',now()-interval '100 days',now()-interval '100 days'),
 ('a9000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','session.reminder','channel','a5000000-0000-4000-8000-000000000001',now()-interval '100 days',now()-interval '100 days','ret:rem:old-pending','pending',now()-interval '100 days',now()-interval '100 days'),
 ('a9000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','session.reminder','channel','a5000000-0000-4000-8000-000000000001',now()-interval '2 days',now()-interval '2 days','ret:rem:recent-succeeded','succeeded',now()-interval '2 days',now()-interval '2 days');

insert into public.reminder_dispatch_logs(id, org_id, reminder_job_id, result, created_at) values
 ('aa000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000003','succeeded',now()-interval '100 days'),
 ('aa000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000003','succeeded',now()-interval '1 day');

insert into public.scheduled_messages(id, org_id, channel_id, sender_profile_id, content, send_at, status, created_at, updated_at) values
 ('ab000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','old sent',now()-interval '40 days','sent',now()-interval '41 days',now()-interval '40 days'),
 ('ab000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','old failed',now()-interval '40 days','failed',now()-interval '41 days',now()-interval '40 days');

select ok(not has_function_privilege('authenticated', 'public.purge_notification_job_history(integer, integer)', 'execute'), 'frontend cannot trigger the purge');
select ok(not has_function_privilege('anon', 'public.purge_notification_job_history(integer, integer)', 'execute'), 'anonymous cannot trigger the purge');
select ok(not has_function_privilege('service_role', 'public.purge_rows_in_batches(regclass, text, integer, integer)', 'execute'), 'dynamic batch helper is not callable by API roles');
select is((select count(*) from cron.job where jobname = 'notification-job-retention' and schedule = '41 * * * *' and active), 1::bigint, 'retention job is scheduled hourly');

-- Small batches exercise the batching loop.
select lives_ok($$select public.purge_notification_job_history(2, 50)$$, 'purge runs');

select ok(not exists(select 1 from public.event_outbox where id='a6000000-0000-4000-8000-000000000001'), 'old processed outbox row purged');
select ok(exists(select 1 from public.event_outbox where id='a6000000-0000-4000-8000-000000000002'), 'outbox row with a live job is kept');
select ok(exists(select 1 from public.event_outbox where id='a6000000-0000-4000-8000-000000000003'), 'recent outbox row is kept');
select ok(exists(select 1 from public.event_outbox where id='a6000000-0000-4000-8000-000000000004'), 'pending outbox row is never purged');

select ok(not exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000001'), 'old succeeded job purged');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000002'), 'recent succeeded job kept');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000003'), 'pending job never purged');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000004'), 'retryable failed job never purged');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000005'), 'push delivery dedupe ledger kept for 90 days');
select ok(not exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000006'), 'push delivery older than 90 days purged');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000007'), 'dead-letter jobs kept 90 days for diagnosis');
select ok(not exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000008'), 'succeeded reconcile job older than 7 days purged');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-000000000009'), 'recent reconcile job kept for the repair cooldown');
select ok(exists(select 1 from public.event_pipeline_jobs where id='a7000000-0000-4000-8000-00000000000a'), 'other succeeded jobs keep the 30-day window');

select is((select array_agg(id::text) from public.event_pipeline_logs where org_id='a1000000-0000-4000-8000-000000000001'), array['a8000000-0000-4000-8000-000000000002'], 'pipeline logs older than 7 days purged');

select ok(not exists(select 1 from public.reminder_jobs where id='a9000000-0000-4000-8000-000000000001'), 'old succeeded reminder purged');
select is((select count(*) from public.reminder_jobs where id in ('a9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003')), 2::bigint, 'pending and recent reminders kept');
select is((select array_agg(id::text) from public.reminder_dispatch_logs where org_id='a1000000-0000-4000-8000-000000000001'), array['aa000000-0000-4000-8000-000000000002'], 'only recent reminder logs remain');

select is((select array_agg(status) from public.scheduled_messages where org_id='a1000000-0000-4000-8000-000000000001'), array['failed'], 'sent queue rows purged; failed rows stay visible to senders');

select * from finish();
rollback;
