create table if not exists public.channel_live_session_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  display_name text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create index if not exists channel_live_session_feedback_session_idx
  on public.channel_live_session_feedback (org_id, live_session_id);

alter table public.channel_live_session_feedback enable row level security;

-- All writes happen server-side via apps/api's service-role client (guests
-- without a profile can submit feedback too), so there is intentionally no
-- insert policy here — only a read policy for channel members/staff.
create policy "channel members can read live session feedback"
  on public.channel_live_session_feedback
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.channel_members cm
      where cm.org_id = channel_live_session_feedback.org_id
        and cm.channel_id = channel_live_session_feedback.channel_id
        and cm.deleted_at is null
        and exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = cm.profile_id
            and p.org_id = channel_live_session_feedback.org_id
            and p.deleted_at is null
            and a.auth_user_id = auth.uid()
            and a.deleted_at is null
        )
    )
  );
