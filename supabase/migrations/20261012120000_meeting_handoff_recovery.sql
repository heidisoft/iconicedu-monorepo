-- Bind single-browser handoff redemption to a browser-generated retry secret.
alter table public.live_session_browser_links add column redemption_hash text;

create or replace function public.redeem_meeting_browser_handoff(
  p_token_hash text, p_session_id uuid, p_redemption_hash text, p_access_hash text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_link public.live_session_browser_links%rowtype;
begin
  select * into v_link from public.live_session_browser_links
    where token_hash = p_token_hash and live_session_id = p_session_id
      and purpose = 'handoff' and expires_at > now() for update;
  if not found then return false; end if;
  if v_link.redemption_hash is not null then
    return v_link.redemption_hash = p_redemption_hash and exists (
      select 1 from public.live_session_browser_links where token_hash = p_access_hash
        and live_session_id = p_session_id and purpose = 'access' and expires_at > now());
  end if;
  insert into public.live_session_browser_links(token_hash, live_session_id, purpose, auth_user_id, expires_at)
    values(p_access_hash, p_session_id, 'access', v_link.auth_user_id, now() + interval '4 hours');
  update public.live_session_browser_links set redemption_hash = p_redemption_hash where token_hash = p_token_hash;
  return true;
end;
$$;
revoke all on function public.redeem_meeting_browser_handoff(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_meeting_browser_handoff(text, uuid, text, text) to service_role;
