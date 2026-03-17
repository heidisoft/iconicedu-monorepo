alter table public.accounts
  add column if not exists active_profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_active_profile_id_fkey'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_active_profile_id_fkey
      foreign key (active_profile_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

with ranked_profiles as (
  select
    p.id,
    p.account_id,
    p.org_id,
    row_number() over (
      partition by p.org_id, p.account_id
      order by p.created_at desc, p.id desc
    ) as rn
  from public.profiles p
  where p.deleted_at is null
)
update public.accounts a
set active_profile_id = rp.id
from ranked_profiles rp
where a.id = rp.account_id
  and a.org_id = rp.org_id
  and rp.rn = 1
  and a.active_profile_id is null
  and a.deleted_at is null;

drop index if exists public.profiles_org_account_unique;

create unique index if not exists profiles_org_account_kind_unique
  on public.profiles (org_id, account_id, kind)
  where deleted_at is null;

create index if not exists accounts_org_active_profile_idx
  on public.accounts (org_id, active_profile_id)
  where deleted_at is null;
