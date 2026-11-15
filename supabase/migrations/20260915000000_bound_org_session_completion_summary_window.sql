-- `get_org_session_completion_summary` applied the [p_since, p_until) window inside
-- the `bool_or(...)` aggregate expressions instead of the base-row `where` clause, so
-- a bounded call still scanned and grouped every qualifying row for the org (issue
-- #249: this is one of the causes of `canceling statement due to statement timeout`
-- on the `/[orgSlug]` dashboard route). Every row sharing a (schedule_id,
-- occurrence_key) shares the same session_end_at, so pushing the window into the
-- where clause before grouping is semantically equivalent, just cheaper: rows outside
-- the window are excluded before the group-by instead of being carried through it.
--
-- Add a supporting partial index so a bounded call can use an index scan instead of a
-- sequential scan of class_session_completions.

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
      bool_or(c.status in ('confirmed', 'auto_confirmed')) as confirmed,
      bool_or(c.status = 'pending') as pending
    from public.class_session_completions c
    where c.org_id = p_org_id
      and c.deleted_at is null
      and c.status in ('confirmed', 'auto_confirmed', 'pending')
      and (p_since is null or c.session_end_at >= p_since)
      and (p_until is null or c.session_end_at < p_until)
    group by c.schedule_id, c.occurrence_key
  )
  select
    coalesce(count(*) filter (where confirmed), 0)::integer,
    coalesce(count(*) filter (where pending and not confirmed), 0)::integer
  from occ;
$$;

create index if not exists class_session_completions_org_window_idx
  on public.class_session_completions (org_id, session_end_at, status)
  where deleted_at is null;

notify pgrst, 'reload schema';
