/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { MessageSearchPanel } from './message-search-panel';

const close = vi.fn();
const scrollToMessage = vi.fn();
const loadedMessages: any[] = [{ ids: { id: 'message-1', orgId: 'org-1' } }];

vi.mock('@iconicedu/ui-web/components/messages/context/messages-state-provider', () => ({
  useMessagesState: () => ({
    channel: {
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: {
        participants: [
          {
            ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
            kind: 'guardian',
            profile: {
              displayName: 'Alex Guardian',
              avatar: { url: null, source: 'seed' },
            },
          },
        ],
      },
    },
    scrollToMessage,
    close,
    messages: loadedMessages,
  }),
}));

const makeSender = (id: string, name: string) => ({
  ids: { id, orgId: 'org-1', accountId: `account-${id}` },
  kind: 'guardian',
  profile: { displayName: name, avatar: { url: null, source: 'seed' } },
  prefs: {},
  meta: {},
  ui: { themeKey: null },
  joinedDate: new Date().toISOString(),
});

const searchResult = {
  message: {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender('profile-1', 'Alex Guardian'),
      createdAt: new Date().toISOString(),
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    content: { text: 'please review the homework packet' },
  },
  matchRanges: [{ start: 7, end: 13 }], // "review"
};

describe('MessageSearchPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not call the search API until the user types', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Type to search/)).toBeInTheDocument();
  });

  it('debounces the query before calling the search API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);

    const input = screen.getByPlaceholderText('Search messages');
    fireEvent.change(input, { target: { value: 'r' } });
    fireEvent.change(input, { target: { value: 're' } });
    fireEvent.change(input, { target: { value: 'rev' } });

    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(350);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/messages/search?channelId=channel-1&query=rev'),
    );
  });

  it('renders results with the matched text bolded via matchRanges', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [searchResult] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);

    fireEvent.change(screen.getByPlaceholderText('Search messages'), {
      target: { value: 'review' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const highlighted = screen.getByText('review');
    expect(highlighted).toBeInTheDocument();
    expect(highlighted.tagName).toBe('STRONG');
  });

  it('shows an empty-results message gracefully', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);

    fireEvent.change(screen.getByPlaceholderText('Search messages'), {
      target: { value: 'nothingmatches' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByText('No messages found.')).toBeInTheDocument();
  });

  it('shows an error message gracefully on failure', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, message: 'Unable to search messages' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);

    fireEvent.change(screen.getByPlaceholderText('Search messages'), {
      target: { value: 'review' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByText('Unable to search messages')).toBeInTheDocument();
  });

  it('navigates to a loaded result message and closes the panel', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [searchResult] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MessageSearchPanel intent={{ key: 'search' }} />);

    fireEvent.change(screen.getByPlaceholderText('Search messages'), {
      target: { value: 'review' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByText('review')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alex Guardian'));

    expect(close).toHaveBeenCalled();
    expect(scrollToMessage).toHaveBeenCalledWith('message-1');
  });
});
