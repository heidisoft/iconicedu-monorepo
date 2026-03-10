-- =============================================================================
-- 033: Comprehensive RLS Policy Reset
--
-- Drops every existing policy on every public table, then recreates a
-- clean, consolidated set from scratch.
--
-- Helper functions used (already exist in the DB):
--   current_account_id()            → calling user's accounts.id
--   is_org_member(org_id)           → active account in org
--   is_org_admin(org_id)            → owner or admin role in org
--   is_profile_owner(profile_id)    → profile belongs to calling user
--   is_channel_member(channel_id)   → active channel_members row
--   can_manage_channel(channel_id)  → org admin or channel owner
--   can_access_message(message_id)  → channel member + visibility check
--   can_supervise_channel(chan_id)  → guardian of a child in this DM channel
--   can_supervise_message(msg_id)   → guardian read via supervised channel
--   can_staff_observe_channel(c_id) → staff user not already a channel member
--   can_staff_observe_message(m_id) → staff read via observed channel
--   is_learning_space_participant() → active learning_space_participants row
--   can_manage_learning_space()     → org admin or space creator
--   is_schedule_participant()       → active class_schedule_participants row
--   can_manage_schedule()           → org admin or schedule creator
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1 – drop every existing policy across the public schema dynamically
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Step 2 – ensure RLS is enabled on every table (idempotent)
-- ---------------------------------------------------------------------------
alter table public.orgs                                      enable row level security;
alter table public.accounts                                  enable row level security;
alter table public.user_roles                                enable row level security;
alter table public.profiles                                  enable row level security;
alter table public.educator_profiles                         enable row level security;
alter table public.child_profiles                            enable row level security;
alter table public.guardian_profiles                         enable row level security;
alter table public.staff_profiles                            enable row level security;
alter table public.profile_presence                          enable row level security;
alter table public.educator_availabilities                   enable row level security;
alter table public.educator_profile_subjects                 enable row level security;
alter table public.educator_profile_grade_levels             enable row level security;
alter table public.educator_profile_curriculum_tags          enable row level security;
alter table public.educator_profile_badges                   enable row level security;
alter table public.child_profile_grade_level                 enable row level security;
alter table public.staff_profile_specialties                 enable row level security;
alter table public.families                                  enable row level security;
alter table public.family_links                              enable row level security;
alter table public.family_link_invites                       enable row level security;
alter table public.notification_preferences                  enable row level security;
alter table public.notification_preference_scopes            enable row level security;
alter table public.channels                                  enable row level security;
alter table public.channel_members                           enable row level security;
alter table public.channel_capabilities                      enable row level security;
alter table public.channel_read_state                        enable row level security;
alter table public.channel_media                             enable row level security;
alter table public.channel_files                             enable row level security;
alter table public.messages                                  enable row level security;
alter table public.message_saves                             enable row level security;
alter table public.message_text                              enable row level security;
alter table public.message_image                             enable row level security;
alter table public.message_file                              enable row level security;
alter table public.message_design_file_update                enable row level security;
alter table public.message_payment_reminder                  enable row level security;
alter table public.message_event_reminder                    enable row level security;
alter table public.message_feedback_request                  enable row level security;
alter table public.message_lesson_assignment                 enable row level security;
alter table public.message_progress_update                   enable row level security;
alter table public.message_session_booking                   enable row level security;
alter table public.message_session_complete                  enable row level security;
alter table public.message_session_summary                   enable row level security;
alter table public.message_homework_submission               enable row level security;
alter table public.message_link_preview                      enable row level security;
alter table public.message_audio_recording                   enable row level security;
alter table public.message_live_session_started              enable row level security;
alter table public.message_reactions                         enable row level security;
alter table public.message_reaction_counts                   enable row level security;
alter table public.threads                                   enable row level security;
alter table public.thread_participants                        enable row level security;
alter table public.thread_read_state                         enable row level security;
alter table public.learning_spaces                           enable row level security;
alter table public.learning_space_channels                   enable row level security;
alter table public.learning_space_participants               enable row level security;
alter table public.learning_space_links                      enable row level security;
alter table public.class_schedules                           enable row level security;
alter table public.class_schedule_participants               enable row level security;
alter table public.class_schedule_recurrence                 enable row level security;
alter table public.class_schedule_recurrence_exceptions      enable row level security;
alter table public.class_schedule_recurrence_overrides       enable row level security;
alter table public.channel_live_sessions                     enable row level security;
alter table public.channel_live_session_participants         enable row level security;
alter table public.channel_live_session_participant_events   enable row level security;
alter table public.channel_live_session_expected_participants enable row level security;
alter table public.activity_events                           enable row level security;
alter table public.activity_event_suppression_rules          enable row level security;
alter table public.activity_feed_items                       enable row level security;
alter table public.activity_feed_group_members               enable row level security;
alter table public.message_session_feedback                  enable row level security;
alter table public.reminder_jobs                             enable row level security;
alter table public.reminder_dispatch_logs                    enable row level security;
alter table public.user_onboarding_status                    enable row level security;
alter table public.auth_telemetry_events                     enable row level security;

