-- Run with `supabase test db` after applying migrations. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-00000000ce01', 'Schedule reconciliation test', 'codex-schedule-reconciliation-test');

-- ─── Dedicated claim vs. general Events worker exclusion ──────────────────────

insert into public.event_pipeline_jobs (org_id, job_kind, dedupe_key, status, run_at)
values
  ('00000000-0000-4000-8000-00000000ce01', 'reminder.reconcile', 'schedule:seed-1', 'pending', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-00000000ce01', 'reminder.reconcile', 'schedule:seed-expired', 'leased', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-00000000ce01', 'activity.project', 'event:seed-1', 'pending', now() - interval '2 minutes');

update public.event_pipeline_jobs set lease_until = now() - interval '1 minute'
where org_id = '00000000-0000-4000-8000-00000000ce01' and dedupe_key = 'schedule:seed-expired';

select is((select count(*)::integer from public.claim_due_event_pipeline_jobs(100, 'test-events')
  where org_id = '00000000-0000-4000-8000-00000000ce01'), 1,
  'general events worker skips reminder.reconcile and claims only the projection job');
select is((select count(*)::integer from public.claim_due_schedule_reconciliation_jobs(100, 'test-recon')
  where org_id = '00000000-0000-4000-8000-00000000ce01'), 2,
  'dedicated worker claims a due reconcile job and recovers an expired lease');
select is((select count(*)::integer from public.claim_due_schedule_reconciliation_jobs(100, 'test-recon-again')
  where org_id = '00000000-0000-4000-8000-00000000ce01'), 0,
  'active reconcile leases cannot be claimed twice');

insert into public.event_pipeline_jobs (org_id, job_kind, dedupe_key, status, run_at)
values
  ('00000000-0000-4000-8000-00000000ce01', 'reminder.reconcile', 'schedule:org-scope', 'pending', now() - interval '1 minute');

select is((select count(*)::integer from public.claim_due_org_schedule_reconciliation_jobs(
  '00000000-0000-4000-8000-00000000ce01', 100, 'test-org-recon')), 1,
  'org-scoped worker claims reconcile jobs for its organization');
select is((select count(*)::integer from public.claim_due_org_event_pipeline_jobs(
  '00000000-0000-4000-8000-00000000ce01', 100, 'test-org-events')), 0,
  'org-scoped general worker also excludes reminder.reconcile');

select ok(not has_function_privilege('authenticated',
  'public.claim_due_schedule_reconciliation_jobs(integer,text,integer)', 'EXECUTE'),
  'reconcile claiming is service-role-only');
select ok(not has_function_privilege('authenticated',
  'public.enqueue_stale_schedule_reconciliation(integer)', 'EXECUTE'),
  'the repair pass is service-role-only');

-- ─── Periodic repair pass: replenish missing jobs ────────────────────────────

insert into public.class_schedules (id, org_id, title, start_at, end_at, timezone, status, visibility, source_kind)
values (
  '00000000-0000-4000-8000-00000000ce10', '00000000-0000-4000-8000-00000000ce01',
  'Weekly algebra', now() + interval '2 days', now() + interval '2 days' + interval '1 hour',
  'UTC', 'scheduled', 'private', 'class_session'
);

-- The insert trigger already enqueued a reconcile job; simulate a lost trigger
-- event / a job that was fully worked off so the schedule now has none.
delete from public.event_pipeline_jobs
where org_id = '00000000-0000-4000-8000-00000000ce01'
  and job_kind = 'reminder.reconcile'
  and source_id = '00000000-0000-4000-8000-00000000ce10';

select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile'
    and source_id = '00000000-0000-4000-8000-00000000ce10'
    and status in ('pending', 'leased', 'failed')), 0,
  'no active reconcile job for the schedule before the repair pass');

select ok(public.enqueue_stale_schedule_reconciliation(50) >= 1,
  'repair pass re-enqueues at least the schedule with missing jobs');
select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile'
    and source_id = '00000000-0000-4000-8000-00000000ce10'
    and status = 'pending'), 1,
  'repair pass created exactly one pending reconcile job for the schedule');
select is(public.enqueue_stale_schedule_reconciliation(50), 0,
  'repair pass is idempotent while a reconcile job is still pending');

-- A cancelled schedule is never replenished.
update public.class_schedules set status = 'cancelled'
where id = '00000000-0000-4000-8000-00000000ce10';
delete from public.event_pipeline_jobs
where job_kind = 'reminder.reconcile'
  and source_id = '00000000-0000-4000-8000-00000000ce10';
