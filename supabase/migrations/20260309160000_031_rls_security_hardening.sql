-- RLS Security Hardening
-- Addresses gaps found across all public tables:
--   1. message_saves           — RLS not enabled; no policies
--   2. activity_feed_items     — SELECT policy too broad (all org members)
--   3. activity_feed_group_members — SELECT policy too broad (all org members)
--   4. channel_live_sessions + related — SELECT-only; no write/admin policies

-- ============================================================
-- 1. message_saves: enable RLS + self-access + admin read
-- ============================================================

alter table public.message_saves enable row level security;

-- Users can manage their own saves inside channels they belong to
create policy "message saves self"
  on public.message_saves
  for all
  using (
    deleted_at is null
    and public.is_profile_owner(profile_id)
    and public.is_channel_member(channel_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(profile_id)
    and public.is_channel_member(channel_id)
  );

-- Admins can read all saves in their org (e.g. moderation/reporting)
create policy "message saves read by admin"
  on public.message_saves
  for select
  using (deleted_at is null and public.is_org_admin(org_id));

-- ============================================================
-- 2. activity_feed_items: tighten SELECT to recipient or admin
--    The previous "activity feed read by org" policy exposed every
--    feed item to all org members regardless of recipient.
-- ============================================================

drop policy if exists "activity feed read by org" on public.activity_feed_items;

create policy "activity feed read own or admin"
  on public.activity_feed_items
  for select
  using (
    deleted_at is null
    and (
      public.is_profile_owner(recipient_profile_id)
      or public.is_org_admin(org_id)
    )
  );

-- ============================================================
-- 3. activity_feed_group_members: tighten SELECT to group
--    recipient (via parent feed item) or admin
-- ============================================================

drop policy if exists "activity feed groups read by org" on public.activity_feed_group_members;

create policy "activity feed groups read own or admin"
  on public.activity_feed_group_members
  for select
  using (
    deleted_at is null
    and (
      public.is_org_admin(org_id)
      or exists (
        select 1
        from public.activity_feed_items fi
        where fi.id = group_id
          and fi.deleted_at is null
          and public.is_profile_owner(fi.recipient_profile_id)
      )
    )
  );

-- ============================================================
-- 4. channel_live_sessions: add admin write policies
--    Backend service_role already bypasses RLS; these policies
--    give org admins explicit management access via the client.
-- ============================================================

create policy "live sessions manage by admin"
  on public.channel_live_sessions
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session participants manage by admin"
  on public.channel_live_session_participants
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session events manage by admin"
  on public.channel_live_session_participant_events
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session expected participants manage by admin"
  on public.channel_live_session_expected_participants
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session started messages manage by admin"
  on public.message_live_session_started
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));
