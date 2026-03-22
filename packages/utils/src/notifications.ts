export type EmailNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  subject: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export type SmsNotificationPayload = {
  orgId: string;
  recipientProfileId: string;
  prefKey: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export interface EmailNotificationProvider {
  send(payload: EmailNotificationPayload): Promise<void>;
}

export interface SmsNotificationProvider {
  send(payload: SmsNotificationPayload): Promise<void>;
}
