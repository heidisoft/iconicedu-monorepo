# Schedule Update → Event & Reminder Flow

## Purpose

Documents how classroom/schedule changes produce reminder jobs, activity events,
and notifications — including cancellations and reschedules.

## Last Updated

2026-05-10

## Related Docs

- [Reminders Cron Ops](reminders.md)
- [Push Notifications](push-notifications.md)
- [Local Event Pipeline Testing](local-event-pipeline-testing.md)

---

## Overview

Schedule writes never synchronously compile reminders or generate activity events.
Instead, DB triggers enqueue durable jobs into `event_pipeline_jobs`. Two
per-minute workers claim and process those jobs asynchronously: the dedicated
`schedule-reconciliation-dispatch` worker claims `reminder.reconcile` jobs through
`claim_due_schedule_reconciliation_jobs`, and the general `events-dispatch` worker
claims everything else (it explicitly excludes `reminder.reconcile`). This means
primary schedule CRUD always completes even if the reminder or notification
pipeline is degraded, and an Events backlog can no longer delay creating reminder
or completion-check jobs.

---

## Trigger Tables

Every INSERT/UPDATE/DELETE on the following tables fires a DB trigger:

| Table                                  | Trigger name                                                      | Jobs enqueued                                                   |
| -------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `class_schedules`                      | `class_schedules_reminder_reconcile_enqueue`                      | `reminder.reconcile`                                            |
| `class_schedule_participants`          | `class_schedule_participants_reminder_reconcile_enqueue`          | `reminder.reconcile`                                            |
| `class_schedule_recurrence`            | `class_schedule_recurrence_reminder_reconcile_enqueue`            | `reminder.reconcile`                                            |
| `class_schedule_recurrence_exceptions` | `class_schedule_recurrence_exceptions_reminder_reconcile_enqueue` | `reminder.reconcile` + `activity.generate` (session_cancel)     |
| `class_schedule_recurrence_overrides`  | `class_schedule_recurrence_overrides_reminder_reconcile_enqueue`  | `reminder.reconcile` + `activity.generate` (session_reschedule) |

All triggers call `enqueue_reminder_reconcile_job(org_id, schedule_id)`, which
inserts a deduped row into `event_pipeline_jobs` with:

- `job_kind = 'reminder.reconcile'`
- `dedupe_key = 'schedule:<schedule_id>'`
- `run_at = now()`
- `priority = 40`

Exception/override triggers also call `enqueue_session_cancel_event_outbox()` or
`enqueue_session_reschedule_event_outbox()`, which write an `event_outbox` row and
a corresponding `activity.generate` job.

---

## Full Flow Diagram

```
API write (schedule create / update / cancel / reschedule)
    ↓
DB trigger on class_schedules | recurrence | exceptions | overrides
    ↓ (always)                              ↓ (exceptions/overrides only)
event_pipeline_jobs                        event_outbox
job_kind='reminder.reconcile'              kind='session_cancel' | 'session_reschedule'
    ↓ schedule-reconciliation-dispatch (1m)    ↓ events-dispatch cron (1 min)
ReminderReconcileService                   ActivityGenerationService
→ upsert / cancel reminder_jobs            → activity_events
  (session.reminder + session.completion_check)  ↓ event projection
    ↓ reminders-dispatch /                 activity_feed_items
      session-completions-dispatch (1m)    + notification.prepare / deliver jobs
dispatchDueReminderJobs                        ↓
→ activity_events                          push notifications to participants
  (session.reminder.sent
   session.completion_check.sent)
    ↓ event projection
activity_feed_items + push notifications
```

---

## Reminder Reconciliation (`ReminderReconcileService`)

**File:** `apps/api/src/modules/reminders/reminder-reconcile.service.ts`

**Method:** `reconcileNextReminderJobForSchedule({ orgId, scheduleId, now })`

Claimed by the dedicated `schedule-reconciliation-dispatch` worker through
`claim_due_schedule_reconciliation_jobs`
(`EventPipelineService.dispatchDueJobs({ reconcileOnly: true })`). The general
`events-dispatch` worker no longer claims these jobs.

### Logic

1. Load full schedule: recurrence rules, exceptions, overrides, participants,
   learning-space archive state.
2. If the schedule should be cancelled (deleted, `status='cancelled'`, or
   learning space archived) → cancel all active `reminder_jobs` → return
   `'canceled_only'`.
3. Expand all occurrences across a 365-day horizon (`RECONCILE_HORIZON_DAYS`).
4. Compute candidate jobs:
   - `session.reminder` at **−12 hours** and **−5 min** before session start, for
     the next eligible occurrence only.
   - `session.completion_check` at **+10 min** after session end, independently
     for every eligible occurrence in the next 30 days (three-day lookback). These
     do not wait for reminder delivery or an earlier occurrence's dispatch.
5. Skip occurrences whose jobs already have a `succeeded` dedupe key.
6. Cancel active jobs no longer in the expected set; upsert the rest.

### Dedupe Keys

```
session.reminder:<orgId>:<learningSpaceId>:<channelId>:<occurrenceStart>:<offsetMinutes>
session.completion_check:<orgId>:<learningSpaceId>:<channelId>:<occurrenceStart>
```

---

## Schedule CRUD → Trigger Mapping

