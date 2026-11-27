-- Links identify a referrer, never authenticate the recipient or grant family access.
create table public.parent_referral_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  referrer_account_id uuid not null references public.accounts(id),
  code text not null unique check (code ~ '^[a-f0-9]{48}$'),
  created_at timestamptz not null default now(),
  unique(org_id, referrer_account_id)
);
create table public.parent_referrals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  referred_account_id uuid not null references public.accounts(id),
  referrer_account_id uuid references public.accounts(id),
  claimed_referrer_name text not null check (length(claimed_referrer_name) between 2 and 100),
  attribution_source text not null check (attribution_source in ('link','name')),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','fulfilled')),
  reward_label text not null default '$20 off',
  review_note text,
  created_at timestamptz not null default now(),
  unique(org_id, referred_account_id),
  check (referrer_account_id is distinct from referred_account_id),
  check (status in ('pending_review','rejected') or referrer_account_id is not null)
);
create table public.parent_referral_events (
  id bigint generated always as identity primary key,
  referral_id uuid not null references public.parent_referrals(id),
  org_id uuid not null references public.orgs(id),
  actor_auth_user_id uuid,
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.parent_referral_links enable row level security;
alter table public.parent_referrals enable row level security;
alter table public.parent_referral_events enable row level security;
revoke all on public.parent_referral_links, public.parent_referrals, public.parent_referral_events from anon, authenticated;
grant select, insert, update, delete on public.parent_referral_links, public.parent_referrals to service_role;
revoke all on public.parent_referral_events from service_role;
grant select, insert on public.parent_referral_events to service_role;
grant usage, select on sequence public.parent_referral_events_id_seq to service_role;
create function public.audit_parent_referral() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.parent_referral_events(referral_id,org_id,actor_auth_user_id,before_data,after_data)
  values(new.id,new.org_id,coalesce(nullif(current_setting('app.referral_actor',true),'')::uuid,auth.uid()),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
  return new;
end; $$;
revoke all on function public.audit_parent_referral() from public, anon, authenticated;
create trigger audit_parent_referral after insert or update on public.parent_referrals for each row execute function public.audit_parent_referral();

create function public.get_parent_referral_link(actor_auth_id uuid, target_org_id uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.accounts; link public.parent_referral_links;
begin
  select * into actor from public.accounts where auth_user_id=actor_auth_id and org_id=target_org_id and deleted_at is null and primary_role='guardian' and status='active' limit 1;
  if actor.id is null then raise insufficient_privilege; end if;
  insert into public.parent_referral_links(org_id, referrer_account_id, code)
    values(actor.org_id,actor.id,encode(extensions.gen_random_bytes(24),'hex'))
    on conflict(org_id,referrer_account_id) do nothing;
  select * into link from public.parent_referral_links where org_id=actor.org_id and referrer_account_id=actor.id;
  return jsonb_build_object('code',link.code);
end; $$;

create function public.resolve_parent_referral(code_value text) returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('orgSlug',o.slug,'referrerName',coalesce(nullif(p.display_name,''),'An ICONIC Academy parent'))
  from public.parent_referral_links l join public.accounts a on a.id=l.referrer_account_id and a.org_id=l.org_id
  join public.orgs o on o.id=l.org_id
  join public.profiles p on p.account_id=a.id and p.org_id=l.org_id and p.kind='guardian' and p.deleted_at is null
  where l.code=code_value and a.deleted_at is null and a.status='active' and a.primary_role='guardian' limit 1;
$$;

create function public.record_parent_referral(actor_auth_id uuid, target_org_id uuid, code_value text default null, name_value text default null) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.accounts; referrer_id uuid; referrer_name text; referral_id uuid;
begin
  select * into actor from public.accounts where auth_user_id=actor_auth_id and org_id=target_org_id and deleted_at is null for update;
  if actor.id is null or actor.status<>'active' or actor.onboarding_completed_at is not null or actor.primary_role not in ('guardian') and actor.primary_role is not null then raise insufficient_privilege; end if;
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
revoke all on function public.get_parent_referral_link(uuid,uuid), public.resolve_parent_referral(text), public.record_parent_referral(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.get_parent_referral_link(uuid,uuid), public.resolve_parent_referral(text), public.record_parent_referral(uuid,uuid,text,text) to service_role;

create function public.guard_parent_referral_scope() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op='UPDATE' and (new.org_id is distinct from old.org_id or new.referred_account_id is distinct from old.referred_account_id) then raise exception 'Referral identity is immutable' using errcode='22023'; end if;
  if not exists(select 1 from public.accounts where id=new.referred_account_id and org_id=new.org_id) or
     (new.referrer_account_id is not null and not exists(select 1 from public.accounts where id=new.referrer_account_id and org_id=new.org_id)) then raise exception 'Invalid referral organization' using errcode='22023'; end if;
  return new;
end; $$;
revoke all on function public.guard_parent_referral_scope() from public, anon, authenticated;
create trigger guard_parent_referral_scope before insert or update on public.parent_referrals for each row execute function public.guard_parent_referral_scope();

-- Review records the human operator; fulfilment remains a manual Stripe action.
create function public.review_parent_referral(reviewer_auth_id uuid, referral_id_value uuid, status_value text, note_value text, referrer_id_value uuid default null) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.accounts; referral public.parent_referrals;
begin
  select * into referral from public.parent_referrals where id=referral_id_value for update;
  select * into actor from public.accounts where auth_user_id=reviewer_auth_id and org_id=referral.org_id and primary_role in ('staff','admin','owner') and status='active' and deleted_at is null limit 1;
  if actor.id is null then raise insufficient_privilege; end if;
  if status_value not in ('approved','rejected','fulfilled') or length(trim(coalesce(note_value,''))) not between 3 and 1000 then raise exception 'Review details required' using errcode='22023'; end if;
  if referral.status='fulfilled' then
    if status_value='fulfilled' then return; end if;
    raise exception 'Fulfilled referrals are final' using errcode='22023';
  end if;
  if status_value='fulfilled' and referral.status<>'approved' then raise exception 'Approve before fulfilment' using errcode='22023'; end if;
  if status_value in ('approved','fulfilled') and coalesce(referrer_id_value,referral.referrer_account_id) is null then raise exception 'Confirm the referring parent account' using errcode='22023'; end if;
  if referrer_id_value is not null and not exists(select 1 from public.accounts where id=referrer_id_value and org_id=referral.org_id and primary_role='guardian' and status='active' and deleted_at is null) then raise exception 'Invalid referring parent' using errcode='22023'; end if;
  perform set_config('app.referral_actor',reviewer_auth_id::text,true);
  update public.parent_referrals set status=status_value,review_note=trim(note_value),referrer_account_id=coalesce(referrer_id_value,referrer_account_id) where id=referral.id;
  perform set_config('app.referral_actor','',true);
end; $$;
revoke all on function public.review_parent_referral(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.review_parent_referral(uuid,uuid,text,text,uuid) to service_role;
