import type {
  ActivityEventRow,
  NotificationDispatchJobRow,
} from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

import { buildNotificationDecision } from '@iconicedu/api/lib/notifications/decision-engine';
import { buildPersonalizedSessionCopy } from '@iconicedu/api/lib/notifications/push-copy';
import { sendEmailNotification } from '@iconicedu/api/lib/notifications/providers/email-provider';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { sendSmsNotification } from '@iconicedu/api/lib/notifications/providers/sms-provider';

const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;

type EnqueueDispatchInput = {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  recipientProfileIds: string[];
};

function resolveRetryDelayMs(attemptCount: number) {
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
  const jitter = Math.floor(Math.random() * 2_000);
  return Math.min(RETRY_MAX_MS, exponential + jitter);
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/invalid|unauthorized|forbidden|not found|missing/i.test(message);
}

function buildAttemptBucket(input: { timing: string; runAt: string }) {
  const runDate = new Date(input.runAt);
  const rounded = new Date(runDate);
  rounded.setSeconds(0, 0);
  return `${input.timing}:${rounded.toISOString().slice(0, 16)}`;
}

async function resolveActivityFeedItemId(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  activityEventId: string;
  recipientProfileId: string;
}) {
  const response = await input.supabase
    .from('activity_feed_items')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('recipient_profile_id', input.recipientProfileId)
    .eq('source_event_id', input.activityEventId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}

async function tryResolveActivityFeedItemId(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  activityEventId: string;
  recipientProfileId: string;
}) {
  try {
    return await resolveActivityFeedItemId(input);
  } catch {
    return null;
  }
}

async function logDispatch(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  notificationDispatchJobId: string;
  result: 'succeeded' | 'suppressed' | 'retryable_failure' | 'fatal_failure';
  details?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const response = await input.supabase.from('notification_dispatch_logs').insert({
    org_id: input.orgId,
    notification_dispatch_job_id: input.notificationDispatchJobId,
    result: input.result,
    details: input.details ?? {},
    created_at: now,
    updated_at: now,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function sendNotificationViaChannel(input: {
  supabase: SupabaseServiceClient;
  job: NotificationDispatchJobRow;
}) {
  const payload = (input.job.payload ?? {}) as Record<string, unknown>;
  const title =
    typeof payload.title === 'string' && payload.title.trim().length > 0
      ? payload.title
      : input.job.pref_key;
  const summary =
    typeof payload.summary === 'string' && payload.summary.trim().length > 0
      ? payload.summary
      : null;

  if (input.job.delivery_channel === 'push') {
    const activityFeedItemId = await tryResolveActivityFeedItemId({
      supabase: input.supabase,
      orgId: input.job.org_id,
      activityEventId: input.job.activity_event_id,
      recipientProfileId: input.job.recipient_profile_id,
    });

    const result = await sendPushNotification({
      orgId: input.job.org_id,
      recipientProfileId: input.job.recipient_profile_id,
      prefKey: input.job.pref_key,
      title,
      summary,
      activityFeedItemId,
      threadId: typeof payload.threadId === 'string' ? payload.threadId : null,
      scopeKind: input.job.scope_kind ?? undefined,
      scopeId: input.job.scope_id ?? undefined,
      channelRouteKind:
        payload.channelRouteKind === 'space' ||
        payload.channelRouteKind === 'dm' ||
        payload.channelRouteKind === 'channel'
          ? payload.channelRouteKind
          : undefined,
      metadata: payload,
    });
    await logDispatch({
      supabase: input.supabase,
      orgId: input.job.org_id,
      notificationDispatchJobId: input.job.id,
      result: 'succeeded',
      details: {
        channel: input.job.delivery_channel,
        prefKey: input.job.pref_key,
      },
    });
    return result;
  } else if (input.job.delivery_channel === 'email') {
    await sendEmailNotification({
      orgId: input.job.org_id,
      recipientProfileId: input.job.recipient_profile_id,
      prefKey: input.job.pref_key,
      subject: title,
      summary,
      metadata: payload,
    });
  } else if (input.job.delivery_channel === 'sms') {
    await sendSmsNotification({
      orgId: input.job.org_id,
      recipientProfileId: input.job.recipient_profile_id,
      prefKey: input.job.pref_key,
      message: summary ?? title,
      metadata: payload,
    });
  }

  await logDispatch({
    supabase: input.supabase,
    orgId: input.job.org_id,
    notificationDispatchJobId: input.job.id,
    result: 'succeeded',
    details: {
      channel: input.job.delivery_channel,
      prefKey: input.job.pref_key,
    },
  });

  return undefined;
}

export async function enqueueNotificationDispatchJobs(input: EnqueueDispatchInput) {
  const upsertRows: Array<Record<string, unknown>> = [];
  const eventPayload = (input.event.payload ?? {}) as Record<string, unknown>;
  const baseTitle =
    typeof eventPayload.title === 'string' && eventPayload.title.trim().length > 0
      ? eventPayload.title
      : input.event.event_type;
  const baseSummary =
    typeof eventPayload.summary === 'string' && eventPayload.summary.trim().length > 0
      ? eventPayload.summary
      : null;

  for (const recipientProfileId of input.recipientProfileIds) {
    const personalized = buildPersonalizedSessionCopy(
      input.event.event_type,
      eventPayload,
      recipientProfileId,
    );
    const payloadTitle = personalized?.title ?? baseTitle;
    const payloadSummary = personalized?.summary ?? baseSummary;

    const decision = await buildNotificationDecision({
      supabase: input.supabase,
      event: input.event,
      recipientProfileId,
    });

    for (const channel of decision.deliveryChannels) {
      const attemptBucket = buildAttemptBucket({
        timing: decision.deliveryTiming,
        runAt: decision.runAt,
      });
      upsertRows.push({
        org_id: input.event.org_id,
        activity_event_id: input.event.id,
        recipient_profile_id: recipientProfileId,
        pref_key: input.event.event_type,
        scope_kind: decision.scopeKind,
        scope_id: decision.scopeId,
        delivery_channel: channel,
        delivery_timing: decision.deliveryTiming,
        attempt_bucket: attemptBucket,
        run_at: decision.runAt,
        payload: {
          eventType: input.event.event_type,
          reasonCodes: decision.reasonCodes,
          sourceKind: input.event.source_kind,
          occurredAt: input.event.occurred_at,
          title: payloadTitle,
          summary: payloadSummary,
          threadId:
            typeof eventPayload.threadId === 'string' ? eventPayload.threadId : null,
          rawEventPayload: eventPayload,
        },
        status: 'pending',
        attempt_count: 0,
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });
    }
  }

  if (!upsertRows.length) {
    return { enqueued: 0 };
  }

  const response = await input.supabase
    .from('notification_dispatch_jobs')
    .upsert(upsertRows, {
      onConflict:
        'activity_event_id,recipient_profile_id,delivery_channel,attempt_bucket',
    });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { enqueued: upsertRows.length };
}

export async function dispatchDueNotificationJobs(input: {
  supabase: SupabaseServiceClient;
  leaseOwner: string;
  limit?: number;
  leaseSeconds?: number;
}) {
  const claimResponse = await input.supabase.rpc('claim_due_notification_dispatch_jobs', {
    p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
    p_lease_owner: input.leaseOwner,
    p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });

  if (claimResponse.error) {
    throw new Error(claimResponse.error.message);
  }

  const jobs = (claimResponse.data ?? []) as NotificationDispatchJobRow[];
  let succeeded = 0;
  let suppressed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    const now = new Date().toISOString();
    try {
      const eventResponse = await input.supabase
        .from('activity_events')
        .select('*')
        .eq('id', job.activity_event_id)
        .eq('org_id', job.org_id)
        .is('deleted_at', null)
        .maybeSingle<ActivityEventRow>();
      if (eventResponse.error) {
        throw new Error(eventResponse.error.message);
      }
      if (!eventResponse.data) {
        await input.supabase
          .from('notification_dispatch_jobs')
          .update({
            status: 'suppressed',
            lease_owner: null,
            lease_until: null,
            updated_at: now,
            last_error: 'Source event missing',
          })
          .eq('id', job.id)
          .eq('org_id', job.org_id);
        suppressed += 1;
        await logDispatch({
          supabase: input.supabase,
          orgId: job.org_id,
          notificationDispatchJobId: job.id,
          result: 'suppressed',
          details: { reason: 'source_event_missing' },
        });
        continue;
      }

      const latestDecision = await buildNotificationDecision({
        supabase: input.supabase,
        event: eventResponse.data,
        recipientProfileId: job.recipient_profile_id,
      });
      if (!latestDecision.deliveryChannels.includes(job.delivery_channel)) {
        await input.supabase
          .from('notification_dispatch_jobs')
          .update({
            status: 'suppressed',
            lease_owner: null,
            lease_until: null,
            updated_at: now,
            last_error: null,
          })
          .eq('id', job.id)
          .eq('org_id', job.org_id);
        suppressed += 1;
        await logDispatch({
          supabase: input.supabase,
          orgId: job.org_id,
          notificationDispatchJobId: job.id,
          result: 'suppressed',
          details: {
            reason: 'no_longer_eligible',
            reasonCodes: latestDecision.reasonCodes,
          },
        });
        continue;
      }

      const sendResult = await sendNotificationViaChannel({
        supabase: input.supabase,
        job,
      });

      const updateResponse = await input.supabase
        .from('notification_dispatch_jobs')
        .update({
          status: 'succeeded',
          dispatched_at: now,
          payload: {
            ...(job.payload ?? {}),
            expoTicketIds: sendResult?.ticketIds ?? [],
          },
          lease_owner: null,
          lease_until: null,
          updated_at: now,
          last_error: null,
        })
        .eq('id', job.id)
        .eq('org_id', job.org_id);
      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }
      succeeded += 1;
    } catch (error) {
      const nextAttemptCount = (job.attempt_count ?? 0) + 1;
      const retryable = isRetryableError(error);
      const shouldDeadLetter = !retryable || nextAttemptCount >= (job.max_attempts ?? 8);

      const updatePayload = shouldDeadLetter
        ? {
            status: 'dead_letter',
            attempt_count: nextAttemptCount,
            lease_owner: null,
            lease_until: null,
            next_attempt_at: null,
            last_error: error instanceof Error ? error.message : String(error),
            updated_at: now,
          }
        : {
            status: 'failed',
            attempt_count: nextAttemptCount,
            lease_owner: null,
            lease_until: null,
            next_attempt_at: new Date(
              Date.now() + resolveRetryDelayMs(nextAttemptCount),
            ).toISOString(),
            last_error: error instanceof Error ? error.message : String(error),
            updated_at: now,
          };

      const updateResponse = await input.supabase
        .from('notification_dispatch_jobs')
        .update(updatePayload)
        .eq('id', job.id)
        .eq('org_id', job.org_id);
      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      await logDispatch({
        supabase: input.supabase,
        orgId: job.org_id,
        notificationDispatchJobId: job.id,
        result: shouldDeadLetter ? 'fatal_failure' : 'retryable_failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      if (shouldDeadLetter) {
        deadLettered += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    claimed: jobs.length,
    succeeded,
    suppressed,
    failed,
    deadLettered,
  };
}