-- =============================================================================
-- Step 3 – policies, grouped by domain
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CORE / AUTH
-- ---------------------------------------------------------------------------

-- orgs
create policy "orgs select by member"
  on public.orgs for select
  using (deleted_at is null and public.is_org_member(id));

create policy "orgs all by admin"
  on public.orgs for all
  using (deleted_at is null and public.is_org_admin(id))
  with check (deleted_at is null and public.is_org_admin(id));

-- accounts
create policy "accounts select self or admin"
  on public.accounts for select
  using (
    deleted_at is null
    and (id = public.current_account_id() or public.is_org_admin(org_id))
  );

create policy "accounts update self or admin"
  on public.accounts for update
  using (
    deleted_at is null
    and (id = public.current_account_id() or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (id = public.current_account_id() or public.is_org_admin(org_id))
  );

create policy "accounts insert by admin"
  on public.accounts for insert
  with check (public.is_org_admin(org_id));

create policy "accounts delete by admin"
  on public.accounts for delete
  using (public.is_org_admin(org_id));

-- user_roles
create policy "user roles select by admin"
  on public.user_roles for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "user roles all by admin"
  on public.user_roles for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------

-- profiles
create policy "profiles select by org"
  on public.profiles for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "profiles update self or admin"
  on public.profiles for update
  using (
    deleted_at is null
    and (public.is_profile_owner(id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(id) or public.is_org_admin(org_id))
  );

create policy "profiles insert by admin"
  on public.profiles for insert
  with check (public.is_org_admin(org_id));

create policy "profiles delete by admin"
  on public.profiles for delete
  using (public.is_org_admin(org_id));

-- educator_profiles
create policy "educator profiles select by org"
  on public.educator_profiles for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator profiles all self or admin"
  on public.educator_profiles for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- child_profiles
-- SELECT: any org member (educators need to view their students)
create policy "child profiles select by org"
  on public.child_profiles for select
  using (deleted_at is null and public.is_org_member(org_id));

-- INSERT: admin only (admins provision child accounts)
create policy "child profiles insert by admin"
  on public.child_profiles for insert
  with check (public.is_org_admin(org_id));

-- UPDATE: child self, linked guardian, or admin
create policy "child profiles update self guardian or admin"
  on public.child_profiles for update
  using (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts ga
          on ga.id = fl.guardian_account_id
         and ga.auth_user_id = auth.uid()
         and ga.deleted_at is null
        join public.profiles cp
          on cp.id = child_profiles.profile_id
         and cp.account_id = fl.child_account_id
         and cp.deleted_at is null
        where fl.deleted_at is null
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts ga
          on ga.id = fl.guardian_account_id
         and ga.auth_user_id = auth.uid()
         and ga.deleted_at is null
        join public.profiles cp
          on cp.id = child_profiles.profile_id
         and cp.account_id = fl.child_account_id
         and cp.deleted_at is null
        where fl.deleted_at is null
      )
    )
  );

