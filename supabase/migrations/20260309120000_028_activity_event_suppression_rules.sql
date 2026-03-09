create table if not exists public.activity_event_suppression_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid null references public.profiles(id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create unique index if not exists activity_event_suppression_rules_org_event_actor_uidx
  on public.activity_event_suppression_rules (org_id, event_type, actor_profile_id)
  where actor_profile_id is not null and deleted_at is null;

create unique index if not exists activity_event_suppression_rules_org_event_uidx
  on public.activity_event_suppression_rules (org_id, event_type)
  where actor_profile_id is null and deleted_at is null;

create index if not exists activity_event_suppression_rules_org_event_idx
  on public.activity_event_suppression_rules (org_id, event_type)
  where deleted_at is null;

alter table public.activity_event_suppression_rules enable row level security;

create policy "activity event suppression rules read by admin"
  on public.activity_event_suppression_rules
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "activity event suppression rules manage by admin"
  on public.activity_event_suppression_rules
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));
