import type {
  NotificationDecisionReason,
  NotificationDecisionVM,
  NotificationDeliveryChannel,
  NotificationDeliveryTiming,
} from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

import {
  getNotificationDefaultChannels,
  getNotificationPolicyConfig,
} from '@iconicedu/api/lib/notifications/policy-config';
import { resolveEffectivePreference } from '@iconicedu/api/lib/notifications/resolve-effective-preference';

type DeliveryContext = {
  now?: Date;
  liveStatus?: string | null;
  lastSeenAt?: string | null;
  lastReadAt?: string | null;
};

const PRESENCE_STALE_MS = 5 * 60 * 1000;

type ProfileAccountRow = {
  account_id: string;
};

type EventPayload = {
  mentionedProfileId?: string;
  threadId?: string;
  suppressNotifications?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function resolveChannelIdFromScope(event: ActivityEventRow): string | null {
  const scope = asRecord(event.scope);
  return scope.kind === 'channel' && typeof scope.channelId === 'string'
    ? scope.channelId
    : null;
}

function isPresenceActive(liveStatus: string | null | undefined) {
  return (
    liveStatus === 'online' ||
    liveStatus === 'in_class' ||
    liveStatus === 'teaching' ||
    liveStatus === 'reviewing_work'
  );
}

function isPresenceActiveFresh(
  liveStatus: string | null | undefined,
  lastSeenAt: string | null | undefined,
  now: Date,
) {
  if (!isPresenceActive(liveStatus) || !lastSeenAt) {
    return false;
  }
  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenTime)) {
    return false;
  }
  return now.getTime() - lastSeenTime <= PRESENCE_STALE_MS;
}

function isRecentlyRead(lastReadAt: string | null | undefined, eventOccurredAt: string) {
  if (!lastReadAt) {
    return false;
  }

  const lastReadTime = new Date(lastReadAt).getTime();
  const eventTime = new Date(eventOccurredAt).getTime();
  if (Number.isNaN(lastReadTime) || Number.isNaN(eventTime)) {
    return false;
  }
  return lastReadTime >= eventTime;
}

function isMentionEvent(event: ActivityEventRow): boolean {
  const payload = asRecord(event.payload) as EventPayload;
  return (
    event.event_type === 'message.mentioned' ||
    (event.event_type === 'message.posted' &&
      typeof payload.mentionedProfileId === 'string' &&
      payload.mentionedProfileId.length > 0)
  );
}

export function resolveThreadIdFromPayload(event: ActivityEventRow): string | null {
  const payload = asRecord(event.payload) as EventPayload;
  return typeof payload.threadId === 'string' && payload.threadId.length > 0
    ? payload.threadId
    : null;
}

function resolveEffectiveLastReadAt(values: Array<string | null | undefined>) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const currentTime = new Date(value).getTime();
    if (Number.isNaN(currentTime) || currentTime <= latestTime) {
      continue;
    }

    latest = value;
    latestTime = currentTime;
  }

  return latest;
}

export function buildDeliveryPlan(input: {
  event: ActivityEventRow;
  recipientProfileId: string;
  channels: NotificationDeliveryChannel[];
  reasonCodes: NotificationDecisionReason[];
  context: DeliveryContext;
}) {
  const policy = getNotificationPolicyConfig(input.event.event_type);
  const now = input.context.now ?? new Date();
  const reasons = [...input.reasonCodes];
  const activePresence = isPresenceActiveFresh(
    input.context.liveStatus,
    input.context.lastSeenAt,
    now,
  );
  const recentlyRead = isRecentlyRead(input.context.lastReadAt, input.event.occurred_at);
  const mentionPriorityOverride = isMentionEvent(input.event) && !policy.critical;
  const effectiveDelaySeconds = mentionPriorityOverride ? 30 : policy.defaultDelaySeconds;
  const shouldDelay =
    policy.presenceAware && !policy.critical && (activePresence || recentlyRead);

  if (mentionPriorityOverride) {
    reasons.push('mention_priority_override');
  }
  if (activePresence) {
    reasons.push('presence_active');
  }
  if (recentlyRead) {
    reasons.push('channel_recently_read');
  }
  if (policy.critical) {
    reasons.push('critical_override');
  }

  const deliveryTiming: NotificationDeliveryTiming = shouldDelay
    ? 'delayed'
    : policy.digestEligible
      ? 'digest'
      : 'immediate';

  const runAt = new Date(
    now.getTime() +
      (deliveryTiming === 'delayed'
        ? effectiveDelaySeconds
        : deliveryTiming === 'digest'
          ? Math.max(effectiveDelaySeconds, 30 * 60)
          : 0) *
        1000,
  ).toISOString();

  const decision: NotificationDecisionVM = {
    eventId: input.event.id,
    recipientProfileId: input.recipientProfileId,
    prefKey: policy.prefKey,
    shouldWriteInbox: true,
    deliveryChannels: input.channels,
    deliveryTiming,
    runAt,
    reasonCodes: reasons,
    policy,
  };

  return decision;
}

