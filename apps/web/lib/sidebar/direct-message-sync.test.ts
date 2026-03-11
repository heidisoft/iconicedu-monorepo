import { describe, expect, it } from 'vitest';

import {
  shouldAttemptDirectMessageSync,
  shouldRunDirectMessageSync,
} from '@iconicedu/web/lib/sidebar/direct-message-sync';

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
      shouldAttemptDirectMessageSync(
        'channel-3',
        new Set(['channel-1']),
        new Set(['channel-2']),
      ),
    ).toBe(true);
  });
});

describe('shouldRunDirectMessageSync', () => {
  it('allows refreshing existing dm channels when allowExistingSync is true', () => {
    expect(
      shouldRunDirectMessageSync({
        channelId: 'channel-1',
        directMessageIds: new Set(['channel-1']),
        excludedChannelIds: new Set(),
        allowExistingSync: true,
      }),
    ).toBe(true);
  });

  it('still blocks excluded channels even when allowExistingSync is true', () => {
    expect(
      shouldRunDirectMessageSync({
        channelId: 'channel-2',
        directMessageIds: new Set(),
        excludedChannelIds: new Set(['channel-2']),
        allowExistingSync: true,
      }),
    ).toBe(false);
  });

  it('uses default sync rules when allowExistingSync is not set', () => {
    expect(
      shouldRunDirectMessageSync({
        channelId: 'channel-3',
        directMessageIds: new Set(['channel-3']),
        excludedChannelIds: new Set(),
      }),
    ).toBe(false);
  });
});
