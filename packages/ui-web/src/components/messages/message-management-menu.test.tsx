/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { MessageManagementMenu } from './message-management-menu';
import { MessagesStateProvider } from './context/messages-state-provider';
import type { ChannelVM, MessageVM } from '@iconicedu/shared-types';

function makeChannel(readStateOverrides: Record<string, unknown> = {}): ChannelVM {
  return {
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
      readState: { unreadCount: 0, ...readStateOverrides },
    },
  } as unknown as ChannelVM;
}

const message: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: { displayName: 'Taylor Reed', avatar: { url: null, source: 'seed' } },
      prefs: {},
      meta: {},
      ui: { themeKey: null },
      joinedDate: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'Hello there' },
} as unknown as MessageVM;

function renderMenu(options: {
  channel: ChannelVM;
  enableMessageReplyReference?: boolean;
  enableMessageMarkUnread?: boolean;
}) {
  return render(
    <MessagesStateProvider
      channel={options.channel}
      enableMessageReplyReference={options.enableMessageReplyReference}
      enableMessageMarkUnread={options.enableMessageMarkUnread}
    >
      <MessageManagementMenu message={message} currentUserId="profile-2" />
    </MessagesStateProvider>,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More actions' }));
  await waitFor(() => {
    expect(screen.getByText('Forward')).toBeInTheDocument();
  });
}

describe('MessageManagementMenu reply and mark-unread actions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not show Reply or Mark unread when both flags are off (flag-off inertness)', async () => {
    const user = userEvent.setup();
    renderMenu({ channel: makeChannel() });
    await openMenu(user);

    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark unread')).not.toBeInTheDocument();
  });

  it('shows Reply when enableMessageReplyReference is on', async () => {
    const user = userEvent.setup();
    renderMenu({ channel: makeChannel(), enableMessageReplyReference: true });
    await openMenu(user);

    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('shows Mark unread when the channel has no unread messages and the flag is on', async () => {
    const user = userEvent.setup();
    renderMenu({
      channel: makeChannel({ unreadCount: 0 }),
      enableMessageMarkUnread: true,
    });
    await openMenu(user);

    expect(screen.getByText('Mark unread')).toBeInTheDocument();
  });

  it('hides Mark unread when the channel already shows unread messages', async () => {
    const user = userEvent.setup();
    renderMenu({
      channel: makeChannel({ unreadCount: 3 }),
      enableMessageMarkUnread: true,
    });
    await openMenu(user);

    expect(screen.queryByText('Mark unread')).not.toBeInTheDocument();
  });

  it('hides Mark unread when the channel is already manually marked unread', async () => {
    const user = userEvent.setup();
    renderMenu({
      channel: makeChannel({ unreadCount: 0, isManuallyUnread: true }),
      enableMessageMarkUnread: true,
    });
    await openMenu(user);

    expect(screen.queryByText('Mark unread')).not.toBeInTheDocument();
  });

  it('posts to the mark-unread proxy route with the channel id when clicked', async () => {
    const user = userEvent.setup();
    renderMenu({
      channel: makeChannel({ unreadCount: 0 }),
      enableMessageMarkUnread: true,
    });
    await openMenu(user);

    await user.click(screen.getByText('Mark unread'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/messages/mark-unread',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ channelId: 'channel-1', messageId: 'message-1' }),
        }),
      );
    });
  });
});

function makeMessage(senderId: string): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: '2026-01-01T00:00:00.000Z',
      visibility: { type: 'all' },
      sender: { ids: { id: senderId, orgId: 'org-1', accountId: 'account-1' } },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'hello' },
  } as unknown as MessageVM;
}

describe('MessageManagementMenu edit action', () => {
  it('shows "Edit message" when onEdit is provided for the sender', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MessageManagementMenu
        message={makeMessage('profile-1')}
        currentUserId="profile-1"
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const editItem = await screen.findByText('Edit message');
    await user.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('does not show "Edit message" when onEdit is not provided (ineligible)', async () => {
    const user = userEvent.setup();

    render(
      <MessageManagementMenu
        message={makeMessage('profile-1')}
        currentUserId="profile-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it('never shows "Edit message" for another user\'s message, even if onEdit is passed', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MessageManagementMenu
        message={makeMessage('someone-else')}
        currentUserId="profile-1"
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });
});
