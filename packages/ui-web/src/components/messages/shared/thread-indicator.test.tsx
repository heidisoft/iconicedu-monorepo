import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadVM } from '@iconicedu/shared-types';
import { ThreadIndicator } from './thread-indicator';

function createThread(): ThreadVM {
  return {
    ids: { id: 'thread-1', orgId: 'org-1' },
    parent: { messageId: 'message-1' },
    stats: {
      messageCount: 2,
      lastReplyAt: '2026-01-01T10:00:00.000Z',
    },
    participants: [],
  };
}

describe('ThreadIndicator', () => {
  it('shows NEW indicator when unread replies exist', () => {
    render(
      <ThreadIndicator
        thread={createThread()}
        unreadCount={2}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show NEW indicator when there are no unread replies', () => {
    render(
      <ThreadIndicator
        thread={createThread()}
        unreadCount={0}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });
});

