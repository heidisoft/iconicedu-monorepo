/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MessagesContainer } from './messages-container';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

const addMessage = vi.fn();
const updateMessage = vi.fn();
const deleteMessage = vi.fn();
const clearReplyTo = vi.fn();
const latestMessageInputProps: { current: any | null } = { current: null };

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

describe('MessagesContainer reply-to-message send flow', () => {
  beforeEach(() => {
    latestMessageInputProps.current = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('includes replyToMessageId and clears the reply target after a successful send when the flag is on', async () => {
    const sendTextMessage = vi.fn().mockResolvedValue({
      ids: { id: 'created-1', orgId: 'org-1' },
      core: {
        type: 'text',
        sender: makeParticipant('profile-2', 'educator'),
        createdAt: new Date().toISOString(),
        visibility: { type: 'all' },
      },
      social: { reactions: [] },
      state: { isSaved: false },
      content: { text: 'Sure thing' },
    });

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
        enableMessageReplyReference
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

    expect(latestMessageInputProps.current.replyTarget).toMatchObject({
      senderName: replyTarget.senderName,
      snippet: replyTarget.snippet,
    });

    await latestMessageInputProps.current.onSend('Sure thing', []);

    await waitFor(() => {
      expect(sendTextMessage).toHaveBeenCalledWith(
        expect.objectContaining({ replyToMessageId: 'message-1' }),
      );
    });

    await waitFor(() => {
      expect(clearReplyTo).toHaveBeenCalled();
    });
  });

  it('does not attach a replyToMessageId when the flag is off, even with a pending reply target', async () => {
    const sendTextMessage = vi.fn().mockResolvedValue({
      ids: { id: 'created-2', orgId: 'org-1' },
      core: {
        type: 'text',
        sender: makeParticipant('profile-2', 'educator'),
        createdAt: new Date().toISOString(),
        visibility: { type: 'all' },
      },
      social: { reactions: [] },
      state: { isSaved: false },
      content: { text: 'Hello' },
    });

    render(
      <MessagesContainer
        channel={channel}
        currentUserId="profile-2"
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

    expect(latestMessageInputProps.current.replyTarget).toBeNull();

    await latestMessageInputProps.current.onSend('Hello', []);

    await waitFor(() => {
      expect(sendTextMessage).toHaveBeenCalledWith(
        expect.objectContaining({ replyToMessageId: undefined }),
      );
    });

    expect(clearReplyTo).not.toHaveBeenCalled();
  });
});
