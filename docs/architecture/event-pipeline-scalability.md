# Event Pipeline — Scalability Assessment

Assessed against current implementation in `apps/api/src/modules/events/` and `supabase/migrations/20260505000000_unified_event_pipeline.sql`.

---

## What scales well

| Mechanism                                                                      | Why it scales                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `FOR UPDATE SKIP LOCKED` in `claim_due_event_pipeline_jobs`                    | Multiple workers can claim jobs concurrently without lock contention or duplicate processing                |
| Outbox pattern                                                                 | Product writes never fail because of pipeline backlog; `event_outbox` absorbs spikes                        |
| Deduplication (`ON CONFLICT` on both `event_outbox` and `event_pipeline_jobs`) | Safe to re-enqueue; burst writes produce one job, not N                                                     |
| Exponential backoff with jitter (base 15 s, max 10 min)                        | Retries do not cause thundering herd                                                                        |
| Dead letter queue (`max_attempts = 8`)                                         | Nothing is silently dropped                                                                                 |
| Priority column                                                                | Time-sensitive jobs (`reminder.reconcile` at 40) beat bulk delivery (`notification.deliver` at 100)         |
| DB triggers as the enqueue path                                                | Enqueue is atomic with the source write — the outbox entry either exists or it does not; no dual-write race |

---

## Hard limits before millions

### 1. Serial job processing — the primary bottleneck

**File**: `apps/api/src/modules/events/event-pipeline.service.ts:70`

```ts
for (const job of jobs) {   // sequential — each job awaits before the next starts
  const result = await this.processJob(supabase, job);
```

Claims 100 jobs then awaits each one before the next. A 200 ms notification delivery → 100 jobs × 200 ms = 20 s per dispatch cycle. With a 1-minute cron the effective ceiling is roughly 300 jobs/min (~400k events/day assuming instant processing), and real-world I/O makes that much lower.

**Fix**: Process jobs in parallel batches using `Promise.allSettled` with a concurrency limit (10–20 jobs at a time), or hand off to a real queue (BullMQ, pg-boss) with worker fan-out.

---

### 2. Cron polling at 1-minute floor

Five edge functions on `* * * * *`. No push/event-driven wakeup. If the queue depth grows faster than it drains, latency increases indefinitely — there is no auto-scaling signal.

**Fix**: On high-traffic paths (message send), trigger an immediate worker wakeup via a Supabase Realtime broadcast or a lightweight HTTP call from the trigger, rather than waiting up to 60 s for the next cron tick.

---

### 3. Per-recipient fan-out in `activity_feed_items`

The projector writes one `activity_feed_items` row per recipient per event. A class of 500 students generates 500 rows per message. At large channel sizes this becomes the dominant write bottleneck in `projectActivityEvents`.

**Fix**: For channel-scoped events, write a single channel-scoped feed row and resolve per-reader read-state at query time, rather than materialising a row per recipient. Only fan out to per-user rows for user-scoped events (DMs, mentions, thread replies).

---

### 4. Unbounded table growth — no archival

`event_pipeline_jobs`, `event_pipeline_logs`, `activity_events`, and `activity_feed_items` accumulate forever. The `where deleted_at is null` partial indexes are efficient for active rows, but table bloat degrades vacuum performance and page-level scans over time.

`event_pipeline_logs` is the worst offender: one insert per job outcome, no TTL, no partitioning.

**Fix**:

- Nightly archival job moves `succeeded`/`suppressed` pipeline jobs older than 30 days to a cold table (or deletes them).
- `event_pipeline_logs` retention: 30 days maximum; add a scheduled cleanup.
- Consider Postgres table partitioning by `created_at` on `activity_feed_items` once rows exceed ~10 M.

---

### 5. `job_kind` not in the claim index

`event_pipeline_jobs_due_idx` covers `(status, run_at, next_attempt_at, priority, created_at)`. The per-kind filter in `claim_due_event_pipeline_jobs` (`p_job_kinds is null or j.job_kind = any(p_job_kinds)`) is a post-scan filter — not selective at the index level.

**Fix**: Add a partial composite index including `job_kind` for the high-frequency claim paths, or separate job kinds into dedicated query paths that can use the existing index without the `ANY` filter.

---

### 6. Single NestJS process

One API process dispatches all jobs. The `FOR UPDATE SKIP LOCKED` pattern already supports multiple concurrent workers claiming from the same queue — but nothing currently runs more than one worker instance.

**Fix**: Run multiple NestJS worker instances (or separate the worker into a dedicated service). The database locking is already correct; only the deployment topology needs to change.

---

## DB triggers — scalability notes

The current triggers (`enqueue_message_activity_source_job`, `enqueue_reaction_activity_source_job`, etc.) each run synchronously inside the source write transaction and call `enqueue_event_outbox`, which performs two upserts (`event_outbox` + `event_pipeline_jobs`).

**Advantages at scale:**

- Atomic with the source write — the outbox entry either exists or it does not. No dual-write race, no missed events on process crash.
- `ON CONFLICT DO UPDATE` means the trigger is safe to fire on retried writes without creating duplicate jobs.
- Overhead per trigger is two indexed upserts (~1–2 ms on a warmed Postgres instance), which is acceptable for write rates up to tens of thousands per second.

**Risks at scale:**

- Trigger latency extends the source transaction's hold time. Under write bursts (e.g. a bulk import of messages), every row insert blocks until the two upserts complete. At very high rates this increases lock contention on the source table.
- Triggers run on the Postgres primary. If `event_pipeline_jobs` or `event_outbox` become hot tables (high insert/update rate), index contention on those tables can back-pressure the source write path.
- Schema changes to the trigger function require a `CREATE OR REPLACE` which briefly locks. At high concurrent write rates this can cause visible latency spikes.

**When triggers become a problem**: Roughly above ~5,000 source-table inserts/second sustained. Below that the synchronous upsert overhead is negligible compared to network and application latency.

**Alternative at that scale**: Move the enqueue call out of the trigger and into the application write path (API service), with the trigger as a fallback catch-up mechanism only. This decouples source-table write latency from outbox insert latency and allows batching multiple inserts into a single enqueue call.

---

## Scalability improvement priority

| Priority | Change                                                                       | Impact                                                   |
| -------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0       | Parallel job processing in `dispatchDueJobs`                                 | 10–50× throughput immediately                            |
| P0       | Table archival for `event_pipeline_logs` and completed `event_pipeline_jobs` | Prevents long-term degradation                           |
| P1       | Multiple worker instances (horizontal scale)                                 | Linear throughput with instance count                    |
| P1       | Channel-scoped feed rows instead of per-recipient fan-out                    | Eliminates projection write bottleneck for large classes |
| P2       | Immediate worker wakeup on outbox insert (Realtime or HTTP)                  | Reduces tail latency on the happy path                   |
| P2       | `job_kind` composite index for claim queries                                 | Reduces claim query cost at high job-table row counts    |
| P3       | `activity_feed_items` table partitioning by `created_at`                     | Needed only once rows exceed ~10 M                       |
