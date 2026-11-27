-- Serialize claims per verified identity and prevent duplicate cross-organization rewards.
-- A matching previously recorded claim is acknowledged by the API without another write.
create or replace function public.record_parent_referral(actor_auth_id uuid, target_org_id uuid, code_value text default null, name_value text default null) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.accounts; referrer_id uuid; referrer_name text; referral_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('parent-referral:' || actor_auth_id::text, 0));
  select * into actor from public.accounts where auth_user_id=actor_auth_id and org_id=target_org_id and deleted_at is null for update;
  if actor.id is null or actor.status<>'active' then raise insufficient_privilege; end if;
  if exists(select 1 from public.accounts established where established.auth_user_id=actor_auth_id and established.deleted_at is null and (established.primary_role is not null or established.onboarding_completed_at is not null)) then raise insufficient_privilege; end if;
  if exists(select 1 from public.parent_referrals r join public.accounts a on a.id=r.referred_account_id where a.auth_user_id=actor_auth_id and (r.org_id<>target_org_id or r.referred_account_id<>actor.id)) then raise insufficient_privilege; end if;
  if not exists(select 1 from public.profiles where account_id=actor.id and org_id=target_org_id and kind='guardian' and deleted_at is null) then raise insufficient_privilege; end if;
  if not exists(select 1 from auth.users where id=actor_auth_id and (email_confirmed_at is not null or phone_confirmed_at is not null)) then raise insufficient_privilege; end if;
  if code_value is not null then
    select l.referrer_account_id,p.display_name into referrer_id,referrer_name
    from public.parent_referral_links l join public.accounts a on a.id=l.referrer_account_id and a.org_id=l.org_id
    join public.profiles p on p.account_id=a.id and p.org_id=l.org_id and p.kind='guardian' and p.deleted_at is null
    where l.code=code_value and l.org_id=target_org_id and a.deleted_at is null and a.status='active' and a.primary_role='guardian' limit 1;
    if referrer_id is null or referrer_id=actor.id then raise exception 'Invalid referral' using errcode='22023'; end if;
    referrer_name=case when length(trim(coalesce(referrer_name,'')))<2 then 'ICONIC Academy parent' else left(trim(referrer_name),100) end;
  else
    referrer_name=trim(name_value);
    if referrer_name is null or length(referrer_name) not between 2 and 100 then raise exception 'Invalid parent name' using errcode='22023'; end if;
  end if;
  perform set_config('app.referral_actor',actor_auth_id::text,true);
  insert into public.parent_referrals(org_id,referred_account_id,referrer_account_id,claimed_referrer_name,attribution_source)
    values(target_org_id,actor.id,referrer_id,referrer_name,case when code_value is null then 'name' else 'link' end)
    on conflict(org_id,referred_account_id) do nothing returning id into referral_id;
  perform set_config('app.referral_actor','',true);
  return referral_id;
end; $$;
revoke all on function public.record_parent_referral(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_parent_referral(uuid,uuid,text,text) to service_role;
