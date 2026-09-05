-- Marks completion-check reminder jobs after the post-dispatch reconciliation pass.
-- The marker keeps the safety net bounded: each successful job is re-run once through
-- the idempotent per-participant dispatcher, filling any rows missed by a partial run.

alter table public.reminder_jobs
  add column if not exists completion_reconciled_at timestamptz;

create index if not exists reminder_jobs_completion_reconciliation_idx
  on public.reminder_jobs (dispatched_at asc, id asc)
  where job_type = 'session.completion_check'
    and status = 'succeeded'
    and completion_reconciled_at is null
    and deleted_at is null;
