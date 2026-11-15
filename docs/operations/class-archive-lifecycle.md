# Class Archive Lifecycle

Last Updated: 2026-11-14

What happens to a class (`learning_spaces` row) and everything attached to it
when it is archived, restored, or deleted, and what is kept for reporting.

- Defined in `supabase/migrations/20261113000000_learning_space_archive_cascade.sql`.
- Regression test: `supabase/tests/learning_space_archive_cascade.test.sql`.
- Daily job: `learning-space-archive-retention` (03:23 UTC) runs
  `select public.purge_archived_learning_space_artifacts();`. Both CI
  cron-verification steps fail if it is missing or misconfigured.

## States

A class counts as archived when any of these is true:
`status = 'archived'`, `archived_at is not null`, or `deleted_at is not null`.
`public.is_learning_space_archived()` is the single definition.

| Action  | Entry point (service_role only)                    | Reversible                      |
| ------- | -------------------------------------------------- | ------------------------------- |
| Archive | `public.archive_learning_space(org, class, actor)` | Yes, any time                   |
| Restore | `public.restore_learning_space(org, class, actor)` | n/a                             |
| Delete  | `public.delete_learning_space(org, class, actor)`  | Yes, for 30 days after deletion |

`apps/api` exposes them to org owners, admins, and staff:

| Endpoint                                  | Body        | Web admin route                    |
| ----------------------------------------- | ----------- | ---------------------------------- |
| `POST /admin/learning-spaces/:id/archive` | `{ orgId }` | `POST /api/admin/spaces/archive`   |
| `POST /admin/learning-spaces/:id/restore` | `{ orgId }` | `POST /api/admin/spaces/unarchive` |
| `DELETE /admin/learning-spaces/:id`       | `{ orgId }` | `POST /api/admin/spaces/delete`    |

Responses are `LearningSpaceLifecycleResult` from `@iconicedu/shared-types`.
Errors: `404` class not found, `409` a session is live (`55006`) or the
30-day restore window has passed (`55000`), `403` not an org admin.

Archive and delete are refused while a class session is `starting` or `live`;
end it first so attendance and summaries are finalized.

Archiving or deleting also works when something updates the row directly
(SQL, scripts): the `sync_learning_space_archive_state` trigger runs the same
cascade on every active ↔ archived transition. Use the API so the actor is
recorded.

## What Archive Does

All in one transaction, stamped with the class's `archived_at`:

| Area                         | Effect                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class channel(s)             | `status = 'archived'`, so they are read-only (`can_post_to_channel_as_profile` requires `status = 'active'`).                                                                                                                 |
| Connections                  | Class `channel_members` and `learning_space_participants` get `deleted_at = archived_at`, `deleted_by = actor`.                                                                                                               |
| Tutor ↔ student/guardian DMs | Archived (read-only, hidden from DM lists) when no other active class still connects the pair. Guardians are connected through `family_links` to a child in the class. Members and messages are kept for safeguarding review. |
| Future work                  | Pending/leased/failed `reminder_jobs` and pending `scheduled_messages` for the class channel and the archived DMs are canceled.                                                                                               |

Staff, support, and tutor ↔ tutor DMs are never touched.

Archive and restore take a transaction-scoped advisory lock per tutor/contact
pair (`lock_learning_space_tutor_contact_pairs()`), so archiving two classes
that share a pair at the same time still closes their shared DM.

Canceled reminders stay canceled. `enqueue_stale_schedule_reconciliation()`
skips schedules of archived or deleted classes. The reminder reconcile and
dispatch checks in `apps/api` also see soft-deleted classes, since delete
archives the class too.

Archived channels are read-only everywhere: message inserts through RLS, and
reactions and message edits through `assertChannelWritable` in `apps/api`.

An archived DM still opens by id (`GET /channels/:channelId/dm-meta` returns
it with `is_archived: true`) so members can read the history; DM lists show active
DMs only.

`POST /channels/ensure-dm` only starts an educator ↔ child/guardian DM while
`tutor_contact_has_active_class()` is true. When the pair is connected again
by a new class, `reopen_class_lifecycle_dm()` reopens the archived DM with its
history, but only if the class lifecycle archived it
(`is_class_lifecycle_archive_stamp()`). A DM an admin archived by hand stays
archived and is returned as read-only history; no second DM is created.

