-- Auto-close stale inbox notifications and unanswered session completion checks.
-- This is intentionally idempotent so the per-minute reminder dispatcher can run it safely.

alter table public.class_session_completion_votes
  add column if not exists system_marked_completed_at timestamptz,
  add column if not exists system_marked_completed_reason text;

alter table public.class_schedules
  add column if not exists system_marked_completed_at timestamptz,
  add column if not exists system_marked_completed_reason text;

create or replace function public.run_stale_activity_cleanup(
  p_now timestamptz default now(),
  p_age interval default interval '7 days'
)
returns table (
  notifications_marked_read integer,
  completion_votes_marked_completed integer,
  sessions_marked_completed integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := p_now - p_age;
  v_notifications integer := 0;
  v_votes integer := 0;
  v_sessions integer := 0;
begin
  if p_age <= interval '0 seconds' then
    raise exception 'p_age must be positive';
  end if;

  with marked as (
    update public.activity_feed_items afi
       set is_read = true,
           read_at = p_now,
           updated_at = p_now,
           metadata = coalesce(afi.metadata, '{}'::jsonb) || jsonb_build_object(
             'systemMarkedRead',
             jsonb_build_object(
               'at', p_now,
               'reason', 'older_than_7_days',
               'cutoff', v_cutoff
             )
           )
     where afi.deleted_at is null
       and afi.is_read is distinct from true
       and afi.read_at is null
       and afi.occurred_at < v_cutoff
    returning 1
  )
  select count(*)::integer into v_notifications from marked;

  with candidate_sessions as (
    select cs.id,
           cs.org_id,
           cs.start_at as occurrence_key
      from public.class_schedules cs
     where cs.deleted_at is null
       and cs.source_kind = 'class_session'
       and cs.status not in ('cancelled', 'rescheduled')
       and cs.end_at < v_cutoff
       and not exists (
         select 1
           from public.class_schedule_recurrence csr
          where csr.org_id = cs.org_id
            and csr.schedule_id = cs.id
            and csr.deleted_at is null
       )
       and not exists (
         select 1
           from public.class_session_completion_votes disputed
          where disputed.org_id = cs.org_id
            and disputed.schedule_id = cs.id
            and disputed.occurrence_key = cs.start_at
            and disputed.status = 'disputed'
            and disputed.deleted_at is null
       )
  ),
  missing_votes as (
    select candidate_sessions.org_id,
           candidate_sessions.id as schedule_id,
           candidate_sessions.occurrence_key,
           csp.profile_id,
           csp.role::text as role
      from candidate_sessions
      join public.class_schedule_participants csp
        on csp.org_id = candidate_sessions.org_id
       and csp.schedule_id = candidate_sessions.id
       and csp.deleted_at is null
       and csp.profile_id is not null
       and csp.role in ('educator', 'child', 'guardian', 'staff', 'observer')
     where not exists (
       select 1
         from public.class_session_completion_votes existing
        where existing.org_id = candidate_sessions.org_id
          and existing.schedule_id = candidate_sessions.id
          and existing.occurrence_key = candidate_sessions.occurrence_key
          and existing.profile_id = csp.profile_id
          and existing.deleted_at is null
     )
  ),
  upserted as (
    insert into public.class_session_completion_votes (
      org_id,
      schedule_id,
      occurrence_key,
      profile_id,
      role,
      status,
      dispute_category,
      dispute_reason,
      reschedule_requested,
      voted_at,
      created_at,
      updated_at,
      system_marked_completed_at,
      system_marked_completed_reason,
      deleted_at,
      deleted_by
    )
    select org_id,
           schedule_id,
           occurrence_key,
           profile_id,
           role,
           'confirmed',
           null,
           null,
           false,
           p_now,
           p_now,
           p_now,
           p_now,
           'system_auto_confirmed_no_response_after_7_days',
           null,
           null
      from missing_votes
    on conflict (org_id, schedule_id, occurrence_key, profile_id)
    do update
          set status = 'confirmed',
              dispute_category = null,
              dispute_reason = null,
              reschedule_requested = false,
              voted_at = excluded.voted_at,
              updated_at = excluded.updated_at,
              system_marked_completed_at = excluded.system_marked_completed_at,
              system_marked_completed_reason = excluded.system_marked_completed_reason,
              deleted_at = null,
              deleted_by = null
        where public.class_session_completion_votes.deleted_at is not null
    returning 1
  )
  select count(*)::integer into v_votes from upserted;

  with completed as (
    update public.class_schedules cs
       set status = 'completed',
           updated_at = p_now,
           system_marked_completed_at = p_now,
           system_marked_completed_reason = 'system_auto_completed_no_response_after_7_days'
     where cs.deleted_at is null
       and cs.source_kind = 'class_session'
       and cs.status = 'scheduled'
       and cs.end_at < v_cutoff
       and not exists (
         select 1
           from public.class_schedule_recurrence csr
          where csr.org_id = cs.org_id
            and csr.schedule_id = cs.id
            and csr.deleted_at is null
       )
       and not exists (
         select 1
           from public.class_session_completion_votes disputed
          where disputed.org_id = cs.org_id
            and disputed.schedule_id = cs.id
            and disputed.occurrence_key = cs.start_at
            and disputed.status = 'disputed'
            and disputed.deleted_at is null
       )
    returning 1
  )
  select count(*)::integer into v_sessions from completed;

  return query select v_notifications, v_votes, v_sessions;
end;
$$;
