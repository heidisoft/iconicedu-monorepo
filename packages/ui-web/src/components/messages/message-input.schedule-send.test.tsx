/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageInput } from './message-input';

describe('MessageInput scheduled send', () => {
  it('does not render the schedule-send affordance when the flag is off', () => {
    render(<MessageInput onSend={vi.fn()} enableScheduledSend={false} />);
    expect(
      screen.queryByRole('button', { name: 'Schedule send' }),
    ).not.toBeInTheDocument();
  });

  it('does not render the schedule-send affordance without an onScheduleSend handler, even if enabled', () => {
    render(<MessageInput onSend={vi.fn()} enableScheduledSend />);
    expect(
      screen.queryByRole('button', { name: 'Schedule send' }),
    ).not.toBeInTheDocument();
  });

  it('renders the schedule-send affordance when enabled with a handler', () => {
    render(
      <MessageInput onSend={vi.fn()} enableScheduledSend onScheduleSend={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Schedule send' })).toBeInTheDocument();
  });

  it('calls onScheduleSend (not onSend) with an absolute sendAt and the browser timezone, then clears the composer', async () => {
    const onSend = vi.fn();
    const onScheduleSend = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        enableScheduledSend
        onScheduleSend={onScheduleSend}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Write a message...'), {
      target: { value: 'Reminder for tomorrow' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Schedule send' }));

    const dateInput = await screen.findByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    fireEvent.change(dateInput, { target: { value: '2099-01-01' } });
    fireEvent.change(timeInput, { target: { value: '09:30' } });

    fireEvent.click(screen.getByRole('button', { name: /schedule message/i }));

    await waitFor(() => {
      expect(onScheduleSend).toHaveBeenCalledTimes(1);
    });
    expect(onSend).not.toHaveBeenCalled();

    const call = onScheduleSend.mock.calls[0][0];
    expect(call.content).toBe('Reminder for tomorrow');
    expect(call.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(new Date(call.sendAt).getFullYear()).toBe(2099);
    expect(new Date(call.sendAt).getHours()).toBe(9);
    expect(new Date(call.sendAt).getMinutes()).toBe(30);

    // Composer is cleared after a successful schedule.
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('Write a message...') as HTMLTextAreaElement).value,
      ).toBe('');
    });
  });

  it('shows an inline error and keeps the popover open when scheduling a time in the past', async () => {
    const onScheduleSend = vi.fn();
    render(
      <MessageInput
        onSend={vi.fn()}
        enableScheduledSend
        onScheduleSend={onScheduleSend}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Write a message...'), {
      target: { value: 'Old reminder' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule send' }));

    const dateInput = await screen.findByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    fireEvent.change(dateInput, { target: { value: '2000-01-01' } });
    fireEvent.change(timeInput, { target: { value: '09:30' } });
    fireEvent.click(screen.getByRole('button', { name: /schedule message/i }));

    expect(await screen.findByText('Pick a time in the future.')).toBeInTheDocument();
    expect(onScheduleSend).not.toHaveBeenCalled();
  });
});