## What Is Always Kept

Reports and history are not modified by archive, delete, or retention:
`class_session_completions`, `class_schedules`, `channel_live_sessions` and their
participants, events, feedback, and quality rows, `message_session_feedback`,
`messages` (including session summaries) and their attachments, and dispatched
`reminder_jobs` and their logs.

Hard `DELETE` on `learning_spaces` and on class channels is blocked by the
`prevent_class_hard_delete` trigger, because the foreign-key cascades would
destroy those reports. Org deletion (a cascaded delete) is still allowed. For a
verified legal erasure request, an operator can run the delete in a transaction
with `set local app.allow_class_hard_delete = 'on';` after exporting what
the request allows to be retained.

## Restore

`restore_learning_space` reverses exactly what the archive did:

- members and participants whose `deleted_at` equals the archive stamp come
  back, but people removed before the archive stay removed;
- class channels whose `archived_at` equals the archive stamp become active
  again; a class channel archived on its own before the class keeps its
  earlier stamp and stays archived;
- tutor DMs are reopened when the class lifecycle archived them (their
  `archived_at` matches a class archive or delete stamp, or the backfill stamp).
  A DM an admin archived by hand keeps its own timestamp and stays archived.

Restoring a deleted class is refused once 30 days have passed since
`deleted_at`, because retention may already have purged its artifacts.

After a restore, `apps/api` runs the reminder reconcile for the class so
future reminders are regenerated.

## Retention

The daily job first runs `reconcile_archived_learning_spaces()`, which finishes
the cascade for any archived class that still has an active channel, members,
or participants. It then deletes **ephemeral per-user state** only:

| Scope                       | After                        | Purged                                                                                                |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Deleted class               | 30 days after `deleted_at`   | read state, saved messages, pins, unsent scheduled messages, screen-annotation snapshots, whiteboards |
| Archived class, archived DM | 365 days after `archived_at` | read state, saved messages, pins, unsent scheduled messages, screen-annotation snapshots              |

Deletes are batched through `public.purge_rows_in_batches` with
`SKIP LOCKED` and a 5-second `lock_timeout`.

Messages, media, and reports are kept indefinitely until the organization
adopts a records-retention period. Exporting those to long-term storage before
any purge is tracked in [issue #292](https://github.com/heidisoft/iconicedu-monorepo/issues/292).

## Backfill

The migration ran a one-off backfill:

1. made `status` and `archived_at` agree (if either one says archived, the class is archived);
2. ran the cascade for every class that was already archived or deleted;
3. archived active tutor ↔ student/guardian DMs that no active class connects
   any more, for example DMs left behind when the old delete path removed the
   class. Those rows have `archived_at = public.learning_space_archive_backfill_stamp()`
   (`2026-11-13 00:00:00+00`).

Counts were written as `NOTICE`s in the migration output. To review or undo
step 3:

```sql
-- Review
select id, org_id, updated_at from public.channels
where kind = 'dm' and status = 'archived'
  and archived_at = public.learning_space_archive_backfill_stamp();

-- Undo for one DM (forward fix; never edit the migration)
update public.channels set status = 'active', archived_at = null
where id = '<dm channel id>'
  and archived_at = public.learning_space_archive_backfill_stamp();
```

## Operating It

```sql
-- Recent runs
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'learning-space-archive-retention')
order by start_time desc
limit 10;

-- Archived classes that still have active connections (read-only; should be 0 after each run)
select count(*)
from public.learning_spaces ls
where public.is_learning_space_archived(ls.status, ls.archived_at, ls.deleted_at)
  and exists (
    select 1 from public.learning_space_participants p
    where p.learning_space_id = ls.id and p.deleted_at is null
  );

-- Fix drift now instead of waiting for the daily run
select public.reconcile_archived_learning_spaces();
```

Per-table counts are logged as `purge_archived_learning_space_artifacts: {...}`.
To change a retention window or the purge scope, add a new forward migration
that replaces the function. Never edit the original migration.
