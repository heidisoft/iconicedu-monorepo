-- Run with `supabase test db` after applying migrations. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-000000001550', 'Fifteen minute reminder test', 'fifteen-minute-reminder-test');

-- ─── Re-key queued five-minute reminders through the reconciler ────────────────

insert into public.reminder_jobs
  (org_id, job_type, target_kind, target_id, run_at, dedupe_key, payload, status, lease_until, lease_owner)
select '00000000-0000-4000-8000-000000001550', job_type, 'channel',
  '00000000-0000-4000-8000-000000001551', now() + interval '1 hour',
  job_key, jsonb_build_object('reminderOffsetMinutes', offset_minutes), status, lease_until,
  case when status = 'leased' then 'timing-test-worker' else null end
from (values
  ('session.reminder', 'timing-pending:5', 5, 'pending', null::timestamptz),
  ('session.reminder', 'timing-failed:5', 5, 'failed', null::timestamptz),
  ('session.reminder', 'timing-expired:5', 5, 'leased', now() - interval '1 minute'),
  ('session.reminder', 'timing-running:5', 5, 'leased', now() + interval '1 minute'),
  ('session.reminder', 'timing-sent:5', 5, 'succeeded', null::timestamptz),
  ('session.reminder', 'timing-12h:720', 720, 'pending', null::timestamptz),
  ('session.reminder', 'timing-15m:15', 15, 'pending', null::timestamptz),
  ('session.completion_check', 'timing-completion', null, 'pending', null::timestamptz)
) jobs(job_type, job_key, offset_minutes, status, lease_until);

\ir ../migrations/20260908150000_fifteen_minute_class_reminders.sql

select is((select status from public.reminder_jobs where dedupe_key = 'timing-pending:5'),
  'canceled', 'queued five-minute reminder is canceled');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-failed:5'),
  'canceled', 'failed five-minute reminder cannot retry at the old offset');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-expired:5'),
  'canceled', 'expired five-minute lease is canceled');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-running:5'),
  'leased', 'in-flight lease is preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-sent:5'),
  'succeeded', 'sent history is preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-12h:720'),
  'pending', '12-hour reminders are preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-15m:15'),
  'pending', 'fifteen-minute reminders are preserved');
select is((select status from public.reminder_jobs where dedupe_key = 'timing-completion'),
  'pending', 'completion checks are preserved');

-- ─── Staleness guard: reminder claims skip cancelled / moved occurrences ───────

insert into public.learning_spaces (id, org_id, kind, status, title) values
  ('00000000-0000-4000-8000-000000001560', '00000000-0000-4000-8000-000000001550', 'one_on_one', 'active', 'Active space'),
  ('00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001550', 'one_on_one', 'archived', 'Archived space');

insert into public.class_schedules
  (id, org_id, title, start_at, end_at, timezone, status, visibility, source_kind, source_learning_space_id)
