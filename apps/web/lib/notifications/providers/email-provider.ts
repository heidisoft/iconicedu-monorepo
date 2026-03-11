type EmailNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  subject: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendEmailNotification(payload: EmailNotificationPayload) {
  console.log('notifications.email.send', {
    orgId: payload.orgId,
    recipientProfileId: payload.recipientProfileId,
    prefKey: payload.prefKey,
    subject: payload.subject,
    summary: payload.summary ?? null,
    metadata: payload.metadata ?? {},
  });
}
