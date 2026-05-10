import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

type PushNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  title: string;
  summary?: string | null;
  activityFeedItemId?: string | null;
  threadId?: string | null;
  scopeKind?: 'channel' | 'learning_space';
  scopeId?: string;
  channelRouteKind?: 'space' | 'dm' | 'channel';
  metadata?: Record<string, unknown>;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status: 'ok' | 'error';
  details?: { error?: string };
  message?: string;
};

export type SendPushResult = {
  ticketIds: string[];
  revokedTokenIds: string[];
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  badge?: number;
  channelId?: string;
  data?: Record<string, unknown>;
  sound: 'default';
};

// Keep preview/body text short enough for lock-screen scanning and Expo payload safety.
const MAX_PREVIEW_LENGTH = 150;

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.substring(0, maxLength);
  return `${text.substring(0, maxLength - 3).trimEnd()}...`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function buildExpoHeaders() {
  const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
  };
}

function resolveChannelIdFromMetadata(metadata: Record<string, unknown> | undefined) {
  const root = asRecord(metadata);
  if (typeof root.channelId === 'string' && root.channelId.trim().length > 0) {
    return root.channelId;
  }

  const rawEventPayload = asRecord(root.rawEventPayload);
  if (
    typeof rawEventPayload.channelId === 'string' &&
    rawEventPayload.channelId.trim().length > 0
  ) {
    return rawEventPayload.channelId;
  }

  const scope = asRecord(rawEventPayload.scope);
  if (typeof scope.channelId === 'string' && scope.channelId.trim().length > 0) {
    return scope.channelId;
  }

  return undefined;
}

