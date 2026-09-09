-- Backs GET /session-completions/org-summary
-- (apps/api SessionCompletionsService.getOrgCompletionSummary), which sits on
-- the staff/admin home page's critical render path.
--
-- The service used to fetch every non-deleted confirmed / auto_confirmed /
-- pending row for the org (unbounded, all-time) and fold it to occurrence
-- counts in Node. On orgs with a large completion history that scan grew
-- without limit and tripped statement_timeout. This computes the same two
-- numbers in a single indexed pass and returns them.
--
-- Semantics preserved exactly:
--   completed = occurrences ((schedule_id, occurrence_key)) that have a
--     confirmed or auto_confirmed row whose session_end_at is in
--     [p_since, p_until); both bounds optional (null = open).
--   pending   = occurrences that have a pending row and NO confirmed /
--     auto_confirmed row, all-time (any confirmation resolves the occurrence).

create index if not exists class_session_completions_org_status_idx
  on public.class_session_completions (org_id, status)
  include (schedule_id, occurrence_key, session_end_at)
  where deleted_at is null;

create or replace function public.get_org_session_completion_summary(
  p_org_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (completed integer, pending integer)
language sql
stable
set search_path = public
as $$
  with occ as (
    select
      c.schedule_id,
      c.occurrence_key,
      bool_or(c.status in ('confirmed', 'auto_confirmed')) as is_confirmed,
      bool_or(c.status = 'pending') as has_pending,
      bool_or(
        c.status in ('confirmed', 'auto_confirmed')
        and (p_since is null or c.session_end_at >= p_since)
        and (p_until is null or c.session_end_at < p_until)
      ) as confirmed_in_window
    from public.class_session_completions c
    where c.org_id = p_org_id
      and c.deleted_at is null
      and c.status in ('confirmed', 'auto_confirmed', 'pending')
    group by c.schedule_id, c.occurrence_key
  )
  select
    coalesce(count(*) filter (where confirmed_in_window), 0)::integer,
    coalesce(count(*) filter (where has_pending and not is_confirmed), 0)::integer
  from occ;
$$;

-- API-owned: apps/api invokes this with the service-role client after checking
-- org membership and admin role. Keep it off the anon/authenticated Data API.
revoke execute on function
  public.get_org_session_completion_summary(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.get_org_session_completion_summary(uuid, timestamptz, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
