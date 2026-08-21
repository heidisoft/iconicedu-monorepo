# Push Notifications

## Purpose

End-to-end reference for Expo push notifications: how tokens are managed on device, how canonical events become activity and notification jobs, and how to test the unified pipeline locally without a physical device or deployed edge function.

## Last Updated

2026-05-05

## Related Docs

- [Reminders Cron Ops](reminders.md)
- [Documentation Hub](../README.md)

---

## Current Status

The API-owned push notification pipeline runs through the unified event pipeline.

That means:

- mobile push token registration/revocation goes through `apps/api`
- DB triggers and API command handlers enqueue canonical signals into `event_outbox`
- `events-dispatch` claims `event_pipeline_jobs` and runs activity generation, activity projection, notification preparation, and notification delivery
- notification dispatch to Expo exists in `apps/api`
- `activity_events` and `activity_feed_items` remain durable user-facing tables, but only API-owned services write generated activity/projection rows

What still must be true in the running environment for push to work end to end:

- all real event-producing flows that should notify users must write through `apps/api` or a source-of-truth table trigger
- the deployed `events-dispatch` cron / edge function must call `apps/api`
- `INTERNAL_EVENTS_TOKEN` and `EXPO_ACCESS_TOKEN` must be configured in the deployed API environment
- at least one real device flow should be verified end to end

Older activity worker/projector endpoints may remain available for guarded admin replay and compatibility while queues drain, but they are not the normal product path.

---

## How It Works

### Overview

```
Mobile device
  └─ usePushRegistration           ← registers Expo push token on login / permission grant
  └─ usePushToggle                 ← in-app on/off switch, syncs revoked_at in DB

Canonical event occurs
  └─ API command or DB trigger inserts event_outbox
      └─ event_pipeline_jobs activity.generate

Supabase Edge Function (cron every 1 min)
  └─ events-dispatch               ← HTTP POST → API internal endpoint

API app
  └─ POST /internal/events/dispatch
      └─ EventPipelineService.dispatchDueJobs()
          └─ activity.generate      ← ActivityGenerationService writes activity_events
          └─ activity.project       ← projectActivityEvents writes feed rows
          └─ notification.prepare   ← NotificationService evaluates recipients/channels
          └─ notification.deliver   ← sendPushNotification via Expo → APNs / FCM → device
```

---

### Normal App Flow vs Internal Endpoints

For normal product usage, clients do not call internal activity, projection, notification, or dispatch endpoints directly.

Expected runtime flow:

1. Mobile or web performs a product action through `apps/api`.
2. The API writes product data; API command code or DB triggers enqueue a canonical `event_outbox` signal.
3. `events-dispatch` claims `activity.generate` work and writes or reuses the canonical `activity_events` row.
4. `activity.project` writes `activity_feed_items` and enqueues `notification.prepare`.
5. `notification.prepare` evaluates preferences, suppression, timing, and channels, then enqueues `notification.deliver`.
6. `notification.deliver` sends the push notification through Expo and logs the outcome.

For guardian switch-user flows, the frontend still sends the selected acting profile id, but `apps/api` is the authority that validates whether the authenticated account may act as that profile before any message, activity, or notification work is performed.

The internal endpoints below are intended for:

- cron / Supabase edge functions
- manual testing
- replay / retry operations
- operational debugging

They are not part of the normal mobile app or web app request flow.

---

### 1. Token Registration (Mobile)

**Hook:** `apps/mobile/src/hooks/use-push-registration.ts`

Runs once per session after the user is authenticated and profile data is loaded. Flow:

1. Skips Expo Go, simulators, and web (`supportsNativePushNotifications`)
2. On first launch — shows a custom consent sheet before requesting OS permission (required because iOS only allows one system prompt)
3. Once permission is granted, calls `getExpoPushToken()` → Expo service → returns an `ExponentPushToken[...]` string
4. Calls `storePushToken(orgId, profileId, token)` via RPC (`upsert_push_token`) — stores the token in `push_tokens` table under the active profile

