-- Backs the "This and following events" reschedule scope (Google-Calendar-style
-- edit modal for recurring classes): splits a recurring class_schedules series
-- into two at a given point, in one transaction.
--
-- Every other write in schedules.service.ts is a sequence of unwrapped Supabase
-- calls (tolerable there because each touches a single row and self-heals via
-- the async reminder-reconcile trigger queue on partial failure). A series split
-- touches two schedules across four tables, and a crash midway would leave a
-- truncated old series with no new series to replace it — classes silently
-- disappearing from the calendar, with no clean retry (resubmitting would
-- re-truncate an already-truncated series). This function exists to make that
-- atomic instead.
--
-- The caller (SchedulesService.splitRecurringSeries) is responsible for:
--   - computing p_old_until as a valid instant on the correct LOCAL calendar day
--     in the OLD schedule's own timezone (never the new one, even if the split
--     also changes timezone) — see schedule-expansion.util.ts's until/local-date
--     comparison semantics;
--   - partitioning the old recurrence's current exceptions/overrides into the
--     "kept" set (local date before the split) it passes here — this function
--     does not do that partitioning itself, it only applies the set it's given.
create or replace function public.split_class_schedule_recurrence(
  p_org_id uuid,
  p_schedule_id uuid,
  p_old_until timestamptz,
  p_kept_exceptions jsonb,
  p_kept_overrides jsonb,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz,
  p_new_timezone text,
  p_new_byday public.rrule_byday[],
  p_actor_profile_id uuid,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_schedule public.class_schedules%rowtype;
  v_old_recurrence public.class_schedule_recurrence%rowtype;
  v_original_until timestamptz;
  v_new_schedule_id uuid := gen_random_uuid();
  v_new_recurrence_id uuid := gen_random_uuid();
begin
  select * into v_old_schedule
    from public.class_schedules
   where id = p_schedule_id
     and org_id = p_org_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'class_schedules row % not found for org %', p_schedule_id, p_org_id;
  end if;

  select * into v_old_recurrence
    from public.class_schedule_recurrence
   where schedule_id = p_schedule_id
     and org_id = p_org_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'schedule % has no active recurrence to split', p_schedule_id;
  end if;

  v_original_until := v_old_recurrence.until;

  -- Truncate the old series.
  update public.class_schedule_recurrence
     set until = p_old_until,
         updated_at = p_now,
         updated_by = p_actor_profile_id
   where id = v_old_recurrence.id;

  -- Wholesale-replace the old recurrence's exceptions/overrides with the kept
  -- set (mirrors replaceRecurrenceExceptionsAndOverrides's delete-then-reinsert
  -- strategy — safe since nothing outside these two tables references their ids).
  delete from public.class_schedule_recurrence_exceptions
   where recurrence_id = v_old_recurrence.id
     and org_id = p_org_id;

  insert into public.class_schedule_recurrence_exceptions (
    id, org_id, recurrence_id, occurrence_key, reason, suppress_notifications,
    created_at, created_by, updated_at, updated_by
  )
  select
    gen_random_uuid(), p_org_id, v_old_recurrence.id,
    (e->>'occurrenceKey')::timestamptz, e->>'reason',
    coalesce((e->>'suppressNotifications')::boolean, false),
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  from jsonb_array_elements(coalesce(p_kept_exceptions, '[]'::jsonb)) as e;

  delete from public.class_schedule_recurrence_overrides
   where recurrence_id = v_old_recurrence.id
     and org_id = p_org_id;

  insert into public.class_schedule_recurrence_overrides (
    id, org_id, recurrence_id, occurrence_key, patch, suppress_notifications,
    created_at, created_by, updated_at, updated_by
  )
  select
    gen_random_uuid(), p_org_id, v_old_recurrence.id,
    (o->>'occurrenceKey')::timestamptz, o->'patch',
    coalesce((o->>'suppressNotifications')::boolean, false),
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  from jsonb_array_elements(coalesce(p_kept_overrides, '[]'::jsonb)) as o;

  -- New series, same identity/roster, new day/time. A fresh class_schedules.id
  -- deliberately means class_session_completions attached to the old id never
  -- move — they're immutable snapshots and stay correctly attributed to history.
  insert into public.class_schedules (
    id, org_id, title, description, location, meeting_link,
    start_at, end_at, timezone, status, visibility, theme_key,
    source_kind, source_learning_space_id, source_channel_id,
    source_session_id, source_owner_user_id, source_created_by_user_id,
    source_related_learning_space_id,
    created_at, created_by, updated_at, updated_by
  ) values (
    v_new_schedule_id, p_org_id, v_old_schedule.title, v_old_schedule.description,
    v_old_schedule.location, v_old_schedule.meeting_link,
    p_new_start_at, p_new_end_at, coalesce(p_new_timezone, v_old_schedule.timezone),
    'scheduled', v_old_schedule.visibility, v_old_schedule.theme_key,
    v_old_schedule.source_kind, v_old_schedule.source_learning_space_id,
    v_old_schedule.source_channel_id, v_old_schedule.source_session_id,
    v_old_schedule.source_owner_user_id, v_old_schedule.source_created_by_user_id,
    v_old_schedule.source_related_learning_space_id,
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  );

  insert into public.class_schedule_recurrence (
    id, org_id, schedule_id, frequency, interval, count, until, timezone,
    raw_rrule, bysecond, byminute, byhour, byday, bymonthday, byyearday,
    byweekno, bymonth, bysetpos, wkst,
    created_at, created_by, updated_at, updated_by
  ) values (
    v_new_recurrence_id, p_org_id, v_new_schedule_id, v_old_recurrence.frequency,
    v_old_recurrence.interval, v_old_recurrence.count, v_original_until,
    coalesce(p_new_timezone, v_old_recurrence.timezone),
    null, v_old_recurrence.bysecond, v_old_recurrence.byminute, v_old_recurrence.byhour,
    p_new_byday, v_old_recurrence.bymonthday, v_old_recurrence.byyearday,
    v_old_recurrence.byweekno, v_old_recurrence.bymonth, v_old_recurrence.bysetpos,
    v_old_recurrence.wkst,
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  );

  insert into public.class_schedule_participants (
    id, org_id, schedule_id, profile_id, role, status,
    display_name, avatar_url, theme_key,
    created_at, created_by, updated_at, updated_by
  )
  select
    gen_random_uuid(), p_org_id, v_new_schedule_id, sp.profile_id, sp.role, sp.status,
    sp.display_name, sp.avatar_url, sp.theme_key,
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  from public.class_schedule_participants sp
  where sp.schedule_id = p_schedule_id
    and sp.org_id = p_org_id
    and sp.deleted_at is null;

  return v_new_schedule_id;
end;
$$;

-- security definer functions default to EXECUTE-granted-to-PUBLIC; without this,
-- any authenticated PostgREST caller could invoke the function directly with an
-- arbitrary org_id/schedule_id, bypassing requireOrgActor's role check entirely.
revoke all on function public.split_class_schedule_recurrence(uuid, uuid, timestamptz, jsonb, jsonb, timestamptz, timestamptz, text, public.rrule_byday[], uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.split_class_schedule_recurrence(uuid, uuid, timestamptz, jsonb, jsonb, timestamptz, timestamptz, text, public.rrule_byday[], uuid, timestamptz) to service_role;

-- Backs the "All events" reschedule scope: rewrites a recurring schedule's
-- day/time in place across class_schedules + class_schedule_recurrence +
-- its exceptions/overrides in one transaction. Same rationale as the split
-- function above — these four unwrapped sequential updates would otherwise
-- risk a lost-update race (another admin's concurrent per-occurrence edit
-- landing between this function's read and its wholesale exception/override
-- replace) and a partial-failure window where the schedule's time and the
-- recurrence's weekday briefly disagree.
create or replace function public.update_class_schedule_recurrence_rule(
  p_org_id uuid,
  p_schedule_id uuid,
  p_recurrence_id uuid,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz,
  p_new_timezone text,
  p_new_byday public.rrule_byday[],
  p_kept_exceptions jsonb,
  p_kept_overrides jsonb,
  p_actor_profile_id uuid,
  p_now timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.class_schedules
   where id = p_schedule_id and org_id = p_org_id and deleted_at is null
   for update;
  if not found then
    raise exception 'class_schedules row % not found for org %', p_schedule_id, p_org_id;
  end if;

  perform 1 from public.class_schedule_recurrence
   where id = p_recurrence_id and schedule_id = p_schedule_id and org_id = p_org_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'recurrence % not found for schedule %', p_recurrence_id, p_schedule_id;
  end if;

  update public.class_schedules
     set start_at = p_new_start_at,
         end_at = p_new_end_at,
         timezone = p_new_timezone,
         updated_at = p_now,
         updated_by = p_actor_profile_id
   where id = p_schedule_id;

  update public.class_schedule_recurrence
     set byday = p_new_byday,
         timezone = p_new_timezone,
         updated_at = p_now,
         updated_by = p_actor_profile_id
   where id = p_recurrence_id;

  delete from public.class_schedule_recurrence_exceptions
   where recurrence_id = p_recurrence_id and org_id = p_org_id;

  insert into public.class_schedule_recurrence_exceptions (
    id, org_id, recurrence_id, occurrence_key, reason, suppress_notifications,
    created_at, created_by, updated_at, updated_by
  )
  select
    gen_random_uuid(), p_org_id, p_recurrence_id,
    (e->>'occurrenceKey')::timestamptz, e->>'reason',
    coalesce((e->>'suppressNotifications')::boolean, false),
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  from jsonb_array_elements(coalesce(p_kept_exceptions, '[]'::jsonb)) as e;

  delete from public.class_schedule_recurrence_overrides
   where recurrence_id = p_recurrence_id and org_id = p_org_id;

  insert into public.class_schedule_recurrence_overrides (
    id, org_id, recurrence_id, occurrence_key, patch, suppress_notifications,
    created_at, created_by, updated_at, updated_by
  )
  select
    gen_random_uuid(), p_org_id, p_recurrence_id,
    (o->>'occurrenceKey')::timestamptz, o->'patch',
    coalesce((o->>'suppressNotifications')::boolean, false),
    p_now, p_actor_profile_id, p_now, p_actor_profile_id
  from jsonb_array_elements(coalesce(p_kept_overrides, '[]'::jsonb)) as o;
end;
$$;

revoke all on function public.update_class_schedule_recurrence_rule(uuid, uuid, uuid, timestamptz, timestamptz, text, public.rrule_byday[], jsonb, jsonb, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.update_class_schedule_recurrence_rule(uuid, uuid, uuid, timestamptz, timestamptz, text, public.rrule_byday[], jsonb, jsonb, uuid, timestamptz) to service_role;
