type EmailNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  subject: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendEmailNotification(_payload: EmailNotificationPayload) {}