-- DELETE: admin only
create policy "child profiles delete by admin"
  on public.child_profiles for delete
  using (public.is_org_admin(org_id));

-- guardian_profiles
create policy "guardian profiles select by org"
  on public.guardian_profiles for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "guardian profiles all self or admin"
  on public.guardian_profiles for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- staff_profiles
create policy "staff profiles select by org"
  on public.staff_profiles for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "staff profiles all self or admin"
  on public.staff_profiles for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- profile_presence
create policy "profile presence select by org"
  on public.profile_presence for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "profile presence all self or admin"
  on public.profile_presence for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- educator_availabilities
create policy "educator availabilities select by org"
  on public.educator_availabilities for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator availabilities all self or admin"
  on public.educator_availabilities for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- ---------------------------------------------------------------------------
-- PROFILE SPECIALISATION SUB-TABLES
-- Same pattern: org read, self/admin write
-- ---------------------------------------------------------------------------

create policy "educator subjects select by org"
  on public.educator_profile_subjects for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator subjects all self or admin"
  on public.educator_profile_subjects for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

create policy "educator grade levels select by org"
  on public.educator_profile_grade_levels for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator grade levels all self or admin"
  on public.educator_profile_grade_levels for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

create policy "educator curriculum tags select by org"
  on public.educator_profile_curriculum_tags for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator curriculum tags all self or admin"
  on public.educator_profile_curriculum_tags for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

create policy "educator badges select by org"
  on public.educator_profile_badges for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "educator badges all self or admin"
  on public.educator_profile_badges for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- child_profile_grade_level: same child/guardian/admin update pattern
create policy "child grade level select by org"
  on public.child_profile_grade_level for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "child grade level insert self or admin"
  on public.child_profile_grade_level for insert
  with check (
    public.is_profile_owner(profile_id) or public.is_org_admin(org_id)
  );

create policy "child grade level update self guardian or admin"
  on public.child_profile_grade_level for update
  using (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts ga
          on ga.id = fl.guardian_account_id
         and ga.auth_user_id = auth.uid()
         and ga.deleted_at is null
        join public.profiles cp
          on cp.id = child_profile_grade_level.profile_id
         and cp.account_id = fl.child_account_id
         and cp.deleted_at is null
        where fl.deleted_at is null
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts ga
          on ga.id = fl.guardian_account_id
         and ga.auth_user_id = auth.uid()
         and ga.deleted_at is null
        join public.profiles cp
          on cp.id = child_profile_grade_level.profile_id
         and cp.account_id = fl.child_account_id
         and cp.deleted_at is null
        where fl.deleted_at is null
      )
    )
  );

create policy "child grade level delete self or admin"
  on public.child_profile_grade_level for delete
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

create policy "staff specialties select by org"
  on public.staff_profile_specialties for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "staff specialties all self or admin"
  on public.staff_profile_specialties for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- ---------------------------------------------------------------------------
-- FAMILY
-- ---------------------------------------------------------------------------

create policy "families select by org"
  on public.families for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "families all by admin"
  on public.families for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "family links select by org"
  on public.family_links for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "family links all by admin"
  on public.family_links for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- family_link_invites
-- Creators can see and delete their own invites; admins have full access.
create policy "family link invites select by creator or admin"
  on public.family_link_invites for select
  using (
    deleted_at is null
    and (
      public.is_org_admin(org_id)
      or created_by_account_id = public.current_account_id()
      or accepted_by_account_id = public.current_account_id()
    )
  );

create policy "family link invites insert by admin"
  on public.family_link_invites for insert
  with check (public.is_org_admin(org_id));

create policy "family link invites delete by creator or admin"
  on public.family_link_invites for delete
  using (
    deleted_at is null
    and (
      public.is_org_admin(org_id)
      or created_by_account_id = public.current_account_id()
    )
  );