export async function buildNotificationDecision(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  recipientProfileId: string;
}) {
  const reasonCodes: NotificationDecisionReason[] = [];
  const policy = getNotificationPolicyConfig(input.event.event_type);
  const eventPayload = asRecord(input.event.payload) as EventPayload;
  if (eventPayload.suppressNotifications === true) {
    return {
      eventId: input.event.id,
      recipientProfileId: input.recipientProfileId,
      prefKey: policy.prefKey,
      shouldWriteInbox: true,
      deliveryChannels: [] as NotificationDeliveryChannel[],
      deliveryTiming: 'immediate' as NotificationDeliveryTiming,
      runAt: new Date().toISOString(),
      reasonCodes: ['source_suppressed'] as NotificationDecisionReason[],
      policy,
      scopeKind: null,
      scopeId: null,
    };
  }
  const preference = await resolveEffectivePreference({
    supabase: input.supabase,
    event: input.event,
    recipientProfileId: input.recipientProfileId,
    prefKey: policy.prefKey,
    defaultChannels: getNotificationDefaultChannels(input.event.event_type),
  });

  reasonCodes.push(preference.source as NotificationDecisionReason);

  if (preference.muted || preference.channels.length === 0) {
    return {
      eventId: input.event.id,
      recipientProfileId: input.recipientProfileId,
      prefKey: policy.prefKey,
      shouldWriteInbox: true,
      deliveryChannels: [] as NotificationDeliveryChannel[],
      deliveryTiming: 'immediate' as NotificationDeliveryTiming,
      runAt: new Date().toISOString(),
      reasonCodes: [...reasonCodes, 'no_channels_enabled'],
      policy,
      scopeKind: preference.scopeKind,
      scopeId: preference.scopeId,
    };
  }

  const profileResponse = await input.supabase
    .from('profiles')
    .select('account_id')
    .eq('org_id', input.event.org_id)
    .eq('id', input.recipientProfileId)
    .is('deleted_at', null)
    .maybeSingle<ProfileAccountRow>();
  if (profileResponse.error) {
    throw new Error(profileResponse.error.message);
  }

  const channelId = resolveChannelIdFromScope(input.event);
  const threadId = resolveThreadIdFromPayload(input.event);

  const [presenceResponse, readStateResponse, threadReadStateResponse] =
    await Promise.all([
      input.supabase
        .from('profile_presence')
        .select('live_status, last_seen_at')
        .eq('org_id', input.event.org_id)
        .eq('profile_id', input.recipientProfileId)
        .is('deleted_at', null)
        .maybeSingle<{ live_status?: string | null; last_seen_at?: string | null }>(),
      channelId && profileResponse.data?.account_id
        ? input.supabase
            .from('channel_read_state')
            .select('last_read_at')
            .eq('org_id', input.event.org_id)
            .eq('channel_id', channelId)
            .eq('account_id', profileResponse.data.account_id)
            .is('thread_id', null)
            .is('deleted_at', null)
            .maybeSingle<{ last_read_at?: string | null }>()
        : Promise.resolve({ data: null, error: null }),
      channelId && threadId && profileResponse.data?.account_id
        ? input.supabase
            .from('channel_read_state')
            .select('last_read_at')
            .eq('org_id', input.event.org_id)
            .eq('channel_id', channelId)
            .eq('account_id', profileResponse.data.account_id)
            .eq('thread_id', threadId)
            .is('deleted_at', null)
            .maybeSingle<{ last_read_at?: string | null }>()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (presenceResponse.error) {
    throw new Error(presenceResponse.error.message);
  }
  if (readStateResponse.error) {
    throw new Error(readStateResponse.error.message);
  }
  if (threadReadStateResponse.error) {
    throw new Error(threadReadStateResponse.error.message);
  }

  const decision = buildDeliveryPlan({
    event: input.event,
    recipientProfileId: input.recipientProfileId,
    channels: preference.channels,
    reasonCodes,
    context: {
      liveStatus: presenceResponse.data?.live_status ?? null,
      lastSeenAt: presenceResponse.data?.last_seen_at ?? null,
      lastReadAt: resolveEffectiveLastReadAt([
        readStateResponse.data?.last_read_at ?? null,
        threadReadStateResponse.data?.last_read_at ?? null,
      ]),
    },
  });

  return {
    ...decision,
    scopeKind: preference.scopeKind,
    scopeId: preference.scopeId,
  };
}
