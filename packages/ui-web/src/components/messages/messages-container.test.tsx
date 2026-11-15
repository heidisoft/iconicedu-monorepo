/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, waitFor, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { MessagesContainer } from './messages-container';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

const setCurrentUserId = vi.fn();
const setCreateTextMessage = vi.fn();
const setSendTextMessage = vi.fn();
const setSendFileMessage = vi.fn();
const setEditTextMessage = vi.fn();
const setJoinLiveSession = vi.fn();
const latestGetMessageActionState: {
  current: ((messageId: string) => any) | null;
} = { current: null };
const setGetMessageActionState = vi.fn((handler: (messageId: string) => any) => {
  latestGetMessageActionState.current = handler;
});
const addMessage = vi.fn();
const updateMessage = vi.fn();
const deleteMessage = vi.fn();
const toggleReaction = vi.fn();
const toggleSaved = vi.fn();
const toggleHidden = vi.fn();
const prependMessages = vi.fn();
const latestMessageInputProps: { current: any | null } = { current: null };

vi.mock('../../hooks/use-messages', () => ({
  useMessages: (initialMessages: any[]) => ({
    messages: initialMessages,
    addMessage,
    prependMessages,
    updateMessage,
    deleteMessage,
    toggleReaction,
    toggleSaved,
    toggleHidden,
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
    setCurrentUserId,
    setMessages: vi.fn(),
    setCreateTextMessage,
    setSendTextMessage,
    setSendFileMessage,
    setEditTextMessage,
    setJoinLiveSession,
    setGetMessageActionState,
    setThreadHandlers: vi.fn(),
    setScrollToMessage: vi.fn(),
    messageFilter: null,
    toggleMessageFilter: vi.fn(),
  }),
}));

const latestMessageListProps: { current: any | null } = { current: null };

