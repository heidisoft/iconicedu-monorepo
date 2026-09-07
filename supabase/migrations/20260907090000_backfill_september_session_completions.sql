-- One-off, idempotent backfill: give the org-wide "Sessions completed" tile
-- (getOrgCompletionSummary in apps/api/src/modules/session-completions/
-- session-completions.service.ts) its September numbers for classroom occurrences
-- that never got a class_session_completions row at all.
--
-- Why this is needed: rows in that table are created ONLY by the completion-check
-- dispatcher (CompletionCheckDispatcherService.upsertSessionCompletion), as
-- 'pending', and are then resolved by an explicit participant action. Since
-- 20260905080000_remove_session_completion_auto_confirm.sql there is no longer any
-- path that resolves an occurrence the dispatcher missed entirely — so a September
-- session whose completion_check job never ran (or ran before the row-creating
-- code shipped) has no row, and the tile can never count it. The post-dispatch
-- reconciliation (reconcileRecentCompletionChecks) can't help either: it has a
-- hard 3-day dispatched_at cutoff.
--
-- Scope guards:
--   * Only occurrences with NO existing completion row are touched. An occurrence
--     that already has a 'pending' / 'disputed' / 'confirmed' row is a different
--     situation (a human still needs to act, or already did) and is left alone.
--   * status is 'auto_confirmed', not 'confirmed' — the system is asserting the
--     session happened, no human confirmed it. The tile counts both identically
--     (`status in ('confirmed','auto_confirmed')`), so this is enough to make the
--     occurrence count.
--   * confirmed_at / resolved_at are set to the session's own end time, NEVER
--     now() — same discipline as 20260905020000_backfill_class_session_completions
--     .sql: a backfilled row must not look "just resolved" and flood the 3-day
--     carousel/inbox window at deploy.
--
-- "September" is bounded per occurrence in that occurrence's own timezone
-- (class_schedules.timezone / reminder_jobs.timezone, falling back to UTC), which
-- matches how sessions are bucketed elsewhere (getOccurrenceDayKey in
-- packages/ui-web/.../messages-schedule-tab.utils.ts). The dashboard tile actually
-- uses the *viewer's* timezone, so an occurrence ending within a few hours of the
-- Sep 1 / Oct 1 boundary may sit just outside a given viewer's window — an
-- acceptable edge effect for a metric backfill.

-- --------------------------------------------------------------------------------
-- Path 1: one-off sessions (no recurrence row). occurrence_key is the schedule's
-- own start_at; participants come straight from class_schedule_participants.
-- --------------------------------------------------------------------------------
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
      from public.class_schedule_recurrence csr
     where csr.org_id = cs.org_id
       and csr.schedule_id = cs.id
       and csr.deleted_at is null
  )
  and not exists (
    select 1
      from public.class_session_completions x
     where x.org_id = cs.org_id
       and x.schedule_id = cs.id
       and x.occurrence_key = cs.start_at
  )
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;

-- --------------------------------------------------------------------------------
-- Path 2: recurring occurrences. There is no way to enumerate a recurrence's
-- occurrence_keys in SQL (that needs RRULE expansion, which lives in the reminders
-- service), so reconstruct them from the completion-check reminder jobs that were
-- queued for September. Each such job carries the occurrence_start_at the
-- dispatcher would have used as occurrence_key, plus payload.members — the same
-- list the dispatcher iterates.
--
-- Only 'succeeded' jobs are used: a job that never dispatched has no basis for
-- asserting the session happened. Guardians resolved dynamically via family_links
-- at dispatch time are NOT in payload.members and so won't get a row here — but
-- the tile collapses by occurrence, so one educator/child row is enough to count
-- it; the missing guardian row only affects that guardian's personal carousel,
-- which the 3-day window has long since dropped anyway.
-- --------------------------------------------------------------------------------
insert into public.class_session_completions (
  org_id, schedule_id, occurrence_key, profile_id, role,
  status, channel_id, learning_space_id, session_title, session_end_at,
  confirmed_at, resolved_at, expires_at, created_at, updated_at
)
select distinct on (rj.org_id, rj.source_schedule_id, rj.occurrence_start_at, member->>'profileId')
  rj.org_id,
  rj.source_schedule_id,
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
join public.class_schedules cs
  on cs.id = rj.source_schedule_id
 and cs.org_id = rj.org_id
 and cs.deleted_at is null
 and cs.status <> 'cancelled'
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
  and rj.source_schedule_id is not null
  and rj.occurrence_start_at is not null
  and member->>'profileId' is not null
  and session_end.at < now()
  and session_end.at >= (timestamp '2026-09-01 00:00:00' at time zone coalesce(rj.timezone, 'UTC'))
  and session_end.at <  (timestamp '2026-10-01 00:00:00' at time zone coalesce(rj.timezone, 'UTC'))
  and not exists (
    select 1
      from public.class_session_completions x
     where x.org_id = rj.org_id
       and x.schedule_id = rj.source_schedule_id
       and x.occurrence_key = rj.occurrence_start_at
  )
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;
