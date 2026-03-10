import type { FeedScopeVM, ReminderJobRow } from '@iconicedu/shared-types';
import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { ensureSystemProfileId } from '@iconicedu/web/lib/automation/system-profile';

const REMINDER_HORIZON_DAYS = 30;
const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;
const SESSION_REMINDER_OFFSETS_MINUTES = [30, 5] as const;

type ReminderJobPayload = {
  title: string;
  summary?: string | null;
  description?: string | null;
  channelId: string;
  learningSpaceId?: string | null;
  scheduleId?: string | null;
  occurrenceStart?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  invoiceId?: string | null;
  dueAt?: string | null;
  amount?: number | null;
  currency?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
};

function normalizeBaseScheduleId(scheduleId: string) {
  const marker = '__';
  const index = scheduleId.indexOf(marker);
  return index === -1 ? scheduleId : scheduleId.slice(0, index);
}

function formatStartsInSummary(offsetMinutes: number) {
  return `Class starts in ${offsetMinutes} minutes`;
}

function resolveRetryDelayMs(attemptCount: number) {
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
  const jitter = Math.floor(Math.random() * 2_000);
  return Math.min(RETRY_MAX_MS, exponential + jitter);
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/invalid|unauthorized|forbidden|not found|missing/i.test(message);
}

async function upsertReminderJobs(
  supabase: SupabaseServiceClient,
  rows: Array<Record<string, unknown>>,
) {
  if (!rows.length) {
    return;
  }

  const response = await supabase
    .from('reminder_jobs')
    .upsert(rows, { onConflict: 'org_id,dedupe_key' });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function compileLearningSpaceReminderJobs(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string;
}) {
  const schedules = await buildClassSchedulesByOrg(input.supabase, input.orgId);
  const relevant = schedules.filter(
    (schedule) =>
      schedule.source.kind === 'class_session' &&
      schedule.source.learningSpaceId === input.learningSpaceId,
  );

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const occurrences = expandRecurringEvents(relevant, rangeStart, rangeEnd).filter(
    (schedule) => schedule.status !== 'cancelled',
  );

  const dedupeKeys = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];
  const createdAt = new Date().toISOString();

  for (const occurrence of occurrences) {
    if (occurrence.source.kind !== 'class_session' || !occurrence.source.channelId) {
      continue;
    }

    const occurrenceStart = new Date(occurrence.startAt);
    if (Number.isNaN(occurrenceStart.getTime())) {
      continue;
    }

    const normalizedScheduleId = normalizeBaseScheduleId(occurrence.ids.id);
    const payload: ReminderJobPayload = {
      title: occurrence.title,
      summary: occurrence.description ?? null,
      description: occurrence.description ?? null,
      channelId: occurrence.source.channelId,
      learningSpaceId: occurrence.source.learningSpaceId,
      scheduleId: normalizedScheduleId,
      occurrenceStart: occurrence.startAt,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      location: occurrence.location ?? null,
      meetingLink: occurrence.meetingLink ?? null,
      channelRouteKind: 'space',
      members: occurrence.participants.map((participant) => ({
        profileId: participant.ids.id,
        displayName: participant.displayName ?? null,
        avatarUrl: participant.avatarUrl ?? null,
        themeKey: participant.themeKey ?? null,
      })),
    };

    for (const offsetMinutes of SESSION_REMINDER_OFFSETS_MINUTES) {
      const reminderDedupe = `session.reminder:${input.orgId}:${normalizedScheduleId}:${occurrence.startAt}:${offsetMinutes}`;
      dedupeKeys.add(reminderDedupe);
      rows.push({
        org_id: input.orgId,
        job_type: 'session.reminder',
        target_kind: 'channel',
        target_id: occurrence.source.channelId,
        source_learning_space_id: occurrence.source.learningSpaceId,
        source_schedule_id: normalizedScheduleId,
        occurrence_start_at: occurrence.startAt,
        run_at: new Date(
          occurrenceStart.getTime() - offsetMinutes * 60 * 1000,
        ).toISOString(),
        timezone: occurrence.timezone ?? 'UTC',
        payload: {
          ...payload,
          summary: formatStartsInSummary(offsetMinutes),
        },
        dedupe_key: reminderDedupe,
        status: 'pending',
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        created_at: createdAt,
        updated_at: createdAt,
        next_attempt_at: null,
        lease_owner: null,
        lease_until: null,
        last_error: null,
        deleted_at: null,
      });
    }

    const feedbackDedupe = `session.feedback_request:${input.orgId}:${normalizedScheduleId}:${occurrence.startAt}`;
    dedupeKeys.add(feedbackDedupe);
    rows.push({
      org_id: input.orgId,
      job_type: 'session.feedback_request',
      target_kind: 'channel',
      target_id: occurrence.source.channelId,
      source_learning_space_id: occurrence.source.learningSpaceId,
      source_schedule_id: normalizedScheduleId,
      occurrence_start_at: occurrence.startAt,
      run_at: new Date(occurrenceStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      timezone: occurrence.timezone ?? 'UTC',
      payload,
      dedupe_key: feedbackDedupe,
      status: 'pending',
      max_attempts: DEFAULT_MAX_ATTEMPTS,
      created_at: createdAt,
      updated_at: createdAt,
      next_attempt_at: null,
      lease_owner: null,
      lease_until: null,
      last_error: null,
      deleted_at: null,
    });
  }

  await upsertReminderJobs(input.supabase, rows);

  const staleCandidatesResponse = await input.supabase
    .from('reminder_jobs')
    .select('id, dedupe_key')
    .eq('org_id', input.orgId)
    .eq('source_learning_space_id', input.learningSpaceId)
    .in('job_type', ['session.reminder', 'session.feedback_request'])
    .in('status', ['pending', 'leased', 'failed'])
    .is('deleted_at', null)
    .returns<Array<{ id: string; dedupe_key: string }>>();

  if (staleCandidatesResponse.error) {
    throw new Error(staleCandidatesResponse.error.message);
  }

  const staleIds = (staleCandidatesResponse.data ?? [])
    .filter((row) => !dedupeKeys.has(row.dedupe_key))
    .map((row) => row.id);

  if (staleIds.length) {
    const staleUpdateResponse = await input.supabase
      .from('reminder_jobs')
      .update({
        status: 'canceled',
        updated_at: createdAt,
        lease_owner: null,
        lease_until: null,
      })
      .eq('org_id', input.orgId)
      .in('id', staleIds);

    if (staleUpdateResponse.error) {
      throw new Error(staleUpdateResponse.error.message);
    }
  }

  return {
    compiledCount: rows.length,
    canceledCount: staleIds.length,
  };
}

