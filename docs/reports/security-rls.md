# RLS Security Summary

Generated: 2026-03-09

This document covers every `public` table in the database, its Row Level Security (RLS) status, the policies applied, and what access each role has.

---

## Helper Functions

All policies are built on these shared helpers:

| Function                                  | Returns true when…                                    |
| ----------------------------------------- | ----------------------------------------------------- |
| `current_account_id()`                    | The authenticated user's `accounts.id` in this org    |
| `is_org_member(org_id)`                   | User has an active account in the org                 |
| `is_org_admin(org_id)`                    | User has `owner` or `admin` role in the org           |
| `is_profile_owner(profile_id)`            | Profile's `account_id` maps to the current auth user  |
| `is_channel_member(channel_id)`           | User has an active `channel_members` row              |
| `can_manage_channel(channel_id)`          | User is org admin or channel owner                    |
| `can_mutate_message(message_id)`          | User sent the message or can manage the channel       |
| `can_access_message(message_id)`          | User is channel member and message visibility permits |
| `is_learning_space_participant(space_id)` | User has a row in `learning_space_participants`       |
| `can_manage_learning_space(space_id)`     | User is org admin or space creator                    |
| `is_schedule_participant(schedule_id)`    | User has a row in `class_schedule_participants`       |
| `can_manage_schedule(schedule_id)`        | User is org admin or schedule creator                 |

---

## Tables

### Core / Auth

#### `orgs`

| Operation                  | Who                           |
| -------------------------- | ----------------------------- |
| SELECT                     | Org members (`is_org_member`) |
| ALL (insert/update/delete) | Org admins (`is_org_admin`)   |

#### `accounts`

| Operation | Who                      |
| --------- | ------------------------ |
| SELECT    | Own account OR org admin |
| UPDATE    | Own account OR org admin |
| INSERT    | Org admin only           |
| DELETE    | Org admin only           |

#### `user_roles`

| Operation | Who                                        |
| --------- | ------------------------------------------ |
| SELECT    | Own account OR org admin _(migration 034)_ |
| ALL       | Org admin only                             |

---

### Profile Tables

#### `profiles`

| Operation | Who                        |
| --------- | -------------------------- |
| SELECT    | All org members            |
| UPDATE    | Profile owner OR org admin |
| INSERT    | Org admin only             |
| DELETE    | Org admin only             |

#### `educator_profiles`

| Operation | Who                                                  |
| --------- | ---------------------------------------------------- |
| SELECT    | All org members                                      |
| ALL       | Org admin; + educator can update own (migration 041) |

#### `child_profiles`

| Operation     | Who                                                                     |
| ------------- | ----------------------------------------------------------------------- |
| SELECT        | All org members + linked guardians (see migrations 024–039)             |
| UPDATE/INSERT | Child self + linked guardian + org admin (see migrations 027, 030, 039) |
| DELETE        | Org admin only (migration 028)                                          |

#### `guardian_profiles`

| Operation | Who                                                  |
| --------- | ---------------------------------------------------- |
| SELECT    | All org members                                      |
| ALL       | Org admin; + guardian can update own (migration 037) |

#### `staff_profiles`

| Operation | Who             |
| --------- | --------------- |
| SELECT    | All org members |
| ALL       | Org admin       |

#### `profile_presence`

| Operation | Who                        |
| --------- | -------------------------- |
| SELECT    | All org members            |
| ALL       | Profile owner OR org admin |

---

#### `educator_availabilities` _(gap fixed — migration 032)_

| Operation | Who                                              |
| --------- | ------------------------------------------------ |
| SELECT    | All org members (needed for scheduling/matching) |
| ALL       | Profile owner (educator self) OR org admin       |

> **Note:** This table existed in the live DB but had no migration. Migration 032 creates it idempotently and adds RLS.

---

### Profile Specialisation

All six sub-tables (`educator_profile_subjects`, `educator_profile_grade_levels`, `educator_profile_curriculum_tags`, `educator_profile_badges`, `child_profile_grade_level`, `staff_profile_specialties`) share the same pattern:

| Operation   | Who                                                                  |
| ----------- | -------------------------------------------------------------------- |
| SELECT      | All org members (+ educator self for educator tables, migration 042) |
| ALL (write) | Org admin (+ owner self where applicable)                            |

---

### Family Tables

#### `families`

| Operation | Who                                                |
| --------- | -------------------------------------------------- |
| SELECT    | All org members                                    |
| ALL       | Org admin; + family member cascade (migration 043) |

#### `family_links`

| Operation | Who                                                         |
| --------- | ----------------------------------------------------------- |
| SELECT    | All org members                                             |
| ALL       | Org admin; guardian can read own links (migration 037, 040) |

#### `family_link_invites` _(added migration 016–020, cleaned up 020)_

| Operation | Who                           |
| --------- | ----------------------------- |
| SELECT    | Org admin OR invite recipient |
| INSERT    | Org admin                     |
| DELETE    | Org admin OR invite sender    |

---

### Preferences

#### `notification_preferences`

| Operation | Who                                                        |
| --------- | ---------------------------------------------------------- |
| ALL       | Profile owner OR linked guardian of child profile OR admin |

#### `notification_preference_scopes` _(migration 029)_

| Operation | Who                                                        |
| --------- | ---------------------------------------------------------- |
| ALL       | Profile owner OR linked guardian of child profile OR admin |

---

### Channels & Messaging

#### `channels`

| Operation   | Who                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| SELECT      | Org member AND (channel is public OR user is a member) OR supervised guardian DM read |
| ALL (write) | `can_manage_channel`                                                                  |

#### `channel_members`

| Operation | Who                  |
| --------- | -------------------- |
| SELECT    | Channel members      |
| ALL       | `can_manage_channel` |

#### `channel_capabilities`

| Operation | Who                  |
| --------- | -------------------- |
| SELECT    | Channel members      |
| ALL       | `can_manage_channel` |

#### `channel_read_state`

| Operation | Who                                                    |
| --------- | ------------------------------------------------------ |
| ALL       | Own account only (`account_id = current_account_id()`) |

#### `channel_media` / `channel_files`

| Operation | Who             |
| --------- | --------------- |
| SELECT    | Channel members |
| ALL       | Channel members |

---

### Messages

#### `messages`

| Operation | Who                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SELECT    | Channel members (incl. guardian supervised DM read, migration 216; staff observer read, migration 217)                                                 |
| INSERT    | Channel members OR service_role for system automation types (`event-reminder`, `feedback-request`, `payment-reminder`) with a system profile as sender |
| UPDATE    | `can_mutate_message` (sender or channel manager)                                                                                                       |
| DELETE    | `can_mutate_message`                                                                                                                                   |

#### `message_saves` _(gap fixed — migration 031)_

| Operation | Who                              |
| --------- | -------------------------------- |
| ALL       | Profile owner AND channel member |
| SELECT    | Org admin (read for moderation)  |

#### Message payload tables

All 15 payload tables (`message_text`, `message_image`, `message_file`, `message_design_file_update`, `message_payment_reminder`, `message_event_reminder`, `message_feedback_request`, `message_lesson_assignment`, `message_progress_update`, `message_session_booking`, `message_session_complete`, `message_session_summary`, `message_homework_submission`, `message_link_preview`, `message_audio_recording`):

| Operation | Who                  |
| --------- | -------------------- |
| SELECT    | `can_access_message` |
| ALL       | `can_access_message` |

---

### Threads

#### `threads`

| Operation | Who             |
| --------- | --------------- |
| SELECT    | Channel members |
| ALL       | Channel members |

#### `thread_participants`

| Operation | Who                                 |
| --------- | ----------------------------------- |
| SELECT    | Channel members (via thread lookup) |
| ALL       | Channel members (via thread lookup) |

#### `thread_read_state`

| Operation | Who              |
| --------- | ---------------- |
| ALL       | Own account only |

---

### Reactions

#### `message_reactions` / `message_reaction_counts`

