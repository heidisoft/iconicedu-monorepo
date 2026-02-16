import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessageList } from './message-list';
import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';

vi.mock('./message-item', () => ({
  MessageItem: () => null,
}));

vi.mock('./empty-state', () => ({
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

describe('MessageList', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
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
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
      />,
    );

    act(() => {
      rerender(
        <MessageList
          messages={[baseMessage, newerMessage]}
          onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
          onProfileClick={vi.fn()}
        />,
      );
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(getByText('NEW MESSAGES')).toBeInTheDocument();
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
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(queryByText('NEW MESSAGES')).not.toBeInTheDocument();
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
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    expect(queryByText('NEW MESSAGES')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(queryByText('NEW MESSAGES')).toBeInTheDocument();

    rerender(
      <MessageList
        messages={[older, newer]}
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryByText('NEW MESSAGES')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(queryByText('NEW MESSAGES')).toBeInTheDocument();
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
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-older"
        currentUserId="profile-1"
      />,
    );
    expect(queryByText('NEW MESSAGES')).toBeInTheDocument();
    unmount();

    const { queryByText: queryAfterRemount } = render(
      <MessageList
        messages={[older, newer]}
        onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
        onProfileClick={vi.fn()}
        lastReadMessageId="message-newer"
        currentUserId="profile-1"
      />,
    );
    expect(queryAfterRemount('NEW MESSAGES')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