export async function enqueuePaymentReminderJobs(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  rows: Array<{
    dedupeKey: string;
    channelId: string;
    invoiceId?: string | null;
    dueAt?: string | null;
    title: string;
    summary?: string | null;
    learningSpaceId?: string | null;
    amount?: number | null;
    currency?: string | null;
    runAt: string;
  }>;
}) {
  const now = new Date().toISOString();
  const upsertRows = input.rows.map((row) => ({
    org_id: input.orgId,
    job_type: 'payment.reminder',
    target_kind: 'channel',
    target_id: row.channelId,
    source_learning_space_id: row.learningSpaceId ?? null,
    source_invoice_id: row.invoiceId ?? null,
    occurrence_start_at: null,
    run_at: row.runAt,
    timezone: 'UTC',
    payload: {
      title: row.title,
      summary: row.summary ?? null,
      channelId: row.channelId,
      learningSpaceId: row.learningSpaceId ?? null,
      invoiceId: row.invoiceId ?? null,
      dueAt: row.dueAt ?? null,
      amount: row.amount ?? null,
      currency: row.currency ?? 'USD',
      channelRouteKind: row.learningSpaceId ? 'space' : 'channel',
    } satisfies ReminderJobPayload,
    dedupe_key: row.dedupeKey,
    status: 'pending',
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    created_at: now,
    updated_at: now,
  }));

  await upsertReminderJobs(input.supabase, upsertRows);
  return { enqueuedCount: upsertRows.length };
}

