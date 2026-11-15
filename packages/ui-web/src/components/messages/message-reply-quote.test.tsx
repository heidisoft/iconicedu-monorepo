/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageReplyQuote } from './message-reply-quote';
import type { MessageReplyReferenceVM } from '@iconicedu/shared-types';

const replyTo: MessageReplyReferenceVM = {
  messageId: 'message-1',
  senderId: 'profile-1',
  senderName: 'Taylor Reed',
  snippet: 'Sounds good, see you then',
  type: 'text',
};

describe('MessageReplyQuote', () => {
  it('renders as a clickable button and calls onClick when the original is reachable', () => {
    const onClick = vi.fn();
    render(<MessageReplyQuote replyTo={replyTo} isReachable onClick={onClick} />);

    const button = screen.getByRole('button', {
      name: /jump to original message from taylor reed/i,
    });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Taylor Reed')).toBeInTheDocument();
    expect(screen.getByText(/Sounds good, see you then/)).toBeInTheDocument();
  });

  it('degrades to a non-interactive block when the original is not reachable', () => {
    render(<MessageReplyQuote replyTo={replyTo} isReachable={false} />);

    expect(
      screen.queryByRole('button', { name: /jump to original message/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Taylor Reed')).toBeInTheDocument();
  });
});