-- ---------------------------------------------------------------------------
-- PREFERENCES
-- ---------------------------------------------------------------------------

create policy "notification preferences all self"
  on public.notification_preferences for all
  using (deleted_at is null and public.is_profile_owner(profile_id))
  with check (deleted_at is null and public.is_profile_owner(profile_id));

create policy "notification preference scopes all self"
  on public.notification_preference_scopes for all
  using (deleted_at is null and public.is_profile_owner(profile_id))
  with check (deleted_at is null and public.is_profile_owner(profile_id));

-- ---------------------------------------------------------------------------
-- CHANNELS
-- ---------------------------------------------------------------------------

-- channels: member/public visibility + staff observer read
create policy "channels select by membership or public"
  on public.channels for select
  using (
    deleted_at is null
    and public.is_org_member(org_id)
    and (visibility = 'public' or public.is_channel_member(id))
  );

create policy "channels select staff observer"
  on public.channels for select
  using (deleted_at is null and public.can_staff_observe_channel(id));

create policy "channels all by manager"
  on public.channels for all
  using (deleted_at is null and public.can_manage_channel(id))
  with check (deleted_at is null and public.can_manage_channel(id));

-- channel_members
create policy "channel members select by member"
  on public.channel_members for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "channel members select supervised guardian"
  on public.channel_members for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "channel members select staff observer"
  on public.channel_members for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel members all by manager"
  on public.channel_members for all
  using (deleted_at is null and public.can_manage_channel(channel_id))
  with check (deleted_at is null and public.can_manage_channel(channel_id));

-- channel_capabilities
create policy "channel capabilities select by member"
  on public.channel_capabilities for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "channel capabilities select staff observer"
  on public.channel_capabilities for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel capabilities all by manager"
  on public.channel_capabilities for all
  using (deleted_at is null and public.can_manage_channel(channel_id))
  with check (deleted_at is null and public.can_manage_channel(channel_id));

-- channel_read_state: own account only
create policy "channel read state all self"
  on public.channel_read_state for all
  using (deleted_at is null and account_id = public.current_account_id())
  with check (deleted_at is null and account_id = public.current_account_id());

-- channel_media
create policy "channel media select by member"
  on public.channel_media for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "channel media select staff observer"
  on public.channel_media for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel media all by member"
  on public.channel_media for all
  using (deleted_at is null and public.is_channel_member(channel_id))
  with check (deleted_at is null and public.is_channel_member(channel_id));

-- channel_files
create policy "channel files select by member"
  on public.channel_files for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "channel files select staff observer"
  on public.channel_files for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel files all by member"
  on public.channel_files for all
  using (deleted_at is null and public.is_channel_member(channel_id))
  with check (deleted_at is null and public.is_channel_member(channel_id));

-- ---------------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------------

-- messages – SELECT: channel members, guardian supervised DMs, staff observers
create policy "messages select by member"
  on public.messages for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "messages select supervised guardian"
  on public.messages for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "messages select staff observer"
  on public.messages for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

-- messages – INSERT: channel members OR service_role system automation
create policy "messages insert by member or system"
  on public.messages for insert
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        auth.role() = 'service_role'
        and type in ('event-reminder', 'feedback-request', 'payment-reminder')
        and exists (
          select 1
          from public.profiles p
          where p.id = sender_profile_id
            and p.org_id = org_id
            and p.kind = 'system'
            and p.deleted_at is null
        )
      )
    )
  );

-- messages – UPDATE: sender (including soft-delete) or channel/org manager
create policy "messages update by sender or manager"
  on public.messages for update
  using (
    deleted_at is null
    and (
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      or public.is_org_admin(org_id)
    )
  )
  with check (
    -- Allow soft-delete (deleted_at set to non-null) by sender or admin,
    -- or any active update by sender or admin
    (
      deleted_at is not null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.is_org_admin(org_id)
      )
    )
    or (
      deleted_at is null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.is_org_admin(org_id)
      )
    )
  );

