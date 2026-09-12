-- One-off, idempotent backfill: give every recurring class_schedule's own
-- anchor occurrence (start_at/end_at — the "first session" of the series) a
-- class_session_completions row when the series' reminder-job history never
-- covered it.
--
-- Why this is needed: 20260907090000_backfill_september_session_completions.sql
-- reconstructs recurring occurrences from `reminder_jobs` rows of type
-- 'session.completion_check', since there is no way to run RRULE expansion in
-- SQL. Those job rows are only ever created by
-- RemindersService#compileLearningSpaceReminderJobsForOrg
-- (apps/api/src/modules/reminders/reminders.service.ts), which expands
-- occurrences in a rolling window of [now - 24h, now + REMINDER_HORIZON_DAYS]
-- at the moment it runs. A recurring schedule's anchor occurrence
-- (class_schedules.start_at) is commonly already in the past the first time
-- compile ever runs for that schedule — e.g. the series represents a class
-- that had already started meeting when it was entered into the system, or
-- compile was delayed. Once the anchor falls outside that -24h floor, no
-- completion-check job is EVER queued for it, because the window only slides
-- forward from "now" and never looks back to repair the gap. That leaves the
-- first session of the series with no reminder_jobs trail at all, so the
-- September reconstruction (and any future one like it) has nothing to find
-- it by, and it stays permanently missing from class_session_completions —
-- and therefore from the admin completed-sessions table and every metric
-- derived from it — regardless of month.
--
-- This inserts the missing anchor occurrence directly from class_schedules,
-- the same way Path 1 of 20260907090000 already does for one-off (non-
-- recurring) sessions — no reminder_jobs dependency needed, since the
-- anchor's own start_at/end_at live on the schedule row itself.
--
-- Scope guards:
--   * Only schedules that HAVE a recurrence row — the complement of Path 1's
--     one-off sessions, which are already covered by the September migration.
--   * Only anchor occurrences that have already ended (end_at < now()) — a
--     future first occurrence will still get a completion-check job queued
--     normally as the rolling window reaches it.
--   * Skipped if the anchor date itself was cancelled via a recurrence
--     exception (class_schedule_recurrence_exceptions) — that session never
--     happened.
--   * Skipped if a class_session_completions row already exists for this
--     (schedule_id, occurrence_key) — a human already recorded it, or an
--     earlier backfill did.
--   * status is 'auto_confirmed', not 'confirmed' — same discipline as every
--     other backfill migration: the system is asserting the session
--     happened, no human confirmed it.
--   * confirmed_at / resolved_at are set to the session's own end_at, NEVER
--     now(), so the backfilled row does not masquerade as "just resolved"
--     and flood the 3-day carousel/inbox window.
--   * Bounded to September 2026 (session_end_at), matching the scope actually
--     requested — the underlying gap isn't month-specific (it can affect any
--     recurring schedule's anchor occurrence regardless of when the schedule
--     was created), but this backfill only touches September.

insert into public.class_session_completions (
  org_id, schedule_id, occurrence_key, profile_id, role,
  status, channel_id, learning_space_id, session_title, session_end_at,
  confirmed_at, resolved_at, expires_at, created_at, updated_at
)
select
  cs.org_id,
  cs.id,
  cs.start_at,
  csp.profile_id,
  csp.role,
  'auto_confirmed'::public.class_session_completion_status,
  cs.source_channel_id,
  cs.source_learning_space_id,
  cs.title,
  cs.end_at,
  cs.end_at,
  cs.end_at,
  cs.end_at + interval '3 days',
  now(),
  now()
from public.class_schedules cs
join public.class_schedule_recurrence csr
  on csr.org_id = cs.org_id
 and csr.schedule_id = cs.id
 and csr.deleted_at is null
join public.class_schedule_participants csp
  on csp.org_id = cs.org_id
 and csp.schedule_id = cs.id
 and csp.deleted_at is null
 and csp.profile_id is not null
where cs.deleted_at is null
  and cs.source_kind = 'class_session'
  and cs.status <> 'cancelled'
  and cs.end_at < now()
  and cs.end_at >= (timestamp '2026-09-01 00:00:00' at time zone coalesce(cs.timezone, 'UTC'))
  and cs.end_at <  (timestamp '2026-10-01 00:00:00' at time zone coalesce(cs.timezone, 'UTC'))
  and not exists (
    select 1
      from public.class_schedule_recurrence_exceptions cse
     where cse.recurrence_id = csr.id
       and cse.deleted_at is null
       and cse.occurrence_key = cs.start_at
  )
  and not exists (
    select 1
      from public.class_session_completions x
     where x.org_id = cs.org_id
       and x.schedule_id = cs.id
       and x.occurrence_key = cs.start_at
  )
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;
