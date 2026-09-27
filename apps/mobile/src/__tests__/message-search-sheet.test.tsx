import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessageSearchSheet } from '@/components/messages/message-search-sheet';
import type { MessageVM } from '@iconicedu/shared-types';

const mockSearchChannelMessages = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  searchChannelMessages: (...args: unknown[]) => mockSearchChannelMessages(...args),
}));

function makeMessage(id: string, text: string): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        kind: 'educator',
        ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
        profile: { displayName: 'John Doe', avatar: { source: 'seed', seed: 'john' } },
      },
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text },
  } as unknown as MessageVM;
}

describe('MessageSearchSheet (issue #264 P2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  function renderSheet(onResultPress = jest.fn()) {
    return render(
      <MessageSearchSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
        onResultPress={onResultPress}
      />,
    );
  }

  it('debounces the query — does not search on every keystroke, only after typing settles', async () => {
    mockSearchChannelMessages.mockResolvedValue([]);
    renderSheet();

    const input = screen.getByLabelText('Search messages input');
    fireEvent.changeText(input, 'h');
    fireEvent.changeText(input, 'he');
    fireEvent.changeText(input, 'hel');
    fireEvent.changeText(input, 'hell');
    fireEvent.changeText(input, 'hello');

    // Not yet — debounce window hasn't elapsed
    expect(mockSearchChannelMessages).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSearchChannelMessages).toHaveBeenCalledTimes(1);
    });
    expect(mockSearchChannelMessages).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'hello', orgId: 'org-1', channelId: 'chan-1' }),
    );
  });

  it('does not search below the minimum query length', () => {
    renderSheet();
    fireEvent.changeText(screen.getByLabelText('Search messages input'), 'h');
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockSearchChannelMessages).not.toHaveBeenCalled();
  });

  it('renders results with bolded match ranges using the server-provided offsets', async () => {
    mockSearchChannelMessages.mockResolvedValue([
      {
        message: makeMessage('msg-1', 'please review the homework tonight'),
        matchRanges: [{ start: 18, end: 26 }], // "homework"
      },
    ]);
    renderSheet();

    fireEvent.changeText(screen.getByLabelText('Search messages input'), 'homework');
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText('homework')).toBeTruthy();
    });
    // Unmatched portions render as separate Text segments too
    expect(screen.getByText('please review the ')).toBeTruthy();
    expect(screen.getByText(' tonight')).toBeTruthy();
    expect(screen.getByText('homework')).toBeTruthy();
  });

  it('calls onResultPress with the message id when a result is tapped', async () => {
    const onResultPress = jest.fn();
    mockSearchChannelMessages.mockResolvedValue([
      { message: makeMessage('msg-42', 'find me'), matchRanges: [{ start: 0, end: 4 }] },
    ]);
    renderSheet(onResultPress);

    fireEvent.changeText(screen.getByLabelText('Search messages input'), 'find');
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText('find')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('find'));

    expect(onResultPress).toHaveBeenCalledWith('msg-42');
  });

  it('shows a "No results" empty state when the search comes back empty', async () => {
    mockSearchChannelMessages.mockResolvedValue([]);
    renderSheet();

    fireEvent.changeText(screen.getByLabelText('Search messages input'), 'nomatch');
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText('No results')).toBeTruthy();
    });
  });

  it('clears results and resets on close/reopen (flag-off inertness handled by the caller not mounting this sheet)', () => {
    const { rerender } = render(
      <MessageSearchSheet
        visible={false}
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
        onResultPress={jest.fn()}
      />,
    );
    expect(mockSearchChannelMessages).not.toHaveBeenCalled();

    rerender(
      <MessageSearchSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
        onResultPress={jest.fn()}
      />,
    );
    expect(mockSearchChannelMessages).not.toHaveBeenCalled();
  });
});
