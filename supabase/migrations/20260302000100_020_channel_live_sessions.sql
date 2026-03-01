create table if not exists public.channel_live_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  provider text not null,
  provider_session_id text null,
  session_scope_key text not null,
  occurrence_key timestamptz null,
  status text not null check (status in ('starting', 'live', 'ended', 'failed')),
  started_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  started_message_id uuid null references public.messages(id) on delete set null,
  join_path text not null,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null,
  provider_metadata jsonb not null default '{}'::jsonb,
  app_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create unique index if not exists channel_live_sessions_active_scope_idx
  on public.channel_live_sessions (org_id, session_scope_key)
  where deleted_at is null and status in ('starting', 'live');

create index if not exists channel_live_sessions_channel_started_idx
  on public.channel_live_sessions (org_id, channel_id, started_at desc);

create index if not exists channel_live_sessions_occurrence_idx
  on public.channel_live_sessions (org_id, occurrence_key);

create table if not exists public.channel_live_session_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  join_requested_at timestamptz null,
  first_joined_at timestamptz null,
  last_joined_at timestamptz null,
  last_left_at timestamptz null,
  join_count integer not null default 0,
  total_seconds integer null,
  last_known_status text not null default 'requested'
    check (last_known_status in ('requested', 'joined', 'left')),
  provider_participant_id text null,
  provider_metadata jsonb not null default '{}'::jsonb,
  app_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null,
  unique (org_id, live_session_id, profile_id)
);

create index if not exists channel_live_session_participants_session_idx
  on public.channel_live_session_participants (org_id, live_session_id);

create table if not exists public.channel_live_session_participant_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  provider_participant_id text null,
  provider text not null,
  event_type text not null
    check (event_type in ('join_requested', 'participant_joined', 'participant_left', 'session_started', 'session_ended')),
  occurred_at timestamptz not null,
  source text not null check (source in ('app', 'provider_webhook')),
  provider_event_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create unique index if not exists channel_live_session_participant_events_provider_event_idx
  on public.channel_live_session_participant_events (provider, provider_event_id)
  where provider_event_id is not null and deleted_at is null;

create index if not exists channel_live_session_participant_events_session_idx
  on public.channel_live_session_participant_events (org_id, live_session_id, occurred_at);

create table if not exists public.message_live_session_started (
  message_id uuid primary key references public.messages(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

alter publication supabase_realtime add table public.message_live_session_started;

alter table public.channel_live_sessions enable row level security;
alter table public.channel_live_session_participants enable row level security;
alter table public.channel_live_session_participant_events enable row level security;
alter table public.message_live_session_started enable row level security;

create policy "channel members can read live sessions"
  on public.channel_live_sessions
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.channel_members cm
      where cm.org_id = channel_live_sessions.org_id
        and cm.channel_id = channel_live_sessions.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = channel_live_sessions.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );

create policy "channel members can read live session participants"
  on public.channel_live_session_participants
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.channel_members cm
      where cm.org_id = channel_live_session_participants.org_id
        and cm.channel_id = channel_live_session_participants.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = channel_live_session_participants.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );

create policy "channel members can read live session events"
  on public.channel_live_session_participant_events
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.channel_members cm
      where cm.org_id = channel_live_session_participant_events.org_id
        and cm.channel_id = channel_live_session_participant_events.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = channel_live_session_participant_events.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );

create policy "channel members can read live session started messages"
  on public.message_live_session_started
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.messages m
      join public.channel_members cm
        on cm.channel_id = m.channel_id
       and cm.org_id = m.org_id
       and cm.deleted_at is null
      join public.profiles p
        on p.id = cm.profile_id
       and p.org_id = m.org_id
       and p.deleted_at is null
      join public.accounts a
        on a.id = p.account_id
       and a.deleted_at is null
      where m.id = message_live_session_started.message_id
        and m.org_id = message_live_session_started.org_id
        and m.deleted_at is null
        and a.auth_user_id = auth.uid()
    )
  );