-- messages – DELETE: sender or org admin
create policy "messages delete by sender or manager"
  on public.messages for delete
  using (
    deleted_at is null
    and (
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      or public.is_org_admin(org_id)
    )
  );

-- message_saves: self manage (owner + channel member), admin read
create policy "message saves select self or admin"
  on public.message_saves for select
  using (
    deleted_at is null
    and (
      (public.is_profile_owner(profile_id) and public.is_channel_member(channel_id))
      or public.is_org_admin(org_id)
    )
  );

create policy "message saves write self"
  on public.message_saves for all
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

-- ---------------------------------------------------------------------------
-- MESSAGE PAYLOAD TABLES
-- Three SELECT policies each: member access, guardian supervised, staff observer
-- One write policy: can_access_message (member access + visibility check)
-- ---------------------------------------------------------------------------

-- message_text
create policy "message text select by access"
  on public.message_text for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message text select supervised guardian"
  on public.message_text for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message text select staff observer"
  on public.message_text for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message text write by access"
  on public.message_text for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_image
create policy "message image select by access"
  on public.message_image for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message image select supervised guardian"
  on public.message_image for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message image select staff observer"
  on public.message_image for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message image write by access"
  on public.message_image for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_file
create policy "message file select by access"
  on public.message_file for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message file select supervised guardian"
  on public.message_file for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message file select staff observer"
  on public.message_file for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message file write by access"
  on public.message_file for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_design_file_update
create policy "message design file update select by access"
  on public.message_design_file_update for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message design file update select supervised guardian"
  on public.message_design_file_update for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message design file update select staff observer"
  on public.message_design_file_update for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message design file update write by access"
  on public.message_design_file_update for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_payment_reminder
create policy "message payment reminder select by access"
  on public.message_payment_reminder for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message payment reminder select supervised guardian"
  on public.message_payment_reminder for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message payment reminder select staff observer"
  on public.message_payment_reminder for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message payment reminder write by access"
  on public.message_payment_reminder for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_event_reminder
create policy "message event reminder select by access"
  on public.message_event_reminder for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message event reminder select supervised guardian"
  on public.message_event_reminder for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message event reminder select staff observer"
  on public.message_event_reminder for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message event reminder write by access"
  on public.message_event_reminder for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_feedback_request
create policy "message feedback request select by access"
  on public.message_feedback_request for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message feedback request select supervised guardian"
  on public.message_feedback_request for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message feedback request select staff observer"
  on public.message_feedback_request for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message feedback request write by access"
  on public.message_feedback_request for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_lesson_assignment
create policy "message lesson assignment select by access"
  on public.message_lesson_assignment for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message lesson assignment select supervised guardian"
  on public.message_lesson_assignment for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message lesson assignment select staff observer"
  on public.message_lesson_assignment for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message lesson assignment write by access"
  on public.message_lesson_assignment for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_progress_update
create policy "message progress update select by access"
  on public.message_progress_update for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message progress update select supervised guardian"
  on public.message_progress_update for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message progress update select staff observer"
  on public.message_progress_update for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message progress update write by access"
  on public.message_progress_update for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_session_booking
create policy "message session booking select by access"
  on public.message_session_booking for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message session booking select supervised guardian"
  on public.message_session_booking for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message session booking select staff observer"
  on public.message_session_booking for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message session booking write by access"
  on public.message_session_booking for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_session_complete
create policy "message session complete select by access"
  on public.message_session_complete for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message session complete select supervised guardian"
  on public.message_session_complete for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message session complete select staff observer"
  on public.message_session_complete for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message session complete write by access"
  on public.message_session_complete for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_session_summary
create policy "message session summary select by access"
  on public.message_session_summary for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message session summary select supervised guardian"
  on public.message_session_summary for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message session summary select staff observer"
  on public.message_session_summary for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message session summary write by access"
  on public.message_session_summary for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_homework_submission
