/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

import { PinnedPanel } from './pinned-panel';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const close = vi.fn();
const scrollToMessage = vi.fn();
const messages: any[] = [{ ids: { id: 'message-1', orgId: 'org-1' } }];

vi.mock('@iconicedu/ui-web/components/messages/context/messages-state-provider', () => ({
  useMessagesState: () => ({
    channel: { ids: { id: 'channel-1', orgId: 'org-1' } },
    scrollToMessage,
    close,
    messages,
  }),
}));

const makeSender = (id: string) => ({
  ids: { id, orgId: 'org-1', accountId: `account-${id}` },
  kind: 'guardian',
  profile: { displayName: `User ${id}`, avatar: { url: null, source: 'seed' } },
  prefs: {},
  meta: {},
  ui: { themeKey: null },
  joinedDate: new Date().toISOString(),
});

const pinnedMessage = {
  message: {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender('profile-2'),
      createdAt: new Date().toISOString(),
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    content: { text: 'Important announcement' },
  },
  pinnedBy: makeSender('profile-1'),
  pinnedAt: new Date().toISOString(),
};

describe('PinnedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an empty state when there are no pins', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })),
    );
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('No pinned messages')).toBeInTheDocument();
    });
  });

  it('renders a pin with who pinned it and when', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: [pinnedMessage] }),
      })),
    );
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('Important announcement')).toBeInTheDocument();
    });
    expect(screen.getByText(/Pinned by User profile-1/)).toBeInTheDocument();
  });

  it('unpins a message and removes it from the list', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [pinnedMessage] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('Important announcement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unpin message' }));

    await waitFor(() => {
      expect(screen.getByText('No pinned messages')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/messages/pins',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          messageId: 'message-1',
          isPinned: false,
        }),
      }),
    );
  });

  it('rolls back and surfaces an error toast when unpin fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({ success: false, message: 'Unable to unpin message' }),
        };
      }
      return { ok: true, json: async () => ({ success: true, data: [pinnedMessage] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('Important announcement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unpin message' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Unable to unpin message');
    });
    // Rolled back: the message is still shown.
    expect(screen.getByText('Important announcement')).toBeInTheDocument();
  });

  it('navigates to a loaded message and closes the panel on click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: [pinnedMessage] }),
      })),
    );
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('Important announcement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Important announcement'));

    expect(close).toHaveBeenCalled();
    expect(scrollToMessage).toHaveBeenCalledWith('message-1');
  });

  it('surfaces a load error gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ success: false, message: 'Unable to load pinned messages' }),
      })),
    );
    render(<PinnedPanel intent={{ key: 'pinned' }} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load pinned messages')).toBeInTheDocument();
    });
  });
});
