import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageInput } from './message-input';
import type { MessageVM } from '@iconicedu/shared-types';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';

const mockUseMobileFeatureFlag = jest.fn();
jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: (key: string) => mockUseMobileFeatureFlag(key),
}));

const mockFetchLinkPreview = jest.fn();
jest.mock('@/lib/api/queries', () => ({
  fetchLinkPreview: (...args: unknown[]) => mockFetchLinkPreview(...args),
}));

function flagsAllOff() {
  mockUseMobileFeatureFlag.mockImplementation(() => false);
}

function enableFlags(...keys: string[]) {
  mockUseMobileFeatureFlag.mockImplementation((key: string) => keys.includes(key));
}

const sender = {
  kind: 'educator',
  ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
  profile: { displayName: 'Jamie Lee', avatar: { source: 'seed', seed: 'jamie' } },
  prefs: {},
  meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
} as unknown as MessageVM['core']['sender'];

const originalMessage: MessageVM = {
  ids: { id: 'msg-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender,
    createdAt: '2025-01-15T10:30:00Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  state: {},
  content: { text: 'Sounds good, see you then!' },
} as unknown as MessageVM;

beforeEach(() => {
  flagsAllOff();
  mockFetchLinkPreview.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MessageInput — quote reply preview', () => {
  it('renders a quote-reply banner with the original sender and snippet', () => {
    render(<MessageInput onSend={jest.fn()} quoteReplyTo={originalMessage} />);

    expect(screen.getByText('Replying to')).toBeTruthy();
    expect(screen.getByText('Jamie Lee')).toBeTruthy();
    expect(screen.getByText('Sounds good, see you then!')).toBeTruthy();
  });

  it('calls onCancelQuoteReply when the dismiss button is pressed', () => {
    const onCancelQuoteReply = jest.fn();
    render(
      <MessageInput
        onSend={jest.fn()}
        quoteReplyTo={originalMessage}
        onCancelQuoteReply={onCancelQuoteReply}
      />,
    );

    fireEvent.press(screen.getByLabelText('Cancel quote reply'));
    expect(onCancelQuoteReply).toHaveBeenCalled();
  });

  it('does not render a quote-reply banner when quoteReplyTo is not set', () => {
    render(<MessageInput onSend={jest.fn()} />);
    expect(screen.queryByText('Replying to')).toBeNull();
  });
});

describe('MessageInput — link preview (flag: enableMobileLinkPreviews)', () => {
  it('does not fetch a preview when the flag is off', () => {
    flagsAllOff();
    render(<MessageInput onSend={jest.fn()} />);

    fireEvent.changeText(
      screen.getByLabelText('Message input'),
      'check this out https://example.com/a',
    );

    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
    expect(screen.queryByTestId('composer-link-preview-card')).toBeNull();
  });

  it('debounce-fetches and shows a preview card for the first URL typed', async () => {
    jest.useFakeTimers();
    enableFlags(mobileFeatureFlagKeys.enableMobileLinkPreviews);
    mockFetchLinkPreview.mockResolvedValue({
      url: 'https://example.com/a',
      title: 'Example title',
      description: 'An example page',
      siteName: 'example.com',
    });

    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.changeText(
      screen.getByLabelText('Message input'),
      'check this out https://example.com/a',
    );

    // Not fetched yet — still debouncing
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(mockFetchLinkPreview).toHaveBeenCalledWith('https://example.com/a');
    await waitFor(() => {
      expect(screen.getByText('Example title')).toBeTruthy();
    });
    expect(screen.getByText('An example page')).toBeTruthy();
  });

  it('dismisses the card without removing the URL from the text, and does not refetch the same URL', async () => {
    jest.useFakeTimers();
    enableFlags(mobileFeatureFlagKeys.enableMobileLinkPreviews);
    mockFetchLinkPreview.mockResolvedValue({
      url: 'https://example.com/a',
      title: 'Example title',
    });

    render(<MessageInput onSend={jest.fn()} />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'https://example.com/a');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => {
      expect(screen.getByTestId('composer-link-preview-card')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Dismiss link preview'));
    expect(screen.queryByTestId('composer-link-preview-card')).toBeNull();
    // Text is untouched by dismissal
    expect(screen.getByLabelText('Message input').props.value).toBe(
      'https://example.com/a',
    );

    mockFetchLinkPreview.mockClear();
    // Editing elsewhere in the text but keeping the same URL should not re-show the card
    fireEvent.changeText(input, 'https://example.com/a — see above');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
    expect(screen.queryByTestId('composer-link-preview-card')).toBeNull();
  });

  it('re-shows a preview when the text changes to a different URL', async () => {
    jest.useFakeTimers();
    enableFlags(mobileFeatureFlagKeys.enableMobileLinkPreviews);
    mockFetchLinkPreview.mockImplementation((url: string) =>
      Promise.resolve({ url, title: `Title for ${url}` }),
    );

    render(<MessageInput onSend={jest.fn()} />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'https://example.com/a');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => {
      expect(screen.getByTestId('composer-link-preview-card')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Dismiss link preview'));

    fireEvent.changeText(input, 'https://example.com/b');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => {
      expect(screen.getByText('Title for https://example.com/b')).toBeTruthy();
    });
  });

  it('fails silently when the preview fetch rejects (no card, no crash)', async () => {
    jest.useFakeTimers();
    enableFlags(mobileFeatureFlagKeys.enableMobileLinkPreviews);
    mockFetchLinkPreview.mockRejectedValue(new Error('network down'));

    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Message input'), 'https://example.com/a');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('composer-link-preview-card')).toBeNull();
  });

  it('clears the preview when the text no longer contains a URL', async () => {
    jest.useFakeTimers();
    enableFlags(mobileFeatureFlagKeys.enableMobileLinkPreviews);
    mockFetchLinkPreview.mockResolvedValue({
      url: 'https://example.com/a',
      title: 'Example title',
    });

    render(<MessageInput onSend={jest.fn()} />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'https://example.com/a');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => {
      expect(screen.getByTestId('composer-link-preview-card')).toBeTruthy();
    });

    fireEvent.changeText(input, 'no links here anymore');
    expect(screen.queryByTestId('composer-link-preview-card')).toBeNull();
  });
});

describe('MessageInput — list formatting toolbar (flag: enableMessageListFormatting)', () => {
  it('does not render the toolbar buttons when the flag is off', () => {
    flagsAllOff();
    render(<MessageInput onSend={jest.fn()} />);
    expect(screen.queryByLabelText('Add bullet list')).toBeNull();
    expect(screen.queryByLabelText('Add numbered list')).toBeNull();
  });

  it('prefixes the current line with a bullet marker', () => {
    enableFlags(mobileFeatureFlagKeys.enableMessageListFormatting);
    render(<MessageInput onSend={jest.fn()} />);
    const input = screen.getByLabelText('Message input');

    fireEvent.changeText(input, 'milk');
    fireEvent(input, 'onSelectionChange', {
      nativeEvent: { selection: { start: 4, end: 4 } },
    });
    fireEvent.press(screen.getByLabelText('Add bullet list'));

    expect(screen.getByLabelText('Message input').props.value).toBe('- milk');
  });

  it('prefixes multi-line selections with incrementing numbers', () => {
    enableFlags(mobileFeatureFlagKeys.enableMessageListFormatting);
    render(<MessageInput onSend={jest.fn()} />);
    const input = screen.getByLabelText('Message input');
    const text = 'first\nsecond\nthird';

    fireEvent.changeText(input, text);
    fireEvent(input, 'onSelectionChange', {
      nativeEvent: { selection: { start: 0, end: text.length } },
    });
    fireEvent.press(screen.getByLabelText('Add numbered list'));

    expect(screen.getByLabelText('Message input').props.value).toBe(
      '1. first\n2. second\n3. third',
    );
  });
});