| API operation                             | Tables written                                                                | Side effects                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Create schedule                           | `class_schedules`, `class_schedule_participants`, `class_schedule_recurrence` | `reminder.reconcile` enqueued                                                        |
| Update schedule times                     | `class_schedules`                                                             | `reminder.reconcile` enqueued; reconciler cancels stale job and inserts new one      |
| Cancel whole schedule                     | `class_schedules.status = 'cancelled'`                                        | `reminder.reconcile` enqueued; reconciler sees cancelled → cancels all reminder_jobs |
| Cancel single session (recurring)         | `class_schedule_recurrence_exceptions` INSERT/UPDATE                          | `reminder.reconcile` + `session_cancel` activity event enqueued                      |
| Reschedule single session (recurring)     | `class_schedule_recurrence_overrides` INSERT/UPDATE                           | `reminder.reconcile` + `session_reschedule` activity event enqueued                  |
| Cancel single session (non-recurring)     | `class_schedules.status = 'cancelled'`                                        | Same as "Cancel whole schedule" above                                                |
| Reschedule single session (non-recurring) | `class_schedules` updated with new times                                      | `reminder.reconcile` enqueued                                                        |

**File:** `apps/api/src/modules/schedules/schedules.service.ts`

The dedicated reconciliation worker owns the durable cleanup above, but it runs
on its own cron tick. To close the sub-minute window where a due
`session.reminder` job could fire before reconciliation cancels it, the reminder
claim RPCs (`claim_due_reminder_jobs` / `claim_due_org_reminder_jobs`) skip any
job whose schedule is `cancelled`/`completed`/`rescheduled` or gone, whose
learning space is archived, whose one-off start moved in place, or whose
recurring occurrence now has a cancelling exception or a start-moving override.
Completion-check claims are unchanged — that worker re-resolves cancel/reschedule
state itself at dispatch and can defer a moved session.

---

## Key Constants

| Constant                           | Value                     | Meaning                                            |
| ---------------------------------- | ------------------------- | -------------------------------------------------- |
| `SESSION_REMINDER_OFFSETS_MINUTES` | `[720, 15]`               | Minutes before session start to fire reminders     |
| `SESSION_FEEDBACK_OFFSET_MINUTES`  | `15`                      | Minutes after session end to fire feedback request |
| `RECONCILE_HORIZON_DAYS`           | `365`                     | Look-ahead window for recurring event expansion    |
| `reminder.reconcile` job priority  | `40`                      | Higher priority than `activity.generate` (50)      |
| `max_attempts`                     | `8`                       | Reminder dispatch retry limit                      |
| Retry backoff                      | 15 s – 10 min exponential | `next_attempt_at` after failure                    |

## Notification Copy

Canonical rendering is owned by
`apps/api/src/lib/activity-feed/definitions/activity-definitions.ts`; push/email
delivery copy is derived in `apps/api/src/lib/notifications/push-copy.ts`.
Summary / preview text is capped at 150 characters before activity projection
and notification delivery payloads are written.

| Variation                        | Event type                      | Primary headline                  | Secondary headline                                                          | Summary / preview                                                             | Expanded content                              | Action button |
| -------------------------------- | ------------------------------- | --------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- | ------------- |
| Single class session rescheduled | `class.session.rescheduled`     | `{classTitle}`                    | `session was rescheduled · {roleContext} · New time: {newSessionDateTime}`  | `{classTitle} session {oldSessionDateTime} was moved to {newSessionDateTime}` | `Reason: {rescheduledReason}`                 | Open class    |
| Single class session canceled    | `class.session.canceled`        | `{classTitle}`                    | `session {sessionDateTime} was canceled · {roleContext}`                    | `{classTitle} session {sessionDateTime} was canceled`                         | `Reason: {canceledReason}`                    | Open class    |
| Single class reminder            | `session.reminder.sent`         | `{classTitle}`                    | `Class session starts today/tomorrow at {sessionStartTime} · {roleContext}` | `Class session starts today/tomorrow at {sessionStartTime}`                   | Join details, class outline, or session notes | Open class    |
| Single class feedback request    | `session.feedback_request.sent` | `Share feedback for {classTitle}` | `{roleContext} · Your feedback helps improve future sessions`               | `Tell us how the session went`                                                | Feedback form or quick rating UI              | Give feedback |

---

## Relevant Files

| Path                                                                   | Purpose                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/modules/reminders/reminder-reconcile.service.ts`         | Reconciliation logic                             |
| `apps/api/src/modules/reminders/reminders.service.ts`                  | Dispatch due reminder jobs                       |
| `apps/api/src/modules/schedules/schedules.service.ts`                  | Schedule CRUD (trigger source)                   |
| `apps/api/src/modules/events/event-pipeline.service.ts`                | Job claim & dispatch loop (`reconcileOnly` path) |
| `apps/api/src/modules/events/events.controller.ts`                     | `/internal/schedule-reconciliation/dispatch`     |
| `supabase/functions/schedule-reconciliation-dispatch/index.ts`         | Dedicated reconciliation Edge Function bridge    |
| `supabase/migrations/*_independent_schedule_reconciliation_worker.sql` | Dedicated claim RPCs, repair pass, cron          |
| `supabase/migrations/*_reminder_reconcile_jobs.sql`                    | Trigger definitions                              |
| `supabase/migrations/*_unified_event_pipeline.sql`                     | `event_pipeline_jobs` schema & enqueue functions |
| `supabase/migrations/*_schedule_recurrence_update_activity_outbox.sql` | Exception/override outbox triggers               |