export async function cancelLearningSpaceReminderJobs(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string;
}) {
  const response = await input.supabase
    .from('reminder_jobs')
    .update({
      status: 'canceled',
      lease_owner: null,
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', input.orgId)
    .eq('source_learning_space_id', input.learningSpaceId)
    .in('status', ['pending', 'leased', 'failed'])
    .is('deleted_at', null);

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function logDispatch(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  jobId: string;
  messageId?: string | null;
  activityEventId?: string | null;
  result: 'succeeded' | 'idempotent_hit' | 'retryable_failure' | 'fatal_failure';
  details?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const response = await input.supabase.from('reminder_dispatch_logs').insert({
    org_id: input.orgId,
    reminder_job_id: input.jobId,
    message_id: input.messageId ?? null,
    activity_event_id: input.activityEventId ?? null,
    result: input.result,
    details: input.details ?? {},
    created_at: now,
    updated_at: now,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function processReminderJob(supabase: SupabaseServiceClient, job: ReminderJobRow) {
  const payload = (job.payload ?? {}) as ReminderJobPayload;
  const now = new Date().toISOString();

  const systemProfileId = await ensureSystemProfileId(supabase, job.org_id);
  const messageId: string | null = null;

  const eventType =
    job.job_type === 'payment.reminder'
      ? 'payment.reminder.sent'
      : job.job_type === 'session.feedback_request'
        ? 'session.feedback_request.sent'
        : 'session.reminder.sent';

  const scope: FeedScopeVM = payload.learningSpaceId
    ? { kind: 'learning_space', learningSpaceId: payload.learningSpaceId as string }
    : { kind: 'channel', channelId: payload.channelId };
  const activityEvent = await publishActivityEvent({
    supabase,
    orgId: job.org_id,
    eventType,
    occurredAt: now,
    sourceKind: 'system',
    actorProfileId: systemProfileId,
    scope,
    objectRef: messageId ? { kind: 'message', id: messageId } : undefined,
    targetRef: payload.learningSpaceId
      ? { kind: 'learning_space', id: payload.learningSpaceId as string }
      : undefined,
    payload: {
      channelId: payload.channelId,
      messageId: messageId ?? null,
      learningSpaceId: payload.learningSpaceId ?? null,
      scheduleId: payload.scheduleId ?? null,
      occurrenceStart: payload.occurrenceStart ?? payload.startAt ?? now,
      invoiceId: payload.invoiceId ?? null,
      dueAt: payload.dueAt ?? null,
      title: payload.title,
      summary: payload.summary ?? null,
      channelRouteKind:
        payload.channelRouteKind ?? (payload.learningSpaceId ? 'space' : 'channel'),
      members: payload.members ?? null,
    },
    dedupeKey: `${job.dedupe_key}:activity`,
    createdBy: systemProfileId,
  });

  await supabase
    .from('reminder_jobs')
    .update({
      status: 'succeeded',
      dispatched_at: now,
      lease_owner: null,
      lease_until: null,
      updated_at: now,
      updated_by: systemProfileId,
      last_error: null,
    })
    .eq('id', job.id)
    .eq('org_id', job.org_id);

  await logDispatch({
    supabase,
    orgId: job.org_id,
    jobId: job.id,
    messageId,
    activityEventId: activityEvent?.id ?? null,
    result: 'succeeded',
    details: {
      eventType,
    },
  });
}

export async function dispatchDueReminderJobs(input: {
  supabase: SupabaseServiceClient;
  leaseOwner: string;
  limit?: number;
  leaseSeconds?: number;
}) {
  const claimResponse = await input.supabase.rpc('claim_due_reminder_jobs', {
    p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
    p_lease_owner: input.leaseOwner,
    p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });

  if (claimResponse.error) {
    throw new Error(claimResponse.error.message);
  }

  const claimed = (claimResponse.data ?? []) as ReminderJobRow[];
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of claimed) {
    try {
      await processReminderJob(input.supabase, job);
      succeeded += 1;
    } catch (error) {
      const now = new Date();
      const nextAttemptAt = new Date(
        now.getTime() + resolveRetryDelayMs(job.attempt_count + 1),
      ).toISOString();
      const retryable =
        isRetryableError(error) && job.attempt_count + 1 < job.max_attempts;
      const nextStatus = retryable ? 'failed' : 'dead_letter';
      const message = error instanceof Error ? error.message : String(error);

      const response = await input.supabase
        .from('reminder_jobs')
        .update({
          status: nextStatus,
          attempt_count: job.attempt_count + 1,
          next_attempt_at: retryable ? nextAttemptAt : null,
          last_error: message,
          lease_owner: null,
          lease_until: null,
          updated_at: now.toISOString(),
        })
        .eq('id', job.id)
        .eq('org_id', job.org_id);

      if (response.error) {
        throw new Error(response.error.message);
      }

      await logDispatch({
        supabase: input.supabase,
        orgId: job.org_id,
        jobId: job.id,
        result: retryable ? 'retryable_failure' : 'fatal_failure',
        details: {
          error: message,
          attempt: job.attempt_count + 1,
          nextStatus,
        },
      });

      failed += 1;
      if (!retryable) {
        deadLettered += 1;
      }
    }
  }

  return {
    claimed: claimed.length,
    succeeded,
    failed,
    deadLettered,
  };
}
