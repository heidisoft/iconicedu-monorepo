# Local Event Pipeline Testing

Use this runbook to test the unified event pipeline locally for messages/DMs,
activity feed projection, notifications, and reminders.

## What This Tests

The local pipeline should move work through these tables:

```text
product write or DB trigger
  -> event_outbox
  -> event_pipeline_jobs activity.generate
  -> activity_events
  -> event_pipeline_jobs activity.project
  -> activity_feed_items / activity_feed_group_members
  -> event_pipeline_jobs notification.prepare
  -> event_pipeline_jobs notification.deliver
  -> event_pipeline_logs
```

Reminder schedule changes use the same job table:

```text
class schedule table change
  -> event_pipeline_jobs reminder.reconcile
  -> reminder_jobs
  -> reminders-dispatch
  -> activity_events / activity_feed_items / notification jobs
```

## Prerequisites

- Docker is running.
- Supabase CLI is installed.
- Dependencies are installed with `pnpm install`.
- `apps/api/.env` has local Supabase values and matching local internal tokens:
  - `INTERNAL_EVENTS_TOKEN`
  - `INTERNAL_REMINDERS_TOKEN`
- `apps/web/.env.local` points to the local API, usually `http://127.0.0.1:3001`.

Start from a clean local database when validating migrations:

```bash
supabase start
supabase db reset
supabase db lint --local
```

Start the API and web app in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

The API defaults to `http://127.0.0.1:3001` when `PORT=3001`.

## Local Helpers

Set helper variables in a terminal. The token values must match `apps/api/.env`.

```bash
export API_URL="http://127.0.0.1:3001"
export INTERNAL_EVENTS_TOKEN="<same value as apps/api/.env INTERNAL_EVENTS_TOKEN>"
export INTERNAL_REMINDERS_TOKEN="<same value as apps/api/.env INTERNAL_REMINDERS_TOKEN>"
```

Dispatch one batch of unified event jobs:

```bash
curl -sS -X POST "$API_URL/internal/events/dispatch" \
  -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-manual-events"}'
```

Dispatch only one job kind:

```bash
curl -sS -X POST "$API_URL/internal/events/dispatch" \
  -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-manual-events","jobKinds":["activity.generate"]}'
```

Dispatch due reminder jobs:

```bash
curl -sS -X POST "$API_URL/internal/reminders/dispatch" \
  -H "authorization: Bearer $INTERNAL_REMINDERS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-manual-reminders"}'
```

Run the unified dispatcher a few times because each phase enqueues the next phase
after the current claim:

```bash
for i in 1 2 3 4; do
  curl -sS -X POST "$API_URL/internal/events/dispatch" \
    -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
    -H "content-type: application/json" \
    -d '{"limit":100,"leaseOwner":"local-manual-events"}'
  printf '\n'
done
```

Open the local SQL editor at Supabase Studio, or use `psql`:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

Useful inspection query:

```sql
select
  job_kind,
  status,
  count(*) as count
from public.event_pipeline_jobs
where deleted_at is null
group by job_kind, status
order by job_kind, status;
```

Recent pipeline rows:

```sql
select
  id,
  event_kind,
  source_table,
  source_id,
  dedupe_key,
  status,
  processed_at,
  last_error,
  created_at
from public.event_outbox
where deleted_at is null
order by created_at desc
limit 20;

select
  id,
  job_kind,
  source_kind,
  source_id,
  dedupe_key,
  status,
  attempt_count,
  last_error,
  created_at,
  dispatched_at
from public.event_pipeline_jobs
where deleted_at is null
order by created_at desc
limit 40;

select
  job_kind,
  result,
  details,
  created_at
from public.event_pipeline_logs
order by created_at desc
limit 40;
```

## Test 1: DM Or Channel Message To Activity Feed

Preferred path: use the web app so the same API/UI path users use is exercised.

1. Sign in locally.
2. Open a DM or channel.
3. Send a normal text message.
4. Check that the DB trigger created an outbox signal:

```sql
select event_kind, source_table, source_id, dedupe_key, status, created_at
from public.event_outbox
where event_kind = 'message'
order by created_at desc
limit 5;
```

Expected:

- `event_kind = 'message'`
- `source_table = 'messages'`
- `dedupe_key` looks like `message:<message-id>`
- an `activity.generate` row exists in `event_pipeline_jobs`

Run the event dispatcher several times:

```bash
for i in 1 2 3 4; do
  curl -sS -X POST "$API_URL/internal/events/dispatch" \
    -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
    -H "content-type: application/json" \
    -d '{"limit":100,"leaseOwner":"local-message-test"}'
  printf '\n'
done
```

Verify activity generation:

```sql
select id, event_type, source_kind, source_id, dedupe_key, projection_status, created_at
from public.activity_events
where source_kind = 'message'
order by created_at desc
limit 10;
```