**Guardian / view-as-child mode:** when a guardian is viewing as a child profile, `profileId` is the child's profile ID. The token is deliberately stored under the child's profile so child-targeted notifications reach the guardian's physical device. The `upsert_push_token` RPC validates the caller is either the profile owner or a linked guardian before writing.

**Token stored locally:** `expo_push_token` key in `expo-secure-store` — used for revocation without a network round-trip to Expo.

---

### 2. Token Lifecycle

| Event                            | Handler                                                | Action                                                                                          |
| -------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| First permission grant           | `usePushRegistration`                                  | Register token, save to SecureStore                                                             |
| App returns to foreground        | `usePushToggle` AppState listener                      | Re-check OS permission status                                                                   |
| User disables push in-app        | `usePushToggle` toggle()                               | `revoked_at = now()` in DB + `notification_preferences.muted = true`                            |
| User enables push in-app         | `usePushToggle` toggle()                               | Re-register token (`revoked_at = null`) + clear muted pref                                      |
| Logout                           | `auth-provider` signOut                                | Read token from SecureStore → `revoked_at = now()` (best-effort, never blocks sign-out)         |
| OS permission revoked (Settings) | Lazy — detected on next foreground via `usePushToggle` | Expo returns `DeviceNotRegistered` on next send → push-provider sets `revoked_at` automatically |
| Token rejected by APNs/FCM       | `push-provider` after send                             | Sets `revoked_at` for all rejected token IDs                                                    |
| App reinstall / token rotation   | Next session `usePushRegistration`                     | New token registered; old token cleaned up lazily via `DeviceNotRegistered`                     |

---

### 3. Notification Events and Queuing

**Entry points:**

- `apps/api/src/modules/events/event-pipeline.service.ts`
- `apps/api/src/modules/events/notification.service.ts`
- `apps/api/src/lib/activity-feed/projector/project-activity-events.ts`

When an activity event is projected, an idempotent `notification.prepare` job is enqueued. For each recipient profile:

1. `buildNotificationDecision()` runs the preference + policy check
2. Eligible channels (`push`, `email`, `sms`) are written as `notification.deliver` rows in `event_pipeline_jobs` with `status = 'pending'`

`NotificationService.prepareForActivityEvent()` builds one row per eligible recipient/channel pair:

- `activityEventId`, `recipientProfileId`, `prefKey`, `scopeKind`, and `scopeId` come from the activity event plus `buildNotificationDecision()`.
- `delivery_channel` is one of the channels returned by the decision engine.
- `delivery_timing`, `run_at`, and `attempt_bucket` control when the dispatcher can claim the job.
- `payload` includes `eventType`, decision `reasonCodes`, `sourceKind`, `occurredAt`, `title`, `summary`, optional `threadId`, and `rawEventPayload`.
- Rows are upserted on the unified job dedupe key `notification.deliver:<eventId>:<recipientProfileId>:<channel>:<attemptBucket>`, so repeated projection is idempotent for the same delivery window.

**Delivery timing logic** (`apps/api/src/lib/notifications/policy-config.ts`):

| Category             | Examples                                                                                                                                     | Timing                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Critical — immediate | `class.session.scheduled`, `class.sessions.scheduled`, `session.started`, `payment.reminder.sent`, `payments.reminder.sent`, `system.notice` | `immediate` (0s delay) — bypasses presence suppression   |
| Standard delay       | `message.posted`, `message.mentioned`, `message.thread_reply.posted`, `reaction.added`, `file.uploaded`, `image.uploaded`, `audio.uploaded`  | `delayed` (60s) when presence-aware suppression applies  |
| Everything else      | All other event types                                                                                                                        | `delayed` (120s) when presence-aware suppression applies |

**Suppression rules** (`buildNotificationDecision`):

- Profile is online / in-class / teaching → non-critical notifications delayed
- Channel recently read (read timestamp ≥ event timestamp) → notification delayed
- `notification_preferences.muted = true` for the pref key or master `__push__` key → suppressed entirely

