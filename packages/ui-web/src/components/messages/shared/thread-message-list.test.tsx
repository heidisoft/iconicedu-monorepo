import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { ThreadMessageList } from './thread-message-list';

vi.mock('../message-item', () => ({
  MessageItem: ({ message }: { message: MessageVM }) => (
    <div data-testid={`message-${message.ids.id}`}>{message.ids.id}</div>
  ),
}));

function createMessage(id: string): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: `2026-01-01T10:0${id === 'm1' ? 0 : id === 'm2' ? 1 : 2}:00.000Z`,
      visibility: { type: 'all' },
      sender: { ids: { id: 'profile-1', orgId: 'org-1' } },
    },
    social: { reactions: [] },
    content: { text: id },
  } as MessageVM;
}

describe('ThreadMessageList', () => {
  const messages = [createMessage('m1'), createMessage('m2'), createMessage('m3')];

  it('shows new messages separator with count from unreadCount', () => {
    render(
      <ThreadMessageList
        messages={messages}
        onProfileClick={vi.fn()}
        currentUserId="profile-2"
        unreadCount={2}
      />,
    );

    expect(screen.getByText('NEW MESSAGES (2)')).toBeInTheDocument();
  });

  it('places separator after last read message when read anchor is available', () => {
    render(
      <ThreadMessageList
        messages={messages}
        onProfileClick={vi.fn()}
        currentUserId="profile-2"
        lastReadMessageId="m1"
        unreadCount={2}
      />,
    );

    expect(screen.getByText('NEW MESSAGES (2)')).toBeInTheDocument();
  });
});
