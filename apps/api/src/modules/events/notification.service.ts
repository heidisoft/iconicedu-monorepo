import { Injectable } from '@nestjs/common';
import type { ActivityEventRow, EventPipelineJobRow } from '@iconicedu/shared-types';

import { truncatePreviewText } from '@iconicedu/api/lib/activity-feed/preview-text';
import { buildNotificationDecision } from '@iconicedu/api/lib/notifications/decision-engine';
import { buildPersonalizedSessionCopy } from '@iconicedu/api/lib/notifications/push-copy';
import { sendEmailNotification } from '@iconicedu/api/lib/notifications/providers/email-provider';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { sendSmsNotification } from '@iconicedu/api/lib/notifications/providers/sms-provider';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const DEFAULT_MAX_ATTEMPTS = 8;

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
    const baseTitle =
      typeof eventPayload.title === 'string' && eventPayload.title.trim().length > 0
        ? eventPayload.title
        : event.event_type;
    const baseSummary =
      typeof eventPayload.summary === 'string' && eventPayload.summary.trim().length > 0
        ? truncatePreviewText(eventPayload.summary)
        : null;

    let enqueued = 0;
    for (const recipientProfileId of input.recipientProfileIds ?? []) {
      const personalized = buildPersonalizedSessionCopy(
        event.event_type,
        eventPayload,
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
          p_dedupe_key: `notification.deliver:${event.id}:${recipientProfileId}:${channel}:${attemptBucket}`,
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
            summary: truncatePreviewText(personalized?.summary ?? baseSummary),
            threadId:
              typeof eventPayload.threadId === 'string' ? eventPayload.threadId : null,
            rawEventPayload: eventPayload,
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

      return sendPushNotification({
        orgId: input.job.org_id,
        recipientProfileId,
        prefKey,
        title,
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
