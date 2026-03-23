# Activity Feed Architecture Contract

## Contract

All feed entries must flow through the event pipeline:

1. Emit via `publishActivityEvent` into `activity_events`.
2. Project via `projectActivityEvents` into `activity_feed_items`.

Direct feature-level inserts/upserts into `activity_feed_items` are not allowed.

## Allowed `activity_feed_items` Writes

- Projector-managed writes in `project-activity-events.ts` (leaf/group projection and counters).
- Recipient read-state updates (`is_read` / `read_at`) in `api/activity-feed/read/route.ts`.

## Why

- Keeps feed behavior event-sourced and deterministic.
- Preserves dedupe and recipient resolution in one place.
- Prevents partial or schema-divergent feed writes from feature code.
