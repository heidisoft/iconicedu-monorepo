/* @vitest-environment jsdom */
import React, { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageBase } from './message-base';
import {
  MessagesStateProvider,
  useMessagesState,
} from './context/messages-state-provider';
import type { ChannelVM, MessageVM, ThreadVM } from '@iconicedu/shared-types';

const channel: ChannelVM = {
  ids: { id: 'channel-1', orgId: 'org-1' },
  basics: {
    kind: 'channel',
    topic: 'General',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: 'profile-1',
    createdAt: new Date().toISOString(),
  },
  postingPolicy: { kind: 'members-only' },
  collections: {
    participants: [],
    messages: { items: [] },
    media: { items: [] },
    files: { items: [] },
  },
} as unknown as ChannelVM;

function makeSender(id: string, displayName: string) {
  return {
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    kind: 'guardian',
    profile: { displayName, avatar: { url: null, source: 'seed' } },
    prefs: {},
    meta: {},
    ui: { themeKey: null },
    joinedDate: new Date().toISOString(),
  };
}

const originalMessage: MessageVM = {
  ids: { id: 'original-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: makeSender('profile-1', 'Taylor Reed'),
    createdAt: '2026-02-16T10:00:00.000Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'What time works for everyone?' },
} as unknown as MessageVM;

function makeReplyMessage(): MessageVM {
  return {
    ids: { id: 'reply-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender('profile-2', 'Jamie Lee'),
      createdAt: '2026-02-16T10:05:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
      replyTo: {
        messageId: 'original-1',
        senderId: 'profile-1',
        senderName: 'Taylor Reed',
        snippet: 'What time works for everyone?',
        type: 'text',
      },
    },
    content: { text: '3pm works for me' },
  } as unknown as MessageVM;
}

function Harness({
  loadedMessages,
  onScrollToMessage,
  children,
}: {
  loadedMessages: MessageVM[];
  onScrollToMessage: (messageId: string) => void;
  children: React.ReactNode;
}) {
  const { setMessages, setScrollToMessage } = useMessagesState();
  useEffect(() => {
    setMessages(loadedMessages);
    setScrollToMessage(() => onScrollToMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderReplyMessage(options: {
  enableMessageReplyReference?: boolean;
  loadedMessages: MessageVM[];
  onScrollToMessage: (messageId: string) => void;
}) {
  return render(
    <MessagesStateProvider
      channel={channel}
      enableMessageReplyReference={options.enableMessageReplyReference}
    >
      <Harness
        loadedMessages={options.loadedMessages}
        onScrollToMessage={options.onScrollToMessage}
      >
        <MessageBase
          message={makeReplyMessage()}
          onOpenThread={
            vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void
          }
          onProfileClick={vi.fn()}
        >
          <div>3pm works for me</div>
        </MessageBase>
      </Harness>
    </MessagesStateProvider>,
  );
}

describe('MessageBase reply-to-message quote rendering', () => {
  it('does not render a reply quote when the flag is off (flag-off inertness)', () => {
    renderReplyMessage({
      enableMessageReplyReference: false,
      loadedMessages: [originalMessage],
      onScrollToMessage: vi.fn(),
    });

    expect(screen.queryByText('Taylor Reed')).not.toBeInTheDocument();
  });

  it('renders a clickable reply quote and jumps to the original when it is loaded', () => {
    const onScrollToMessage = vi.fn();
    renderReplyMessage({
      enableMessageReplyReference: true,
      loadedMessages: [originalMessage],
      onScrollToMessage,
    });

    const quoteButton = screen.getByRole('button', {
      name: /jump to original message from taylor reed/i,
    });
    fireEvent.click(quoteButton);

    expect(onScrollToMessage).toHaveBeenCalledWith('original-1');
  });

  it('degrades to a non-interactive quote when the original message is not loaded', () => {
    const onScrollToMessage = vi.fn();
    renderReplyMessage({
      enableMessageReplyReference: true,
      loadedMessages: [],
      onScrollToMessage,
    });

    expect(
      screen.queryByRole('button', { name: /jump to original message/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Taylor Reed')).toBeInTheDocument();
  });
});