Activity and notification side effects are intentionally non-blocking for product
flows. Web and mobile actions should complete once the primary product write is
committed. If pipeline work fails, workers retry from `event_pipeline_jobs`; if a
job reaches `dead_letter`, it can be inspected and replayed operationally without
re-running the user action.

---

## Push Template Catalog

The API now treats the following event types as the canonical push template surface. Each job carries a title/body pair plus deep-link metadata that mobile resolves from `prefKey`, `scopeKind`, `scopeId`, `channelId`, and `threadId`.

| Event type                                          | Push title pattern                                                     | Push body pattern                    | Mobile deep link                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `message.posted`                                    | channel-message and DM variants                                        | message preview                      | `/(app)/dm/:channelId`, `/(app)/channel/:id`, or `/(app)/spaces/:id`   |
| `message.mentioned`                                 | mention variants                                                       | message preview                      | `/(app)/channel/:id` or `/(app)/spaces/:id`                            |
| `message.thread_reply.posted`                       | thread-reply variants                                                  | message preview                      | `/(app)/channel/:id` or `/(app)/spaces/:id`, preserves `threadId`      |
| `reaction.added`                                    | `{sender} reacted {emoji} to your message` with optional context title | mirrors title                        | channel, class, or DM route from scope and `channelRouteKind` metadata |
| `file.uploaded`, `image.uploaded`, `audio.uploaded` | shared file / image / audio variants                                   | content preview or file name         | channel or space route from scope metadata                             |
| `class.session.scheduled`                           | `{classTitle} session scheduled`                                       | payload summary or schedule fallback | class space when `channelId` exists, else Schedule tab                 |
| `class.sessions.scheduled`                          | `{classTitle} sessions scheduled`                                      | payload summary or schedule fallback | class space when `channelId` exists, else Schedule tab                 |
| `session.started`                                   | `{classTitle} is live now`                                             | join-now fallback or payload summary | class space when `channelId` exists, else Schedule tab                 |
| `payment.reminder.sent`                             | payload title or `Payment reminder`                                    | payload description / summary        | Inbox fallback                                                         |
| `payments.reminder.sent`                            | payload title or `Payment reminders`                                   | payload description / summary        | Inbox fallback                                                         |
| `system.notice`                                     | payload title or `System notice`                                       | payload message / summary            | Inbox fallback                                                         |

Notes:

- Deep-link routing is finalized in `apps/mobile/src/lib/notifications/notification-config.ts`.
- Push body text is capped by Expo payload constraints; previews are truncated before send.
- For conversational pushes, `activityFeedItemId` is included so the notification can be marked read on tap.
- `threadId` is preserved for thread reply notifications so mobile opens the correct thread context.

---

### 4. Dispatch Pipeline

**Cron trigger:** Supabase Edge Function `events-dispatch` runs via `public.configure_edge_function_cron()`.

It calls:

```
POST /internal/events/dispatch
Authorization: Bearer <INTERNAL_EVENTS_TOKEN>
```

**API handler:** `apps/api/src/modules/events/events.controller.ts`

Calls `EventPipelineService.dispatchDueJobs()` which:

1. Claims `N` due jobs from `event_pipeline_jobs` via `claim_due_event_pipeline_jobs()` RPC (lease-based, idempotent — safe for overlapping ticks)
2. Re-evaluates each job's `buildNotificationDecision()` at dispatch time (preferences may have changed since enqueue)
3. For push jobs: `sendPushNotification()` → queries `push_tokens` by `profile_id` → calls Expo Push API in batch with optional `EXPO_ACCESS_TOKEN`
4. Successful Expo ticket IDs are persisted on delivery job metadata for follow-up receipt polling
5. Marks jobs `succeeded`, `failed` (retryable with exponential backoff), or `dead_letter` (after max 8 attempts or non-retryable error)

**Retry schedule:** 15s, 30s, 60s, 120s, 240s, 480s, 600s, 600s (capped at 10 min).

Status transitions:

