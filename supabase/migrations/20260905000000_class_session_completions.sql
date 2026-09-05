-- Consolidated session-completion domain table, replacing the fragmented
-- class_session_completion_votes (confirm/dispute) + class_session_feedback (rating)
-- + activity_feed_items.metadata overlay with a single source of truth.
--
-- One row per (org_id, schedule_id, occurrence_key, profile_id): the dispatcher
-- inserts it as 'pending' when the completion check is sent; the participant's
-- confirm/dispute/rate actions update it in place. See
-- supabase/migrations/20260515000000_session_completion_votes.sql and
-- 20260517000000_fix_completion_votes_rls.sql for the conventions this follows
-- (notably: profile_id stores a profiles.id, not an auth.users id, so RLS must
-- join through accounts — the original votes table shipped with a bare
-- `profile_id = auth.uid()` policy that was always false and had to be patched).

create type public.class_session_completion_status as enum (
  'pending',
  'confirmed',
  'disputed',
  'auto_confirmed'
);

create table public.class_session_completions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.orgs(id) on delete cascade,
  schedule_id           uuid not null references public.class_schedules(id),
  occurrence_key        timestamptz not null,
  profile_id            uuid not null references public.profiles(id),
  role                  public.class_schedule_participant_role not null,

  status                public.class_session_completion_status not null default 'pending',

  dispute_category      text
                          check (dispute_category in ('teacher_absent','student_absent','technical_issue','other')),
  dispute_reason        text check (char_length(dispute_reason) <= 500),
  reschedule_requested  boolean not null default false,

  rating                smallint check (rating between 1 and 5),
  rating_comment        text check (char_length(rating_comment) <= 1000),

  -- Denormalized so the profile-facing list query (homepage carousel + inbox) needs no joins.
  channel_id            uuid,
  learning_space_id     uuid,
  session_title         text,
  session_end_at        timestamptz not null,

  notified_at           timestamptz,
  confirmed_at          timestamptz,
  disputed_at           timestamptz,
  rated_at              timestamptz,
  resolved_at           timestamptz,
  -- session_end_at + 3 days, computed once at insert. Single explicit value driving
  -- both the carousel/inbox visibility window and the auto-confirm sweep, replacing
  -- the old system's two disagreeing implicit ones (7-day cleanup job vs 3-day copy).
  expires_at            timestamptz not null,

  created_at            timestamptz not null default now(),
  created_by            uuid,
  updated_at            timestamptz not null default now(),
  updated_by            uuid,
  deleted_at            timestamptz,
  deleted_by            uuid,

  -- Idempotency key for the dispatcher's upsert. Deliberately just the natural key —
  -- no session_end_at here even though partition-readiness would want it, since that
  -- would let two racing dispatch attempts that resolve slightly different end times
  -- for the same occurrence both succeed as "different" rows, defeating the guarantee
  -- this constraint exists for.
  unique (org_id, schedule_id, occurrence_key, profile_id)
);

create index class_session_completions_schedule_idx
  on public.class_session_completions (org_id, schedule_id, occurrence_key)
  where deleted_at is null;

-- Serves the `status = 'pending'` branch of the profile-facing list query.
create index class_session_completions_profile_pending_idx
  on public.class_session_completions (org_id, profile_id, session_end_at desc)
  where deleted_at is null and status = 'pending';

-- Serves the `resolved_at > now() - interval '3 days'` branch. Without this, that
-- branch has no index of its own (the pending index doesn't cover resolved_at) and
-- degrades to a per-tenant scan as row count grows.
create index class_session_completions_profile_resolved_idx
  on public.class_session_completions (org_id, profile_id, resolved_at desc)
  where deleted_at is null and resolved_at is not null;

-- Serves the expiry sweep job.
create index class_session_completions_pending_expiry_idx
  on public.class_session_completions (expires_at)
  where deleted_at is null and status = 'pending';

alter table public.class_session_completions enable row level security;

-- Correct pattern from the start (see 20260517000000_fix_completion_votes_rls.sql):
-- profile_id is a profiles.id, so RLS must join through accounts to auth.uid(),
-- not compare profile_id to auth.uid() directly.
create policy "profile_read_own_completion"
  on public.class_session_completions
  for select
  to authenticated
  using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  );

create policy "profile_update_own_completion"
  on public.class_session_completions
  for update
  to authenticated
  using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  );

-- Deliberately no profile-facing insert policy: rows are created only by the
-- dispatcher (service role) at notify time, not by the client. This is a real,
-- intentional behavior change from the old votes table (which let a client insert
-- its own row, since it didn't exist until the user acted) — see the dispatcher's
-- idempotent upsert + reconciliation safety net for why this is safe.
create policy "service_role_all_class_session_completions"
  on public.class_session_completions
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