create policy "message homework submission select by access"
  on public.message_homework_submission for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message homework submission select supervised guardian"
  on public.message_homework_submission for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message homework submission select staff observer"
  on public.message_homework_submission for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message homework submission write by access"
  on public.message_homework_submission for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_link_preview
create policy "message link preview select by access"
  on public.message_link_preview for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message link preview select supervised guardian"
  on public.message_link_preview for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message link preview select staff observer"
  on public.message_link_preview for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message link preview write by access"
  on public.message_link_preview for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_audio_recording
create policy "message audio recording select by access"
  on public.message_audio_recording for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message audio recording select supervised guardian"
  on public.message_audio_recording for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message audio recording select staff observer"
  on public.message_audio_recording for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message audio recording write by access"
  on public.message_audio_recording for all
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

-- message_live_session_started (payload for live session start events)
create policy "message live session started select by access"
  on public.message_live_session_started for select
  using (deleted_at is null and public.can_access_message(message_id));
create policy "message live session started select supervised guardian"
  on public.message_live_session_started for select
  using (deleted_at is null and public.can_supervise_message(message_id));
create policy "message live session started select staff observer"
  on public.message_live_session_started for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));
create policy "message live session started all by admin"
  on public.message_live_session_started for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- REACTIONS
-- ---------------------------------------------------------------------------

-- message_reactions: read by message access; own reaction write; admin delete any
create policy "message reactions select by access"
  on public.message_reactions for select
  using (deleted_at is null and public.can_access_message(message_id));

create policy "message reactions select supervised guardian"
  on public.message_reactions for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message reactions select staff observer"
  on public.message_reactions for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message reactions insert self"
  on public.message_reactions for insert
  with check (
    deleted_at is null
    and public.can_access_message(message_id)
    and account_id = public.current_account_id()
  );

create policy "message reactions delete self or admin"
  on public.message_reactions for delete
  using (
    deleted_at is null
    and (
      (public.can_access_message(message_id) and account_id = public.current_account_id())
      or public.is_org_admin(org_id)
    )
  );

-- message_reaction_counts: read by access; write by admin (maintained by system)
create policy "message reaction counts select by access"
  on public.message_reaction_counts for select
  using (deleted_at is null and public.can_access_message(message_id));

create policy "message reaction counts select supervised guardian"
  on public.message_reaction_counts for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message reaction counts select staff observer"
  on public.message_reaction_counts for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message reaction counts all by admin"
  on public.message_reaction_counts for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- THREADS
-- ---------------------------------------------------------------------------

create policy "threads select by member"
  on public.threads for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "threads select supervised guardian"
  on public.threads for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "threads select staff observer"
  on public.threads for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

-- Any channel member can create and manage threads
create policy "threads write by member"
  on public.threads for all
  using (deleted_at is null and public.is_channel_member(channel_id))
  with check (deleted_at is null and public.is_channel_member(channel_id));

-- thread_participants
create policy "thread participants select by member"
  on public.thread_participants for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.is_channel_member(t.channel_id)
    )
  );

create policy "thread participants select supervised guardian"
  on public.thread_participants for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.can_supervise_channel(t.channel_id)
    )
  );

create policy "thread participants select staff observer"
  on public.thread_participants for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.can_staff_observe_channel(t.channel_id)
    )
  );

create policy "thread participants write by member"
  on public.thread_participants for all
  using (
    deleted_at is null
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.is_channel_member(t.channel_id)
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.is_channel_member(t.channel_id)
    )
  );

