-- Document the API-owned notifications dispatch contract in the repo-managed
-- cron source of truth.
--
-- Important: the actual switch to the new API endpoint is controlled by the
-- `notifications-dispatch` edge function secrets:
--   - NOTIFICATIONS_DISPATCH_URL
--   - INTERNAL_NOTIFICATIONS_TOKEN
--
-- This migration cannot update those environment secrets. It records the
-- intended contract on the scheduling helper so environments configured after
-- this migration have an accurate source of truth in schema metadata.

comment on function public.configure_edge_function_cron(text) is
  'Schedules Supabase edge functions for reminders, notifications, and maintenance jobs. The notifications-dispatch edge function is API-owned and must call the backend /internal/notifications/dispatch endpoint via NOTIFICATIONS_DISPATCH_URL.';