| Status        | When it is set                                                                                        | Important data changes                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `leased`      | `claim_due_event_pipeline_jobs()` claims a pending/failed delivery row.                               | Sets `lease_owner`, `lease_until`, and `updated_at`.                                                |
| `suppressed`  | Source `activity_events` row is missing, or the latest decision no longer includes the job's channel. | Clears lease fields and writes an `event_pipeline_logs` row.                                        |
| `succeeded`   | Provider send succeeds.                                                                               | Sets `dispatched_at`, clears lease/error fields, and stores Expo ticket IDs for push jobs.          |
| `failed`      | Error is retryable and attempts remain.                                                               | Increments `attempt_count`, clears lease fields, sets `next_attempt_at`, and writes `last_error`.   |
| `dead_letter` | Error is non-retryable or max attempts are exhausted.                                                 | Increments `attempt_count`, clears lease fields, clears `next_attempt_at`, and writes `last_error`. |

Provider behavior:

- `push` resolves the projected `activity_feed_items.id` for the recipient and includes it in metadata so mobile can mark the inbox item read on notification tap.
- `push` sends through Expo using active `push_tokens`; invalid downstream tokens are revoked lazily by the provider.
- `email` and `sms` use the same job title/summary metadata, but currently flow through their own provider wrappers.
- Every provider outcome writes `event_pipeline_logs` with `succeeded`, `suppressed`, `retryable_failure`, or `fatal_failure`.

---

### 5. Environment Variables

**API app (`apps/api`):**

```bash
INTERNAL_EVENTS_TOKEN=<long-random-secret>
EXPO_ACCESS_TOKEN=<expo-personal-access-token>
```

**Supabase Edge Function secrets:**

```bash
EVENTS_DISPATCH_URL=https://<your-api-domain>/internal/events/dispatch
INTERNAL_EVENTS_TOKEN=<same-value-as-apps-api>
# optional:
EVENTS_DISPATCH_LIMIT=100
EVENTS_DISPATCH_LEASE_SECONDS=120
EVENTS_DISPATCH_LEASE_OWNER=supabase-edge-cron
```

**Dispatch URL sanity check after the API migration:**

- `EVENTS_DISPATCH_URL` must target `https://<your-api-domain>/internal/events/dispatch`
- `REMINDERS_DISPATCH_URL` must target `https://<your-api-domain>/internal/reminders/dispatch`
- no dispatch secret should point at `apps/web` or `/api/internal/...`

Do not add product or admin flows that create activity events or projection jobs
directly. Use `event_outbox` and `event_pipeline_jobs`.

---

## Testing Locally

The edge function is not needed for local testing. You can drive the entire pipeline manually.

### Prerequisites

- `pnpm dev:api` running (Nest on `http://localhost:3001`)
- `INTERNAL_EVENTS_TOKEN` set in `apps/api/.env`
- Supabase connected (remote or local)
- a real Expo push token from a physical device if you want to validate actual delivery

---

### Step 1 — Register a push token manually

Use the Supabase Dashboard SQL editor (or `supabase db remote execute`) to insert a test token directly, bypassing the mobile app:

```sql
SELECT public.upsert_push_token(
  _org_id     := '<your-org-id>',
  _profile_id := '<your-profile-id>',
  _token      := 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  _platform   := 'ios'
);
```

Use a real Expo push token from a physical device or use a dummy value — dummy tokens will fail silently at the Expo API step (no error thrown, just no notification delivered).

To get a real token from a dev build: add a `console.log` in `storePushToken` temporarily, or check the `push_tokens` table after running the mobile app on a device.

---

### Step 2 — Enqueue pipeline work

For a full local run, create a real product event through the API or enqueue a canonical source signal through the DB helper:

```sql
SELECT enqueue_event_outbox(
  p_org_id := '<org-id>',
  p_event_kind := 'message',
  p_dedupe_key := 'message:<message-id>',
  p_payload := jsonb_build_object('messageId', '<message-id>'),
  p_source_table := 'messages',
  p_source_id := '<message-id>',
  p_source_kind := 'message'
);
```

