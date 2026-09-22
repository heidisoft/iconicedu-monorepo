/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { toast } from 'sonner';

import { MessagesContainer } from './messages-container';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../hooks/use-messages', () => ({
  useMessages: (initialMessages: any[]) => ({
    messages: initialMessages,
    addMessage: vi.fn(),
    prependMessages: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    toggleReaction: vi.fn(),
    toggleSaved: vi.fn(),
    toggleHidden: vi.fn(),
  }),
}));

vi.mock('./context/messages-state-provider', () => ({
  useOptionalMessagesState: () => null,
  useMessagesState: () => ({
    toggle: vi.fn(),
    setSavedCount: vi.fn(),
    setHomeworkCount: vi.fn(),
    setSessionSummaryCount: vi.fn(),
    setThreadData: vi.fn(),
    setCurrentUserId: vi.fn(),
    setMessages: vi.fn(),
    setCreateTextMessage: vi.fn(),
    setSendTextMessage: vi.fn(),
    setSendFileMessage: vi.fn(),
    setJoinLiveSession: vi.fn(),
    setGetMessageActionState: vi.fn(),
    setThreadHandlers: vi.fn(),
    setScrollToMessage: vi.fn(),
    messageFilter: null,
    toggleMessageFilter: vi.fn(),
  }),
}));

const latestMessageListProps: { current: any | null } = { current: null };

vi.mock('./message-list', () => ({
  MessageList: (props: any) => {
    latestMessageListProps.current = props;
    return null;
  },
}));

vi.mock('./message-input', () => ({
  MessageInput: () => null,
}));

const makeParticipant = (id: string, kind: UserProfileVM['kind']): UserProfileVM =>
  ({
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    kind,
    profile: { displayName: `User ${id}`, avatar: { url: null, source: 'seed' } },
    prefs: {},
    meta: {},
    ui: { themeKey: null },
    joinedDate: new Date().toISOString(),
  }) as unknown as UserProfileVM;

const textMessage = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: makeParticipant('profile-2', 'educator'),
    createdAt: new Date().toISOString(),
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'Hello there' },
} as any;

const channel: ChannelVM = {
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
  postingPolicy: { kind: 'members-only', allowThreads: true, allowReactions: true },
  collections: {
    participants: [
      makeParticipant('profile-1', 'staff'),
      makeParticipant('profile-2', 'educator'),
    ],
    messages: { items: [textMessage], total: 1 },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
  },
};

describe('MessagesContainer pinning', () => {
  beforeEach(() => {
    latestMessageListProps.current = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads pinned message ids for the channel when enableMessagePinning is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).startsWith('/api/messages/pins')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: [
                {
                  message: textMessage,
                  pinnedBy: makeParticipant('profile-1', 'staff'),
                  pinnedAt: new Date().toISOString(),
                },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true, files: [] }) };
      }),
    );

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-1"
        currentUserProfile={makeParticipant('profile-1', 'staff')}
        enableMessagePinning
      />,
    );

    await waitFor(() => {
      expect(latestMessageListProps.current?.pinnedMessageIds?.has('message-1')).toBe(
        true,
      );
    });

    expect(latestMessageListProps.current?.currentUserCanPinMessages).toBe(true);
  });

  it('does not fetch pins or grant pin permission when enableMessagePinning is off', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-1"
        currentUserProfile={makeParticipant('profile-1', 'staff')}
        enableMessagePinning={false}
      />,
    );

    await waitFor(() => {
      expect(latestMessageListProps.current).not.toBeNull();
    });
    expect(latestMessageListProps.current?.currentUserCanPinMessages).toBe(false);
    expect(latestMessageListProps.current?.pinnedMessageIds?.size).toBe(0);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).startsWith('/api/messages/pins'),
      ),
    ).toBe(false);
  });

  it('does not grant pin permission to non-manager profiles even when the flag is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })),
    );

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-3"
        currentUserProfile={makeParticipant('profile-3', 'guardian')}
        enableMessagePinning
      />,
    );

    await waitFor(() => {
      expect(latestMessageListProps.current).not.toBeNull();
    });
    expect(latestMessageListProps.current?.currentUserCanPinMessages).toBe(false);
  });

  it('optimistically pins, then rolls back and surfaces the error when the API rejects (e.g. the 25-pin cap)', async () => {
    // The channel already has one other pinned message ("message-2"), so the
    // initial-load fetch resolving gives a signal distinct from the Set's
    // empty initial state — the test can then wait on it deterministically
    // instead of racing an optimistic update against the mount-time fetch.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.startsWith('/api/messages/pins') &&
          (!init || init.method === undefined)
        ) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: [
                {
                  message: { ...textMessage, ids: { id: 'message-2', orgId: 'org-1' } },
                  pinnedBy: makeParticipant('profile-1', 'staff'),
                  pinnedAt: new Date().toISOString(),
                },
              ],
            }),
          };
        }
        if (url === '/api/messages/pins' && init?.method === 'POST') {
          return {
            ok: false,
            json: async () => ({
              success: false,
              message: 'This channel already has 25 pinned messages.',
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true, files: [] }) };
      }),
    );

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-1"
        currentUserProfile={makeParticipant('profile-1', 'staff')}
        enableMessagePinning
      />,
    );

    // Wait for the initial GET /api/messages/pins load to settle before
    // toggling, so it cannot race with (and clobber) the optimistic update.
    await waitFor(() => {
      expect(latestMessageListProps.current?.currentUserCanPinMessages).toBe(true);
      expect(latestMessageListProps.current?.pinnedMessageIds?.has('message-2')).toBe(
        true,
      );
    });

    // The mocked POST rejects (and rolls back) almost synchronously, so this
    // exercises the full optimistic-update-then-rollback cycle rather than
    // trying to catch the update mid-flight.
    await act(async () => {
      latestMessageListProps.current.onTogglePinned('message-1');
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'This channel already has 25 pinned messages.',
      );
    });

    // Rolled back after the API rejected the pin — the pre-existing pin stays.
    await waitFor(() => {
      expect(latestMessageListProps.current?.pinnedMessageIds?.has('message-1')).toBe(
        false,
      );
    });
    expect(latestMessageListProps.current?.pinnedMessageIds?.has('message-2')).toBe(true);
  });
});
