# Push Notifications

## Purpose

End-to-end reference for Expo push notifications: how tokens are managed on device, how activity events flow into dispatch jobs, and how to test the full pipeline locally without a physical device or deployed edge function.

## Last Updated

2026-04-18

## Related Docs

- [Reminders Cron Ops](reminders.md)
- [Activity Feed Architecture](../architecture/activity-feed.md)
- [Documentation Hub](../README.md)

---

## Current Status

The API-owned push notification pipeline is now implemented in the repo.

That means:

- mobile push token registration/revocation goes through `apps/api`
- activity event projection into `notification_dispatch_jobs` exists in `apps/api`
- notification dispatch to Expo exists in `apps/api`
- internal API endpoints exist for projection and dispatch

What still must be true in the running environment for push to work end to end:

- all real event-producing flows that should notify users must publish through `apps/api`
- the deployed `notifications-dispatch` cron / edge function must call the API endpoint, not the legacy web endpoint
- `INTERNAL_NOTIFICATIONS_TOKEN_API` and `EXPO_ACCESS_TOKEN` must be configured in the deployed API environment
- at least one real device flow should be verified end to end

Until those runtime checks are confirmed, treat this document as the intended and implemented backend architecture, but not as proof that every deployed environment is already using it.

---

## How It Works

### Overview

```
Mobile device
  └─ usePushRegistration           ← registers Expo push token on login / permission grant
  └─ usePushToggle                 ← in-app on/off switch, syncs revoked_at in DB

Activity event occurs (message, session, etc.)
  └─ projectActivityEvents()       ← enqueues notification_dispatch_jobs rows

Supabase Edge Function (cron every 1 min)
  └─ notifications-dispatch        ← HTTP POST → API internal endpoint

API app
  └─ POST /internal/notifications/dispatch
      └─ dispatchDueNotificationJobs()
          └─ buildNotificationDecision()    ← checks preferences, presence, delay policy
          └─ sendPushNotification()         ← looks up push_tokens, calls authenticated Expo Push API
              └─ pollExpoPushReceipts()     ← confirms downstream delivery / credential errors
              └─ Expo Push API → APNs / FCM → device
```

---

### Normal App Flow vs Internal Endpoints

For normal product usage, clients should not call the internal projection or dispatch endpoints directly.

Expected runtime flow:

1. Mobile or web creates a message / reaction / session event through `apps/api`
2. `apps/api` writes the `activity_events` row
3. `apps/api` projects that event into `notification_dispatch_jobs`
4. cron later calls the internal dispatch endpoint
5. API sends the push notification through Expo

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

**Entry point:** `apps/api/src/lib/activity-feed/projector/project-activity-events.ts`

When an activity event is projected, `enqueueNotificationDispatchJobs()` is called. For each recipient profile:

1. `buildNotificationDecision()` runs the preference + policy check
2. Eligible channels (`push`, `email`, `sms`) are written as rows into `notification_dispatch_jobs` with `status = 'pending'`

**Delivery timing logic** (`apps/api/src/lib/notifications/policy-config.ts`):

| Category             | Examples                                                                                                                                          | Timing                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Critical — immediate | `class.session.scheduled/rescheduled/canceled`, `session.started`, `session.reminder.sent`, `payment.reminder`, `payment.failed`, `system.notice` | `immediate` (0s delay) — bypasses presence suppression   |
| Near-real-time       | `dm.posted`, `dms.posted`, `dm.reaction.added`, `dm.reaction.removed`                                                                             | `delayed` (30s) when presence-aware suppression applies  |
| Standard delay       | `message.posted`, `reaction.added`, `file.uploaded`                                                                                               | `delayed` (60s) when presence-aware suppression applies  |
| Everything else      | All other event types                                                                                                                             | `delayed` (120s) when presence-aware suppression applies |

**Suppression rules** (`buildNotificationDecision`):

- Profile is online / in-class / teaching → non-critical notifications delayed
- Channel recently read (read timestamp ≥ event timestamp) → notification delayed
- `notification_preferences.muted = true` for the pref key or master `__push__` key → suppressed entirely

**Important:** the presence of this projector in `apps/api` does not by itself guarantee every app flow uses it yet. Push only works for flows that actually publish activity events through the API-owned path.

---

### 4. Dispatch Pipeline

**Cron trigger:** Supabase Edge Function `notifications-dispatch` runs via `public.configure_edge_function_cron()` in `supabase/migrations/20260417000000_edge_function_cron.sql`.

It calls:

```
POST /internal/notifications/dispatch
Authorization: Bearer <INTERNAL_NOTIFICATIONS_TOKEN_API>
```

**API handler:** `apps/api/src/modules/notification-engine/notification-engine.controller.ts`

Calls `dispatchDueNotificationJobs()` which:

