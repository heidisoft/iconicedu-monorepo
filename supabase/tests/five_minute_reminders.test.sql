begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-000000005501', 'Reminder timing test', 'reminder-timing-test');
insert into public.reminder_jobs
  (org_id, job_type, target_kind, target_id, run_at, dedupe_key, payload, status, lease_until, lease_owner)
select '00000000-0000-4000-8000-000000005501', job_type, 'channel',
  '00000000-0000-4000-8000-000000005502', now() + interval '1 hour',
  job_key, jsonb_build_object('reminderOffsetMinutes', offset_minutes), status, lease_until,
  case when status = 'leased' then 'timing-test-worker' else null end
from (values
  ('session.reminder', 'timing-pending:30', 30, 'pending', null::timestamptz),
  ('session.reminder', 'timing-failed:30', 30, 'failed', null::timestamptz),
  ('session.reminder', 'timing-expired:30', 30, 'leased', now() - interval '1 minute'),
  ('session.reminder', 'timing-running:30', 30, 'leased', now() + interval '1 minute'),
  ('session.reminder', 'timing-sent:30', 30, 'succeeded', null::timestamptz),
  ('session.reminder', 'timing-12h:720', 720, 'pending', null::timestamptz),
  ('session.reminder', 'timing-5m:5', 5, 'pending', null::timestamptz),
  ('session.completion_check', 'timing-completion', null, 'pending', null::timestamptz)
) jobs(job_type, job_key, offset_minutes, status, lease_until);

\ir ../migrations/20260908130000_five_minute_class_reminders.sql

select is((select status from public.reminder_jobs where dedupe_key = 'timing-pending:30'),
  'canceled', 'queued 30-minute reminder is canceled');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-failed:30'),
  'canceled', 'failed 30-minute reminder cannot retry at the old offset');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-expired:30'),
  'canceled', 'expired 30-minute lease is canceled');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-running:30'),
  'leased', 'in-flight lease is preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-sent:30'),
  'succeeded', 'sent history is preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-12h:720'),
  'pending', '12-hour reminders are preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-5m:5'),
  'pending', 'five-minute reminders are preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-completion'),
  'pending', 'completion checks are preserved');
select ok((select lease_owner is null and lease_until is null and next_attempt_at is null
  from public.reminder_jobs where dedupe_key = 'timing-expired:30'),
  'canceled jobs release their expired lease and retry schedule');
select * from finish();
rollback;
