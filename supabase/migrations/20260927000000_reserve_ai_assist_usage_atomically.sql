-- Codex review (PR #269, P1): AiAssistService previously enforced the daily
-- AI-assist cap with a plain SELECT count(*) check, then recorded usage via
-- a separate, un-awaited INSERT after the Claude call completed. Concurrent
-- requests from the same profile could all observe a count under the limit
-- before any of them inserted a usage row, so a burst of requests could
-- blow past MAX_REFINES_PER_DAY / MAX_SUGGESTED_REPLIES_PER_DAY before ever
-- touching the paid provider call. This reserves usage atomically: the
-- count check and the usage-row insert happen under one advisory lock
-- scoped to (profile_id, kind), so two concurrent callers can never both
-- observe capacity.

create or replace function public.reserve_ai_assist_usage(
  p_org_id uuid,
  p_profile_id uuid,
  p_kind text,
  p_daily_limit integer,
  p_since timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Serializes concurrent callers for the same profile+kind so the count
  -- check below can never race with another call's insert; released
  -- automatically at the end of this function's transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_kind, 0));

  select count(*)
    into v_count
    from public.ai_assist_usage
   where org_id = p_org_id
     and profile_id = p_profile_id
     and kind = p_kind
     and created_at >= p_since;

  if v_count >= p_daily_limit then
    return false;
  end if;

  insert into public.ai_assist_usage (org_id, profile_id, kind)
  values (p_org_id, p_profile_id, p_kind);

  return true;
end;
$$;

revoke all on function public.reserve_ai_assist_usage(uuid, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_assist_usage(uuid, uuid, text, integer, timestamptz)
  to service_role;
