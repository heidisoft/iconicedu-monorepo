import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import {
  NotificationModeSection,
  buildConversationModePayload,
  describeNotificationMode,
  isMutedNotificationMode,
  NOTIFICATION_MODE_OPTIONS,
} from './notification-mode-section';

const mockFetchConversationNotificationMode = jest.fn();
const mockSetConversationNotificationMode = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  fetchConversationNotificationMode: (...args: unknown[]) =>
    mockFetchConversationNotificationMode(...args),
  setConversationNotificationMode: (...args: unknown[]) =>
    mockSetConversationNotificationMode(...args),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: jest.fn(),
}));

const baseProps = {
  orgId: 'org-1',
  profileId: 'profile-1',
  scopeKind: 'channel' as const,
  scopeId: 'channel-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchConversationNotificationMode.mockResolvedValue({
    mode: 'normal',
    mutedUntil: null,
  });
  mockSetConversationNotificationMode.mockResolvedValue(undefined);
});

describe('notification mode helpers', () => {
  it('describes each mode for the collapsed row', () => {
    expect(describeNotificationMode('normal', null)).toBe('Normal');
    expect(describeNotificationMode('mentions_only', null)).toBe('Mentions only');
    expect(describeNotificationMode('muted_until_enabled', null)).toBe('Muted');
    expect(describeNotificationMode('muted_until', null)).toBe('Muted');
    expect(describeNotificationMode('muted_until', '2026-01-01T10:00:00.000Z')).toMatch(
      /^Muted until /,
    );
  });

  it('flags muted modes', () => {
    expect(isMutedNotificationMode('muted_until')).toBe(true);
    expect(isMutedNotificationMode('muted_until_enabled')).toBe(true);
    expect(isMutedNotificationMode('normal')).toBe(false);
    expect(isMutedNotificationMode('mentions_only')).toBe(false);
  });

  it('computes mutedUntil client-side for timed mutes only', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    const oneHour = NOTIFICATION_MODE_OPTIONS.find((o) => o.key === 'mute_1h')!;
    expect(buildConversationModePayload(oneHour, now)).toEqual({
      mode: 'muted_until',
      mutedUntil: '2026-01-01T01:00:00.000Z',
    });

    const oneWeek = NOTIFICATION_MODE_OPTIONS.find((o) => o.key === 'mute_1w')!;
    expect(buildConversationModePayload(oneWeek, now)).toEqual({
      mode: 'muted_until',
      mutedUntil: '2026-01-08T00:00:00.000Z',
    });

    const untilEnabled = NOTIFICATION_MODE_OPTIONS.find(
      (o) => o.key === 'mute_until_enabled',
    )!;
    expect(buildConversationModePayload(untilEnabled, now)).toEqual({
      mode: 'muted_until_enabled',
      mutedUntil: undefined,
    });

    const normal = NOTIFICATION_MODE_OPTIONS.find((o) => o.key === 'normal')!;
    expect(buildConversationModePayload(normal, now)).toEqual({
      mode: 'normal',
      mutedUntil: undefined,
    });
  });
});

describe('NotificationModeSection', () => {
  it('loads and shows the current mode on mount', async () => {
    mockFetchConversationNotificationMode.mockResolvedValue({
      mode: 'mentions_only',
      mutedUntil: null,
    });

    render(<NotificationModeSection {...baseProps} />);

    expect(mockFetchConversationNotificationMode).toHaveBeenCalledWith({
      orgId: 'org-1',
      profileId: 'profile-1',
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });
    await waitFor(() => {
      expect(screen.getByText('Mentions only')).toBeTruthy();
    });
  });

  it('saves a timed mute with a client-computed mutedUntil', async () => {
    render(<NotificationModeSection {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Normal')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Change notification settings'));
    fireEvent.press(screen.getByLabelText('Mute for 8 hours'));

    await waitFor(() => {
      expect(mockSetConversationNotificationMode).toHaveBeenCalled();
    });
    const payload = mockSetConversationNotificationMode.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        orgId: 'org-1',
        profileId: 'profile-1',
        scopeKind: 'channel',
        scopeId: 'channel-1',
        mode: 'muted_until',
      }),
    );
    expect(typeof payload.mutedUntil).toBe('string');
  });

  it('saves "mute until I turn it back on" without a mutedUntil', async () => {
    render(<NotificationModeSection {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Normal')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Change notification settings'));
    fireEvent.press(screen.getByLabelText('Mute until I turn it back on'));

    await waitFor(() => {
      expect(mockSetConversationNotificationMode).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'muted_until_enabled', mutedUntil: undefined }),
      );
    });
  });

  it('offers an unmute affordance while muted and posts mode normal', async () => {
    mockFetchConversationNotificationMode.mockResolvedValue({
      mode: 'muted_until_enabled',
      mutedUntil: null,
    });

    render(<NotificationModeSection {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Turn on notifications')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Turn on notifications'));

    await waitFor(() => {
      expect(mockSetConversationNotificationMode).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'normal' }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Turn on notifications')).toBeNull();
    });
  });

  it('does not show the unmute row when notifications are normal', async () => {
    render(<NotificationModeSection {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Normal')).toBeTruthy());
    expect(screen.queryByLabelText('Turn on notifications')).toBeNull();
  });

  it('falls back to Normal when the load fails', async () => {
    mockFetchConversationNotificationMode.mockRejectedValue(new Error('offline'));

    render(<NotificationModeSection {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeTruthy();
    });
  });

  it('reverts the optimistic selection when the save fails', async () => {
    mockSetConversationNotificationMode.mockRejectedValue(new Error('boom'));

    render(<NotificationModeSection {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Normal')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Change notification settings'));
    fireEvent.press(screen.getByLabelText('Mentions only'));

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeTruthy();
    });
  });

  it('uses the learning_space scope kind when asked to', async () => {
    render(<NotificationModeSection {...baseProps} scopeKind="learning_space" />);

    expect(mockFetchConversationNotificationMode).toHaveBeenCalledWith(
      expect.objectContaining({ scopeKind: 'learning_space' }),
    );
    // Let the in-flight load settle so the state update stays inside act().
    await waitFor(() => expect(screen.getByText('Normal')).toBeTruthy());
  });
});
