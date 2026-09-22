import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AiSuggestedReplies } from './ai-suggested-replies';

const mockFetchSuggestedReplies = jest.fn();

jest.mock('@/lib/api/messages/queries', () => ({
  fetchSuggestedReplies: (...args: unknown[]) => mockFetchSuggestedReplies(...args),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: jest.fn(),
}));

describe('AiSuggestedReplies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseProps = {
    orgId: 'org-1',
    channelId: 'channel-1',
    profileId: 'profile-1',
  };

  it('renders the trigger button and does not fetch until tapped', () => {
    render(<AiSuggestedReplies {...baseProps} onSelect={jest.fn()} />);

    expect(screen.getByLabelText('Suggested replies')).toBeTruthy();
    expect(mockFetchSuggestedReplies).not.toHaveBeenCalled();
  });

  it('fetches and shows 2-3 suggestion chips on tap', async () => {
    mockFetchSuggestedReplies.mockResolvedValue({
      suggestions: ['Sounds good!', 'Let me check and get back to you.'],
    });

    render(<AiSuggestedReplies {...baseProps} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Suggested replies'));

    expect(mockFetchSuggestedReplies).toHaveBeenCalledWith({
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-1',
    });

    await waitFor(() => {
      expect(screen.getByText('Sounds good!')).toBeTruthy();
    });
    expect(screen.getByText('Let me check and get back to you.')).toBeTruthy();
  });

  it('inserts the tapped chip text via onSelect and collapses the panel', async () => {
    mockFetchSuggestedReplies.mockResolvedValue({
      suggestions: ['Sounds good!', 'On my way.'],
    });
    const onSelect = jest.fn();

    render(<AiSuggestedReplies {...baseProps} onSelect={onSelect} />);
    fireEvent.press(screen.getByLabelText('Suggested replies'));

    const chip = await screen.findByText('Sounds good!');
    fireEvent.press(chip);

    expect(onSelect).toHaveBeenCalledWith('Sounds good!');
    // Panel collapses after a selection — the chip is no longer rendered.
    await waitFor(() => {
      expect(screen.queryByText('Sounds good!')).toBeNull();
    });
  });

  it('shows a subtle empty state when there are no suggestions', async () => {
    mockFetchSuggestedReplies.mockResolvedValue({ suggestions: [] });

    render(<AiSuggestedReplies {...baseProps} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Suggested replies'));

    await waitFor(() => {
      expect(screen.getByText('No suggestions right now.')).toBeTruthy();
    });
  });

  it('shows the thrown error message and allows retrying', async () => {
    mockFetchSuggestedReplies.mockRejectedValueOnce(
      new Error('Daily suggestion limit reached. Try again tomorrow.'),
    );
    mockFetchSuggestedReplies.mockResolvedValueOnce({ suggestions: ['Got it, thanks!'] });

    render(<AiSuggestedReplies {...baseProps} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Suggested replies'));

    await waitFor(() => {
      expect(
        screen.getByText('Daily suggestion limit reached. Try again tomorrow.'),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Try again'));

    await waitFor(() => {
      expect(screen.getByText('Got it, thanks!')).toBeTruthy();
    });
    expect(mockFetchSuggestedReplies).toHaveBeenCalledTimes(2);
  });
});
