import { describe, expect, it } from 'vitest';

import { getDefaultMessagesTab } from './messages-container';
import type { ChannelVM } from '@iconicedu/shared-types';

const baseChannel: ChannelVM = {
  ids: { id: 'channel-1', orgId: 'org-1' },
  basics: {
    kind: 'channel',
    topic: 'General',
    iconKey: null,
    description: null,
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: 'profile-1',
    createdAt: new Date().toISOString(),
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  collections: {
    participants: [],
    messages: { items: [], total: 0 },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
  },
};

describe('getDefaultMessagesTab', () => {
  it('defaults learning space channels with schedule capability to the sessions tab', () => {
    const learningSpaceChannel: ChannelVM = {
      ...baseChannel,
      basics: {
        ...baseChannel.basics,
        purpose: 'learning-space',
      },
      context: {
        capabilities: ['has_schedule'],
        primaryEntity: { kind: 'learning_space', id: 'space-1' },
      },
    };

    expect(getDefaultMessagesTab(learningSpaceChannel, true)).toBe('schedule');
  });

  it('defaults non-learning-space channels to the messages tab', () => {
    expect(getDefaultMessagesTab(baseChannel, true)).toBe('messages');
  });

  it('falls back to messages when the schedule tab is not enabled', () => {
    const learningSpaceChannel: ChannelVM = {
      ...baseChannel,
      basics: {
        ...baseChannel.basics,
        purpose: 'learning-space',
      },
      context: {
        capabilities: [],
        primaryEntity: { kind: 'learning_space', id: 'space-1' },
      },
    };

    expect(getDefaultMessagesTab(learningSpaceChannel, false)).toBe('messages');
  });
});