vi.mock('./message-list', () => ({
  MessageList: ({
    onUnreadViewed,
    onOpenThread,
    messages,
    emptyStateStarterAction,
    ...rest
  }: {
    onUnreadViewed?: (lastReadMessageId: string) => void;
    onOpenThread?: (thread: any, parentMessage: any) => void | Promise<void>;
    messages?: any[];
    emptyStateStarterAction?: { label: string; onClick: () => void };
  } & Record<string, any>) => {
    latestMessageListProps.current = {
      onUnreadViewed,
      onOpenThread,
      messages,
      emptyStateStarterAction,
      ...rest,
    };
    return (
      <div>
        <button type="button" onClick={() => onUnreadViewed?.('message-2')}>
          mark-read
        </button>
        <button
          type="button"
          onClick={() => {
            const parentMessage = messages?.[0];
            const thread = parentMessage?.social?.thread;
            if (thread && parentMessage) {
              void onOpenThread?.(thread, parentMessage);
            }
          }}
        >
          open-thread
        </button>
        {emptyStateStarterAction ? (
          <button type="button" onClick={() => emptyStateStarterAction.onClick()}>
            {emptyStateStarterAction.label}
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock('./message-input', () => ({
  MessageInput: (props: any) => {
    latestMessageInputProps.current = props;
    return null;
  },
}));

const makeParticipant = (id: string, kind: UserProfileVM['kind']): UserProfileVM =>
  ({
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    kind,
    profile: {
      displayName: `User ${id}`,
      avatar: { url: null, source: 'seed' },
    },
    prefs: {},
    meta: {},
    ui: { themeKey: null },
    joinedDate: new Date().toISOString(),
  }) as unknown as UserProfileVM;

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
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  collections: {
    participants: [
      makeParticipant('profile-1', 'guardian'),
      makeParticipant('profile-2', 'educator'),
    ],
    messages: { items: [], total: 0 },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
  },
};

describe('MessagesContainer', () => {
  beforeEach(() => {
    latestMessageInputProps.current = null;
    latestMessageListProps.current = null;
    latestGetMessageActionState.current = null;
    window.history.replaceState(null, '', window.location.pathname);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, files: [] }),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('uses the provided currentUserId', async () => {
    render(<MessagesContainer channel={channel} currentUserId="profile-2" />);

    await waitFor(() => {
      expect(setCurrentUserId).toHaveBeenCalledWith('profile-2');
    });

    const createFactory = setCreateTextMessage.mock.calls[0]?.[0];
    const message = createFactory?.('hello');
    expect(message.core.sender.ids.id).toBe('profile-2');
  });

  it('renders typing indicator for other participants', async () => {
    const onEventHandlers: Array<(event: any) => void> = [];
    const realtimeClient = {
      subscribe: ({ onEvent }: { onEvent: (event: any) => void }) => {
        onEventHandlers.push(onEvent);
        return { unsubscribe: () => void 0 };
      },
      sendTyping: vi.fn(),
    };

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
        realtimeClient={realtimeClient as any}
      />,
    );

    act(() => {
      onEventHandlers.forEach((handler) =>
        handler({ type: 'typing-start', profileId: 'profile-1' }),
      );
    });

    expect(screen.getAllByText(/User profile-1 is typing/i).length).toBeGreaterThan(0);
  });

  it('hides typing indicator a few seconds after typing stops', async () => {
    const onEventHandlers: Array<(event: any) => void> = [];
    const realtimeClient = {
      subscribe: ({ onEvent }: { onEvent: (event: any) => void }) => {
        onEventHandlers.push(onEvent);
        return { unsubscribe: () => void 0 };
      },
      sendTyping: vi.fn(),
    };

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
        realtimeClient={realtimeClient as any}
      />,
    );

    act(() => {
      onEventHandlers.forEach((handler) =>
        handler({ type: 'typing-start', profileId: 'profile-1' }),
      );
    });

    expect(screen.getAllByText(/User profile-1 is typing/i).length).toBeGreaterThan(0);

    act(() => {
      onEventHandlers.forEach((handler) =>
        handler({ type: 'typing-stop', profileId: 'profile-1' }),
      );
    });

    expect(screen.queryByText(/User profile-1 is typing/i)).not.toBeInTheDocument();
  });

  it('persists read-state when unread is viewed', async () => {
    render(<MessagesContainer channel={channel} currentUserId="profile-2" />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'mark-read' }));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/messages/read-state',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  it('does not spam read-state persistence for the same viewed message', async () => {
    vi.useFakeTimers();
    render(<MessagesContainer channel={channel} currentUserId="profile-2" />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'mark-read' }));
      fireEvent.click(screen.getByRole('button', { name: 'mark-read' }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('updates parent thread preview when a reply event is received', async () => {
    const onEventHandlers: Array<(event: any) => void> = [];
    const realtimeClient = {
      subscribe: ({ onEvent }: { onEvent: (event: any) => void }) => {
        onEventHandlers.push(onEvent);
        return { unsubscribe: () => void 0 };
      },
      sendTyping: vi.fn(),
    };

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
        realtimeClient={realtimeClient as any}
      />,
    );

    const thread = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'parent-1' },
      stats: { messageCount: 2, lastReplyAt: new Date().toISOString() },
      participants: [],
    };

    act(() => {
      onEventHandlers.forEach((handler) =>
        handler({
          type: 'message-added',
          message: {
            ids: { id: 'reply-1', orgId: 'org-1' },
            social: { reactions: [], thread },
            core: {
              type: 'text',
              createdAt: new Date().toISOString(),
              visibility: { type: 'all' },
              sender: makeParticipant('profile-1', 'guardian'),
            },
            content: { text: 'reply' },
          },
        }),
      );
    });

    expect(updateMessage).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        social: expect.objectContaining({
          thread: expect.objectContaining({
            ids: expect.objectContaining({ id: 'thread-1' }),
          }),
        }),
      }),
    );
  });

  it('updates parent thread read state when a realtime thread read-state event is received', async () => {
    const onEventHandlers: Array<(event: any) => void> = [];
    const realtimeClient = {
      subscribe: ({ onEvent }: { onEvent: (event: any) => void }) => {
        onEventHandlers.push(onEvent);
        return { unsubscribe: () => void 0 };
      },
      sendTyping: vi.fn(),
    };

    const channelWithThread = {
      ...channel,
      collections: {
        ...channel.collections,
        messages: {
          items: [
            {
              ids: { id: 'parent-1', orgId: 'org-1' },
              core: {
                type: 'text',
                createdAt: '2026-03-18T09:00:00.000Z',
                visibility: { type: 'all' },
                sender: makeParticipant('profile-2', 'educator'),
              },
              social: {
                reactions: [],
                thread: {
                  ids: { id: 'thread-1', orgId: 'org-1' },
                  parent: { messageId: 'parent-1' },
                  stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                  participants: [],
                  readState: { threadId: 'thread-1', unreadCount: 1 },
                },
              },
              content: { text: 'parent' },
            },
          ],
          total: 1,
        },
      },
    } as unknown as ChannelVM;

    render(
      <MessagesContainer
        channel={channelWithThread}
        currentUserId="profile-2"
        realtimeClient={realtimeClient as any}
      />,
    );

    act(() => {
      onEventHandlers.forEach((handler) =>
        handler({
          type: 'thread_read_state_updated',
          threadId: 'thread-1',
          unreadCount: 4,
          lastReadMessageId: 'reply-4',
          lastReadAt: '2026-04-22T12:00:00.000Z',
        }),
      );
    });

    expect(updateMessage).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        social: expect.objectContaining({
          thread: expect.objectContaining({
            ids: expect.objectContaining({ id: 'thread-1' }),
            readState: expect.objectContaining({
              unreadCount: 4,
              lastReadMessageId: 'reply-4',
              lastReadAt: '2026-04-22T12:00:00.000Z',
            }),
          }),
        }),
      }),
    );
  });

  it('marks a thread read when opened and persists thread read-state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/messages/thread?')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              messages: [
                {
                  ids: { id: 'parent-1', orgId: 'org-1' },
                  core: {
                    type: 'text',
                    createdAt: '2026-03-18T09:00:00.000Z',
                    visibility: { type: 'all' },
                    sender: makeParticipant('profile-1', 'guardian'),
                  },
                  social: { reactions: [] },
                  content: { text: 'parent' },
                },
                {
                  ids: { id: 'reply-1', orgId: 'org-1' },
                  core: {
                    type: 'text',
                    createdAt: '2026-03-18T09:10:00.000Z',
                    visibility: { type: 'all' },
                    sender: makeParticipant('profile-1', 'guardian'),
                  },
                  social: {
                    reactions: [],
                    thread: {
                      ids: { id: 'thread-1', orgId: 'org-1' },
                      parent: { messageId: 'parent-1' },
                      stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                      participants: [],
                    },
                  },
                  content: { text: 'reply' },
                },
              ],
            }),
          };
        }
        if (url.includes('/api/messages/read-state')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              unreadCount: 0,
              lastReadAt: '2026-03-18T09:10:00.000Z',
              lastReadMessageId: 'reply-1',
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, files: [] }),
        };
      }),
    );

    const channelWithThread = {
      ...channel,
      collections: {
        ...channel.collections,
        messages: {
          items: [
            {
              ids: { id: 'parent-1', orgId: 'org-1' },
              core: {
                type: 'text',
                createdAt: '2026-03-18T09:00:00.000Z',
                visibility: { type: 'all' },
                sender: makeParticipant('profile-2', 'educator'),
              },
              social: {
                reactions: [],
                thread: {
                  ids: { id: 'thread-1', orgId: 'org-1' },
                  parent: { messageId: 'parent-1' },
                  stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                  participants: [],
                  readState: { threadId: 'thread-1', unreadCount: 1 },
                },
              },
              content: { text: 'parent' },
            },
          ],
          total: 1,
        },
      },
    } as unknown as ChannelVM;

    render(<MessagesContainer channel={channelWithThread} currentUserId="profile-2" />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'open-thread' }));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/messages/thread?'),
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/messages/read-state',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"threadId":"thread-1"'),
        }),
      );
    });
  });

  it('skips thread read-state POST when the thread is already up to date', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/messages/thread?')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            messages: [
              {
                ids: { id: 'parent-1', orgId: 'org-1' },
                core: {
                  type: 'text',
                  createdAt: '2026-03-18T09:00:00.000Z',
                  visibility: { type: 'all' },
                  sender: makeParticipant('profile-1', 'guardian'),
                },
                social: { reactions: [] },
                content: { text: 'parent' },
              },
              {
                ids: { id: 'reply-1', orgId: 'org-1' },
                core: {
                  type: 'text',
                  createdAt: '2026-03-18T09:10:00.000Z',
                  visibility: { type: 'all' },
                  sender: makeParticipant('profile-1', 'guardian'),
                },
                social: {
                  reactions: [],
                  thread: {
                    ids: { id: 'thread-1', orgId: 'org-1' },
                    parent: { messageId: 'parent-1' },
                    stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                    participants: [],
                  },
                },
                content: { text: 'reply' },
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true, files: [] }),
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    const channelWithThread = {
      ...channel,
      collections: {
        ...channel.collections,
        messages: {
          items: [
            {
              ids: { id: 'parent-1', orgId: 'org-1' },
              core: {
                type: 'text',
                createdAt: '2026-03-18T09:00:00.000Z',
                visibility: { type: 'all' },
                sender: makeParticipant('profile-2', 'educator'),
              },
              social: {
                reactions: [],
                thread: {
                  ids: { id: 'thread-1', orgId: 'org-1' },
                  parent: { messageId: 'parent-1' },
                  stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                  participants: [],
                  readState: {
                    threadId: 'thread-1',
                    unreadCount: 0,
                    lastReadMessageId: 'reply-1',
                  },
                },
              },
              content: { text: 'parent' },
            },
          ],
          total: 1,
        },
      },
    } as unknown as ChannelVM;

    render(<MessagesContainer channel={channelWithThread} currentUserId="profile-2" />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'open-thread' }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/messages/thread?'),
      );
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/messages/read-state',
      expect.anything(),
    );
  });

  it('marks a thread read when unread replies exist even if thread message count is stale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/messages/thread?')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              messages: [
                {
                  ids: { id: 'parent-1', orgId: 'org-1' },
                  core: {
                    type: 'text',
                    createdAt: '2026-03-18T09:00:00.000Z',
                    visibility: { type: 'all' },
                    sender: makeParticipant('profile-1', 'guardian'),
                  },
                  social: { reactions: [] },
                  content: { text: 'parent' },
                },
                {
                  ids: { id: 'reply-1', orgId: 'org-1' },
                  core: {
                    type: 'text',
                    createdAt: '2026-03-18T09:10:00.000Z',
                    visibility: { type: 'all' },
                    sender: makeParticipant('profile-1', 'guardian'),
                  },
                  social: {
                    reactions: [],
                    thread: {
                      ids: { id: 'thread-1', orgId: 'org-1' },
                      parent: { messageId: 'parent-1' },
                      stats: { messageCount: 2, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                      participants: [],
                    },
                  },
                  content: { text: 'reply' },
                },
              ],
            }),
          };
        }
        if (url.includes('/api/messages/read-state')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              unreadCount: 0,
              lastReadAt: '2026-03-18T09:10:00.000Z',
              lastReadMessageId: 'reply-1',
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, files: [] }),
        };
      }),
    );

    const channelWithStaleThreadCount = {
      ...channel,
      collections: {
        ...channel.collections,
        messages: {
          items: [
            {
              ids: { id: 'parent-1', orgId: 'org-1' },
              core: {
                type: 'text',
                createdAt: '2026-03-18T09:00:00.000Z',
                visibility: { type: 'all' },
                sender: makeParticipant('profile-2', 'educator'),
              },
              social: {
                reactions: [],
                thread: {
                  ids: { id: 'thread-1', orgId: 'org-1' },
                  parent: { messageId: 'parent-1' },
                  stats: { messageCount: 1, lastReplyAt: '2026-03-18T09:10:00.000Z' },
                  participants: [],
                  readState: { threadId: 'thread-1', unreadCount: 1 },
                },
              },
              content: { text: 'parent' },
            },
          ],
          total: 1,
        },
      },
    } as unknown as ChannelVM;

    render(
      <MessagesContainer
        channel={channelWithStaleThreadCount}
        currentUserId="profile-2"
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'open-thread' }));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/messages/thread?'),
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/messages/read-state',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"threadId":"thread-1"'),
        }),
      );
    });
  });

  it('renders read-only notice for supervised conversations', () => {
    render(<MessagesContainer channel={channel} currentUserId="profile-2" readOnly />);
    expect(screen.getByText('Read-only supervised conversation')).toBeInTheDocument();
  });

  it('loads files asynchronously when files tab is opened', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/messages/channel-files')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              files: [
                {
                  ids: { id: 'file-1', orgId: 'org-1', channelId: 'channel-1' },
                  kind: 'file',
                  name: 'Worksheet.pdf',
                  url: 'https://example.com/worksheet.pdf',
                  mimeType: 'application/pdf',
                  size: 2048,
                  createdAt: '2026-02-22T10:00:00.000Z',
                },
              ],
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }),
    );

    render(<MessagesContainer channel={channel} currentUserId="profile-2" />);

    const filesTab = screen.getByRole('tab', { name: /files/i });
    fireEvent.mouseDown(filesTab);
    fireEvent.click(filesTab);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/messages/channel-files?channelId=channel-1'),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Worksheet.pdf')).toBeInTheDocument();
    });
  });

  it('renders a shadcn-style empty message when the files tab has no files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/messages/channel-files')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              files: [],
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }),
    );

    render(<MessagesContainer channel={channel} currentUserId="profile-2" />);

    const filesTab = screen.getByRole('tab', { name: /files/i });
    fireEvent.mouseDown(filesTab);
    fireEvent.click(filesTab);

    await waitFor(() => {
      expect(screen.getByText('No shared files')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Files shared in this channel will appear here.'),
    ).toBeInTheDocument();
  });

  it('prefills the composer from the dm empty-state starter', async () => {
    const dmChannel: ChannelVM = {
      ...channel,
      basics: {
        ...channel.basics,
        kind: 'dm',
        topic: 'Direct message',
      },
      collections: {
        ...channel.collections,
        participants: [
          makeParticipant('profile-1', 'guardian'),
          makeParticipant('profile-2', 'educator'),
        ],
      },
    };

    render(<MessagesContainer channel={dmChannel} currentUserId="profile-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Say hello/i }));

    await waitFor(() => {
      expect(latestMessageInputProps.current?.prefillRequest?.value).toBe(
        'Hi User profile-2, I wanted to reach out here.',
      );
    });
  });

  it('prefills the composer from the classroom guardian starter', async () => {
    const learningSpaceChannel: ChannelVM = {
      ...channel,
      basics: {
        ...channel.basics,
        purpose: 'learning-space',
        topic: 'Algebra 1',
      },
    };

    render(
      <MessagesContainer channel={learningSpaceChannel} currentUserId="profile-1" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Message teacher/i }));

    await waitFor(() => {
      expect(latestMessageInputProps.current?.prefillRequest?.value).toBe(
        'Hi User, I’m reaching out about Algebra 1.',
      );
    });
  });

  it('prefills the composer from the support starter', async () => {
    const supportChannel: ChannelVM = {
      ...channel,
      basics: {
        ...channel.basics,
        purpose: 'support',
        topic: 'Support',
      },
    };

    render(<MessagesContainer channel={supportChannel} currentUserId="profile-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Ask support for help/i }));

    await waitFor(() => {
      expect(latestMessageInputProps.current?.prefillRequest?.value).toBe(
        'Hi support team, I need help with ',
      );
    });
  });

  describe('message drafts flag plumbing', () => {
    it('passes a draftScope and the flag through to MessageInput when enabled', async () => {
      render(
        <MessagesContainer
          channel={channel}
          currentUserId="profile-1"
          currentUserProfile={channel.collections.participants[0]}
          enableMessageDrafts
        />,
      );

      await waitFor(() => {
        expect(latestMessageInputProps.current?.enableMessageDrafts).toBe(true);
      });
      expect(latestMessageInputProps.current?.draftScope).toEqual({
        accountId: 'account-profile-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
      });
    });

    it('never builds a draftScope when the flag is off, even with a resolvable profile', async () => {
      render(
        <MessagesContainer
          channel={channel}
          currentUserId="profile-1"
          currentUserProfile={channel.collections.participants[0]}
        />,
      );

      await waitFor(() => {
        expect(latestMessageInputProps.current).not.toBeNull();
      });
      expect(latestMessageInputProps.current?.enableMessageDrafts).toBe(false);
      expect(latestMessageInputProps.current?.draftScope).toBeNull();
    });
  });

  describe('send-failure retry (enableMessageSendReliability)', () => {
    it('keeps a failed send visible as "sendFailed" and retries with the same clientMessageId', async () => {
      const sendTextMessage = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({
          ids: { id: 'server-message-1', orgId: 'org-1' },
          core: {
            type: 'text',
            sender: channel.collections.participants[0],
            createdAt: new Date().toISOString(),
            visibility: { type: 'all' },
          },
          social: { reactions: [] },
          state: { isSaved: false },
          content: { text: 'hello there' },
        });
      const messageWriteClient = {
        sendTextMessage,
        editTextMessage: vi.fn(),
        toggleReaction: vi.fn(),
        toggleSavedMessage: vi.fn(),
        deleteMessage: vi.fn(),
        toggleHiddenMessage: vi.fn(),
      };

      render(
        <MessagesContainer
          channel={channel}
          currentUserId="profile-1"
          currentUserProfile={channel.collections.participants[0]}
          messageWriteClient={messageWriteClient as any}
          enableMessageSendReliability
        />,
      );

      await waitFor(() => {
        expect(latestMessageInputProps.current?.onSend).toBeTypeOf('function');
      });

      await act(async () => {
        try {
          await latestMessageInputProps.current.onSend(
            'hello there',
            undefined,
            null,
            'client-msg-1',
          );
        } catch {
          // handleSendMessage rethrows on failure by design — swallow here,
          // same as MessageInput's own catch does.
        }
      });

      const optimisticMessageId = addMessage.mock.calls[0]?.[0]?.ids?.id;
      expect(optimisticMessageId).toBeTruthy();
      expect(sendTextMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'hello there',
          clientMessageId: 'client-msg-1',
        }),
      );
      // Not deleted — kept around as a "Not sent" bubble instead.
      expect(deleteMessage).not.toHaveBeenCalledWith(optimisticMessageId);
      expect(latestGetMessageActionState.current?.(optimisticMessageId)?.sendFailed).toBe(
        true,
      );

      act(() => {
        latestMessageListProps.current.onRetrySend?.(optimisticMessageId);
      });

      // Retry reused the exact same clientMessageId — this is what makes it
      // safe against duplicates if the first attempt actually landed server-side.
      await waitFor(() => expect(sendTextMessage).toHaveBeenCalledTimes(2));
      expect(sendTextMessage.mock.calls[1][0]).toEqual(
        expect.objectContaining({ clientMessageId: 'client-msg-1' }),
      );
      await waitFor(() =>
        expect(updateMessage).toHaveBeenCalledWith(
          optimisticMessageId,
          expect.objectContaining({ ids: { id: 'server-message-1', orgId: 'org-1' } }),
        ),
      );
      await waitFor(() =>
        expect(
          Boolean(latestGetMessageActionState.current?.(optimisticMessageId)?.sendFailed),
        ).toBe(false),
      );
    });

    it('deletes the optimistic message on failure when the flag is off (unchanged legacy behavior)', async () => {
      const messageWriteClient = {
        sendTextMessage: vi.fn().mockRejectedValue(new Error('boom')),
        editTextMessage: vi.fn(),
        toggleReaction: vi.fn(),
        toggleSavedMessage: vi.fn(),
        deleteMessage: vi.fn(),
        toggleHiddenMessage: vi.fn(),
      };

      render(
        <MessagesContainer
          channel={channel}
          currentUserId="profile-1"
          currentUserProfile={channel.collections.participants[0]}
          messageWriteClient={messageWriteClient as any}
        />,
      );

      await waitFor(() => {
        expect(latestMessageInputProps.current?.onSend).toBeTypeOf('function');
      });

      await act(async () => {
        try {
          await latestMessageInputProps.current.onSend('will fail', undefined, null);
        } catch {
          // expected — propagated so the composer doesn't reset on failure.
        }
      });

      const optimisticMessageId = addMessage.mock.calls[0]?.[0]?.ids?.id;
      expect(deleteMessage).toHaveBeenCalledWith(optimisticMessageId);
    });
  });
});
