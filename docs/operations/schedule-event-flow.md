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
Instead, DB triggers enqueue durable jobs into `event_pipeline_jobs`. The unified
event dispatcher (running every minute) claims and processes those jobs
asynchronously. This means primary schedule CRUD always completes even if the
reminder or notification pipeline is degraded.

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
    ↓ events-dispatch cron (1 min)             ↓ events-dispatch cron (1 min)
ReminderReconcileService                   ActivityGenerationService
→ upsert / cancel reminder_jobs            → activity_events
    ↓ reminders-dispatch cron (1 min)          ↓ event projection
dispatchDueReminderJobs                    activity_feed_items
→ activity_events                          + notification.prepare / deliver jobs
  (session.reminder.sent                       ↓
   session.feedback_request.sent)          push notifications to participants
    ↓ event projection
activity_feed_items + push notifications
```

---

## Reminder Reconciliation (`ReminderReconcileService`)

**File:** `apps/api/src/modules/reminders/reminder-reconcile.service.ts`

**Method:** `reconcileNextReminderJobForSchedule({ orgId, scheduleId, now })`

### Logic

1. Load full schedule: recurrence rules, exceptions, overrides, participants,
   learning-space archive state.
2. If the schedule should be cancelled (deleted, `status='cancelled'`, or
   learning space archived) → cancel all active `reminder_jobs` → return
   `'canceled_only'`.
3. Expand all occurrences across a 365-day horizon (`RECONCILE_HORIZON_DAYS`).
4. For each non-cancelled occurrence compute candidate jobs:
   - `session.reminder` at **−30 min** and **−5 min** before session start
   - `session.feedback_request` at **+15 min** after session end (falls back to
     +15 min after start if end time is invalid)
5. Skip occurrences whose jobs already have a `succeeded` dedupe key.
6. Return the first pending candidate as the "next job in chain".
7. Compare against the currently active `reminder_jobs` row for this schedule:
   - **Matches** → return `'kept'` (no write)
   - **Different** → cancel old, insert new → return `'inserted'`
   - **No future jobs** → cancel any stale active jobs → return `'noop'`

### Dedupe Keys

```
session.reminder:<orgId>:<learningSpaceId>:<channelId>:<occurrenceStart>:<offsetMinutes>
session.feedback_request:<orgId>:<learningSpaceId>:<channelId>:<occurrenceStart>
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

---

## Key Constants

| Constant                           | Value                     | Meaning                                            |
| ---------------------------------- | ------------------------- | -------------------------------------------------- |
| `SESSION_REMINDER_OFFSETS_MINUTES` | `[30, 5]`                 | Minutes before session start to fire reminders     |
| `SESSION_FEEDBACK_OFFSET_MINUTES`  | `15`                      | Minutes after session end to fire feedback request |
| `RECONCILE_HORIZON_DAYS`           | `365`                     | Look-ahead window for recurring event expansion    |
| `reminder.reconcile` job priority  | `40`                      | Higher priority than `activity.generate` (50)      |
| `max_attempts`                     | `8`                       | Reminder dispatch retry limit                      |
| Retry backoff                      | 15 s – 10 min exponential | `next_attempt_at` after failure                    |

---

## Relevant Files

| Path                                                                   | Purpose                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/modules/reminders/reminder-reconcile.service.ts`         | Reconciliation logic                             |
| `apps/api/src/modules/reminders/reminders.service.ts`                  | Dispatch due reminder jobs                       |
| `apps/api/src/modules/schedules/schedules.service.ts`                  | Schedule CRUD (trigger source)                   |
| `apps/api/src/modules/events/event-pipeline.service.ts`                | Job claim & dispatch loop                        |
| `supabase/migrations/*_reminder_reconcile_jobs.sql`                    | Trigger definitions                              |
| `supabase/migrations/*_unified_event_pipeline.sql`                     | `event_pipeline_jobs` schema & enqueue functions |
| `supabase/migrations/*_schedule_recurrence_update_activity_outbox.sql` | Exception/override outbox triggers               |
