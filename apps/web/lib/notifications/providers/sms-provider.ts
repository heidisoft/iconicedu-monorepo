type SmsNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function sendSmsNotification(_payload: SmsNotificationPayload) {}