For a lower-level notification provider test, you can enqueue a delivery job directly in `event_pipeline_jobs` to skip activity generation/projection:

```sql
INSERT INTO event_pipeline_jobs (
  id, org_id, job_kind, source_kind, source_id, dedupe_key,
  run_at, payload, status, attempt_count, max_attempts, priority,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '<org-id>',
  'notification.deliver',
  'activity_event',
  '<activity-event-id>',
  'notification.deliver:<activity-event-id>:<profile-id>:push:manual-test',
  now(),
  jsonb_build_object(
    'activityEventId', '<activity-event-id>',
    'recipientProfileId', '<profile-id>',
    'prefKey', 'message.posted',
    'deliveryChannel', 'push',
    'deliveryTiming', 'immediate',
    'attemptBucket', 'manual-test',
    'title', 'Test notification',
    'summary', 'Hello from local'
  ),
  'pending',
  0,
  8,
  80,
  now(),
  now()
);
```

> **Note:** Direct `notification.deliver` inserts are only for local debugging. If you use a fake `activityEventId`, the dispatcher will mark the job `suppressed` because the source event is missing.

---

### Step 3 — Trigger dispatch manually

No need to invoke the edge function. Call the API endpoint directly:

```bash
curl -X POST http://localhost:3001/internal/events/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INTERNAL_EVENTS_TOKEN>" \
  -d '{"leaseOwner": "local-test"}'
```

Expected response:

```json
{ "claimed": 1, "succeeded": 1, "suppressed": 0, "failed": 0, "deadLettered": 0 }
```

---

### Step 4 — Verify

**In DB:**

```sql
-- Check job status
SELECT id, status, dispatched_at, last_error, attempt_count
FROM event_pipeline_jobs
WHERE job_kind = 'notification.deliver'
ORDER BY created_at DESC
LIMIT 10;

-- Check dispatch log
SELECT result, details, created_at
FROM event_pipeline_logs
ORDER BY created_at DESC
LIMIT 10;
```

**On device:** If you used a real Expo push token from a physical device running a dev build, the notification should arrive within a few seconds of the dispatch call.

**Implementation verification checklist:**

```sql
-- 1. activity event exists
SELECT id, event_type, projection_status, last_projection_error, occurred_at
FROM activity_events
WHERE id = '<activity-event-id>';

-- 2. projection created one or more notification jobs
SELECT id, payload->>'recipientProfileId' AS recipient_profile_id, payload->>'deliveryChannel' AS delivery_channel, status, run_at, last_error
FROM event_pipeline_jobs
WHERE job_kind = 'notification.deliver'
  AND source_id = '<activity-event-id>'
ORDER BY created_at ASC;
```

**If the notification doesn't arrive:**

- `status = suppressed` → check `notification_preferences` for the profile/pref_key, or check if the profile has active presence
- `status = failed` / `dead_letter` → check `last_error` column
- `status = succeeded` but no notification → the Expo token is invalid or the device has notifications disabled at OS level; check if `DeviceNotRegistered` would have been returned (Expo's response is logged in the push-provider but not persisted — add a `console.log` in `push-provider.ts` to inspect tickets)
- no `notification.deliver` rows created → check `event_outbox`, `event_pipeline_jobs` for `activity.generate`/`activity.project`/`notification.prepare`, and `activity_events.last_projection_error`

---

### Useful SQL snippets

```sql
-- See all active (non-revoked) push tokens
SELECT profile_id, platform, token, created_at, updated_at
FROM push_tokens
WHERE revoked_at IS NULL
ORDER BY updated_at DESC;

-- Reset a job to pending for re-testing
UPDATE event_pipeline_jobs
SET status = 'pending', attempt_count = 0, lease_owner = NULL,
    lease_until = NULL, run_at = now(), last_error = NULL
WHERE id = '<job-id>';

-- Check notification preferences for a profile
SELECT pref_key, channels, muted, updated_at
FROM notification_preferences
WHERE profile_id = '<profile-id>'
  AND deleted_at IS NULL
ORDER BY pref_key;
```
