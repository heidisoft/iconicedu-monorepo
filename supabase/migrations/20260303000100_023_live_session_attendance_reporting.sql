create table if not exists public.channel_live_session_expected_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_kind text not null check (source_kind in ('scheduled_roster', 'channel_membership', 'manual')),
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null,
  unique (org_id, live_session_id, profile_id)
);

create index if not exists channel_live_session_expected_participants_session_idx
  on public.channel_live_session_expected_participants (org_id, live_session_id);

alter table public.channel_live_sessions
  add column if not exists expected_participant_count integer not null default 0,
  add column if not exists attendee_count integer not null default 0,
  add column if not exists full_attendance_count integer not null default 0,
  add column if not exists partial_attendance_count integer not null default 0,
  add column if not exists no_show_count integer not null default 0,
  add column if not exists session_duration_seconds integer null,
  add column if not exists report_generated_at timestamptz null,
  add column if not exists attendance_policy jsonb not null default '{"fullAttendanceThresholdPercent":90,"graceSeconds":0,"countLateJoinAsAttended":true,"countRejoins":true,"source":"hybrid"}'::jsonb,
  add column if not exists report_status text not null default 'pending'
    check (report_status in ('pending', 'generated', 'stale', 'failed'));

alter table public.channel_live_session_participants
  add column if not exists expected_to_attend boolean not null default false,
  add column if not exists attendance_status text null
    check (attendance_status in ('expected', 'attended', 'partial', 'full', 'no_show', 'excused')),
  add column if not exists attendance_ratio numeric(6,5) null,
  add column if not exists qualified_full_attendance boolean not null default false,
  add column if not exists required_seconds integer null,
  add column if not exists credited_seconds integer null,
  add column if not exists evaluation_reason text null,
  add column if not exists evaluated_at timestamptz null,
  add column if not exists evaluation_version text null;

alter table public.channel_live_session_participant_events
  add column if not exists normalized_event_version text null,
  add column if not exists raw_provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists correlation_key text null;

alter table public.channel_live_session_expected_participants enable row level security;

create policy "channel members can read live session expected participants"
  on public.channel_live_session_expected_participants
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.channel_members cm
      where cm.org_id = channel_live_session_expected_participants.org_id
        and cm.channel_id = channel_live_session_expected_participants.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = channel_live_session_expected_participants.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );
