import { Injectable } from '@nestjs/common';
import type {
  ActivityEventRow,
  EventPipelineJobRow,
  ProfileRow,
} from '@iconicedu/shared-types';

import { truncatePreviewText } from '@iconicedu/api/lib/activity-feed/preview-text';
import { resolveActivityRenderContext } from '@iconicedu/api/lib/activity-feed/projector/activity-render-context';
import { buildNotificationDecision } from '@iconicedu/api/lib/notifications/decision-engine';
import { buildPersonalizedSessionCopy } from '@iconicedu/api/lib/notifications/push-copy';
import { sendEmailNotification } from '@iconicedu/api/lib/notifications/providers/email-provider';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { sendSmsNotification } from '@iconicedu/api/lib/notifications/providers/sms-provider';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const DEFAULT_MAX_ATTEMPTS = 8;

// DM and classroom messages wake the device with `priority: 'high'`, but only for
// the FIRST unread message in the conversation and only when the recipient is not
// active. Once they already have unread messages here, later pushes stay at
// normal priority until they catch up.
const MESSAGE_HIGH_PRIORITY_EVENT_TYPES = new Set([
  'message.posted',
  'message.thread_reply.posted',
]);
const MESSAGE_HIGH_PRIORITY_ROUTE_KINDS = new Set(['dm', 'space']);

async function resolveFirstUnreadMessagePushPriority(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  decision: Awaited<ReturnType<typeof buildNotificationDecision>>;
  channelRouteKind: string | undefined;
}): Promise<'high' | undefined> {
  if (!MESSAGE_HIGH_PRIORITY_EVENT_TYPES.has(input.event.event_type)) {
    return undefined;
  }
  // `immediate` is the decision engine's "recipient is not active" outcome —
  // fresh presence or a recent read downgrades delivery to `delayed`/`digest`.
  if (input.decision.deliveryTiming !== 'immediate') {
    return undefined;
  }
  if (
    !input.channelRouteKind ||
    !MESSAGE_HIGH_PRIORITY_ROUTE_KINDS.has(input.channelRouteKind)
  ) {
    return undefined;
  }

  const channelId =
    'channelId' in input.decision && typeof input.decision.channelId === 'string'
      ? input.decision.channelId
      : null;
  if (!channelId) {
    return undefined;
  }

  const threadId =
    'threadId' in input.decision && typeof input.decision.threadId === 'string'
      ? input.decision.threadId
      : null;
  const lastReadAt = threadId
    ? ((input.decision as { threadLastReadAt?: string | null }).threadLastReadAt ?? null)
    : ((input.decision as { channelLastReadAt?: string | null }).channelLastReadAt ??
      null);

  // First unread == no earlier still-unread message from anyone else in this
  // conversation. `limit(1)` short-circuits as soon as one exists. A failed lookup
  // must not block the notification itself, so fall back to normal priority.
  try {
    let query = input.supabase
      .from('messages')
      .select('id')
      .eq('org_id', input.event.org_id)
      .eq('channel_id', channelId)
      .neq('sender_profile_id', input.decision.recipientProfileId)
      .lt('created_at', input.event.occurred_at)
      .is('deleted_at', null);
    query = threadId ? query.eq('thread_id', threadId) : query.is('thread_id', null);
    if (lastReadAt) {
      query = query.gt('created_at', lastReadAt);
    }

    const { data, error } = await query.limit(1).maybeSingle<{ id: string }>();
    if (error) {
      return undefined;
    }
    return data ? undefined : 'high';
  } catch {
    return undefined;
  }
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

async function loadRecipientProfiles(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  recipientProfileIds: string[];
}) {
  if (!input.recipientProfileIds.length) {
    return new Map<string, ProfileRow>();
  }

  const response = await input.supabase
    .from('profiles')
    .select('*')
    .eq('org_id', input.orgId)
    .in('id', input.recipientProfileIds)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Map((response.data ?? []).map((profile) => [profile.id, profile]));
}

@Injectable()
export class NotificationService {
  async prepareForActivityEvent(input: {
    supabase: SupabaseServiceClient;
    eventId: string;
    recipientProfileIds?: string[];
    createdBy?: string | null;
  }) {
    const eventResponse = await input.supabase
      .from('activity_events')
      .select('*')
      .eq('id', input.eventId)
      .is('deleted_at', null)
      .maybeSingle<ActivityEventRow>();

    if (eventResponse.error) {
      throw new Error(eventResponse.error.message);
    }
    if (!eventResponse.data) {
      return { enqueued: 0, suppressed: true };
    }

    const event = eventResponse.data;
    const eventPayload = event.payload ?? {};
    const recipientProfileIds = input.recipientProfileIds ?? [];
    const recipientProfiles = await loadRecipientProfiles({
      supabase: input.supabase,
      orgId: event.org_id,
      recipientProfileIds,
    });
    const baseTitle =
      typeof eventPayload.title === 'string' && eventPayload.title.trim().length > 0
        ? eventPayload.title
        : event.event_type;
    const baseSummary =
      typeof eventPayload.summary === 'string' && eventPayload.summary.trim().length > 0
        ? truncatePreviewText(eventPayload.summary)
        : null;

    let enqueued = 0;
    for (const recipientProfileId of recipientProfileIds) {
      const recipientProfile = recipientProfiles.get(recipientProfileId);
      const activityContext = recipientProfile
        ? await resolveActivityRenderContext({
            supabase: input.supabase,
            event,
            recipientProfile,
          })
        : null;
      const eventPayloadForRecipient =
        eventPayload && typeof eventPayload === 'object' && !Array.isArray(eventPayload)
          ? {
              ...eventPayload,
              viewerTimezone:
                recipientProfile?.timezone ??
                (eventPayload as Record<string, unknown>).viewerTimezone ??
                null,
              recipientTimezone:
                recipientProfile?.timezone ??
                (eventPayload as Record<string, unknown>).recipientTimezone ??
                null,
              viewerRole:
                activityContext?.viewerRole ??
                (eventPayload as Record<string, unknown>).viewerRole ??
                null,
              viewerRoleKeys: activityContext?.viewerRoleKeys ?? [],
              activityContext,
            }
          : eventPayload;
      const personalized = buildPersonalizedSessionCopy(
        event.event_type,
        eventPayloadForRecipient,
        recipientProfileId,
      );
      const decision = await buildNotificationDecision({
        supabase: input.supabase,
        event,
        recipientProfileId,
      });

      for (const channel of decision.deliveryChannels) {
        const attemptBucket = buildAttemptBucket({
          timing: decision.deliveryTiming,
          runAt: decision.runAt,
        });
        const response = await input.supabase.rpc('enqueue_event_pipeline_job', {
          p_org_id: event.org_id,
          p_job_kind: 'notification.deliver',
          p_dedupe_key: `notification.deliver:${event.id}:${recipientProfileId}:${channel}`,
          p_payload: {
            activityEventId: event.id,
            recipientProfileId,
            prefKey: decision.prefKey,
            scopeKind: decision.scopeKind,
            scopeId: decision.scopeId,
            deliveryChannel: channel,
            deliveryTiming: decision.deliveryTiming,
            attemptBucket,
            reasonCodes: decision.reasonCodes,
            title: personalized?.title ?? baseTitle,
            summary: personalized?.summary ?? baseSummary,
            threadId:
              typeof eventPayload.threadId === 'string' ? eventPayload.threadId : null,
            rawEventPayload: eventPayloadForRecipient,
          },
          p_outbox_id: null,
          p_source_kind: 'activity_event',
          p_source_id: event.id,
          p_run_at: decision.runAt,
          p_priority: decision.deliveryTiming === 'immediate' ? 80 : 100,
          p_created_by: input.createdBy ?? event.created_by ?? null,
          p_updated_by: input.createdBy ?? event.updated_by ?? null,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }
        enqueued += 1;
      }
    }

    return { enqueued, suppressed: false };
  }

  async deliver(input: { supabase: SupabaseServiceClient; job: EventPipelineJobRow }) {
    const payload = input.job.payload ?? {};
    const activityEventId =
      typeof payload.activityEventId === 'string' ? payload.activityEventId : null;
    const recipientProfileId =
      typeof payload.recipientProfileId === 'string' ? payload.recipientProfileId : null;
    const deliveryChannel =
      payload.deliveryChannel === 'push' ||
      payload.deliveryChannel === 'email' ||
      payload.deliveryChannel === 'sms'
        ? payload.deliveryChannel
        : null;
    const prefKey = typeof payload.prefKey === 'string' ? payload.prefKey : null;

    if (!activityEventId || !recipientProfileId || !deliveryChannel || !prefKey) {
      throw new Error('Invalid notification delivery payload');
    }

    const eventResponse = await input.supabase
      .from('activity_events')
      .select('*')
      .eq('id', activityEventId)
      .eq('org_id', input.job.org_id)
      .is('deleted_at', null)
      .maybeSingle<ActivityEventRow>();
    if (eventResponse.error) {
      throw new Error(eventResponse.error.message);
    }
    if (!eventResponse.data) {
      return { suppressed: true, reason: 'source_event_missing' };
    }

    const latestDecision = await buildNotificationDecision({
      supabase: input.supabase,
      event: eventResponse.data,
      recipientProfileId,
    });
    if (!latestDecision.deliveryChannels.includes(deliveryChannel)) {
      return {
        suppressed: true,
        reason: 'no_longer_eligible',
        reasonCodes: latestDecision.reasonCodes,
      };
    }

    const title =
      typeof payload.title === 'string' && payload.title.trim().length > 0
        ? payload.title
        : prefKey;
    const summary =
      typeof payload.summary === 'string' && payload.summary.trim().length > 0
        ? truncatePreviewText(payload.summary)
        : null;
    const metadata = {
      ...payload,
      eventType: eventResponse.data.event_type,
      sourceKind: eventResponse.data.source_kind,
      occurredAt: eventResponse.data.occurred_at,
    };

    if (deliveryChannel === 'push') {
      const activityFeedItemId = await tryResolveActivityFeedItemId({
        supabase: input.supabase,
        orgId: input.job.org_id,
        activityEventId,
        recipientProfileId,
      });
      const rawEventPayload =
        payload.rawEventPayload &&
        typeof payload.rawEventPayload === 'object' &&
        !Array.isArray(payload.rawEventPayload)
          ? (payload.rawEventPayload as Record<string, unknown>)
          : {};

      const channelRouteKind =
        typeof rawEventPayload.channelRouteKind === 'string'
          ? rawEventPayload.channelRouteKind
          : undefined;

      const isHighPriorityReminder =
        eventResponse.data.event_type === 'session.reminder.sent' &&
        eventResponse.data.payload?.reminderOffsetMinutes === 15;
      const messagePushPriority = isHighPriorityReminder
        ? undefined
        : await resolveFirstUnreadMessagePushPriority({
            supabase: input.supabase,
            event: eventResponse.data,
            decision: latestDecision,
            channelRouteKind,
          });
      const priority =
        isHighPriorityReminder || messagePushPriority === 'high'
          ? ('high' as const)
          : undefined;

      return sendPushNotification({
        orgId: input.job.org_id,
        recipientProfileId,
        prefKey,
        title,
        ...(priority ? { priority } : {}),
        summary,
        activityFeedItemId,
        threadId: typeof payload.threadId === 'string' ? payload.threadId : null,
        scopeKind:
          payload.scopeKind === 'channel' || payload.scopeKind === 'learning_space'
            ? payload.scopeKind
            : undefined,
        scopeId: typeof payload.scopeId === 'string' ? payload.scopeId : undefined,
        channelRouteKind:
          rawEventPayload.channelRouteKind === 'space' ||
          rawEventPayload.channelRouteKind === 'dm' ||
          rawEventPayload.channelRouteKind === 'channel'
            ? rawEventPayload.channelRouteKind
            : undefined,
        metadata,
      });
    }

    if (deliveryChannel === 'email') {
      await sendEmailNotification({
        orgId: input.job.org_id,
        recipientProfileId,
        prefKey,
        subject: title,
        summary,
        metadata,
      });
      return undefined;
    }

    await sendSmsNotification({
      orgId: input.job.org_id,
      recipientProfileId,
      prefKey,
      message: summary ?? title,
      metadata,
    });
    return undefined;
  }

  getDefaultMaxAttempts() {
    return DEFAULT_MAX_ATTEMPTS;
  }
}
