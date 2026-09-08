-- One-off, idempotent companion to 20260907090000_backfill_september_session_
-- completions.sql. That migration only *inserted* rows for September occurrences
-- with zero footprint in class_session_completions; it deliberately skipped any
-- occurrence that already had a row. This one handles the other bucket: September
-- occurrences whose only rows are still 'pending' — the dispatcher created them,
-- but no participant ever confirmed, and since 20260905080000_remove_session_
-- completion_auto_confirm.sql nothing flips them anymore. They never reach the
-- org-wide "Sessions completed" tile (getOrgCompletionSummary counts only
-- 'confirmed' / 'auto_confirmed').
--
-- This asserts, for a bounded historical window only, that a September session
-- whose end time has passed did happen. confirmed_at / resolved_at are set to the
-- session's own end time, NEVER now(), so the flipped rows do not masquerade as
-- "just resolved" in the 3-day carousel/inbox window.
--
-- Only occurrences whose active rows are ALL still 'pending' are touched. If any
-- sibling row for the same occurrence is already 'disputed', 'confirmed' or
-- 'auto_confirmed', a human (or an earlier backfill) has already settled that
-- occurrence — flipping the remaining pending rows would either resurrect a
-- disputed session as "completed" or record non-responders as auto-confirmers.
-- Those occurrences are left entirely alone.
--
-- Window is per occurrence, in that occurrence's own timezone
-- (class_schedules.timezone, fallback UTC), and past-only (session_end_at < now()).

update public.class_session_completions csc
   set status       = 'auto_confirmed',
       confirmed_at  = coalesce(csc.confirmed_at, csc.session_end_at),
       resolved_at   = coalesce(csc.resolved_at, csc.session_end_at),
       updated_at    = now()
  from public.class_schedules cs
 where cs.id = csc.schedule_id
   and cs.org_id = csc.org_id
   and csc.deleted_at is null
   and csc.status = 'pending'
   and csc.session_end_at < now()
   and csc.session_end_at >= (timestamp '2026-09-01 00:00:00' at time zone coalesce(cs.timezone, 'UTC'))
   and csc.session_end_at <  (timestamp '2026-10-01 00:00:00' at time zone coalesce(cs.timezone, 'UTC'))
   and not exists (
     select 1
       from public.class_session_completions sibling
      where sibling.org_id        = csc.org_id
        and sibling.schedule_id   = csc.schedule_id
        and sibling.occurrence_key = csc.occurrence_key
        and sibling.id           <> csc.id
        and sibling.deleted_at is null
        and sibling.status       <> 'pending'
   );
