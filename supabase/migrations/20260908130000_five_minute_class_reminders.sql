-- Replace queued 30-minute reminders through the API's schedule reconciler.
-- Deploy the API with the five-minute offset before applying this migration.
update public.reminder_jobs
set status = 'canceled',
    lease_owner = null,
    lease_until = null,
    next_attempt_at = null,
    updated_at = now()
where job_type = 'session.reminder'
  and deleted_at is null
  and (payload->>'reminderOffsetMinutes' = '30' or dedupe_key like '%:30')
  and (status in ('pending', 'failed')
       or (status = 'leased' and lease_until < now()));

-- Preserve sent history and current leases. Reconciliation replaces obsolete
-- offsets and expands the latest recurrence and exception rules in the API.
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
