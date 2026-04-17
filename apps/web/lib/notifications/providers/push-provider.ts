import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type PushNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  title: string;
  summary?: string | null;
  scopeKind?: 'channel' | 'learning_space';
  scopeId?: string;
  metadata?: Record<string, unknown>;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  details?: { error?: string };
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  channelId?: string;
  data?: Record<string, unknown>;
  sound: 'default';
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
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
    return rawEventPayload.content.trim();
  }

  if (
    typeof rawEventPayload.preview === 'string' &&
    rawEventPayload.preview.trim().length > 0
  ) {
    return rawEventPayload.preview.trim();
  }

  if (typeof summary === 'string' && summary.trim().length > 0) {
    return summary.trim();
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

  if (!tokens?.length) return;

  const channelId = resolveChannelIdFromMetadata(payload.metadata);
  const senderName = resolveSenderNameFromMetadata(payload.metadata);
  const senderAvatarUrl = resolveSenderAvatarUrlFromMetadata(payload.metadata);
  const preview = resolvePreviewFromMetadata(payload.metadata, payload.summary);

  // 2. Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.summary ?? undefined,
    // Required for Android 8+ to route the notification to the correct channel.
    // Must match the channel created by ensureAndroidChannel() in use-push-registration.ts.
    channelId: 'default',
    data: {
      prefKey: payload.prefKey,
      orgId: payload.orgId,
      scopeKind: payload.scopeKind,
      scopeId: payload.scopeId,
      channelId,
      senderName,
      senderAvatarUrl,
      preview,
    },
    sound: 'default',
  }));

  // 3. Send via Expo Push API
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    throw new Error(`Expo Push API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: ExpoTicket[] };
  const tickets = Array.isArray(json.data) ? json.data : [];

  // 4. Revoke tokens that the Expo service reports as unregistered
  const revokeIds: string[] = [];
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
      const tokenId = tokens[i]?.id;
      if (tokenId) revokeIds.push(tokenId);
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
}
