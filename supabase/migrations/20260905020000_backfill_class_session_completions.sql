-- One-time, idempotent backfill of class_session_completions from the two
-- tables it consolidates: class_session_completion_votes (confirm/dispute)
-- and class_session_feedback (rating).
--
-- Every historical timestamp below (confirmed_at/disputed_at/resolved_at/rated_at)
-- is copied from its source row's own timestamp (voted_at / submitted_at) —
-- NEVER left as or defaulted to this migration's own run time. The carousel/inbox
-- visibility predicate is `status='pending' OR resolved_at > now() - interval '3
-- days'`; a backfilled row whose resolved_at defaulted to "now" would look
-- "just resolved" regardless of how old the underlying session actually is,
-- flooding the carousel and inbox for every user at cutover.

-- Step 1: one row per existing vote. confirmed_at/disputed_at/resolved_at all
-- come from the vote's own voted_at.
insert into public.class_session_completions (
  org_id, schedule_id, occurrence_key, profile_id, role,
  status, dispute_category, dispute_reason, reschedule_requested,
  channel_id, learning_space_id, session_title, session_end_at,
  confirmed_at, disputed_at, resolved_at, expires_at,
  created_at, created_by, updated_at, updated_by
)
select
  v.org_id, v.schedule_id, v.occurrence_key, v.profile_id,
  v.role::public.class_schedule_participant_role,
  v.status::public.class_session_completion_status,
  v.dispute_category, v.dispute_reason, v.reschedule_requested,
  cs.source_channel_id, cs.source_learning_space_id, cs.title, cs.end_at,
  case when v.status = 'confirmed' then v.voted_at else null end,
  case when v.status = 'disputed' then v.voted_at else null end,
  v.voted_at,
  cs.end_at + interval '3 days',
  v.created_at, v.created_by, v.updated_at, v.updated_by
from public.class_session_completion_votes v
join public.class_schedules cs on cs.id = v.schedule_id
where v.deleted_at is null
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;

-- Step 2: merge rating fields from feedback onto the row backfilled in step 1,
-- where one exists. rated_at comes from the feedback row's own submitted_at.
-- resolved_at is deliberately left untouched — a rating is a follow-on action
-- to an already-resolved confirm/dispute, not itself a fresh resolution.
update public.class_session_completions csc
   set rating = f.rating,
       rating_comment = f.comment,
       rated_at = f.submitted_at,
       updated_at = greatest(csc.updated_at, f.updated_at)
  from public.class_session_feedback f
 where f.deleted_at is null
   and f.org_id = csc.org_id
   and f.recipient_profile_id = csc.profile_id
   and f.class_session_id = csc.schedule_id
   and csc.rating is null;

-- Step 3: synthetic auto_confirmed rows for feedback with no matching vote
-- (can happen today since the two tables are only loosely coupled). resolved_at
-- is explicitly an APPROXIMATION here, not reconstructed history: the old system
-- never recorded when auto-confirmation actually happened for these orphaned-
-- feedback cases, so the feedback's own submitted_at (the closest available
-- signal) stands in for it. This is the one place backfilled resolved_at is
-- fabricated rather than copied verbatim from a matching action's timestamp.
insert into public.class_session_completions (
  org_id, schedule_id, occurrence_key, profile_id, role,
  status, channel_id, learning_space_id, session_title, session_end_at,
  rating, rating_comment, rated_at, resolved_at, expires_at,
  created_at, updated_at
)
select
  f.org_id, f.class_session_id,
  coalesce(f.occurrence_start_at, cs.start_at),
  f.recipient_profile_id,
  csp.role,
  'auto_confirmed'::public.class_session_completion_status,
  cs.source_channel_id, cs.source_learning_space_id, cs.title, cs.end_at,
  f.rating, f.comment, f.submitted_at, f.submitted_at,
  cs.end_at + interval '3 days',
  f.created_at, f.updated_at
from public.class_session_feedback f
join public.class_schedules cs on cs.id = f.class_session_id
join public.class_schedule_participants csp
  on csp.org_id = f.org_id
 and csp.schedule_id = f.class_session_id
 and csp.profile_id = f.recipient_profile_id
 and csp.deleted_at is null
where f.deleted_at is null
  and not exists (
    select 1 from public.class_session_completion_votes v
     where v.deleted_at is null
       and v.org_id = f.org_id
       and v.schedule_id = f.class_session_id
       and v.profile_id = f.recipient_profile_id
  )
on conflict (org_id, schedule_id, occurrence_key, profile_id) do nothing;

comment on table public.class_session_completions is
  'Consolidated session-completion state (confirm/dispute/rate), single source of truth '
  'replacing class_session_completion_votes + class_session_feedback. Rows backfilled by '
  '20260905020000_backfill_class_session_completions.sql have historical timestamps copied '
  'from their source rows, except: synthetic auto_confirmed rows created for orphaned feedback '
  '(no matching vote) have an APPROXIMATED resolved_at (the feedback''s submitted_at, not a '
  'true historical auto-confirm moment, which the old system never recorded).';

comment on table public.class_session_completion_votes is
  'DEPRECATED — superseded by class_session_completions. Read-only historical reference during '
  'the bake period; scheduled for removal once class_session_completions has run in production '
  'with no data-integrity issues for at least 2 weeks.';

comment on table public.class_session_feedback is
  'DEPRECATED — superseded by class_session_completions. Read-only historical reference during '
  'the bake period; scheduled for removal once class_session_completions has run in production '
  'with no data-integrity issues for at least 2 weeks.';