Verify projection:

```sql
select
  id,
  recipient_profile_id,
  verb,
  source_event_id,
  dedupe_key,
  is_read,
  created_at
from public.activity_feed_items
where deleted_at is null
order by created_at desc
limit 20;
```

Expected:

- The `activity.generate` job succeeds.
- The `activity.project` job succeeds.
- One or more `activity_feed_items` rows are created for recipients.
- The message sender should not receive a redundant notification for their own message unless the catalog/decision rules explicitly allow it.

## Test 2: Notification Prepare And Deliver

After a message activity is projected, projection should enqueue
`notification.prepare`, and preparation should enqueue one or more
`notification.deliver` jobs depending on preferences and eligibility.

Inspect notification jobs:

```sql
select
  id,
  job_kind,
  status,
  payload->>'recipientProfileId' as recipient_profile_id,
  payload->>'deliveryChannel' as delivery_channel,
  payload->>'prefKey' as pref_key,
  last_error,
  created_at,
  dispatched_at
from public.event_pipeline_jobs
where job_kind in ('notification.prepare', 'notification.deliver')
order by created_at desc
limit 40;
```

Run notification phases explicitly:

```bash
curl -sS -X POST "$API_URL/internal/events/dispatch" \
  -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-notification-prepare","jobKinds":["notification.prepare"]}'

curl -sS -X POST "$API_URL/internal/events/dispatch" \
  -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-notification-deliver","jobKinds":["notification.deliver"]}'
```

Expected locally:

- `notification.prepare` should end as `succeeded` or `suppressed`.
- `notification.deliver` should end as `succeeded`, `suppressed`, `failed`, or
  `dead_letter` depending on local preferences and provider setup.
- Email and SMS providers are currently no-op adapters, so those channels can
  succeed without sending a real message.
- Push delivery calls Expo only when the recipient has active `push_tokens`.
  Without push tokens, push delivery returns successfully with no tickets.

Do not insert fake Expo push tokens unless you intentionally want to test provider
failure/retry behavior. A fake token can cause network/provider errors and leave
the job in `failed` or `dead_letter`.

Check logs:

```sql
select job_kind, result, details, created_at
from public.event_pipeline_logs
where job_kind like 'notification.%'
order by created_at desc
limit 40;
```

## Test 3: Schedule Change To Reminder Reconcile

Schedule-related table changes should enqueue `reminder.reconcile` jobs directly
in `event_pipeline_jobs`; they should not create rows in old reminder reconcile
tables.

Pick a schedule:

```sql
select id, org_id, learning_space_id, starts_at, timezone, deleted_at
from public.class_schedules
where deleted_at is null
order by created_at desc
limit 10;
```

Touch one schedule to trigger reconciliation:

```sql
update public.class_schedules
set updated_at = timezone('utc', now())
where id = '<schedule-id>';
```

Verify the queued reconcile job:

```sql
select
  id,
  job_kind,
  source_kind,
  source_id,
  dedupe_key,
  status,
  payload,
  created_at
from public.event_pipeline_jobs
where job_kind = 'reminder.reconcile'
order by created_at desc
limit 10;
```

Run reconcile:

```bash
curl -sS -X POST "$API_URL/internal/events/dispatch" \
  -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-reminder-reconcile","jobKinds":["reminder.reconcile"]}'
```

Verify only the next active reminder job is kept for that schedule:

```sql
select
  id,
  job_type,
  source_schedule_id,
  occurrence_start_at,
  run_at,
  status,
  dedupe_key,
  created_at,
  updated_at
from public.reminder_jobs
where source_schedule_id = '<schedule-id>'
  and deleted_at is null
order by run_at asc;
```

Expected:

- One active `reminder_jobs` row for the schedule, unless the schedule has no
  future reminder occurrence.
- The `reminder.reconcile` pipeline job ends as `succeeded`.

## Test 4: Reminder Dispatch To Activity And Notifications

To test dispatch without waiting for the real reminder time, move one reminder job
into the past:

```sql
update public.reminder_jobs
set
  run_at = timezone('utc', now()) - interval '1 minute',
  next_attempt_at = null,
  lease_owner = null,
  lease_until = null,
  status = 'pending',
  updated_at = timezone('utc', now())
where id = (
  select id
  from public.reminder_jobs
  where deleted_at is null
    and status in ('pending', 'failed')
  order by run_at asc
  limit 1
)
returning id, org_id, job_type, source_schedule_id, run_at, status;
```

Dispatch due reminders:

```bash
curl -sS -X POST "$API_URL/internal/reminders/dispatch" \
  -H "authorization: Bearer $INTERNAL_REMINDERS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"limit":100,"leaseOwner":"local-reminder-dispatch"}'
```

Verify reminder state:

```sql
select id, job_type, status, attempt_count, last_error, dispatched_at, updated_at
from public.reminder_jobs
order by updated_at desc
limit 20;

select result, details, created_at
from public.reminder_dispatch_logs
order by created_at desc
limit 20;
```

Run the event dispatcher again to process activity/projection/notification work
created by the reminder:

```bash
for i in 1 2 3 4; do
  curl -sS -X POST "$API_URL/internal/events/dispatch" \
    -H "authorization: Bearer $INTERNAL_EVENTS_TOKEN" \
    -H "content-type: application/json" \
    -d '{"limit":100,"leaseOwner":"local-reminder-activity"}'
  printf '\n'
done
```

Verify reminder activity:

```sql
select id, event_type, source_kind, source_id, dedupe_key, projection_status, created_at
from public.activity_events
where event_type in ('session.reminder.sent', 'session.feedback_request.sent')
order by created_at desc
limit 20;

select id, verb, recipient_profile_id, source_event_id, created_at
from public.activity_feed_items
where source_event_id in (
  select id
  from public.activity_events
  where event_type in ('session.reminder.sent', 'session.feedback_request.sent')
)
order by created_at desc
limit 20;
```

Expected:

- The due reminder job is marked `succeeded`, `failed`, or `dead_letter` with a
  log row explaining the outcome.
- Successful reminder dispatch creates or reuses a reminder activity event.
- Projection creates feed items and notification jobs using the same unified
  pipeline as DMs/messages.
- Reminder reconciliation replenishes the next `reminder_jobs` row after a
  successful send when a future occurrence exists.

## Test 5: Other Schedule Tables

These tables should also enqueue `reminder.reconcile` for the parent schedule:

- `class_schedule_participants`
- `class_schedule_recurrence`
- `class_schedule_recurrence_exceptions`
- `class_schedule_recurrence_overrides`

Use a harmless `updated_at` touch on an existing row:

```sql
update public.class_schedule_participants
set updated_at = timezone('utc', now())
where id = (
  select id
  from public.class_schedule_participants
  where deleted_at is null
  order by created_at desc
  limit 1
);

update public.class_schedule_recurrence
set updated_at = timezone('utc', now())
where id = (
  select id
  from public.class_schedule_recurrence
  where deleted_at is null
  order by created_at desc
  limit 1
);
```

Then inspect:

```sql
select job_kind, source_id, dedupe_key, status, created_at
from public.event_pipeline_jobs
where job_kind = 'reminder.reconcile'
order by created_at desc
limit 20;
```

Expected:

- Each changed row resolves to its parent schedule.
- Multiple changes to the same schedule collapse into one active
  `schedule:<schedule-id>` reconcile job.

## Local Edge Function Bridge Test

Most local testing can call the API internal endpoints directly. To test the
Supabase Edge Function bridge itself:

```bash
supabase functions serve events-dispatch --env-file supabase/.env.local
supabase functions serve reminders-dispatch --env-file supabase/.env.local
```

The edge env file needs:

```bash
EVENTS_DISPATCH_URL=http://host.docker.internal:3001/internal/events/dispatch
INTERNAL_EVENTS_TOKEN=<same value as apps/api/.env INTERNAL_EVENTS_TOKEN>
REMINDERS_DISPATCH_URL=http://host.docker.internal:3001/internal/reminders/dispatch
INTERNAL_REMINDERS_TOKEN=<same value as apps/api/.env INTERNAL_REMINDERS_TOKEN>
```

If `host.docker.internal` does not resolve on your machine, use your host LAN IP
or call the API endpoint directly for local functional testing.

## Troubleshooting

Reset stuck leased jobs locally:

```sql
update public.event_pipeline_jobs
set
  status = 'pending',
  lease_owner = null,
  lease_until = null,
  next_attempt_at = null,
  updated_at = timezone('utc', now())
where status = 'leased'
  and lease_until < timezone('utc', now());
```

Requeue failed local jobs:

```sql
update public.event_pipeline_jobs
set
  status = 'pending',
  lease_owner = null,
  lease_until = null,
  next_attempt_at = null,
  last_error = null,
  updated_at = timezone('utc', now())
where status = 'failed';
```

Common symptoms:

- `401 Unauthorized` from internal endpoints: token in the request does not match
  `apps/api/.env`.
- `claimed: 0`: no due job exists, `run_at` is in the future, or the job is
  leased.
- `notification.deliver` is `suppressed`: preferences, scope, presence/read
  suppression, or latest eligibility changed.
- Push jobs fail locally: remove local `push_tokens` or provide a real Expo push
  token and valid provider credentials.
- No reminder job after schedule touch: check the `reminder.reconcile` job error
  in `event_pipeline_jobs.last_error` and `event_pipeline_logs.details`.

To return to a known state:

```bash
supabase db reset
```
