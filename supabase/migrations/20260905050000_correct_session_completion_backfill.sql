-- Correct the additive backfill for recurring schedules. The legacy feedback
-- table stores at most one response per (org, profile, schedule), while completion
-- votes can contain many occurrences. Therefore a rating belongs only on the row
-- whose occurrence_key matches occurrence_start_at (or the base schedule start when
-- the legacy value is absent), never on every completion for that schedule.

update public.class_session_completions csc
   set rating = null,
       rating_comment = null,
       rated_at = null
 where csc.rating is not null
   and exists (
     select 1
       from public.class_session_feedback f
      where f.deleted_at is null
        and f.org_id = csc.org_id
        and f.recipient_profile_id = csc.profile_id
        and f.class_session_id = csc.schedule_id
   )
   and not exists (
     select 1
       from public.class_session_feedback f
       join public.class_schedules cs on cs.id = f.class_session_id
      where f.deleted_at is null
        and f.org_id = csc.org_id
        and f.recipient_profile_id = csc.profile_id
        and f.class_session_id = csc.schedule_id
        and coalesce(f.occurrence_start_at, cs.start_at) = csc.occurrence_key
   );

update public.class_session_completions csc
   set rating = f.rating,
       rating_comment = f.comment,
       rated_at = f.submitted_at,
       updated_at = greatest(csc.updated_at, f.updated_at)
  from public.class_session_feedback f
  join public.class_schedules cs on cs.id = f.class_session_id
 where f.deleted_at is null
   and f.org_id = csc.org_id
   and f.recipient_profile_id = csc.profile_id
   and f.class_session_id = csc.schedule_id
   and coalesce(f.occurrence_start_at, cs.start_at) = csc.occurrence_key;

-- The original orphan-feedback insert required a schedule-participant row. Linked
-- guardians are valid recipients but are commonly not direct schedule participants;
-- derive their role from profiles when no participant row is present.
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
  coalesce(
    csp.role,
    case p.kind
      when 'educator' then 'educator'::public.class_schedule_participant_role
      when 'child' then 'child'::public.class_schedule_participant_role
      when 'guardian' then 'guardian'::public.class_schedule_participant_role
      when 'staff' then 'staff'::public.class_schedule_participant_role
      else 'observer'::public.class_schedule_participant_role
    end
  ),
  'auto_confirmed'::public.class_session_completion_status,
  cs.source_channel_id, cs.source_learning_space_id, cs.title, cs.end_at,
  f.rating, f.comment, f.submitted_at, f.submitted_at,
  cs.end_at + interval '3 days',
  f.created_at, f.updated_at
from public.class_session_feedback f
join public.class_schedules cs on cs.id = f.class_session_id
join public.profiles p on p.id = f.recipient_profile_id
left join public.class_schedule_participants csp
  on csp.org_id = f.org_id
 and csp.schedule_id = f.class_session_id
 and csp.profile_id = f.recipient_profile_id
 and csp.deleted_at is null
where f.deleted_at is null
on conflict (org_id, schedule_id, occurrence_key, profile_id) do update
  set rating = excluded.rating,
      rating_comment = excluded.rating_comment,
      rated_at = excluded.rated_at,
      updated_at = greatest(
        public.class_session_completions.updated_at,
        excluded.updated_at
      );
