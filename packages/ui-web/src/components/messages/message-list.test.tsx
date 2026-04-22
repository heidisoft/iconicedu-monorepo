/* @vitest-environment jsdom */
import React from 'react';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessageList } from '@iconicedu/ui-web/components/messages/message-list';
import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';

vi.mock('@iconicedu/ui-web/components/messages/message-item', () => ({
  MessageItem: ({
    message,
    onOpenThread,
    isThreadReply,
  }: {
    message: MessageVM;
    onOpenThread?: (thread: ThreadVM, message: MessageVM) => void;
    isThreadReply?: boolean;
  }) =>
    !isThreadReply && message.social.thread ? (
      <button
        type="button"
        data-testid={`open-thread-${message.ids.id}`}
        onClick={() => onOpenThread?.(message.social.thread as ThreadVM, message)}
      >
        Open thread
      </button>
    ) : (
      <div data-testid={`message-item-${message.ids.id}`} />
    ),
}));

vi.mock('@iconicedu/ui-web/components/messages/empty-state', () => ({
  EmptyMessagesState: () => null,
}));

const baseMessage: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: {
        displayName: 'User 1',
        avatar: { url: null, source: 'seed' },
      },
      prefs: {},
      meta: {},
      ui: { themeKey: null },
      joinedDate: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'Hello' },
};

function createMessage(input: {
  id: string;
  senderId?: string;
  createdAt?: string;
  thread?: ThreadVM;
  text?: string;
}): MessageVM {
  return {
    ...baseMessage,
    ids: { ...baseMessage.ids, id: input.id },
    core: {
      ...baseMessage.core,
      createdAt: input.createdAt ?? baseMessage.core.createdAt,
      sender: {
        ...baseMessage.core.sender,
        ids: { ...baseMessage.core.sender.ids, id: input.senderId ?? 'profile-1' },
      },
    },
    social: {
      ...baseMessage.social,
      thread: input.thread,
    },
    content: { text: input.text ?? 'Hello' },
  } as MessageVM;
}

