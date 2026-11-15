import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomChatPanel } from './zoom-chat-panel';

describe('ZoomChatPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the in-call transcript and composer using relative timestamps', () => {
    const now = Date.UTC(2026, 9, 4, 12, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    render(
      <TooltipProvider>
        <ZoomChatPanel
          open
          unreadCount={1}
          messages={[
            {
              id: 'message-1',
              senderUserId: 2,
              senderName: 'Sam Lee',
              message: 'Can everyone see the shared screen?',
              timestamp: now - 8 * 60_000,
            },
          ]}
          draft=""
          selfUserId={1}
          scrollRef={{ current: null }}
          onOpenChange={vi.fn()}
          onDraftChange={vi.fn()}
          onSend={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('heading', { name: 'In-call Messages' })).toBeVisible();
    expect(screen.getByText('Sam Lee')).toBeVisible();
    expect(screen.getByText('8 min ago')).toBeVisible();
    expect(screen.getByText('Can everyone see the shared screen?')).toBeVisible();
    expect(screen.getByPlaceholderText('Send a message')).toBeVisible();
  });
});
