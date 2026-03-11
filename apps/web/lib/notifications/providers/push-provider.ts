type PushNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendPushNotification(payload: PushNotificationPayload) {
  console.log('notifications.push.send', {
    orgId: payload.orgId,
    recipientProfileId: payload.recipientProfileId,
    prefKey: payload.prefKey,
    title: payload.title,
    summary: payload.summary ?? null,
    metadata: payload.metadata ?? {},
  });
}
