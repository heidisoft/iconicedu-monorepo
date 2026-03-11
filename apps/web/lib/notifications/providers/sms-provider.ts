type SmsNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function sendSmsNotification(payload: SmsNotificationPayload) {
  console.log('notifications.sms.send', {
    orgId: payload.orgId,
    recipientProfileId: payload.recipientProfileId,
    prefKey: payload.prefKey,
    message: payload.message,
    metadata: payload.metadata ?? {},
  });
}
