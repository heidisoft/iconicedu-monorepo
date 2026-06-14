create table live_session_attendance (
  id              uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references channel_live_sessions(id) on delete cascade,
  profile_id      uuid not null,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  duration_seconds int generated always as (
    case when left_at is not null then
      extract(epoch from (left_at - joined_at))::int
    else null end
  ) stored
);

create index on live_session_attendance(live_session_id);
create index on live_session_attendance(profile_id);

alter table live_session_attendance enable row level security;

-- Channel members can read attendance for their sessions
create policy "channel members can read attendance"
  on live_session_attendance
  for select
  using (
    exists (
      select 1
      from channel_live_sessions cls
      join channel_members cm on cm.channel_id = cls.channel_id
      where cls.id = live_session_attendance.live_session_id
        and cm.profile_id = auth.uid()
    )
  );
