-- Manual admin runs cannot claim another organization's jobs. Fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-00000000ad01', 'Admin dispatch A', 'admin-dispatch-test-a'),
  ('00000000-0000-4000-8000-00000000ad02', 'Admin dispatch B', 'admin-dispatch-test-b');

insert into public.reminder_jobs
  (org_id, job_type, target_kind, target_id, run_at, dedupe_key, status)
select org_id::uuid, job_type, 'channel', '00000000-0000-4000-8000-00000000ad03',
  now() - interval '1 hour', org_id || ':' || job_type, 'pending'
from (values ('00000000-0000-4000-8000-00000000ad01'),
             ('00000000-0000-4000-8000-00000000ad02')) orgs(org_id)
cross join (values ('session.reminder'), ('session.completion_check')) types(job_type);

select public.enqueue_event_pipeline_job(org_id::uuid, 'notification.deliver',
  org_id || ':' || channel,
  jsonb_build_object('activityEventId', 'admin-event', 'recipientProfileId', 'admin-recipient',
    'deliveryChannel', channel))
from (values ('00000000-0000-4000-8000-00000000ad01'),
             ('00000000-0000-4000-8000-00000000ad02')) orgs(org_id)
cross join (values ('email'), ('push')) channels(channel);

select is((select count(*)::integer from public.claim_due_org_reminder_jobs(
  '00000000-0000-4000-8000-00000000ad01', 100, 'admin-test')), 1,
  'manual reminder run claims only its organization and job type');
select is((select count(*)::integer from public.claim_due_org_completion_check_jobs(
  '00000000-0000-4000-8000-00000000ad01', 100, 'admin-test')), 1,
  'manual completion run claims only its organization and job type');
select is((select count(*)::integer from public.claim_due_org_event_pipeline_jobs(
  '00000000-0000-4000-8000-00000000ad01', 100, 'admin-test')), 1,
  'manual event run excludes another organization and push jobs');
select is((select count(*)::integer from public.claim_due_org_push_notification_jobs(
  '00000000-0000-4000-8000-00000000ad01', 100, 'admin-test')), 1,
  'manual push run claims only its organization and push jobs');

select is((select count(*)::integer from public.reminder_jobs
  where org_id = '00000000-0000-4000-8000-00000000ad02' and status = 'pending'), 2,
  'other organization reminder and completion jobs remain pending');
select is((select count(*)::integer from public.event_pipeline_jobs
  where org_id = '00000000-0000-4000-8000-00000000ad02' and status = 'pending'), 2,
  'other organization event and push jobs remain pending');
select is((select count(*)::integer from public.claim_due_org_completion_check_jobs(null, 100, 'admin-test')), 0,
  'missing organization never falls back to global completion claiming');
select is((select count(*)::integer from public.claim_due_org_push_notification_jobs(null, 100, 'admin-test')), 0,
  'missing organization never falls back to global push claiming');

select ok(not has_function_privilege('authenticated',
  'public.claim_due_org_reminder_jobs(uuid,integer,text,integer)', 'EXECUTE'),
  'scoped reminder RPC requires service role');
select ok(not has_function_privilege('authenticated',
  'public.claim_due_org_completion_check_jobs(uuid,integer,text,integer)', 'EXECUTE'),
  'scoped completion RPC requires service role');
select ok(not has_function_privilege('authenticated',
  'public.claim_due_org_event_pipeline_jobs(uuid,integer,text,integer,text[])', 'EXECUTE'),
  'scoped event RPC requires service role');
select ok(not has_function_privilege('authenticated',
  'public.claim_due_org_push_notification_jobs(uuid,integer,text,integer)', 'EXECUTE'),
  'scoped push RPC requires service role');
select * from finish();
rollback;
