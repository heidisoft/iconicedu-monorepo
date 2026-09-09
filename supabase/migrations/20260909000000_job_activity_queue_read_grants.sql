-- Make the background job-queue tables reachable for the admin job-activity
-- pages (apps/web -> apps/api).
--
-- The admin activity pages read the most recent processed rows from each queue
-- through apps/api using the service-role client. 20260820010000 keeps newly
-- created tables closed to the Data API by default, so PostgREST can report
-- "Could not find the table 'public.<queue>' in the schema cache" until a
-- forward migration grants the minimum privilege and reloads the cache.
--
-- Scope: service_role only. The Data API stays closed to anon/authenticated for
-- these tables, and row level security still gates every non-service caller.
-- This restores the access the existing policies were authored against and does
-- not widen end-user surface; the pages are additionally gated to
-- owner/admin/staff in apps/api.

grant select on table
  public.activity_source_jobs,
  public.event_pipeline_jobs,
  public.notification_dispatch_jobs,
  public.reminder_jobs,
  public.reminder_reconcile_jobs,
  public.class_session_completions
to service_role;

-- Drop PostgREST's cached schema so the grant is visible immediately.
notify pgrst, 'reload schema';
