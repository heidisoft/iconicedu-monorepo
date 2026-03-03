create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  source_kind text not null
    check (source_kind in ('profile', 'system', 'integration', 'provider_webhook')),
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  scope jsonb not null,
  object_ref jsonb null,
  target_ref jsonb null,
  payload jsonb not null default '{}'::jsonb,
  audience_rules jsonb not null default '[]'::jsonb,
  dedupe_key text null,
  projection_status text not null default 'pending'
    check (projection_status in ('pending', 'processing', 'projected', 'failed')),
  projection_attempts integer not null default 0,
  last_projection_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists activity_events_org_occurred_idx
  on public.activity_events (org_id, occurred_at desc);

create unique index if not exists activity_events_org_dedupe_idx
  on public.activity_events (org_id, dedupe_key)
  where dedupe_key is not null and deleted_at is null;

create index if not exists activity_events_projection_status_idx
  on public.activity_events (projection_status, occurred_at)
  where deleted_at is null;

alter table public.activity_events enable row level security;

create policy "activity events read by admin"
  on public.activity_events
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "activity events manage by admin"
  on public.activity_events
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

alter table public.activity_feed_items
  add column if not exists recipient_profile_id uuid null references public.profiles(id) on delete cascade,
  add column if not exists source_event_id uuid null references public.activity_events(id) on delete cascade,
  add column if not exists dedupe_key text null,
  add column if not exists read_at timestamptz null;

create index if not exists activity_feed_items_recipient_occurred_idx
  on public.activity_feed_items (org_id, recipient_profile_id, occurred_at desc)
  where deleted_at is null;

create index if not exists activity_feed_items_recipient_tab_occurred_idx
  on public.activity_feed_items (org_id, recipient_profile_id, tab_key, occurred_at desc)
  where deleted_at is null;

create unique index if not exists activity_feed_items_recipient_source_event_idx
  on public.activity_feed_items (recipient_profile_id, source_event_id)
  where recipient_profile_id is not null and source_event_id is not null and deleted_at is null;

create unique index if not exists activity_feed_items_recipient_dedupe_idx
  on public.activity_feed_items (recipient_profile_id, dedupe_key)
  where recipient_profile_id is not null and dedupe_key is not null and deleted_at is null;
