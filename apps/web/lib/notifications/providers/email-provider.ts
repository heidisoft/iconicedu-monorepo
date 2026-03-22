import type {
  EmailNotificationPayload,
  EmailNotificationProvider,
} from '@iconicedu/utils';

const noopEmailProvider: EmailNotificationProvider = {
  async send(_payload) {},
};

export async function sendEmailNotification(payload: EmailNotificationPayload) {
  await noopEmailProvider.send(payload);
}
