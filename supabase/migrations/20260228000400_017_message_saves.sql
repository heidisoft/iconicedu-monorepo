create table if not exists public.message_saves (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  unique (org_id, message_id, profile_id)
);

create index if not exists idx_message_saves_org_profile_channel
  on public.message_saves (org_id, profile_id, channel_id)
  where deleted_at is null;

create index if not exists idx_message_saves_org_message
  on public.message_saves (org_id, message_id)
  where deleted_at is null;
