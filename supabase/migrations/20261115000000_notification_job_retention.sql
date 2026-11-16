-- Notification / reminder job-history retention.
--
-- Scope: operational queue and log rows only (event outbox, event pipeline
-- jobs + logs, reminder jobs + dispatch logs, sent/canceled scheduled-message
-- queue rows, pg_cron run history). User-facing notifications
-- (activity_events, activity_feed_items) are intentionally NOT touched.
--
-- Safety invariants (see docs/operations/notification-retention.md):
-- * Only terminal rows are purged. pending / leased / failed (retryable) rows
--   are never deleted, regardless of age.
-- * event_outbox rows are re-queued by enqueue_event_outbox() on conflict, so
--   deleting a processed outbox row does not change re-emission behavior.
-- * notification.deliver jobs act as the per-recipient push dedupe ledger, so
--   they are retained for 90 days (well past any prepare retry window).
-- * Reminder reconcile only regenerates occurrences from now() - 3 days, so
--   reminder jobs whose occurrence is 90+ days old can never be re-created.
-- * Deletes run in bounded batches with SKIP LOCKED and a short lock_timeout so
--   the purge never blocks the per-minute dispatch workers.

-- ─── Indexes ───────────────────────────────────────────────────────────────
-- Age scans for the purge, plus full (non-partial) FK-column indexes so the
-- ON DELETE SET NULL / CASCADE actions do not seq-scan the child tables.

create index if not exists event_pipeline_logs_created_at_idx
  on public.event_pipeline_logs (created_at);

create index if not exists event_pipeline_logs_job_id_fk_idx
  on public.event_pipeline_logs (job_id);

create index if not exists event_pipeline_logs_outbox_id_fk_idx
  on public.event_pipeline_logs (outbox_id);

create index if not exists event_pipeline_jobs_outbox_id_fk_idx
  on public.event_pipeline_jobs (outbox_id);

create index if not exists event_pipeline_jobs_terminal_updated_idx
  on public.event_pipeline_jobs (updated_at)
  where status in ('succeeded', 'suppressed', 'canceled', 'dead_letter')
     or deleted_at is not null;

create index if not exists event_outbox_terminal_updated_idx
  on public.event_outbox (updated_at)
  where status in ('processed', 'canceled', 'dead_letter')
     or deleted_at is not null;

create index if not exists reminder_dispatch_logs_created_at_idx
  on public.reminder_dispatch_logs (created_at);

create index if not exists reminder_dispatch_logs_reminder_job_id_fk_idx
  on public.reminder_dispatch_logs (reminder_job_id);

create index if not exists reminder_jobs_terminal_updated_idx
  on public.reminder_jobs (updated_at)
  where status in ('succeeded', 'canceled', 'dead_letter')
     or deleted_at is not null;

create index if not exists scheduled_messages_done_updated_idx
  on public.scheduled_messages (updated_at)
  where status in ('sent', 'canceled');

-- ─── Batched delete helper ─────────────────────────────────────────────────
-- Internal only. p_predicate is a fixed SQL fragment supplied by
-- purge_notification_job_history(), never by callers.

create or replace function public.purge_rows_in_batches(
  p_table regclass,
  p_predicate text,
  p_batch_size integer,
  p_max_batches integer
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint := 0;
  v_batch bigint;
  v_iterations integer := 0;
begin
  loop
    execute format(
      'with doomed as (
         select ctid from %1$s where %2$s limit %3$s for update skip locked
       )
       delete from %1$s t using doomed where t.ctid = doomed.ctid',
      p_table, p_predicate, p_batch_size
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    v_iterations := v_iterations + 1;
    exit when v_batch < p_batch_size or v_iterations >= p_max_batches;
  end loop;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rows_in_batches(regclass, text, integer, integer)
  from public, anon, authenticated, service_role;

-- ─── Retention job ─────────────────────────────────────────────────────────

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
    $p$created_at < now() - interval '30 days'$p$,
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

  -- pg_cron keeps a row per run forever; the per-minute dispatchers alone add
  -- ~10k rows a day.
  if to_regclass('cron.job_run_details') is not null then
    begin
      v_count := public.purge_rows_in_batches(
        'cron.job_run_details',
        $p$end_time < now() - interval '14 days'$p$,
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

-- ─── Schedule ──────────────────────────────────────────────────────────────
-- Hourly with a bounded batch budget: the first runs drain any backlog over a
-- few hours without long-running transactions; afterwards each run is a no-op
-- index probe.

do $jobs$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'notification-job-retention';

    perform cron.schedule(
      'notification-job-retention',
      '41 * * * *',
      'select public.purge_notification_job_history();'
    );
  end if;
end $jobs$;