values
  ('00000000-0000-4000-8000-0000000015a1', '00000000-0000-4000-8000-000000001550', 'Healthy',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'scheduled', 'private', 'class_session',
   '00000000-0000-4000-8000-000000001560'),
  ('00000000-0000-4000-8000-0000000015a2', '00000000-0000-4000-8000-000000001550', 'Cancelled',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'cancelled', 'private', 'class_session', null),
  ('00000000-0000-4000-8000-0000000015a3', '00000000-0000-4000-8000-000000001550', 'Completed',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'completed', 'private', 'class_session', null),
  ('00000000-0000-4000-8000-0000000015a4', '00000000-0000-4000-8000-000000001550', 'Superseded',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'rescheduled', 'private', 'class_session', null),
  ('00000000-0000-4000-8000-0000000015a5', '00000000-0000-4000-8000-000000001550', 'Moved in place',
   now() + interval '3 hours', now() + interval '4 hours', 'UTC', 'scheduled', 'private', 'class_session', null),
  ('00000000-0000-4000-8000-0000000015a6', '00000000-0000-4000-8000-000000001550', 'Archived space',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'scheduled', 'private', 'class_session',
   '00000000-0000-4000-8000-000000001561'),
  ('00000000-0000-4000-8000-0000000015a7', '00000000-0000-4000-8000-000000001550', 'Recurring',
   now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session', null),
  ('00000000-0000-4000-8000-0000000015a8', '00000000-0000-4000-8000-000000001550', 'Soft deleted',
   now() + interval '1 hour', now() + interval '2 hours', 'UTC', 'scheduled', 'private', 'class_session', null);

insert into public.class_schedule_recurrence (id, org_id, schedule_id, frequency)
values ('00000000-0000-4000-8000-0000000015b0', '00000000-0000-4000-8000-000000001550',
        '00000000-0000-4000-8000-0000000015a7', 'weekly');

insert into public.class_schedule_recurrence_exceptions (org_id, recurrence_id, occurrence_key)
values ('00000000-0000-4000-8000-000000001550', '00000000-0000-4000-8000-0000000015b0',
        '2030-06-08T10:00:00.000Z');

insert into public.class_schedule_recurrence_overrides (org_id, recurrence_id, occurrence_key, patch)
values
  -- start moved by hours → occurrence is stale
  ('00000000-0000-4000-8000-000000001550', '00000000-0000-4000-8000-0000000015b0',
   '2030-06-15T10:00:00.000Z', '{"startAt":"2030-06-15T14:00:00.000Z"}'),
  -- override with no startAt (description-only) → occurrence still runs at its time
  ('00000000-0000-4000-8000-000000001550', '00000000-0000-4000-8000-0000000015b0',
   '2030-06-22T10:00:00.000Z', '{"description":"Room change"}'),
  -- override whose startAt equals the occurrence key → not a move
  ('00000000-0000-4000-8000-000000001550', '00000000-0000-4000-8000-0000000015b0',
   '2030-06-29T10:00:00.000Z', '{"startAt":"2030-06-29T10:00:00.000Z"}'),
  -- unparseable startAt must not abort the claim batch → fail open, job kept
  ('00000000-0000-4000-8000-000000001550', '00000000-0000-4000-8000-0000000015b0',
   '2030-07-06T10:00:00.000Z', '{"startAt":"not-a-timestamp"}');

insert into public.reminder_jobs
  (org_id, job_type, target_kind, target_id, run_at, occurrence_start_at, source_schedule_id, dedupe_key, status)
values
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a1', 'guard-healthy', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a2', 'guard-cancelled', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a3', 'guard-completed', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a4', 'guard-rescheduled', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a5', 'guard-moved', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a6', 'guard-archived-space', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a8', 'guard-soft-deleted', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', null, 'guard-no-schedule', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-06-01T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-healthy', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-06-08T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-exception', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-06-15T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-override-moved', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-06-22T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-override-desc', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-06-29T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-override-sametime', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.reminder', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', '2030-07-06T10:00:00.000Z', '00000000-0000-4000-8000-0000000015a7', 'guard-rec-override-badjson', 'pending'),
  ('00000000-0000-4000-8000-000000001550', 'session.completion_check', 'channel', '00000000-0000-4000-8000-000000001551',
   now() - interval '1 hour', now() + interval '1 hour', '00000000-0000-4000-8000-0000000015a2', 'guard-completion-cancelled', 'pending');

update public.class_schedules set deleted_at = now()
where id = '00000000-0000-4000-8000-0000000015a8';

create temporary table guard_claimed as
select dedupe_key from public.claim_due_reminder_jobs(1000, 'guard-test-worker')
where org_id = '00000000-0000-4000-8000-000000001550';

select is(
  (select array_agg(dedupe_key order by dedupe_key) from guard_claimed),
  array['guard-healthy', 'guard-no-schedule', 'guard-rec-healthy',
        'guard-rec-override-badjson', 'guard-rec-override-desc',
        'guard-rec-override-sametime']::text[],
  'reminder worker claims only occurrences that are still scheduled at their original time');
select is(
  (select count(*)::integer from guard_claimed where dedupe_key in (
    'guard-cancelled', 'guard-completed', 'guard-rescheduled', 'guard-moved',
    'guard-archived-space', 'guard-soft-deleted', 'guard-rec-exception', 'guard-rec-override-moved')),
  0, 'cancelled, completed, superseded, moved, archived and deleted-schedule reminders are held back');
select is(
  (select count(*)::integer from public.claim_due_completion_check_jobs(1000, 'guard-completion-worker')
   where org_id = '00000000-0000-4000-8000-000000001550'),
  1, 'the completion worker still claims its job for the cancelled schedule (guard is reminder-only)');
select ok(not has_function_privilege('authenticated',
  'public.claim_due_reminder_jobs(integer,text,integer)', 'EXECUTE'),
  'reminder claiming stays service-role-only');

select * from finish();
rollback;
