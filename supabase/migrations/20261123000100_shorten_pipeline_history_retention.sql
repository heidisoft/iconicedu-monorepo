-- Shorten retention for pure-history pipeline rows.
--
-- Replaces public.purge_notification_job_history from
-- 20261115000000_notification_job_retention.sql. Every window and safety
-- invariant there is unchanged except:
--
-- * event_pipeline_logs: 30 → 7 days. Nothing reads these rows (no API, web,
--   mobile, DB function, view, or Realtime publication), and the API now only
--   writes failure rows.
-- * event_pipeline_jobs, job_kind = 'reminder.reconcile' in a terminal state:
--   30 → 7 days. The active dedupe index only covers pending/leased/failed
--   rows, so terminal reconcile rows are history, not a dedupe ledger. Seven
--   days stays well above the repair pass's 6-hour cooldown, which reads them.
-- * cron.job_run_details: 14 → 7 days. The every-minute dispatchers add
--   roughly 10k rows a day.
--
-- See docs/operations/notification-retention.md.

create or replace function public.purge_notification_job_history(
  p_batch_size integer default 5000,
  p_max_batches integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_batch integer := least(greatest(coalesce(p_batch_size, 5000), 100), 20000);
  v_max integer := least(greatest(coalesce(p_max_batches, 20), 1), 200);
  v_result jsonb := '{}'::jsonb;
  v_count bigint;
begin
  -- Logs first so the FK SET NULL / CASCADE actions on the parent purges
  -- below have little left to touch.
  v_count := public.purge_rows_in_batches(
    'public.event_pipeline_logs',
    $p$created_at < now() - interval '7 days'$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('event_pipeline_logs', v_count);

  v_count := public.purge_rows_in_batches(
    'public.reminder_dispatch_logs',
    $p$created_at < now() - interval '90 days'$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('reminder_dispatch_logs', v_count);

  v_count := public.purge_rows_in_batches(
    'public.event_pipeline_jobs',
    $p$(
      (deleted_at is not null and deleted_at < now() - interval '30 days')
      or (
        job_kind = 'reminder.reconcile'
        and status in ('succeeded', 'suppressed', 'canceled')
        and updated_at < now() - interval '7 days'
      )
      or (
        status in ('succeeded', 'suppressed', 'canceled')
        and job_kind <> 'notification.deliver'
        and updated_at < now() - interval '30 days'
      )
      or (
        status in ('succeeded', 'suppressed', 'canceled', 'dead_letter')
        and updated_at < now() - interval '90 days'
      )
    )$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('event_pipeline_jobs', v_count);

  v_count := public.purge_rows_in_batches(
    'public.event_outbox',
    $p$(
      (
        (deleted_at is not null and deleted_at < now() - interval '30 days')
        or (status in ('processed', 'canceled') and updated_at < now() - interval '30 days')
        or (status = 'dead_letter' and updated_at < now() - interval '90 days')
      )
      and not exists (
        select 1 from public.event_pipeline_jobs j
        where j.outbox_id = event_outbox.id
          and j.status in ('pending', 'leased', 'failed')
          and j.deleted_at is null
      )
    )$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('event_outbox', v_count);

  v_count := public.purge_rows_in_batches(
    'public.reminder_jobs',
    $p$(
      (deleted_at is not null and deleted_at < now() - interval '30 days')
      or (
        status in ('succeeded', 'canceled', 'dead_letter')
        and updated_at < now() - interval '90 days'
        and coalesce(occurrence_start_at, run_at) < now() - interval '90 days'
      )
    )$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('reminder_jobs', v_count);

  -- Sent rows are already real messages; canceled rows are invisible to users.
  -- Failed rows stay because senders can still see and retry them.
  v_count := public.purge_rows_in_batches(
    'public.scheduled_messages',
    $p$status in ('sent', 'canceled') and updated_at < now() - interval '30 days'$p$,
    v_batch, v_max);
  v_result := v_result || jsonb_build_object('scheduled_messages', v_count);

  if to_regclass('cron.job_run_details') is not null then
    begin
      v_count := public.purge_rows_in_batches(
        'cron.job_run_details',
        $p$end_time < now() - interval '7 days'$p$,
        v_batch, v_max);
      v_result := v_result || jsonb_build_object('cron_job_run_details', v_count);
    exception when insufficient_privilege then
      -- Never let pg_cron housekeeping roll back the application purges above.
      v_result := v_result || jsonb_build_object('cron_job_run_details', 'skipped: insufficient_privilege');
    end;
  end if;

  raise log 'purge_notification_job_history: %', v_result;
  return v_result;
end;
$$;

comment on function public.purge_notification_job_history(integer, integer) is
  'Deletes terminal notification/reminder job and log rows past retention. Scheduled hourly by pg_cron job notification-job-retention.';

revoke all on function public.purge_notification_job_history(integer, integer)
  from public, anon, authenticated;
grant execute on function public.purge_notification_job_history(integer, integer)
  to service_role;
