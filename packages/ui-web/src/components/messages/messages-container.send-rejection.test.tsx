/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessagesContainer } from './messages-container';
import { MessageSendRejectedError } from './message-send-rejected-error';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

const addMessage = vi.fn();
const updateMessage = vi.fn();
const deleteMessage = vi.fn();
const clearReplyTo = vi.fn();
const latestMessageInputProps: { current: any | null } = { current: null };
const { toastError, reportObservedError } = vi.hoisted(() => ({
  toastError: vi.fn(),
  reportObservedError: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('@iconicedu/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reportObservedError: (...args: unknown[]) => reportObservedError(...args),
}));

const replyTarget = {
  messageId: 'message-1',
  senderId: 'profile-1',
  senderName: 'User profile-1',
  snippet: 'Original message text',
  type: 'text' as const,
};

vi.mock('../../hooks/use-messages', () => ({
  useMessages: (initialMessages: any[]) => ({
    messages: initialMessages,
    addMessage,
    prependMessages: vi.fn(),
    updateMessage,
    deleteMessage,
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
    setEditTextMessage: vi.fn(),
    setJoinLiveSession: vi.fn(),
    setGetMessageActionState: vi.fn(),
    setThreadHandlers: vi.fn(),
    setScrollToMessage: vi.fn(),
    messageFilter: null,
    toggleMessageFilter: vi.fn(),
    replyTarget,
    clearReplyTo,
  }),
}));

vi.mock('./message-list', () => ({
  MessageList: () => <div />,
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
} as unknown as ChannelVM;

describe('MessagesContainer refused sends', () => {
  beforeEach(() => {
    latestMessageInputProps.current = null;
    vi.clearAllMocks();
  });

  function renderWith(sendTextMessage: ReturnType<typeof vi.fn>) {
    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
        enableMessageSendReliability
        messageWriteClient={
          {
            sendTextMessage,
            toggleReaction: vi.fn(),
            toggleSavedMessage: vi.fn(),
            deleteMessage: vi.fn(),
            toggleHiddenMessage: vi.fn(),
          } as any
        }
      />,
    );
  }

  it('shows the refusal reason, drops the bubble, and keeps the composer', async () => {
    const reason =
      'Students can only be messaged privately together with a parent in this channel';
    const sendTextMessage = vi
      .fn()
      .mockRejectedValue(new MessageSendRejectedError(reason));
    renderWith(sendTextMessage);

    await expect(
      latestMessageInputProps.current.onSend('Hi', [], null, 'client-1', ['student-1']),
    ).rejects.toBeInstanceOf(MessageSendRejectedError);

    expect(toastError).toHaveBeenCalledWith(reason);
    expect(addMessage).toHaveBeenCalledTimes(1);
    const optimisticId = addMessage.mock.calls[0][0].ids.id;
    expect(deleteMessage).toHaveBeenCalledWith(optimisticId);
    expect(reportObservedError).not.toHaveBeenCalled();
  });

  it('keeps ordinary failures retryable without a refusal toast', async () => {
    const sendTextMessage = vi.fn().mockRejectedValue(new Error('Offline'));
    renderWith(sendTextMessage);

    await expect(
      latestMessageInputProps.current.onSend('Hi', [], null, 'client-1'),
    ).rejects.toThrow('Offline');

    expect(toastError).not.toHaveBeenCalled();
    expect(reportObservedError).toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });
});
