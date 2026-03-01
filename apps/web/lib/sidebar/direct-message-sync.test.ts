import { describe, expect, it } from 'vitest';

import { shouldAttemptDirectMessageSync } from '@iconicedu/web/lib/sidebar/direct-message-sync';

describe('shouldAttemptDirectMessageSync', () => {
  it('returns false for already-known direct message ids', () => {
    expect(
      shouldAttemptDirectMessageSync('channel-1', new Set(['channel-1']), new Set()),
    ).toBe(false);
  });

  it('returns false for excluded non-direct ids', () => {
    expect(
      shouldAttemptDirectMessageSync('channel-2', new Set(), new Set(['channel-2'])),
    ).toBe(false);
  });

  it('returns true for unknown candidate ids', () => {
    expect(
      shouldAttemptDirectMessageSync('channel-3', new Set(['channel-1']), new Set(['channel-2'])),
    ).toBe(true);
  });
});
