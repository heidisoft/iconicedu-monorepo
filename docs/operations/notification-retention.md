# Notification Job Retention

Last Updated: 2026-11-23

The `notification-job-retention` pg_cron job deletes old **operational** rows
left behind by the event, notification, push, and reminder pipelines. It keeps
database size bounded without touching anything users see.

- Defined in `supabase/migrations/20261115000000_notification_job_retention.sql`;
  retention windows last changed in
  `supabase/migrations/20261123000100_shorten_pipeline_history_retention.sql`.
- Runs `select public.purge_notification_job_history();` at minute 41 of every hour.
- Deployed by the normal migration step (`supabase db push`) in preview and
  production CI. Both CI cron-verification steps fail if the job is missing or
  misconfigured.
- Regression test: `supabase/tests/notification_job_retention.test.sql`
  (`supabase test db` on a disposable local database).

## What Is Purged

| Table                           | Deleted when                                                                                                                                                               | Why that window is safe                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_pipeline_logs`           | `created_at` older than 7 days                                                                                                                                             | Diagnostic only. Since 2026-11-23 the API logs only failures and suppressions, never successes.                                                                                                                                                                  |
| `event_pipeline_jobs`           | terminal `reminder.reconcile` older than 7 days; other `succeeded`/`suppressed`/`canceled` older than 30 days; `notification.deliver` and `dead_letter` older than 90 days | `notification.deliver` rows are the per-recipient push dedupe ledger, so they are kept well past any prepare retry window. Terminal reconcile rows are history only (the dedupe index covers active rows); 7 days stays above the repair pass's 6-hour cooldown. |
| `event_outbox`                  | `processed`/`canceled` older than 30 days, `dead_letter` older than 90 days, and no live (`pending`/`leased`/`failed`) job                                                 | `enqueue_event_outbox()` re-queues on conflict anyway, so deleting a processed row does not change re-emission behavior.                                                                                                                                         |
| `reminder_dispatch_logs`        | `created_at` older than 90 days                                                                                                                                            | Only used by the admin activity feed's reminder detail.                                                                                                                                                                                                          |
| `reminder_jobs`                 | `succeeded`/`canceled`/`dead_letter`, updated more than 90 days ago, and occurrence (or `run_at`) more than 90 days ago                                                    | Reconcile only regenerates occurrences from `now() - 3 days`, so a deleted dedupe key can never be re-created and re-sent.                                                                                                                                       |
| `scheduled_messages`            | `sent`/`canceled` older than 30 days                                                                                                                                       | Sent rows already exist as real messages; `failed` rows are kept because senders can still see and retry them.                                                                                                                                                   |
| `cron.job_run_details`          | `end_time` older than 7 days                                                                                                                                               | pg_cron run history; the per-minute dispatchers add roughly 10k rows a day.                                                                                                                                                                                      |
| Any of the above (soft-deleted) | `deleted_at` older than 30 days                                                                                                                                            | Already hidden from every reader.                                                                                                                                                                                                                                |

Rows in `pending`, `leased`, or retryable `failed` states are **never** deleted,
whatever their age.

## What Is Not Purged (Yet)

User-facing notification content is out of scope for this job:
`activity_events`, `activity_feed_items`, `notification_preferences`, and
`push_tokens`. Expiring classroom rows already have their own jobs
(`classroom-calls-retention`, `cleanup-live-session-browser-links`,
`expired-meeting-admissions`).

## Operating It

Each run deletes at most `p_batch_size × p_max_batches` rows per table (defaults
5,000 × 20). It uses `FOR UPDATE SKIP LOCKED` and a 5-second `lock_timeout`, so it
never blocks the per-minute workers. A large first backlog drains over a few
hourly runs.

Inspect recent runs:

```sql
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'notification-job-retention')
order by start_time desc
limit 10;
```

Per-table counts are written to the Postgres log as
`purge_notification_job_history: {...}`. To see them directly, or to drain a
backlog faster, run it manually as an admin:

```sql
select public.purge_notification_job_history(10000, 100);
```

To change a retention window, add a new forward migration that replaces
`public.purge_notification_job_history`. Never edit the original migration.

## Reclaiming Disk Space After A Backlog

Purging rows does not shrink tables: Postgres reuses the freed space, but the
dashboard's "space used" only drops once a table is rewritten. After a large
backlog has been purged, reclaim the space once:

1. Drain the backlog until every count in the result is `0`:

   ```sql
   select public.purge_notification_job_history(10000, 50);
   ```

2. Rewrite one table at a time at a quiet hour. `VACUUM FULL` takes an
   `ACCESS EXCLUSIVE` lock for the duration, so the per-minute workers wait on
   it; with purged tables this takes seconds. The `postgres` role has the
   `MAINTAIN` privilege needed for the `net` and `cron` tables.

   ```sql
   vacuum full net._http_response;      -- unlogged, not replicated
   vacuum full cron.job_run_details;
   vacuum full public.event_pipeline_logs;
   vacuum full public.event_pipeline_jobs;
   ```

3. With a read replica attached, each rewrite of a logged table streams its
   new size as WAL and replays the exclusive lock on the replica. Check lag
   between tables:

   ```sql
   select application_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) as lag
   from pg_stat_replication;
   ```

The provisioned disk size cannot be reduced; reclaiming space lowers usage and
growth, not the provisioned disk.
