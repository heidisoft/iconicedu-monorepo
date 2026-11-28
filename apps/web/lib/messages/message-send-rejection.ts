import type { MessageVM } from '@iconicedu/shared-types';
import { MessageSendRejectedError } from '@iconicedu/ui-web/components/messages/message-send-rejected-error';
import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';

/**
 * A send the API refused for a reason the sender can act on (for example a
 * private audience the safeguarding rules do not allow).
 *
 * Server actions return this instead of throwing because Next.js replaces
 * thrown server-action error messages with a generic one in production.
 */
export type MessageSendRejection = {
  rejected: true;
  status: number;
  message: string;
};

export function isMessageSendRejectionResult(
  value: unknown,
): value is MessageSendRejection {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { rejected?: unknown }).rejected === true &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/** Maps an API 403 to a rejection; any other error is rethrown unchanged. */
export function toMessageSendRejection(error: unknown): MessageSendRejection {
  if (error instanceof ApiHttpError && error.status === 403) {
    return { rejected: true, status: error.status, message: error.message };
  }
  throw error;
}

/** Client side: turns a returned rejection into a MessageSendRejectedError. */
export function unwrapMessageSendResult(
  result: MessageVM | MessageSendRejection,
): MessageVM {
  if (isMessageSendRejectionResult(result)) {
    throw new MessageSendRejectedError(result.message);
  }
  return result;
}