1. Claims `N` due jobs from `notification_dispatch_jobs` via `claim_due_notification_dispatch_jobs()` RPC (lease-based, idempotent — safe for overlapping ticks)
2. Re-evaluates each job's `buildNotificationDecision()` at dispatch time (preferences may have changed since enqueue)
3. For push jobs: `sendPushNotification()` → queries `push_tokens` by `profile_id` → calls Expo Push API in batch with optional `EXPO_ACCESS_TOKEN`
4. Successful Expo ticket IDs are persisted back onto `notification_dispatch_jobs.payload.expoTicketIds` for follow-up receipt polling
5. Marks jobs `succeeded`, `failed` (retryable with exponential backoff), or `dead_letter` (after max 8 attempts or non-retryable error)

**Retry schedule:** 15s, 30s, 60s, 120s, 240s, 480s, 600s, 600s (capped at 10 min).

---

### 5. Environment Variables

**API app (`apps/api`):**

```bash
INTERNAL_ACTIVITY_FEED_TOKEN=<long-random-secret>
INTERNAL_NOTIFICATIONS_TOKEN_API=<long-random-secret>
EXPO_ACCESS_TOKEN=<expo-personal-access-token>
```

**Supabase Edge Function secrets:**

```bash
NOTIFICATIONS_DISPATCH_URL=https://<your-api-domain>/internal/notifications/dispatch
INTERNAL_NOTIFICATIONS_TOKEN=<same-value-as-INTERNAL_NOTIFICATIONS_TOKEN_API>
# optional:
NOTIFICATIONS_DISPATCH_LIMIT=100
NOTIFICATIONS_DISPATCH_LEASE_SECONDS=120
NOTIFICATIONS_DISPATCH_LEASE_OWNER=supabase-edge-cron
```

---

## Testing Locally

The edge function is not needed for local testing. You can drive the entire pipeline manually.

### Prerequisites

- `pnpm dev:api` running (Nest on `http://localhost:3001`)
- `INTERNAL_ACTIVITY_FEED_TOKEN` and `INTERNAL_NOTIFICATIONS_TOKEN_API` set in `apps/api/.env`
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

### Step 2 — Enqueue a notification job

Insert an activity event that matches a supported `event_type`. The projector picks it up via the internal API:

```bash
curl -X POST http://localhost:3001/internal/activity-feed/project \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INTERNAL_ACTIVITY_FEED_TOKEN>" \
  -d '{
    "eventIds": ["<activity-event-id>"]
  }'
```

Or insert directly into `notification_dispatch_jobs` to skip the projector:

```sql
INSERT INTO notification_dispatch_jobs (
  id, org_id, activity_event_id, recipient_profile_id,
  pref_key, delivery_channel, delivery_timing, attempt_bucket,
  run_at, payload, status, attempt_count, max_attempts,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '<org-id>',
  gen_random_uuid(),           -- fake event id, projector check will suppress it — use a real one if you want full flow
  '<profile-id>',
  'message.posted',
  'push',
  'immediate',
  'immediate:' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI'),
  now(),
  '{"title": "Test notification", "summary": "Hello from local"}',
  'pending',
  0,
  8,
  now(),
  now()
);
```

> **Note:** If you use a fake `activity_event_id`, the dispatcher will mark the job `suppressed` (source event missing). Use a real event ID for a full end-to-end run.

---

### Step 3 — Trigger dispatch manually

No need to invoke the edge function. Call the API endpoint directly:

```bash
curl -X POST http://localhost:3001/internal/notifications/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INTERNAL_NOTIFICATIONS_TOKEN_API>" \
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
FROM notification_dispatch_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check dispatch log
SELECT result, details, created_at
FROM notification_dispatch_logs
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
SELECT id, recipient_profile_id, delivery_channel, status, run_at, last_error
FROM notification_dispatch_jobs
WHERE activity_event_id = '<activity-event-id>'
ORDER BY created_at ASC;
```

**If the notification doesn't arrive:**

- `status = suppressed` → check `notification_preferences` for the profile/pref_key, or check if the profile has active presence
- `status = failed` / `dead_letter` → check `last_error` column
- `status = succeeded` but no notification → the Expo token is invalid or the device has notifications disabled at OS level; check if `DeviceNotRegistered` would have been returned (Expo's response is logged in the push-provider but not persisted — add a `console.log` in `push-provider.ts` to inspect tickets)
- no `notification_dispatch_jobs` rows created → the event was not projected; check whether the producing code path is using the API-owned activity publisher

---

### Useful SQL snippets

```sql
-- See all active (non-revoked) push tokens
SELECT profile_id, platform, token, created_at, updated_at
FROM push_tokens
WHERE revoked_at IS NULL
ORDER BY updated_at DESC;

-- Reset a job to pending for re-testing
UPDATE notification_dispatch_jobs
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
