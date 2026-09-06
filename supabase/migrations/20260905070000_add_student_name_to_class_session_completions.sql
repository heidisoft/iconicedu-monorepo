-- Denormalized student/child name(s) for the session this completion belongs to,
-- so the homepage tile and notifications inbox can show "who" without an extra
-- join. Populated by the dispatcher at row-creation time from the same
-- ReminderJobPayload.members list already used to build the notification —
-- multiple children (a group class) are joined with ", ".
--
-- Scoping is intentional: for a guardian's row, this is ONLY their own linked
-- child(ren) among the session's participants, never other families' children in
-- the same group class (a guardian must never see another family's child's name
-- via this column). For an educator/staff row, it's every child in the session
-- (their own class roster). Existing rows are left null — there is no reliable
-- way to reconstruct this after the fact from the old, already-fragmented tables.
alter table public.class_session_completions
  add column if not exists student_name text;

drop function if exists public.list_class_session_completions_for_profile(uuid, uuid, integer, timestamptz, uuid);

create function public.list_class_session_completions_for_profile(
  p_org_id uuid,
  p_profile_id uuid,
  p_limit integer default 20,
  p_cursor_order_key timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  org_id uuid,
  schedule_id uuid,
  occurrence_key timestamptz,
  profile_id uuid,
  role public.class_schedule_participant_role,
  status public.class_session_completion_status,
  dispute_category text,
  dispute_reason text,
  reschedule_requested boolean,
  rating smallint,
  rating_comment text,
  channel_id uuid,
  learning_space_id uuid,
  session_title text,
  student_name text,
  session_end_at timestamptz,
  notified_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  rated_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  order_key timestamptz
)
language sql
stable
set search_path = public
as $$
  with combined as (
    select c.id, c.org_id, c.schedule_id, c.occurrence_key, c.profile_id, c.role,
           c.status, c.dispute_category, c.dispute_reason, c.reschedule_requested,
           c.rating, c.rating_comment, c.channel_id, c.learning_space_id,
           c.session_title, c.student_name, c.session_end_at, c.notified_at,
           c.confirmed_at, c.disputed_at, c.rated_at, c.resolved_at, c.expires_at,
           c.session_end_at as order_key
      from public.class_session_completions c
     where c.org_id = p_org_id
       and c.profile_id = p_profile_id
       and c.deleted_at is null
       and c.status = 'pending'
    union all
    select c.id, c.org_id, c.schedule_id, c.occurrence_key, c.profile_id, c.role,
           c.status, c.dispute_category, c.dispute_reason, c.reschedule_requested,
           c.rating, c.rating_comment, c.channel_id, c.learning_space_id,
           c.session_title, c.student_name, c.session_end_at, c.notified_at,
           c.confirmed_at, c.disputed_at, c.rated_at, c.resolved_at, c.expires_at,
           c.resolved_at as order_key
      from public.class_session_completions c
     where c.org_id = p_org_id
       and c.profile_id = p_profile_id
       and c.deleted_at is null
       and c.resolved_at is not null
       and c.resolved_at > now() - interval '3 days'
  )
  select combined.id, combined.org_id, combined.schedule_id, combined.occurrence_key,
         combined.profile_id, combined.role, combined.status, combined.dispute_category,
         combined.dispute_reason, combined.reschedule_requested, combined.rating,
         combined.rating_comment, combined.channel_id, combined.learning_space_id,
         combined.session_title, combined.student_name, combined.session_end_at,
         combined.notified_at, combined.confirmed_at, combined.disputed_at,
         combined.rated_at, combined.resolved_at, combined.expires_at, combined.order_key
    from combined
   where p_cursor_order_key is null
      or (combined.order_key, combined.id) < (p_cursor_order_key, p_cursor_id)
   order by combined.order_key desc, combined.id desc
   limit greatest(p_limit, 0);
$$;

revoke execute on function public.list_class_session_completions_for_profile(uuid, uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.list_class_session_completions_for_profile(uuid, uuid, integer, timestamptz, uuid)
  to service_role;

notify pgrst, 'reload schema';