| Operation | Who                  |
| --------- | -------------------- |
| SELECT    | `can_access_message` |
| ALL       | `can_access_message` |

---

### Learning Spaces

#### `learning_spaces`

| Operation | Who                          |
| --------- | ---------------------------- |
| SELECT    | Participant OR space manager |
| ALL       | `can_manage_learning_space`  |

#### `learning_space_channels` / `learning_space_participants` / `learning_space_links`

| Operation | Who                          |
| --------- | ---------------------------- |
| SELECT    | Participant OR space manager |
| ALL       | `can_manage_learning_space`  |

---

### Class Schedules

#### `class_schedules`

| Operation | Who                                      |
| --------- | ---------------------------------------- |
| SELECT    | Schedule participant OR schedule manager |
| ALL       | `can_manage_schedule`                    |

#### `class_schedule_participants`

| Operation | Who                                      |
| --------- | ---------------------------------------- |
| SELECT    | Schedule participant OR schedule manager |
| ALL       | `can_manage_schedule`                    |

#### `class_schedule_recurrence`

| Operation | Who                                      |
| --------- | ---------------------------------------- |
| SELECT    | Schedule participant OR schedule manager |
| ALL       | `can_manage_schedule`                    |

#### `class_schedule_recurrence_exceptions` / `class_schedule_recurrence_overrides`

| Operation | Who                                                     |
| --------- | ------------------------------------------------------- |
| SELECT    | Schedule participant OR manager (via recurrence lookup) |
| ALL       | `can_manage_schedule` (via recurrence lookup)           |

---

### Live Sessions _(migrations 020–023)_

#### `channel_live_sessions`

| Operation   | Who                                     |
| ----------- | --------------------------------------- |
| SELECT      | Channel members                         |
| ALL (write) | Org admin _(gap fixed — migration 031)_ |

#### `channel_live_session_participants`

| Operation   | Who                                     |
| ----------- | --------------------------------------- |
| SELECT      | Channel members                         |
| ALL (write) | Org admin _(gap fixed — migration 031)_ |

#### `channel_live_session_participant_events`

| Operation   | Who                                     |
| ----------- | --------------------------------------- |
| SELECT      | Channel members                         |
| ALL (write) | Org admin _(gap fixed — migration 031)_ |

#### `channel_live_session_expected_participants`

| Operation   | Who                                     |
| ----------- | --------------------------------------- |
| SELECT      | Channel members                         |
| ALL (write) | Org admin _(gap fixed — migration 031)_ |

#### `message_live_session_started`

| Operation   | Who                                     |
| ----------- | --------------------------------------- |
| SELECT      | Channel members (via message lookup)    |
| ALL (write) | Org admin _(gap fixed — migration 031)_ |

---

### Activity & Automation

#### `auth_telemetry_events` _(migration 020 + 032)_

| Operation            | Who                                                 |
| -------------------- | --------------------------------------------------- |
| SELECT               | Org admin only _(added — migration 032)_            |
| INSERT/UPDATE/DELETE | Deny for clients; backend service_role bypasses RLS |

> Append-only audit table. No `deleted_at`. Correct security posture: clients cannot write; only the NestJS API (service_role) can.

---

#### `activity_events` _(migration 023)_

| Operation | Who            |
| --------- | -------------- |
| SELECT    | Org admin only |
| ALL       | Org admin only |

#### `activity_event_suppression_rules` _(migration 028)_

| Operation | Who            |
| --------- | -------------- |
| SELECT    | Org admin only |
| ALL       | Org admin only |

#### `activity_feed_items`

| Operation   | Who                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------- |
| SELECT      | **Own recipient rows OR org admin** _(tightened from "all org members" — migration 031)_ |
| UPDATE      | Own recipient rows AND org member (mark-as-read, migration 027)                          |
| ALL (write) | Org admin                                                                                |

#### `message_session_feedback` _(migration 030)_

| Operation | Who                            |
| --------- | ------------------------------ |
| ALL       | Profile owner (recipient) only |

