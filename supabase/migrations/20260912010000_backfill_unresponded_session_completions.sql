-- One-off, idempotent backfill: create the missing class_session_completions
-- rows for every session whose completion-check was actually sent
-- (reminder_jobs.status = 'succeeded' for job_type = 'session.completion_check')
-- but which never got a row, because nobody ever confirmed/disputed/rated it.
--
-- Root cause (confirmed against production data, not guessed):
-- `class_session_completions` (20260905000000_class_session_completions.sql) is
-- a NEW table, live only since 2026-09-05. Before that date, "sending a
-- completion check" meant publishing a notification only — no placeholder row
-- was ever created up front; a row only ever appeared in the deprecated
-- class_session_completion_votes / class_session_feedback tables once a
-- participant actually confirmed, disputed, or rated. Those two tables have
-- since been dropped entirely (their deprecation comments said "scheduled for
-- removal once class_session_completions has run with no issues for 2 weeks",
-- and that has since happened), so a pre-2026-09-05 session nobody ever acted
-- on now has ZERO trace in any live table — except the reminder_jobs row
-- itself, which still carries occurrence_start_at, the full recipient list
-- (payload.members), title, channel/learning-space, and end time.
--
-- 20260907090000_backfill_september_session_completions.sql and
-- 20260912000000_backfill_recurring_anchor_session_completions.sql already
-- reconstruct rows from reminder_jobs / class_schedules for narrower slices of
-- this same gap (September only; recurring anchors only). This migration is
-- the general case: every succeeded completion-check job, any month, whether
-- or not its schedule still exists.
--
-- Trustworthiness of `status = 'succeeded'`: dispatchCompletionCheck
-- (apps/api/src/modules/reminders/completion-check-dispatcher.service.ts)
-- re-resolves the occurrence's live cancel/reschedule state immediately before
-- dispatching and returns a non-'sent' result if it was cancelled — and
-- reminders.service.ts (apps/api/.../reminders.service.ts) only ever writes
-- job status 'succeeded' when that result was 'sent'. So a 'succeeded' row is
-- exactly the model's own assertion "this occurrence was live and its
-- completion-check went out" — the same trust basis the September migration
-- already relies on for its own reminder_jobs reconstruction.
--
-- Verified counts before writing this (production, read-only queries): 489
-- succeeded completion-check jobs total; only 43 already have a matching
-- completion row (38 of those from jobs dispatched >= 2026-09-05, under the
-- current eager-upsert dispatcher; 5 from the September backfill migrations).
-- 441 of the 447 missing are from before 2026-09-05.
--
-- Scope: class_session_completions.schedule_id is a NOT NULL foreign key to
-- class_schedules(id) with no cascade, so a row can only be inserted for a
-- schedule that still exists. Of the 447 missing occurrences, 351 belong to a
-- schedule that was hard-deleted (the pre-09681b58 delete-and-recreate edit
-- pattern) and CANNOT be backfilled without either relaxing that constraint or
-- fabricating a placeholder schedule row — deliberately left alone here rather
-- than making that schema/data-integrity call unilaterally. This migration
-- only inserts for the 96 occurrences (308 participant-rows) whose schedule is
-- still present, joining class_schedules to let the foreign key do the
-- filtering rather than duplicating its existence check by hand.
--
-- Per-participant, not per-occurrence: unlike the September migration's
-- Path 2, this does not skip an occurrence just because SOME participant
-- already has a row (e.g. the teacher confirmed, so a vote-table row already
-- migrated) — it fills in whichever specific (schedule, occurrence, profile)
-- combinations are still missing, via the same unique constraint the live
-- dispatcher itself upserts against.
--
-- Same discipline as every prior backfill in this family:
--   * status is 'auto_confirmed', not 'confirmed' — asserting the session
--     happened, not that a human confirmed it.
--   * confirmed_at / resolved_at are the session's own end time, NEVER now(),
--     so backfilled rows do not masquerade as "just resolved" and flood the
--     3-day carousel/inbox window.
--   * on conflict do nothing — safe to run more than once.

insert into public.class_session_completions (
  org_id, schedule_id, occurrence_key, profile_id, role,
  status, channel_id, learning_space_id, session_title, session_end_at,
  confirmed_at, resolved_at, expires_at, created_at, updated_at
)
select distinct on (
  rj.org_id, resolved_schedule.effective_schedule_id, rj.occurrence_start_at,
  member->>'profileId'
)
  rj.org_id,
  resolved_schedule.effective_schedule_id,
  rj.occurrence_start_at,
  (member->>'profileId')::uuid,
  coalesce(member->>'role', 'observer')::public.class_schedule_participant_role,
  'auto_confirmed'::public.class_session_completion_status,
  nullif(rj.payload->>'channelId', '')::uuid,
  nullif(rj.payload->>'learningSpaceId', '')::uuid,
  rj.payload->>'title',
  session_end.at,
  session_end.at,
  session_end.at,
  session_end.at + interval '3 days',
  now(),
  now()
from public.reminder_jobs rj
cross join lateral (
  select coalesce(rj.source_schedule_id, (rj.payload->>'scheduleId')::uuid) as id
) resolved_schedule(effective_schedule_id)
join public.class_schedules cs on cs.id = resolved_schedule.effective_schedule_id
cross join lateral (
  select coalesce(
    nullif(rj.payload->>'endAt', '')::timestamptz,
    rj.occurrence_start_at
  ) as at
) session_end
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(rj.payload->'members') = 'array' then rj.payload->'members'
    else '[]'::jsonb
  end
) as member
where rj.deleted_at is null
  and rj.job_type = 'session.completion_check'
  and rj.status = 'succeeded'
  and rj.occurrence_start_at is not null
  and rj.occurrence_start_at < now()
  and resolved_schedule.effective_schedule_id is not null
  and member->>'profileId' is not null
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;