-- thread_read_state: own account only
create policy "thread read state all self"
  on public.thread_read_state for all
  using (deleted_at is null and account_id = public.current_account_id())
  with check (deleted_at is null and account_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- LEARNING SPACES
-- ---------------------------------------------------------------------------

create policy "learning spaces select by participant or manager"
  on public.learning_spaces for select
  using (
    deleted_at is null
    and (
      public.is_learning_space_participant(id)
      or public.can_manage_learning_space(id)
    )
  );

create policy "learning spaces all by manager"
  on public.learning_spaces for all
  using (deleted_at is null and public.can_manage_learning_space(id))
  with check (deleted_at is null and public.can_manage_learning_space(id));

create policy "learning space channels select by participant or manager"
  on public.learning_space_channels for select
  using (
    deleted_at is null
    and (
      public.is_learning_space_participant(learning_space_id)
      or public.can_manage_learning_space(learning_space_id)
    )
  );

create policy "learning space channels all by manager"
  on public.learning_space_channels for all
  using (deleted_at is null and public.can_manage_learning_space(learning_space_id))
  with check (deleted_at is null and public.can_manage_learning_space(learning_space_id));

create policy "learning space participants select by participant or manager"
  on public.learning_space_participants for select
  using (
    deleted_at is null
    and (
      public.is_learning_space_participant(learning_space_id)
      or public.can_manage_learning_space(learning_space_id)
    )
  );

create policy "learning space participants all by manager"
  on public.learning_space_participants for all
  using (deleted_at is null and public.can_manage_learning_space(learning_space_id))
  with check (deleted_at is null and public.can_manage_learning_space(learning_space_id));

create policy "learning space links select by participant or manager"
  on public.learning_space_links for select
  using (
    deleted_at is null
    and (
      public.is_learning_space_participant(learning_space_id)
      or public.can_manage_learning_space(learning_space_id)
    )
  );

create policy "learning space links all by manager"
  on public.learning_space_links for all
  using (deleted_at is null and public.can_manage_learning_space(learning_space_id))
  with check (deleted_at is null and public.can_manage_learning_space(learning_space_id));

-- ---------------------------------------------------------------------------
-- CLASS SCHEDULES
-- ---------------------------------------------------------------------------

create policy "class schedules select by participant or manager"
  on public.class_schedules for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(id)
      or public.can_manage_schedule(id)
    )
  );

create policy "class schedules all by manager"
  on public.class_schedules for all
  using (deleted_at is null and public.can_manage_schedule(id))
  with check (deleted_at is null and public.can_manage_schedule(id));

create policy "schedule participants select by participant or manager"
  on public.class_schedule_participants for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(schedule_id)
      or public.can_manage_schedule(schedule_id)
    )
  );

create policy "schedule participants all by manager"
  on public.class_schedule_participants for all
  using (deleted_at is null and public.can_manage_schedule(schedule_id))
  with check (deleted_at is null and public.can_manage_schedule(schedule_id));

create policy "schedule recurrence select by participant or manager"
  on public.class_schedule_recurrence for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(schedule_id)
      or public.can_manage_schedule(schedule_id)
    )
  );

create policy "schedule recurrence all by manager"
  on public.class_schedule_recurrence for all
  using (deleted_at is null and public.can_manage_schedule(schedule_id))
  with check (deleted_at is null and public.can_manage_schedule(schedule_id));

create policy "schedule exceptions select by participant or manager"
  on public.class_schedule_recurrence_exceptions for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and (
          public.is_schedule_participant(cr.schedule_id)
          or public.can_manage_schedule(cr.schedule_id)
        )
    )
  );

create policy "schedule exceptions all by manager"
  on public.class_schedule_recurrence_exceptions for all
  using (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and public.can_manage_schedule(cr.schedule_id)
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and public.can_manage_schedule(cr.schedule_id)
    )
  );

create policy "schedule overrides select by participant or manager"
  on public.class_schedule_recurrence_overrides for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and (
          public.is_schedule_participant(cr.schedule_id)
          or public.can_manage_schedule(cr.schedule_id)
        )
    )
  );

create policy "schedule overrides all by manager"
  on public.class_schedule_recurrence_overrides for all
  using (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and public.can_manage_schedule(cr.schedule_id)
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1 from public.class_schedule_recurrence cr
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and public.can_manage_schedule(cr.schedule_id)
    )
  );