#### `reminder_jobs` / `reminder_dispatch_logs` _(migration 025)_

| Operation | Who            |
| --------- | -------------- |
| SELECT    | Org admin only |
| ALL       | Org admin only |

#### `event_outbox` / `event_pipeline_jobs` / `event_pipeline_logs` _(unified event pipeline — migration 048)_

These tables replaced the legacy `activity_source_jobs`, `notification_dispatch_jobs`, and `reminder_reconcile_jobs` tables (all dropped in migration `drop_legacy_event_pipeline_tables`). The new tables are admin-only — the NestJS API and edge functions access them via service_role.

| Operation | Who                                                                     |
| --------- | ----------------------------------------------------------------------- |
| SELECT    | Org admin only                                                          |
| ALL       | Org admin only; backend service_role bypasses RLS for worker operations |

---

### Onboarding

#### `user_onboarding_status` _(migration 012)_

| Operation | Who                                           |
| --------- | --------------------------------------------- |
| ALL       | Profile owner OR org admin                    |
| SELECT    | Org admin (additional explicit select policy) |

#### `student_access_codes` _(migration 020; policies restored in migration 034)_

| Operation | Who            |
| --------- | -------------- |
| SELECT    | Org admin only |
| ALL       | Org admin only |

---

## Security Gaps Fixed

### Migration 031 (`rls_security_hardening`)

| Table                                        | Gap                                                                                   | Fix                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `message_saves`                              | RLS not enabled; no policies — any authenticated user could read/write all saves      | Enable RLS; add self-access (profile owner + channel member) + admin read    |
| `activity_feed_items`                        | SELECT "read by org" let every org member see every feed item regardless of recipient | Replace with "read own or admin" — recipient profile owner or org admin only |
| `channel_live_sessions`                      | SELECT-only policy; no write policy                                                   | Add admin ALL policy (service_role backend still bypasses RLS)               |
| `channel_live_session_participants`          | SELECT-only                                                                           | Add admin ALL policy                                                         |
| `channel_live_session_participant_events`    | SELECT-only                                                                           | Add admin ALL policy                                                         |
| `channel_live_session_expected_participants` | SELECT-only                                                                           | Add admin ALL policy                                                         |
| `message_live_session_started`               | SELECT-only                                                                           | Add admin ALL policy                                                         |

### Migration 032 (`rls_missing_tables`)

| Table                     | Gap                                                                                                    | Fix                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `educator_availabilities` | Table existed in live DB with no migration and no RLS — fully unprotected                              | Create table idempotently; enable RLS; add org-member read + owner/admin write |
| `auth_telemetry_events`   | RLS enabled but zero policies — implicit deny-all is correct for writes, but admins had no read access | Add admin SELECT policy for audit visibility                                   |

### Migration 034 (`rls_post_reset_fixes`)

| Table                     | Gap                                                                                                                  | Fix                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `user_roles`              | Migration 033 set SELECT to admin-only; non-admin users (educators, guardians, students) cannot read their own roles | Add self-SELECT: `account_id = current_account_id()`                                       |
| `message_reaction_counts` | Migration 033 set ALL writes to admin-only; mobile app directly INSERTs/UPDATEs/DELETEs counts with user JWT         | Replace admin ALL with member ALL using `can_access_message` (same as `message_reactions`) |
| `student_access_codes`    | Migration 033's dynamic DROP removed migration 020's admin-only policies; migration 033 did not recreate them        | Recreate admin-only SELECT + ALL policies                                                  |

---

## Tables Without RLS (intentional)

- All tables in the `vm` schema (read-only views/materialized — not user-facing directly)
- `auth.*` tables (managed entirely by Supabase Auth)
- `storage.*` tables (governed by storage bucket policies in separate migrations)

---

## Storage Bucket Policies (separate from table RLS)

| Bucket               | Policy summary                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| `avatars`            | Org members can read; profile owners can upload/update to their own path |
| `channel-files`      | Channel members can read; channel members can upload                     |
| `message-thumbnails` | Public read; service_role write                                          |
