import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { isMessageSendRejectedError } from '@iconicedu/ui-web/components/messages/message-send-rejected-error';
import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';
import {
  isMessageSendRejectionResult,
  toMessageSendRejection,
  unwrapMessageSendResult,
} from './message-send-rejection';

describe('message send rejections', () => {
  it('maps an API 403 to a rejection carrying its message', () => {
    expect(toMessageSendRejection(new ApiHttpError(403, 'Not allowed'))).toEqual({
      rejected: true,
      status: 403,
      message: 'Not allowed',
    });
  });

  it.each([new ApiHttpError(400, 'Bad'), new ApiHttpError(500, 'Down'), new Error('x')])(
    'rethrows anything else (%s)',
    (error) => {
      expect(() => toMessageSendRejection(error)).toThrow(error);
    },
  );

  it('recognises only well-formed rejections', () => {
    expect(
      isMessageSendRejectionResult({ rejected: true, message: 'm', status: 403 }),
    ).toBe(true);
    expect(isMessageSendRejectionResult({ ids: { id: 'm1' } })).toBe(false);
    expect(isMessageSendRejectionResult(null)).toBe(false);
  });

  it('unwraps a message and throws a MessageSendRejectedError for a rejection', () => {
    const message = { ids: { id: 'm1', orgId: 'o1' } } as unknown as MessageVM;
    expect(unwrapMessageSendResult(message)).toBe(message);

    let caught: unknown;
    try {
      unwrapMessageSendResult({ rejected: true, status: 403, message: 'Blocked' });
    } catch (error) {
      caught = error;
    }
    expect(isMessageSendRejectedError(caught)).toBe(true);
    expect((caught as Error).message).toBe('Blocked');
  });
});
