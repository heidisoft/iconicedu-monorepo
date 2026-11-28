/**
 * Thrown on the client when the server refused a send for a reason the sender
 * can act on. Retrying the same send cannot succeed, so the UI shows the
 * reason instead of offering Retry.
 */
export class MessageSendRejectedError extends Error {
  readonly isMessageSendRejection = true;

  constructor(message: string) {
    super(message);
    this.name = 'MessageSendRejectedError';
  }
}

export function isMessageSendRejectedError(
  error: unknown,
): error is MessageSendRejectedError {
  return (
    error instanceof Error &&
    (error as { isMessageSendRejection?: unknown }).isMessageSendRejection === true
  );
}
