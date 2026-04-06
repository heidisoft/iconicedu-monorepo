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
  data?: Record<string, unknown>;
  sound: 'default';
};

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

  // 2. Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.summary ?? undefined,
    data: {
      prefKey: payload.prefKey,
      orgId: payload.orgId,
      scopeKind: payload.scopeKind,
      scopeId: payload.scopeId,
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
