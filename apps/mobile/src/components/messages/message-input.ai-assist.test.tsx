import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessageInput } from '@/components/messages/message-input';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';

const mockUseMobileFeatureFlag = jest.fn();
const mockRefineDraftWithAi = jest.fn();
const mockFetchSuggestedReplies = jest.fn();

jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: (key: string) => mockUseMobileFeatureFlag(key),
}));

jest.mock('@/lib/api/messages/queries', () => ({
  refineDraftWithAi: (...args: unknown[]) => mockRefineDraftWithAi(...args),
  fetchSuggestedReplies: (...args: unknown[]) => mockFetchSuggestedReplies(...args),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: jest.fn(),
}));

const aiContext = { orgId: 'org-1', channelId: 'channel-1', profileId: 'profile-1' };

describe('MessageInput AI-assist gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders neither AI affordance when both flags are off', () => {
    mockUseMobileFeatureFlag.mockReturnValue(false);
    render(<MessageInput onSend={jest.fn()} {...aiContext} />);

    fireEvent.changeText(
      screen.getByLabelText('Message input'),
      'This draft is definitely long enough to pass the threshold',
    );

    expect(screen.queryByLabelText('Refine with AI')).toBeNull();
    expect(screen.queryByLabelText('Suggested replies')).toBeNull();
  });

  it('renders neither AI affordance when flags are on but org/channel/profile context is missing', () => {
    mockUseMobileFeatureFlag.mockReturnValue(true);
    render(<MessageInput onSend={jest.fn()} />);

    fireEvent.changeText(
      screen.getByLabelText('Message input'),
      'This draft is definitely long enough to pass the threshold',
    );

    expect(screen.queryByLabelText('Refine with AI')).toBeNull();
    expect(screen.queryByLabelText('Suggested replies')).toBeNull();
  });

  it('shows "Suggested replies" but not "Refine with AI" below the character threshold', () => {
    mockUseMobileFeatureFlag.mockImplementation(
      (key: string) => key === mobileFeatureFlagKeys.enableAiSuggestedReplies,
    );
    render(<MessageInput onSend={jest.fn()} {...aiContext} />);

    expect(screen.getByLabelText('Suggested replies')).toBeTruthy();
    expect(screen.queryByLabelText('Refine with AI')).toBeNull();
  });

  it('shows "Refine with AI" only once the draft passes the non-whitespace threshold', () => {
    mockUseMobileFeatureFlag.mockImplementation(
      (key: string) => key === mobileFeatureFlagKeys.enableAiRefine,
    );
    render(<MessageInput onSend={jest.fn()} {...aiContext} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'short');
    expect(screen.queryByLabelText('Refine with AI')).toBeNull();

    fireEvent.changeText(input, 'this draft is now long enough');
    expect(screen.getByLabelText('Refine with AI')).toBeTruthy();
  });

  it('tapping a suggested-reply chip inserts editable text into the composer and focuses it', async () => {
    mockUseMobileFeatureFlag.mockImplementation(
      (key: string) => key === mobileFeatureFlagKeys.enableAiSuggestedReplies,
    );
    mockFetchSuggestedReplies.mockResolvedValue({
      suggestions: ['Sounds great, thanks!'],
    });

    render(<MessageInput onSend={jest.fn()} {...aiContext} />);
    fireEvent.press(screen.getByLabelText('Suggested replies'));

    const chip = await screen.findByText('Sounds great, thanks!');
    fireEvent.press(chip);

    const input = screen.getByLabelText('Message input');
    expect(input.props.value).toBe('Sounds great, thanks!');
    // Inserted text must remain plain, editable draft text.
    fireEvent.changeText(input, 'Sounds great, thanks! Talk soon.');
    expect(input.props.value).toBe('Sounds great, thanks! Talk soon.');
  });

  it('replacing the draft via refine shows an Undo banner that restores the previous text', async () => {
    mockUseMobileFeatureFlag.mockImplementation(
      (key: string) => key === mobileFeatureFlagKeys.enableAiRefine,
    );
    mockRefineDraftWithAi.mockResolvedValue({
      refinedText: 'This is the refined draft.',
      factsPreserved: true,
    });

    render(<MessageInput onSend={jest.fn()} {...aiContext} />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'this is the original draft text');

    fireEvent.press(screen.getByLabelText('Refine with AI'));
    fireEvent.press(screen.getByLabelText('Proofread'));

    await waitFor(() => {
      expect(screen.getByLabelText('Replace')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Replace'));

    await waitFor(() => {
      expect(screen.getByLabelText('Message input').props.value).toBe(
        'This is the refined draft.',
      );
    });
    expect(screen.getByLabelText('Undo AI replace')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Undo AI replace'));

    expect(screen.getByLabelText('Message input').props.value).toBe(
      'this is the original draft text',
    );
    expect(screen.queryByLabelText('Undo AI replace')).toBeNull();
  });
});
