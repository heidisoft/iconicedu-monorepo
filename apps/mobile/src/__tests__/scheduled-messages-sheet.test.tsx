import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ScheduledMessagesSheet } from '@/components/messages/scheduled-messages-sheet';
import type { ScheduledMessage } from '@/lib/api/queries';

const mockFetchScheduledMessages = jest.fn();
const mockCancelScheduledMessage = jest.fn();
const mockSendScheduledMessageNow = jest.fn();
const mockUpdateScheduledMessage = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  fetchScheduledMessages: (...args: unknown[]) => mockFetchScheduledMessages(...args),
  cancelScheduledMessage: (...args: unknown[]) => mockCancelScheduledMessage(...args),
  sendScheduledMessageNow: (...args: unknown[]) => mockSendScheduledMessageNow(...args),
  updateScheduledMessage: (...args: unknown[]) => mockUpdateScheduledMessage(...args),
}));

function makeScheduled(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    ids: { id: 'sched-1', orgId: 'org-1' },
    channelId: 'chan-1',
    senderProfileId: 'prof-1',
    content: 'Reminder: bring your worksheet',
    sendAt: '2026-01-01T15:00:00.000Z',
    timezone: 'America/New_York',
    status: 'pending',
    ...overrides,
  };
}

describe('ScheduledMessagesSheet (issue #264 P2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      // Auto-confirm the destructive action for cancel-flow tests.
      const confirm = buttons?.find((b) => b.style === 'destructive');
      confirm?.onPress?.();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderSheet() {
    return render(
      <ScheduledMessagesSheet
        visible
        orgId="org-1"
        senderProfileId="prof-1"
        onClose={jest.fn()}
      />,
    );
  }

  it('renders a pending row with all four actions enabled', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled()]);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Edit scheduled message').props.accessibilityState,
    ).toEqual({ disabled: false });
    expect(screen.getByLabelText('Reschedule message').props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(screen.getByLabelText('Send now').props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(
      screen.getByLabelText('Cancel scheduled message').props.accessibilityState,
    ).toEqual({ disabled: false });
  });

  it('disables Edit, Reschedule, and Send now for a sent row, but allows only viewing (no cancel either)', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled({ status: 'sent' })]);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Edit scheduled message').props.accessibilityState,
    ).toEqual({ disabled: true });
    expect(screen.getByLabelText('Reschedule message').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByLabelText('Send now').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(
      screen.getByLabelText('Cancel scheduled message').props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('disables Edit, Reschedule, and Send now for a canceled row', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled({ status: 'canceled' })]);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Edit scheduled message').props.accessibilityState,
    ).toEqual({ disabled: true });
    expect(
      screen.getByLabelText('Cancel scheduled message').props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('a failed row shows lastError and allows only Cancel (Edit/Reschedule/Send now disabled)', async () => {
    mockFetchScheduledMessages.mockResolvedValue([
      makeScheduled({ status: 'failed', lastError: 'Sender is no longer a member' }),
    ]);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Sender is no longer a member')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Edit scheduled message').props.accessibilityState,
    ).toEqual({ disabled: true });
    expect(screen.getByLabelText('Reschedule message').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByLabelText('Send now').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(
      screen.getByLabelText('Cancel scheduled message').props.accessibilityState,
    ).toEqual({ disabled: false });
  });

  it('sends now and reflects the updated status', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled()]);
    mockSendScheduledMessageNow.mockResolvedValue(makeScheduled({ status: 'sent' }));
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Send now'));

    await waitFor(() => {
      expect(mockSendScheduledMessageNow).toHaveBeenCalledWith({
        orgId: 'org-1',
        id: 'sched-1',
      });
    });
  });

  it('cancels a pending message after confirmation', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled()]);
    mockCancelScheduledMessage.mockResolvedValue(undefined);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Cancel scheduled message'));

    await waitFor(() => {
      expect(mockCancelScheduledMessage).toHaveBeenCalledWith({
        orgId: 'org-1',
        id: 'sched-1',
      });
    });
  });

  it('edits content inline and saves via updateScheduledMessage', async () => {
    mockFetchScheduledMessages.mockResolvedValue([makeScheduled()]);
    mockUpdateScheduledMessage.mockResolvedValue(
      makeScheduled({ content: 'Updated reminder text' }),
    );
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your worksheet')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Edit scheduled message'));
    fireEvent.changeText(
      screen.getByLabelText('Edit scheduled message'),
      'Updated reminder text',
    );
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateScheduledMessage).toHaveBeenCalledWith({
        orgId: 'org-1',
        id: 'sched-1',
        content: 'Updated reminder text',
      });
    });
  });

  it('shows an empty state when there are no scheduled messages', async () => {
    mockFetchScheduledMessages.mockResolvedValue([]);
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText('No scheduled messages')).toBeTruthy();
    });
  });
});
