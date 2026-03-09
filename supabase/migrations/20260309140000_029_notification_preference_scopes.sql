create table if not exists public.notification_preference_scopes (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope_kind text not null check (scope_kind in ('channel', 'learning_space')),
  scope_id uuid not null,
  pref_key text not null,
  channels public.notification_channel[] not null,
  muted boolean,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  unique (org_id, profile_id, scope_kind, scope_id, pref_key)
);

create index if not exists notification_preference_scopes_org_profile_scope_idx
  on public.notification_preference_scopes (org_id, profile_id, scope_kind, scope_id)
  where deleted_at is null;

create index if not exists notification_preference_scopes_org_profile_pref_idx
  on public.notification_preference_scopes (org_id, profile_id, pref_key)
  where deleted_at is null;

alter table public.notification_preference_scopes enable row level security;

drop policy if exists "notification preference scopes self" on public.notification_preference_scopes;

create policy "notification preference scopes self"
  on public.notification_preference_scopes
  for all
  using (
    deleted_at is null
    and public.is_profile_owner(profile_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(profile_id)
  );
