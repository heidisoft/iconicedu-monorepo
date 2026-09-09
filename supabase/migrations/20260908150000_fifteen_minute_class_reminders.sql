-- Move the near pre-class reminder from five minutes to fifteen minutes before
-- session start, and stop the reminder workers from handing out jobs whose
-- session was cancelled, completed, superseded, or moved since the job was
-- queued. Schedule reconciliation still owns the durable cleanup; this only
-- closes the race where a due reminder fires in the <1 min window before the
-- dedicated reconciliation worker cancels the row.
--
-- Deploy the API with the fifteen-minute offset before applying this migration.

-- ─── Re-key queued five-minute reminders through the reconciler ────────────────

update public.reminder_jobs
set status = 'canceled',
    lease_owner = null,
    lease_until = null,
    next_attempt_at = null,
    updated_at = now()
where job_type = 'session.reminder'
  and deleted_at is null
  and (payload->>'reminderOffsetMinutes' = '5' or dedupe_key like '%:5')
  and (status in ('pending', 'failed')
       or (status = 'leased' and lease_until < now()));

-- Preserve sent history and current leases. Reconciliation replaces the obsolete
-- offset and expands the latest recurrence and exception rules in the API.
do $$
declare v_schedule record;
begin
  for v_schedule in
    select id, org_id from public.class_schedules
    where deleted_at is null and source_kind = 'class_session'
      and status not in ('cancelled', 'completed', 'rescheduled')
  loop
    perform public.enqueue_reminder_reconcile_job(v_schedule.org_id, v_schedule.id);
  end loop;
end;
$$;

-- ─── Supporting indexes for the staleness guard ──────────────────────────────

-- The guard below probes recurrence/exception rows per candidate reminder job.
create index if not exists class_schedule_recurrence_schedule_id_idx
  on public.class_schedule_recurrence (schedule_id)
  where deleted_at is null;

create index if not exists class_schedule_recurrence_exceptions_occurrence_idx
  on public.class_schedule_recurrence_exceptions (recurrence_id, occurrence_key)
  where deleted_at is null;

-- ─── Safe text→timestamptz parse ────────────────────────────────────────────

-- `class_schedule_recurrence_overrides.patch` is client-authored JSON with no
-- column-level type enforcement, so `patch->>'startAt'` can be any string. A raw
-- `::timestamptz` cast in the claim RPC would raise and abort the whole batch —
-- one bad row would stop reminder dispatch for every org. Parse defensively and
-- treat an unparseable value as "cannot prove the occurrence moved" (fail open).
create or replace function public.safe_to_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
strict
as $$
begin
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

revoke all on function public.safe_to_timestamptz(text) from public, anon, authenticated;
grant execute on function public.safe_to_timestamptz(text) to service_role;

-- ─── Staleness guard for the reminder claim RPCs ──────────────────────────────

-- A `session.reminder` job is still eligible only when its session has not been
-- cancelled/completed/superseded, its learning space is not archived, and — for
-- the exact occurrence the job targets — no recurrence exception cancelled it and
-- no override moved its start time (>1s, to tolerate sub-second representation
-- drift). A one-off whose start moved in place is caught by comparing the job's
-- occurrence_start_at to the schedule's current start_at. Jobs with no source
-- schedule (legacy/manual) keep the previous behavior. Anything the guard cannot
-- positively classify is left claimable; reconciliation remains the durable
-- cleanup path.

