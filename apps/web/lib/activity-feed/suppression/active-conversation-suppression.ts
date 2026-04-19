import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const ACTIVE_LIVE_STATUSES = new Set([
  'online',
  'in_class',
  'teaching',
  'reviewing_work',
]);

const CONVERSATIONAL_EVENT_TYPES = new Set([
  'dm.posted',
  'message.posted',
  'file.uploaded',
  'dm.reaction.added',
  'reaction.added',
]);

export const ACTIVE_CONVERSATION_SUPPRESSION_WINDOW_MS = 120_000;
const PRESENCE_STALE_MS = 5 * 60 * 1000;

type SuppressionClient = Pick<SupabaseServiceClient, 'from'>;

type EventScope = {
  kind?: string;
  channelId?: string;
};

type EventPayload = {
  channelId?: string;
};

type ProfileAccountRow = {
  id: string;
  account_id: string | null;
};

type PresenceRow = {
  profile_id: string;
  live_status: string | null;
  last_seen_at: string | null;
};

type ReadStateRow = {
  account_id: string;
  last_read_at: string | null;
};

export type ActiveConversationSuppressionResult = {
  recipientProfileIds: string[];
  suppressedProfileIds: string[];
  channelId: string | null;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function asRecord<T extends Record<string, unknown>>(value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as T;
  }
  return value as T;
}

function resolveEventChannelId(event: ActivityEventRow) {
  const scope = asRecord<EventScope>(event.scope);
  if (scope.kind === 'channel' && typeof scope.channelId === 'string') {
    return scope.channelId;
  }
  const payload = asRecord<EventPayload>(event.payload);
  return typeof payload.channelId === 'string' ? payload.channelId : null;
}

function isConversationalEventType(eventType: string) {
  return CONVERSATIONAL_EVENT_TYPES.has(eventType);
}

function isActivePresence(liveStatus: string | null | undefined) {
  return typeof liveStatus === 'string' && ACTIVE_LIVE_STATUSES.has(liveStatus);
}

function isRecentlyRead(lastReadAt: string | null | undefined, cutoffTime: number) {
  if (!lastReadAt) {
    return false;
  }
  const readTime = new Date(lastReadAt).getTime();
  if (Number.isNaN(readTime)) {
    return false;
  }
  return readTime >= cutoffTime;
}

function isPresenceFresh(lastSeenAt: string | null | undefined, nowTime: number) {
  if (!lastSeenAt) {
    return false;
  }
  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenTime)) {
    return false;
  }
  return nowTime - lastSeenTime <= PRESENCE_STALE_MS;
}

export async function resolveActiveConversationSuppressedRecipients(input: {
  supabase: SuppressionClient;
  event: ActivityEventRow;
  recipientProfileIds: string[];
  now?: string;
  suppressionWindowMs?: number;
}): Promise<ActiveConversationSuppressionResult> {
  const recipientProfileIds = unique(input.recipientProfileIds);
  if (!recipientProfileIds.length) {
    return {
      recipientProfileIds: [],
      suppressedProfileIds: [],
      channelId: null,
    };
  }

  if (!isConversationalEventType(input.event.event_type)) {
    return {
      recipientProfileIds,
      suppressedProfileIds: [],
      channelId: null,
    };
  }

  const channelId = resolveEventChannelId(input.event);
  if (!channelId) {
    return {
      recipientProfileIds,
      suppressedProfileIds: [],
      channelId: null,
    };
  }

  const profileResponse = await input.supabase
    .from('profiles')
    .select('id, account_id')
    .eq('org_id', input.event.org_id)
    .in('id', recipientProfileIds)
    .is('deleted_at', null)
    .returns<ProfileAccountRow[]>();

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message);
  }

  const accountIdByProfileId = new Map(
    (profileResponse.data ?? [])
      .filter((row) => row.id)
      .map((row) => [row.id, row.account_id]),
  );

  const presenceResponse = await input.supabase
    .from('profile_presence')
    .select('profile_id, live_status, last_seen_at')
    .eq('org_id', input.event.org_id)
    .in('profile_id', recipientProfileIds)
    .is('deleted_at', null)
    .returns<PresenceRow[]>();

  if (presenceResponse.error) {
    throw new Error(presenceResponse.error.message);
  }

  const presenceByProfileId = new Map(
    (presenceResponse.data ?? []).map((row) => [row.profile_id, row]),
  );

  const accountIds = unique(
    Array.from(accountIdByProfileId.values()).filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );

  const lastReadAtByAccountId = new Map<string, string | null>();
  if (accountIds.length) {
    const readStateResponse = await input.supabase
      .from('channel_read_state')
      .select('account_id, last_read_at')
      .eq('org_id', input.event.org_id)
      .eq('channel_id', channelId)
      .in('account_id', accountIds)
      .is('deleted_at', null)
      .returns<ReadStateRow[]>();

    if (readStateResponse.error) {
      throw new Error(readStateResponse.error.message);
    }

    (readStateResponse.data ?? []).forEach((row) => {
      lastReadAtByAccountId.set(row.account_id, row.last_read_at);
    });
  }

  const nowIso = input.now ?? input.event.occurred_at;
  const nowTime = new Date(nowIso).getTime();
  const suppressionWindowMs =
    input.suppressionWindowMs ?? ACTIVE_CONVERSATION_SUPPRESSION_WINDOW_MS;
  const cutoffTime = Number.isNaN(nowTime) ? Number.NaN : nowTime - suppressionWindowMs;

  const emittedProfileIds: string[] = [];
  const suppressedProfileIds: string[] = [];

  for (const profileId of recipientProfileIds) {
    const accountId = accountIdByProfileId.get(profileId);
    const presence = presenceByProfileId.get(profileId);
    const liveStatus = presence?.live_status;
    const lastReadAt =
      typeof accountId === 'string' ? lastReadAtByAccountId.get(accountId) : null;
    const presenceFresh = isPresenceFresh(presence?.last_seen_at, nowTime);

    const suppress =
      !Number.isNaN(cutoffTime) &&
      isActivePresence(liveStatus) &&
      presenceFresh &&
      isRecentlyRead(lastReadAt, cutoffTime);

    if (suppress) {
      suppressedProfileIds.push(profileId);
    } else {
      emittedProfileIds.push(profileId);
    }
  }

  return {
    recipientProfileIds: emittedProfileIds,
    suppressedProfileIds,
    channelId,
  };
}
