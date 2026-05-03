-- Migration: rolling reminder window
-- Cancel surplus active jobs so that at most one pending/leased/failed job exists
-- per (org_id, source_schedule_id), keeping the one with the earliest run_at.
-- Then add a partial unique index to enforce this invariant going forward.

-- Step 1: collapse surplus active jobs
UPDATE public.reminder_jobs r1
SET
  status     = 'canceled',
  lease_owner = null,
  lease_until = null,
  updated_at  = now()
WHERE r1.deleted_at IS NULL
  AND r1.status NOT IN ('succeeded', 'canceled', 'dead_letter')
  AND r1.source_schedule_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.reminder_jobs r2
    WHERE r2.org_id             = r1.org_id
      AND r2.source_schedule_id = r1.source_schedule_id
      AND r2.deleted_at IS NULL
      AND r2.status NOT IN ('succeeded', 'canceled', 'dead_letter')
      AND (
        r2.run_at < r1.run_at
        OR (r2.run_at = r1.run_at AND r2.id < r1.id)
      )
  );

-- Step 2: add partial unique index — one active job per schedule
CREATE UNIQUE INDEX reminder_jobs_active_per_schedule_idx
  ON public.reminder_jobs (org_id, source_schedule_id)
  WHERE deleted_at IS NULL
    AND status NOT IN ('succeeded', 'canceled', 'dead_letter')
    AND source_schedule_id IS NOT NULL;
