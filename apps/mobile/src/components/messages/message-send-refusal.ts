import { ApiError } from '@/lib/api/http-client';

/**
 * The reason the API refused a send that cannot succeed on retry (for example
 * a private audience the safeguarding rules do not allow), or null for
 * ordinary failures that should stay retryable.
 */
export function getMessageSendRefusal(error: unknown): string | null {
  return error instanceof ApiError && error.status === 403 ? error.message : null;
}
