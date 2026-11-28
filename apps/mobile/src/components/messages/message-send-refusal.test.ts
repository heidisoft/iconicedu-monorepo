import { ApiError } from '@/lib/api/http-client';
import { getMessageSendRefusal } from './message-send-refusal';

describe('getMessageSendRefusal', () => {
  it('returns the API reason for a 403', () => {
    expect(
      getMessageSendRefusal(
        new ApiError('Students can only send messages to everyone', 403),
      ),
    ).toBe('Students can only send messages to everyone');
  });

  it.each([
    new ApiError('Bad request', 400),
    new ApiError('Server error', 500),
    new Error('Network request failed'),
    'offline',
  ])('treats %p as retryable', (error) => {
    expect(getMessageSendRefusal(error)).toBeNull();
  });
});
