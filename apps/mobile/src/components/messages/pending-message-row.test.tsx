import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PendingMessageRow,
  type PendingUpload,
} from '@/components/messages/pending-message-row';
import { lightColors as colors } from '@/lib/theme';

function makeTextPending(overrides: Partial<PendingUpload> = {}): PendingUpload {
  return {
    id: 'client-id-1',
    type: 'text',
    attachments: [],
    senderName: 'Me',
    createdAt: new Date().toISOString(),
    caption: 'Hello, not sent yet',
    clientMessageId: 'client-id-1',
    ...overrides,
  };
}

describe('PendingMessageRow — text sends (send-failure recovery)', () => {
  it('renders the message text with a "Sending…" status while in flight', () => {
    render(<PendingMessageRow pending={makeTextPending()} colors={colors} />);
    expect(screen.getByText('Hello, not sent yet')).toBeTruthy();
    expect(screen.getByText('Sending…')).toBeTruthy();
    expect(screen.queryByText(/tap to retry/)).toBeNull();
  });

  it('shows a retry affordance and calls onRetry when failed', () => {
    const onRetry = jest.fn();
    render(
      <PendingMessageRow
        pending={makeTextPending({ failed: true })}
        colors={colors}
        onRetry={onRetry}
      />,
    );

    const retryText = screen.getByText(/Failed to send/);
    expect(retryText).toBeTruthy();
    fireEvent.press(retryText);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render any image/file/audio bubble chrome for a text row', () => {
    render(<PendingMessageRow pending={makeTextPending()} colors={colors} />);
    // Only the caption bubble + status line should be present — nothing from
    // the file/audio bubble branch (e.g. no generic "File" fallback name).
    expect(screen.queryByText('File')).toBeNull();
    expect(screen.queryByText('Voice message')).toBeNull();
  });
});