function resolveSenderNameFromMetadata(metadata: Record<string, unknown> | undefined) {
  const root = asRecord(metadata);
  const rawEventPayload = asRecord(root.rawEventPayload);
  const senderNameCandidates = [
    'senderName',
    'sender_name',
    'displayName',
    'display_name',
  ];

  for (const key of senderNameCandidates) {
    const value = rawEventPayload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function resolveSenderAvatarUrlFromMetadata(
  metadata: Record<string, unknown> | undefined,
) {
  const root = asRecord(metadata);
  const rawEventPayload = asRecord(root.rawEventPayload);
  const avatarCandidates = [
    'senderAvatarUrl',
    'sender_avatar_url',
    'avatarUrl',
    'avatar_url',
  ];

  for (const key of avatarCandidates) {
    const value = rawEventPayload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function resolveThreadIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
  explicitThreadId?: string | null,
) {
  if (typeof explicitThreadId === 'string' && explicitThreadId.trim().length > 0) {
    return explicitThreadId;
  }

  const root = asRecord(metadata);
  if (typeof root.threadId === 'string' && root.threadId.trim().length > 0) {
    return root.threadId;
  }

  const rawEventPayload = asRecord(root.rawEventPayload);
  if (
    typeof rawEventPayload.threadId === 'string' &&
    rawEventPayload.threadId.trim().length > 0
  ) {
    return rawEventPayload.threadId;
  }

  return undefined;
}

function resolveChannelRouteKindFromMetadata(
  metadata: Record<string, unknown> | undefined,
  explicitChannelRouteKind?: 'space' | 'dm' | 'channel',
) {
  if (explicitChannelRouteKind) {
    return explicitChannelRouteKind;
  }

  const root = asRecord(metadata);
  if (
    root.channelRouteKind === 'space' ||
    root.channelRouteKind === 'dm' ||
    root.channelRouteKind === 'channel'
  ) {
    return root.channelRouteKind;
  }

  const rawEventPayload = asRecord(root.rawEventPayload);
  if (
    rawEventPayload.channelRouteKind === 'space' ||
    rawEventPayload.channelRouteKind === 'dm' ||
    rawEventPayload.channelRouteKind === 'channel'
  ) {
    return rawEventPayload.channelRouteKind;
  }

  return undefined;
}

function resolvePreviewFromMetadata(
  metadata: Record<string, unknown> | undefined,
  summary?: string | null,
) {
  const root = asRecord(metadata);
  const rawEventPayload = asRecord(root.rawEventPayload);

  if (
    typeof rawEventPayload.content === 'string' &&
    rawEventPayload.content.trim().length > 0
  ) {
    return truncateText(rawEventPayload.content.trim(), MAX_PREVIEW_LENGTH);
  }

  if (
    typeof rawEventPayload.preview === 'string' &&
    rawEventPayload.preview.trim().length > 0
  ) {
    return truncateText(rawEventPayload.preview.trim(), MAX_PREVIEW_LENGTH);
  }

  if (typeof summary === 'string' && summary.trim().length > 0) {
    return truncateText(summary.trim(), MAX_PREVIEW_LENGTH);
  }

  return undefined;
}

export async function sendPushNotification(payload: PushNotificationPayload) {
  const supabase = createSupabaseServiceClient();

  // 1. Fetch active (non-revoked) push tokens for the recipient
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('profile_id', payload.recipientProfileId)
    .is('revoked_at', null);

  if (error) {
    throw new Error(error.message);
  }

  if (!tokens?.length) {
    return { ticketIds: [], revokedTokenIds: [] } satisfies SendPushResult;
  }

  // Resolve badge count from the account's total unread across all channels.
  // Failures are swallowed — badge is best-effort and must not block delivery.
  let badgeCount: number | undefined;
  try {
    const profileRow = await supabase
      .from('profiles')
      .select('account_id')
      .eq('id', payload.recipientProfileId)
      .single();

    const accountId = profileRow.data?.account_id;
    if (accountId) {
      const { data: unreadRows } = await supabase
        .from('channel_read_state')
        .select('unread_count')
        .eq('org_id', payload.orgId)
        .eq('account_id', accountId)
        .is('deleted_at', null);

      if (Array.isArray(unreadRows)) {
        badgeCount = unreadRows.reduce(
          (total, row) => total + Math.max(0, row.unread_count ?? 0),
          0,
        );
      }
    }
  } catch {
    // Badge sync failure is non-critical — continue without badge.
  }

  const channelId = resolveChannelIdFromMetadata(payload.metadata);
  const threadId = resolveThreadIdFromMetadata(payload.metadata, payload.threadId);
  const channelRouteKind = resolveChannelRouteKindFromMetadata(
    payload.metadata,
    payload.channelRouteKind,
  );
  const senderName = resolveSenderNameFromMetadata(payload.metadata);
  const senderAvatarUrl = resolveSenderAvatarUrlFromMetadata(payload.metadata);
  const preview = resolvePreviewFromMetadata(payload.metadata, payload.summary);

  // 2. Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.summary
      ? truncateText(payload.summary, MAX_PREVIEW_LENGTH)
      : (preview ?? undefined),
    ...(badgeCount !== undefined ? { badge: badgeCount } : {}),
    // Required for Android 8+ to route the notification to the correct channel.
    // Must match the channel created by ensureAndroidChannel() in use-push-registration.ts.
    channelId: 'default',
    data: {
      prefKey: payload.prefKey,
      orgId: payload.orgId,
      activityFeedItemId: payload.activityFeedItemId ?? null,
      scopeKind: payload.scopeKind,
      scopeId: payload.scopeId,
      channelId,
      threadId: threadId ?? null,
      channelRouteKind,
      senderName,
      senderAvatarUrl,
      preview,
    },
    sound: 'default',
  }));

  // 3. Send via Expo Push API
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: buildExpoHeaders(),
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    throw new Error(`Expo Push API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: ExpoTicket[] };
  const tickets = Array.isArray(json.data) ? json.data : [];

  // 4. Inspect ticket results and revoke tokens that Expo reports as unregistered
  const revokeIds: string[] = [];
  const ticketIds: string[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const tokenId = tokens[i]?.id;
    if (!ticket) continue;

    if (ticket.status === 'ok') {
      if (typeof ticket.id === 'string' && ticket.id.length > 0) {
        ticketIds.push(ticket.id);
      }
      continue;
    }

    const errCode = ticket.details?.error;
    if (errCode === 'DeviceNotRegistered' && tokenId) {
      revokeIds.push(tokenId);
    } else if (errCode === 'InvalidCredentials') {
      throw new Error(
        'Expo push InvalidCredentials - check EAS project push credentials',
      );
    } else if (errCode === 'MessageTooBig') {
      continue;
    } else if (errCode === 'MessageRateExceeded') {
      throw new Error('Expo push rate exceeded - back off and retry');
    } else if (errCode) {
      continue;
    }
  }

  if (revokeIds.length > 0) {
    await supabase
      .from('push_tokens')
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', revokeIds);
  }

  return {
    ticketIds,
    revokedTokenIds: revokeIds,
  } satisfies SendPushResult;
}

export async function pollExpoPushReceipts(receiptIds: string[]) {
  if (!receiptIds.length) {
    return {} as Record<string, ExpoReceipt>;
  }

  const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: buildExpoHeaders(),
    body: JSON.stringify({ ids: receiptIds }),
  });

  if (!res.ok) {
    throw new Error(`Expo Push receipts API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: Record<string, ExpoReceipt> };
  return json.data ?? {};
}