select is(public.enqueue_stale_schedule_reconciliation(50), 0,
  'repair pass ignores cancelled schedules');

-- ─── Repair pass never loops on finished or recently reconciled schedules ────
-- ce20: one-off session that ended 5 days ago (still 'scheduled').
-- ce21: weekly series whose recurrence ended 5 days ago.
-- ce24: one-off session that ended yesterday: still inside the reconciler's
--       3-day look-back, so a missing completion check can be recovered.
-- ce22: future session reconciled 1 hour ago (inside the 6-hour cooldown).
-- ce23: future session last reconciled 7 hours ago (cooldown expired).
insert into public.class_schedules (id, org_id, title, start_at, end_at, timezone, status, visibility, source_kind)
values
  ('00000000-0000-4000-8000-00000000ce20', '00000000-0000-4000-8000-00000000ce01', 'Ended one-off',
   now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session'),
  ('00000000-0000-4000-8000-00000000ce21', '00000000-0000-4000-8000-00000000ce01', 'Ended series',
   now() - interval '60 days', now() - interval '60 days' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session'),
  ('00000000-0000-4000-8000-00000000ce22', '00000000-0000-4000-8000-00000000ce01', 'Recently reconciled',
   now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session'),
  ('00000000-0000-4000-8000-00000000ce23', '00000000-0000-4000-8000-00000000ce01', 'Cooldown expired',
   now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session'),
  ('00000000-0000-4000-8000-00000000ce24', '00000000-0000-4000-8000-00000000ce01', 'Ended yesterday',
   now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 'UTC', 'scheduled', 'private', 'class_session');

insert into public.class_schedule_recurrence (org_id, schedule_id, frequency, interval, until)
values ('00000000-0000-4000-8000-00000000ce01', '00000000-0000-4000-8000-00000000ce21', 'weekly', 1, now() - interval '5 days');

-- Replace the trigger-enqueued jobs with worked-off history.
delete from public.event_pipeline_jobs
where job_kind = 'reminder.reconcile'
  and source_id in ('00000000-0000-4000-8000-00000000ce20', '00000000-0000-4000-8000-00000000ce21',
                    '00000000-0000-4000-8000-00000000ce22', '00000000-0000-4000-8000-00000000ce23',
                    '00000000-0000-4000-8000-00000000ce24');
insert into public.event_pipeline_jobs (org_id, job_kind, dedupe_key, status, run_at, source_id, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000ce01', 'reminder.reconcile', 'schedule:recent', 'succeeded',
   now() - interval '1 hour', '00000000-0000-4000-8000-00000000ce22', now() - interval '1 hour', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-00000000ce01', 'reminder.reconcile', 'schedule:older', 'succeeded',
   now() - interval '7 hours', '00000000-0000-4000-8000-00000000ce23', now() - interval '7 hours', now() - interval '7 hours');

select lives_ok($$select public.enqueue_stale_schedule_reconciliation(200)$$, 'repair pass runs');
select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile' and status = 'pending'
    and source_id in ('00000000-0000-4000-8000-00000000ce20', '00000000-0000-4000-8000-00000000ce21')), 0,
  'repair pass skips ended one-off sessions and ended series');
select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile' and status = 'pending'
    and source_id = '00000000-0000-4000-8000-00000000ce22'), 0,
  'repair pass skips a schedule reconciled inside the 6-hour cooldown');
select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile' and status = 'pending'
    and source_id = '00000000-0000-4000-8000-00000000ce23'), 1,
  'repair pass re-enqueues a stale schedule once the cooldown has expired');
select is((select count(*)::integer from public.event_pipeline_jobs
  where job_kind = 'reminder.reconcile' and status = 'pending'
    and source_id = '00000000-0000-4000-8000-00000000ce24'), 1,
  'repair pass still recovers a session that ended inside the 3-day look-back');

-- Cron registration is part of the deployment contract, including fresh projects.
select public.configure_edge_function_cron('https://schedule-recon-test.invalid');
select ok(exists (
  select 1 from cron.job where jobname = 'edge-function-schedule-reconciliation-dispatch'
    and active and schedule = '* * * * *'
    and strpos(command, 'https://schedule-recon-test.invalid/functions/v1/schedule-reconciliation-dispatch') > 0
), 'schedule-reconciliation cron targets this project every minute');

select * from finish();
rollback;
