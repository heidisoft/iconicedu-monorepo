import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageList } from '@/components/messages/message-list';
import type { MessageVM } from '@iconicedu/shared-types';

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchThreadMessages: jest.fn(),
  markThreadReadState: jest.fn(),
  queryKeys: {
    messages: (channelId: string, profileId = '') => ['messages', channelId, profileId],
  },
}));

function makeSender(id: string, name = 'Sender') {
  return {
    kind: 'educator',
    ids: { id, orgId: 'org-1', accountId: `acc-${id}` },
    profile: {
      displayName: name,
      avatar: { source: 'seed' as const, seed: id, url: null },
    },
    prefs: {},
    meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  } as unknown as MessageVM['core']['sender'];
}

function makeMsg(id: string, text: string, createdAt: string): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender('u1', 'Sender'),
      createdAt,
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text },
  } as unknown as MessageVM;
}

describe('MessageList — pinned indicator + search navigation (issue #264 P2)', () => {
  const messages = [
    makeMsg('a', 'First message', '2025-12-17T10:00:00Z'),
    makeMsg('b', 'Second message', '2025-12-17T10:10:00Z'),
  ];

  it('shows the pinned indicator only for message ids in pinnedMessageIds', () => {
    render(
      <MessageList
        messages={messages}
        currentProfileId="u1"
        pinnedMessageIds={new Set(['a'])}
      />,
    );

    // Both messages render; only one pin indicator should be present.
    expect(screen.getByText('First message')).toBeTruthy();
    expect(screen.getByText('Second message')).toBeTruthy();
    expect(screen.getAllByTestId('message-pinned-indicator')).toHaveLength(1);
  });

  it('reports found=true via onScrollToMessageResult when the target message is loaded', () => {
    const onScrollToMessageResult = jest.fn();
    render(
      <MessageList
        messages={messages}
        currentProfileId="u1"
        highlightMessageId="b"
        onScrollToMessageResult={onScrollToMessageResult}
      />,
    );

    expect(onScrollToMessageResult).toHaveBeenCalledWith(true);
  });

  it('reports found=false via onScrollToMessageResult when the target message is not currently loaded', () => {
    const onScrollToMessageResult = jest.fn();
    render(
      <MessageList
        messages={messages}
        currentProfileId="u1"
        highlightMessageId="does-not-exist"
        onScrollToMessageResult={onScrollToMessageResult}
      />,
    );

    expect(onScrollToMessageResult).toHaveBeenCalledWith(false);
  });

  it('does not crash and does not call onScrollToMessageResult when highlightMessageId is unset', () => {
    const onScrollToMessageResult = jest.fn();
    render(
      <MessageList
        messages={messages}
        currentProfileId="u1"
        onScrollToMessageResult={onScrollToMessageResult}
      />,
    );

    expect(onScrollToMessageResult).not.toHaveBeenCalled();
  });
});
