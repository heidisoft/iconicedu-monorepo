-- Backs GET /session-completions (apps/api SessionCompletionsService.listForProfile),
-- the one query serving both the notifications inbox and the homepage carousel.
--
-- Implemented as a SQL function rather than through the Supabase JS query builder
-- because the two branches of the visibility predicate (`status = 'pending'` vs
-- `resolved_at > now() - interval '3 days'`) need to hit two different dedicated
-- indexes (see 20260905000000_class_session_completions.sql) and be merged under
-- one coherent keyset-pagination ordering — a UNION ALL the query builder can't
-- express directly. A row can only ever match one branch (pending rows have no
-- resolved_at; resolved rows aren't pending), so UNION ALL needs no dedup.
--
-- order_key is `session_end_at` for pending rows and `resolved_at` for resolved
-- rows — the single unified sort/cursor key across both branches.

create or replace function public.list_class_session_completions_for_profile(
  p_org_id uuid,
  p_profile_id uuid,
  p_limit integer default 20,
  p_cursor_order_key timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  org_id uuid,
  schedule_id uuid,
  occurrence_key timestamptz,
  profile_id uuid,
  role public.class_schedule_participant_role,
  status public.class_session_completion_status,
  dispute_category text,
  dispute_reason text,
  reschedule_requested boolean,
  rating smallint,
  rating_comment text,
  channel_id uuid,
  learning_space_id uuid,
  session_title text,
  session_end_at timestamptz,
  notified_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  rated_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  order_key timestamptz
)
language sql
stable
set search_path = public
as $$
  with combined as (
    select c.id, c.org_id, c.schedule_id, c.occurrence_key, c.profile_id, c.role,
           c.status, c.dispute_category, c.dispute_reason, c.reschedule_requested,
           c.rating, c.rating_comment, c.channel_id, c.learning_space_id,
           c.session_title, c.session_end_at, c.notified_at, c.confirmed_at,
           c.disputed_at, c.rated_at, c.resolved_at, c.expires_at,
           c.session_end_at as order_key
      from public.class_session_completions c
     where c.org_id = p_org_id
       and c.profile_id = p_profile_id
       and c.deleted_at is null
       and c.status = 'pending'
    union all
    select c.id, c.org_id, c.schedule_id, c.occurrence_key, c.profile_id, c.role,
           c.status, c.dispute_category, c.dispute_reason, c.reschedule_requested,
           c.rating, c.rating_comment, c.channel_id, c.learning_space_id,
           c.session_title, c.session_end_at, c.notified_at, c.confirmed_at,
           c.disputed_at, c.rated_at, c.resolved_at, c.expires_at,
           c.resolved_at as order_key
      from public.class_session_completions c
     where c.org_id = p_org_id
       and c.profile_id = p_profile_id
       and c.deleted_at is null
       and c.resolved_at is not null
       and c.resolved_at > now() - interval '3 days'
  )
  select combined.id, combined.org_id, combined.schedule_id, combined.occurrence_key,
         combined.profile_id, combined.role, combined.status, combined.dispute_category,
         combined.dispute_reason, combined.reschedule_requested, combined.rating,
         combined.rating_comment, combined.channel_id, combined.learning_space_id,
         combined.session_title, combined.session_end_at, combined.notified_at,
         combined.confirmed_at, combined.disputed_at, combined.rated_at,
         combined.resolved_at, combined.expires_at, combined.order_key
    from combined
   where p_cursor_order_key is null
      or (combined.order_key, combined.id) < (p_cursor_order_key, p_cursor_id)
   order by combined.order_key desc, combined.id desc
   limit greatest(p_limit, 0);
$$;