describe('MessageList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  it('scrolls to bottom when new messages are added', () => {
    const newerMessage = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-2' },
      core: { ...baseMessage.core, createdAt: '2026-02-16T10:00:00.000Z' },
    } as MessageVM;

    const { rerender } = render(
      <MessageList
        messages={[baseMessage]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
      />,
    );

    act(() => {
      rerender(
        <MessageList
          messages={[baseMessage, newerMessage]}
          onOpenThread={
            vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
          }
          onProfileClick={vi.fn()}
        />,
      );
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrolls expanded inline thread into view when it would be hidden by the composer area', async () => {
    const thread = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'message-1' },
      stats: { messageCount: 3, lastReplyAt: '2026-02-16T10:00:00.000Z' },
      participants: [],
      readState: { unreadCount: 1 },
    } as unknown as ThreadVM;

    const { container } = render(
      <MessageList
        messages={[createMessage({ id: 'message-1', thread })]}
        onOpenThread={vi.fn(async () => undefined)}
        onProfileClick={vi.fn()}
      />,
    );

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLDivElement;
    const scrollToSpy = vi.fn();
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      value: 240,
      writable: true,
    });
    Object.defineProperty(viewport, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
      writable: true,
    });
    viewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    }));

    const trigger = screen.getByTestId('open-thread-message-1');
    const messageWrapper = trigger.closest(
      '.transition-all.duration-300',
    ) as HTMLDivElement;
    messageWrapper.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 420,
      top: 420,
      left: 0,
      right: 800,
      bottom: 560,
      width: 800,
      height: 140,
      toJSON: () => ({}),
    }));

    fireEvent.click(trigger);

    await act(async () => {
      await Promise.resolve();
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 336,
      behavior: 'smooth',
    });
  });

  it('renders unread divider at the first message after last read across date sections', () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const newer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-newer' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;

    const { getByText } = render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(getByText('New messages')).toBeInTheDocument();
  });

  it('does not render new messages divider when only sender messages exist after last read', () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const myNewer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-mine' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-1' },
        },
      },
    } as MessageVM;

    const { queryByText } = render(
      <MessageList
        messages={[older, myNewer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(queryByText('New messages')).not.toBeInTheDocument();
  });

  it('keeps new messages divider visible across in-page rerenders', () => {
    vi.useFakeTimers();
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const newer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-newer' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;

    const { queryByText, rerender } = render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(queryByText('New messages')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(queryByText('New messages')).toBeInTheDocument();

    rerender(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryByText('New messages')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(queryByText('New messages')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('resets divider after navigation remount when read state updates', () => {
    vi.useFakeTimers();
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const newer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-newer' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;
    const { queryByText, unmount } = render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );
    expect(queryByText('New messages')).toBeInTheDocument();
    unmount();

    const { queryByText: queryAfterRemount } = render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-newer"
        currentUserId="profile-1"
      />,
    );
    expect(queryAfterRemount('New messages')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('calls unread viewed callback when newest incoming message is visible', async () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const newer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-newer' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;
    const onUnreadViewed = vi.fn();

    render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
        onUnreadViewed={onUnreadViewed}
      />,
    );

    expect(onUnreadViewed).toHaveBeenCalledWith('message-newer');
  });

  it('calls unread viewed callback without an unread divider when channel opens on unread messages', () => {
    const incoming = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-incoming' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;
    const onUnreadViewed = vi.fn();

    render(
      <MessageList
        messages={[incoming]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
        onUnreadViewed={onUnreadViewed}
      />,
    );

    expect(onUnreadViewed).toHaveBeenCalledWith('message-incoming');
    expect(screen.queryByText('New messages')).not.toBeInTheDocument();
  });

  it('does not call unread viewed callback when only current user messages are visible', () => {
    const mine = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-mine' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-1' },
        },
      },
    } as MessageVM;
    const onUnreadViewed = vi.fn();

    render(
      <MessageList
        messages={[mine]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
        onUnreadViewed={onUnreadViewed}
      />,
    );

    expect(onUnreadViewed).not.toHaveBeenCalled();
  });

  it('animates unread divider dismissal before removing it', async () => {
    vi.useFakeTimers();
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const newer = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'message-newer' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;
    const onUnreadViewed = vi.fn();

    render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
        onUnreadViewed={onUnreadViewed}
      />,
    );

    expect(onUnreadViewed).toHaveBeenCalledWith('message-newer');

    const divider = screen.getByTestId('unread-divider');
    expect(divider).toHaveAttribute('data-dismissing', 'true');

    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(screen.getByTestId('unread-divider')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('unread-divider')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows inline unread divider at first unread reply when lastReadMessageId is present', async () => {
    const thread: ThreadVM = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'message-parent' },
      stats: { messageCount: 3, lastReplyAt: '2026-02-16T10:03:00.000Z' },
      participants: [],
      readState: { threadId: 'thread-1', lastReadMessageId: 'reply-1', unreadCount: 2 },
    };
    const parent = createMessage({
      id: 'message-parent',
      senderId: 'profile-parent',
      createdAt: '2026-02-16T10:00:00.000Z',
      thread,
    });
    const reply1 = createMessage({
      id: 'reply-1',
      senderId: 'profile-2',
      createdAt: '2026-02-16T10:01:00.000Z',
      thread,
      text: 'Reply one',
    });
    const reply2 = createMessage({
      id: 'reply-2',
      senderId: 'profile-3',
      createdAt: '2026-02-16T10:02:00.000Z',
      thread,
      text: 'Reply two',
    });

    render(
      <MessageList
        messages={[parent, reply1, reply2]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('open-thread-message-parent'));
    });

    expect(screen.getByText('New messages (2)')).toBeInTheDocument();
  });

  it('shows inline unread divider using unreadCount fallback when lastReadMessageId is missing', async () => {
    const thread: ThreadVM = {
      ids: { id: 'thread-2', orgId: 'org-1' },
      parent: { messageId: 'message-parent' },
      stats: { messageCount: 4, lastReplyAt: '2026-02-16T10:04:00.000Z' },
      participants: [],
      readState: { threadId: 'thread-2', unreadCount: 1 },
    };
    const parent = createMessage({
      id: 'message-parent',
      senderId: 'profile-parent',
      createdAt: '2026-02-16T10:00:00.000Z',
      thread,
    });
    const reply1 = createMessage({
      id: 'reply-1',
      senderId: 'profile-2',
      createdAt: '2026-02-16T10:01:00.000Z',
      thread,
      text: 'Reply one',
    });
    const reply2 = createMessage({
      id: 'reply-2',
      senderId: 'profile-3',
      createdAt: '2026-02-16T10:02:00.000Z',
      thread,
      text: 'Reply two',
    });

    render(
      <MessageList
        messages={[parent, reply1, reply2]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('open-thread-message-parent'));
    });

    expect(screen.getByText('New messages (1)')).toBeInTheDocument();
  });

  it('does not show inline unread divider when unreadCount is zero', async () => {
    const thread: ThreadVM = {
      ids: { id: 'thread-3', orgId: 'org-1' },
      parent: { messageId: 'message-parent' },
      stats: { messageCount: 3, lastReplyAt: '2026-02-16T10:03:00.000Z' },
      participants: [],
      readState: { threadId: 'thread-3', unreadCount: 0 },
    };
    const parent = createMessage({
      id: 'message-parent',
      senderId: 'profile-parent',
      createdAt: '2026-02-16T10:00:00.000Z',
      thread,
    });
    const reply1 = createMessage({
      id: 'reply-1',
      senderId: 'profile-2',
      createdAt: '2026-02-16T10:01:00.000Z',
      thread,
      text: 'Reply one',
    });

    render(
      <MessageList
        messages={[parent, reply1]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('open-thread-message-parent'));
    });

    expect(screen.queryByText(/New messages/)).not.toBeInTheDocument();
  });

  it('does not show inline unread divider when replies after anchor are authored by current user', async () => {
    const thread: ThreadVM = {
      ids: { id: 'thread-4', orgId: 'org-1' },
      parent: { messageId: 'message-parent' },
      stats: { messageCount: 3, lastReplyAt: '2026-02-16T10:03:00.000Z' },
      participants: [],
      readState: { threadId: 'thread-4', lastReadMessageId: 'reply-1', unreadCount: 1 },
    };
    const parent = createMessage({
      id: 'message-parent',
      senderId: 'profile-parent',
      createdAt: '2026-02-16T10:00:00.000Z',
      thread,
    });
    const reply1 = createMessage({
      id: 'reply-1',
      senderId: 'profile-2',
      createdAt: '2026-02-16T10:01:00.000Z',
      thread,
      text: 'Reply one',
    });
    const myReply = createMessage({
      id: 'reply-2',
      senderId: 'profile-1',
      createdAt: '2026-02-16T10:02:00.000Z',
      thread,
      text: 'My reply',
    });

    render(
      <MessageList
        messages={[parent, reply1, myReply]}
        onOpenThread={
          vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
        }
        onProfileClick={vi.fn()}
        currentUserId="profile-1"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('open-thread-message-parent'));
    });

    expect(screen.queryByText(/New messages/)).not.toBeInTheDocument();
  });
});
