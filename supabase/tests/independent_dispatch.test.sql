-- Run with supabase test db after applying migrations. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-00000000cd01', 'Dispatch test', 'codex-dispatch-test');

insert into public.reminder_jobs
  (org_id, job_type, target_kind, target_id, run_at, dedupe_key, status, lease_until)
select '00000000-0000-4000-8000-00000000cd01', job_type, 'channel',
  '00000000-0000-4000-8000-00000000cd02', now() - interval '1 hour',
  dedupe_key, status, lease_until
from (values
  ('session.reminder', 'test-reminder', 'pending', null::timestamptz),
  ('session.completion_check', 'test-completion-1', 'pending', null::timestamptz),
  ('session.completion_check', 'test-completion-2', 'pending', null::timestamptz),
  ('session.completion_check', 'test-completion-3', 'pending', null::timestamptz),
  ('session.completion_check', 'test-completion-expired', 'leased', now() - interval '1 minute'),
  ('session.completion_check', 'test-completion-active', 'leased', now() + interval '1 hour')
) as jobs(job_type, dedupe_key, status, lease_until);

select is((select count(*)::integer from public.claim_due_reminder_jobs(100000, 'test-reminder')
  where org_id = '00000000-0000-4000-8000-00000000cd01'), 1, 'reminder worker excludes completion checks');
select is((select count(*)::integer from public.claim_due_completion_check_jobs(100000, 'test-completion')
  where org_id = '00000000-0000-4000-8000-00000000cd01'), 4, 'completion worker claims three checks and recovers an expired lease');
select is((select count(*)::integer from public.claim_due_completion_check_jobs(100000, 'test-completion-other')
  where org_id = '00000000-0000-4000-8000-00000000cd01'), 0, 'active completion leases cannot be claimed twice');

create temporary table test_delivery_ids as
select public.enqueue_event_pipeline_job(
  '00000000-0000-4000-8000-00000000cd01', 'notification.deliver', 'legacy-delivery-' || n,
  jsonb_build_object('activityEventId', 'event-' || n, 'recipientProfileId', 'teacher-1',
    'deliveryChannel', case when n = 4 then 'email' else 'push' end)
) as id, n from generate_series(1, 4) n;

select is((select count(*)::integer from public.claim_due_event_pipeline_jobs(100000, 'test-events')
  where org_id = '00000000-0000-4000-8000-00000000cd01' and job_kind = 'notification.deliver'),
  1, 'general worker claims email but excludes push');
select is((select count(*)::integer from public.claim_due_push_notification_jobs(100000, 'test-push')
  where org_id = '00000000-0000-4000-8000-00000000cd01'), 3, 'push worker claims all three teacher notifications');
select is(public.enqueue_event_pipeline_job(
  '00000000-0000-4000-8000-00000000cd01', 'notification.deliver', 'new-stable-key',
  '{"activityEventId":"event-1","recipientProfileId":"teacher-1","deliveryChannel":"push"}'
), (select id from test_delivery_ids where n = 1), 'retry reuses the legacy delivery identity');
select is((select status from public.event_pipeline_jobs where id = (select id from test_delivery_ids where n = 1)),
  'leased', 'preparation does not reset a running push job');

update public.event_pipeline_jobs set status = 'succeeded'
where id = (select id from test_delivery_ids where n = 1);
select is(public.enqueue_event_pipeline_job(
  '00000000-0000-4000-8000-00000000cd01', 'notification.deliver', 'another-minute-bucket',
  '{"activityEventId":"event-1","recipientProfileId":"teacher-1","deliveryChannel":"push"}'
), (select id from test_delivery_ids where n = 1), 'completed push jobs are not recreated by projection retries');

update public.event_pipeline_jobs set lease_until = now() - interval '1 minute'
where id = (select id from test_delivery_ids where n = 2);
select is((select count(*)::integer from public.claim_due_push_notification_jobs(100000, 'test-push-recovery')
  where org_id = '00000000-0000-4000-8000-00000000cd01'), 1, 'push worker recovers only expired leases');
select ok(not has_function_privilege('authenticated', 'public.claim_due_completion_check_jobs(integer,text,integer)', 'EXECUTE'),
  'completion claiming is service-role-only');
select ok(not has_function_privilege('authenticated', 'public.claim_due_push_notification_jobs(integer,text,integer)', 'EXECUTE'),
  'push claiming is service-role-only');
-- Cron registration is part of the deployment contract, including fresh projects.
select public.configure_edge_function_cron('https://dispatch-test.invalid');
select ok(exists (
  select 1 from cron.job where jobname = 'edge-function-session-completions-dispatch'
    and active and schedule = '* * * * *'
    and strpos(command, 'https://dispatch-test.invalid/functions/v1/session-completions-dispatch') > 0
), 'completion cron targets this project every minute');
select ok(exists (
  select 1 from cron.job where jobname = 'edge-function-push-notifications-dispatch'
    and active and schedule = '* * * * *'
    and strpos(command, 'https://dispatch-test.invalid/functions/v1/push-notifications-dispatch') > 0
), 'push cron targets this project every minute');

select public.configure_edge_function_cron('https://dispatch-test.invalid');
select is((select count(*)::integer from cron.job
  where jobname = 'edge-function-session-completions-dispatch'), 1,
  'repeated deployments retain exactly one completion cron');
select is((select count(*)::integer from cron.job
  where jobname = 'edge-function-push-notifications-dispatch'), 1,
  'repeated deployments retain exactly one push cron');
select ok(not exists (select 1 from cron.job where jobname in (
  'edge-function-notifications-dispatch', 'edge-function-reminders-reconcile-dispatch',
  'edge-function-activity-worker-dispatch', 'edge-function-activity-projector-dispatch'
)), 'deprecated worker crons stay removed');
select * from finish();
rollback;