create or replace function public.claim_due_reminder_jobs(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.reminder_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select r.id
    from public.reminder_jobs r
    left join public.class_schedules s
      on s.id = r.source_schedule_id
     and s.org_id = r.org_id
     and s.deleted_at is null
    where r.deleted_at is null
      and (r.status in ('pending', 'failed') or (r.status = 'leased' and r.lease_until < v_now))
      and r.job_type = 'session.reminder'
      and r.run_at <= v_now
      and coalesce(r.next_attempt_at, r.run_at) <= v_now
      and (r.lease_until is null or r.lease_until < v_now)
      and (
        r.source_schedule_id is null
        or (
          s.id is not null
          and s.status not in ('cancelled', 'completed', 'rescheduled')
          and not exists (
            select 1 from public.learning_spaces ls
            where ls.id = s.source_learning_space_id
              and ls.org_id = r.org_id
              and ls.deleted_at is null
              and (ls.status = 'archived' or ls.archived_at is not null)
          )
          and (
            r.occurrence_start_at is null
            or exists (
              select 1 from public.class_schedule_recurrence rec
              where rec.schedule_id = s.id and rec.org_id = r.org_id and rec.deleted_at is null
            )
            or abs(extract(epoch from (r.occurrence_start_at - s.start_at))) <= 1
          )
          and not exists (
            select 1
            from public.class_schedule_recurrence rec
            where rec.schedule_id = s.id
              and rec.org_id = r.org_id
              and rec.deleted_at is null
              and (
                exists (
                  select 1 from public.class_schedule_recurrence_exceptions ex
                  where ex.recurrence_id = rec.id
                    and ex.org_id = r.org_id
                    and ex.occurrence_key = r.occurrence_start_at
                    and ex.deleted_at is null
                )
                or exists (
                  select 1 from public.class_schedule_recurrence_overrides ov
                  where ov.recurrence_id = rec.id
                    and ov.org_id = r.org_id
                    and ov.occurrence_key = r.occurrence_start_at
                    and ov.deleted_at is null
                    and public.safe_to_timestamptz(ov.patch->>'startAt') is not null
                    and abs(extract(epoch from (
                          public.safe_to_timestamptz(ov.patch->>'startAt') - r.occurrence_start_at
                        ))) > 1
                )
              )
          )
        )
      )
    order by r.run_at asc, r.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update of r skip locked
  )
  update public.reminder_jobs r
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

create or replace function public.claim_due_org_reminder_jobs(
  p_org_id uuid,
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns setof public.reminder_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  with due as (
    select r.id
    from public.reminder_jobs r
    left join public.class_schedules s
      on s.id = r.source_schedule_id
     and s.org_id = r.org_id
     and s.deleted_at is null
    where r.org_id = p_org_id
      and r.deleted_at is null
      and (r.status in ('pending', 'failed') or (r.status = 'leased' and r.lease_until < v_now))
      and r.job_type = 'session.reminder'
      and r.run_at <= v_now
      and coalesce(r.next_attempt_at, r.run_at) <= v_now
      and (r.lease_until is null or r.lease_until < v_now)
      and (
        r.source_schedule_id is null
        or (
          s.id is not null
          and s.status not in ('cancelled', 'completed', 'rescheduled')
          and not exists (
            select 1 from public.learning_spaces ls
            where ls.id = s.source_learning_space_id
              and ls.org_id = r.org_id
              and ls.deleted_at is null
              and (ls.status = 'archived' or ls.archived_at is not null)
          )
          and (
            r.occurrence_start_at is null
            or exists (
              select 1 from public.class_schedule_recurrence rec
              where rec.schedule_id = s.id and rec.org_id = r.org_id and rec.deleted_at is null
            )
            or abs(extract(epoch from (r.occurrence_start_at - s.start_at))) <= 1
          )
          and not exists (
            select 1
            from public.class_schedule_recurrence rec
            where rec.schedule_id = s.id
              and rec.org_id = r.org_id
              and rec.deleted_at is null
              and (
                exists (
                  select 1 from public.class_schedule_recurrence_exceptions ex
                  where ex.recurrence_id = rec.id
                    and ex.org_id = r.org_id
                    and ex.occurrence_key = r.occurrence_start_at
                    and ex.deleted_at is null
                )
                or exists (
                  select 1 from public.class_schedule_recurrence_overrides ov
                  where ov.recurrence_id = rec.id
                    and ov.org_id = r.org_id
                    and ov.occurrence_key = r.occurrence_start_at
                    and ov.deleted_at is null
                    and public.safe_to_timestamptz(ov.patch->>'startAt') is not null
                    and abs(extract(epoch from (
                          public.safe_to_timestamptz(ov.patch->>'startAt') - r.occurrence_start_at
                        ))) > 1
                )
              )
          )
        )
      )
    order by r.run_at asc, r.created_at asc
    limit greatest(1, coalesce(p_limit, 1))
    for update of r skip locked
  )
  update public.reminder_jobs r
  set status = 'leased',
      lease_owner = p_lease_owner,
      lease_until = v_now + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 120))),
      updated_at = v_now
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

revoke all on function public.claim_due_reminder_jobs(integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminder_jobs(integer, text, integer) to service_role;

revoke all on function public.claim_due_org_reminder_jobs(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_org_reminder_jobs(uuid, integer, text, integer) to service_role;
