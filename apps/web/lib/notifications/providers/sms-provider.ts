import type { SmsNotificationPayload, SmsNotificationProvider } from '@iconicedu/utils';

const noopSmsProvider: SmsNotificationProvider = {
  async send(_payload) {},
};

export async function sendSmsNotification(payload: SmsNotificationPayload) {
  await noopSmsProvider.send(payload);
}
