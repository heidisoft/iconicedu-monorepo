import { describe, expect, it } from 'vitest';

import { shouldRetryDirectMessageBootstrap } from '@iconicedu/web/lib/sidebar/direct-message-bootstrap';

describe('shouldRetryDirectMessageBootstrap', () => {
  it('retries when a first inbound message has not become visible yet', () => {
    expect(
      shouldRetryDirectMessageBootstrap({
        hasMessages: false,
        existsInSidebar: false,
        senderProfileId: 'profile-other',
      }),
    ).toBe(true);
  });

  it('retries brand-new dm channels created before the first message row is queryable', () => {
    expect(
      shouldRetryDirectMessageBootstrap({
        hasMessages: false,
        existsInSidebar: false,
        waitForMessages: true,
      }),
    ).toBe(true);
  });

  it('does not retry once the conversation is already visible', () => {
    expect(
      shouldRetryDirectMessageBootstrap({
        hasMessages: false,
        existsInSidebar: true,
        waitForMessages: true,
      }),
    ).toBe(false);
  });

  it('does not retry unrelated channel inserts with no message activity', () => {
    expect(
      shouldRetryDirectMessageBootstrap({
        hasMessages: false,
        existsInSidebar: false,
      }),
    ).toBe(false);
  });
});
