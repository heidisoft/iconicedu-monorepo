-- Staff-facing connection-quality monitoring (FR-043) and a privileged-action
-- audit trail (FR-044) for live sessions. Both are populated exclusively by
-- apps/api's service-role client from client-reported SDK events / in-session
-- host actions — there is intentionally no insert policy for either table,
-- only a read policy scoped to org admins/staff.

create table if not exists public.channel_live_session_quality_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  display_name text not null,
  metric text not null check (metric in ('network_quality', 'connection_state')),
  -- network_quality: 'bad' | 'normal' | 'good' (collapsed from the SDK's 0-5
  -- uplink/downlink levels). connection_state: 'reconnecting' | 'fail'
  -- (we only report degraded states, never the steady-state 'connected').
  level text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists channel_live_session_quality_events_session_idx
  on public.channel_live_session_quality_events (org_id, live_session_id, occurred_at);

alter table public.channel_live_session_quality_events enable row level security;

create policy "org admins can read live session quality events"
  on public.channel_live_session_quality_events
  for select
  to authenticated
  using (deleted_at is null and public.is_org_admin(org_id));

create table if not exists public.channel_live_session_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  target_profile_id uuid null references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists channel_live_session_audit_events_session_idx
  on public.channel_live_session_audit_events (org_id, live_session_id, occurred_at);

alter table public.channel_live_session_audit_events enable row level security;

create policy "org admins can read live session audit events"
  on public.channel_live_session_audit_events
  for select
  to authenticated
  using (deleted_at is null and public.is_org_admin(org_id));
