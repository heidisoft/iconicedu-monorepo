-- Session-completion RPCs are API-owned. PostgreSQL grants EXECUTE on new
-- functions to PUBLIC by default; that is unsafe for the SECURITY DEFINER
-- expiry sweep because an anonymous Data API caller could otherwise run it.
-- Keep both the mutating sweep and profile list function behind apps/api,
-- where authentication, organization membership, and profile authorization
-- are enforced before the service-role client invokes them.

revoke execute on function public.run_class_session_completion_expiry_sweep(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.run_class_session_completion_expiry_sweep(timestamptz, integer)
  to service_role;

revoke execute on function public.list_class_session_completions_for_profile(uuid, uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.list_class_session_completions_for_profile(uuid, uuid, integer, timestamptz, uuid)
  to service_role;

notify pgrst, 'reload schema';
