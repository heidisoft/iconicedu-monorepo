create table if not exists public.whiteboard_sessions (
  id              uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  org_id          uuid not null,
  channel_id      uuid not null,
  snapshot        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists whiteboard_sessions_live_session_idx
  on public.whiteboard_sessions (live_session_id);

create index if not exists whiteboard_sessions_channel_idx
  on public.whiteboard_sessions (org_id, channel_id);

alter table public.whiteboard_sessions enable row level security;

create policy "channel members can read whiteboard sessions"
  on public.whiteboard_sessions
  for select
  using (
    exists (
      select 1
      from public.channel_members cm
      where cm.org_id = whiteboard_sessions.org_id
        and cm.channel_id = whiteboard_sessions.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = whiteboard_sessions.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );

create policy "channel members can insert whiteboard sessions"
  on public.whiteboard_sessions
  for insert
  with check (
    exists (
      select 1
      from public.channel_members cm
      where cm.org_id = whiteboard_sessions.org_id
        and cm.channel_id = whiteboard_sessions.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = whiteboard_sessions.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );

create policy "channel members can update whiteboard sessions"
  on public.whiteboard_sessions
  for update
  using (
    exists (
      select 1
      from public.channel_members cm
      where cm.org_id = whiteboard_sessions.org_id
        and cm.channel_id = whiteboard_sessions.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = whiteboard_sessions.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );
