-- get_org_session_completion_summary previously computed `pending` as an
-- all-time, unbounded backlog (any occurrence with a pending row and no
-- confirmation, regardless of when the session happened), while `completed`
-- was scoped to [p_since, p_until) via session_end_at. The home dashboard
-- tile sums both numbers under a single "this month" framing, so old
-- unresolved occurrences from before the displayed month silently inflated
-- it relative to the admin attendance page's month-scoped count. Scope
-- `pending` to the same session_end_at window as `completed` so both
-- numbers describe the same month.

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
      bool_or(
        c.status in ('confirmed', 'auto_confirmed')
        and (p_since is null or c.session_end_at >= p_since)
        and (p_until is null or c.session_end_at < p_until)
      ) as confirmed_in_window,
      bool_or(
        c.status = 'pending'
        and (p_since is null or c.session_end_at >= p_since)
        and (p_until is null or c.session_end_at < p_until)
      ) as pending_in_window
    from public.class_session_completions c
    where c.org_id = p_org_id
      and c.deleted_at is null
      and c.status in ('confirmed', 'auto_confirmed', 'pending')
    group by c.schedule_id, c.occurrence_key
  )
  select
    coalesce(count(*) filter (where confirmed_in_window), 0)::integer,
    coalesce(count(*) filter (where pending_in_window and not confirmed_in_window), 0)::integer
  from occ;
$$;

notify pgrst, 'reload schema';