-- ---------------------------------------------------------------------------
-- LIVE SESSIONS
-- Backend (service_role) writes these; admins manage via client if needed.
-- ---------------------------------------------------------------------------

create policy "live sessions select by member"
  on public.channel_live_sessions for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "live sessions all by admin"
  on public.channel_live_sessions for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session participants select by member"
  on public.channel_live_session_participants for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "live session participants all by admin"
  on public.channel_live_session_participants for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session events select by member"
  on public.channel_live_session_participant_events for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "live session events all by admin"
  on public.channel_live_session_participant_events for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "live session expected participants select by member"
  on public.channel_live_session_expected_participants for select
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "live session expected participants all by admin"
  on public.channel_live_session_expected_participants for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- ACTIVITY & AUTOMATION
-- ---------------------------------------------------------------------------

-- activity_events: internal projection store — admin only
create policy "activity events select by admin"
  on public.activity_events for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "activity events all by admin"
  on public.activity_events for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- activity_event_suppression_rules
create policy "activity event suppression rules select by admin"
  on public.activity_event_suppression_rules for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "activity event suppression rules all by admin"
  on public.activity_event_suppression_rules for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- activity_feed_items
-- Recipients can read/update their own rows; admins can read and write all.
create policy "activity feed items select own or admin"
  on public.activity_feed_items for select
  using (
    deleted_at is null
    and (
      public.is_profile_owner(recipient_profile_id)
      or public.is_org_admin(org_id)
    )
  );

create policy "activity feed items update own"
  on public.activity_feed_items for update
  using (
    deleted_at is null
    and public.is_org_member(org_id)
    and public.is_profile_owner(recipient_profile_id)
  )
  with check (
    deleted_at is null
    and public.is_org_member(org_id)
    and public.is_profile_owner(recipient_profile_id)
  );

create policy "activity feed items insert by admin"
  on public.activity_feed_items for insert
  with check (public.is_org_admin(org_id));

create policy "activity feed items delete by admin"
  on public.activity_feed_items for delete
  using (deleted_at is null and public.is_org_admin(org_id));

-- activity_feed_group_members
create policy "activity feed group members select own or admin"
  on public.activity_feed_group_members for select
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

create policy "activity feed group members all by admin"
  on public.activity_feed_group_members for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- message_session_feedback: recipient manages own; admin can read for reporting
create policy "message session feedback select own or admin"
  on public.message_session_feedback for select
  using (
    deleted_at is null
    and (
      public.is_profile_owner(recipient_profile_id)
      or public.is_org_admin(org_id)
    )
  );

create policy "message session feedback write own"
  on public.message_session_feedback for all
  using (
    deleted_at is null
    and public.is_profile_owner(recipient_profile_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(recipient_profile_id)
  );

-- reminder_jobs / reminder_dispatch_logs: admin + service_role only
create policy "reminder jobs select by admin"
  on public.reminder_jobs for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder jobs all by admin"
  on public.reminder_jobs for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder dispatch logs select by admin"
  on public.reminder_dispatch_logs for select
  using (deleted_at is null and public.is_org_admin(org_id));

create policy "reminder dispatch logs all by admin"
  on public.reminder_dispatch_logs for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- ONBOARDING
-- ---------------------------------------------------------------------------

create policy "user onboarding status all self or admin"
  on public.user_onboarding_status for all
  using (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  )
  with check (
    deleted_at is null
    and (public.is_profile_owner(profile_id) or public.is_org_admin(org_id))
  );

-- ---------------------------------------------------------------------------
-- AUDIT / TELEMETRY
-- auth_telemetry_events has no deleted_at — it is append-only.
-- Writes go through service_role (NestJS API); clients get deny-all by default.
-- Admins can read for audit purposes.
-- ---------------------------------------------------------------------------

create policy "auth telemetry events select by admin"
  on public.auth_telemetry_events for select
  using (public.is_org_admin(org_id));
