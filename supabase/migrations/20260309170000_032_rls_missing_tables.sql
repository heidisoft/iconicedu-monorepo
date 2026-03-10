-- RLS for tables missing from migration history
--
-- Tables found in the live schema that had no RLS policies:
--   1. educator_availabilities — table exists in DB with no migration, no RLS
--   2. auth_telemetry_events   — RLS enabled but no policies (deny-all for clients,
--                                which is correct for writes; adds admin read)

-- ============================================================
-- 1. educator_availabilities
--    Table exists in live DB but was never captured in a migration.
--    We recreate it idempotently here so the migration history is
--    complete, then enable RLS and attach policies.
-- ============================================================

create table if not exists public.educator_availabilities (
  profile_id uuid not null primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  class_types text[] not null default '{}',
  weekly_commitment integer not null default 0,
  availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

alter table public.educator_availabilities enable row level security;

-- Any org member can read educator availability (needed for scheduling / matching)
create policy "educator availabilities read by org"
  on public.educator_availabilities
  for select
  using (deleted_at is null and public.is_org_member(org_id));

-- Educators manage their own; admins manage all
create policy "educator availabilities manage self or admin"
  on public.educator_availabilities
  for all
  using (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
    )
  );

-- ============================================================
-- 2. auth_telemetry_events
--    RLS is already enabled. With no policies the default is
--    deny-all for authenticated clients, which is correct
--    (the NestJS API writes via service_role which bypasses RLS).
--    Add an explicit admin read policy for audit visibility.
-- ============================================================

-- No deleted_at on this table — it is an append-only audit log.
create policy "auth telemetry events read by admin"
  on public.auth_telemetry_events
  for select
  using (public.is_org_admin(org_id));
