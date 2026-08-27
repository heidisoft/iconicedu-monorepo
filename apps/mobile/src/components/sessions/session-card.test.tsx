import React from 'react';
import { Linking, Share, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SessionCard, type ClassSession } from './session-card';

const mockPush = jest.fn();
const mockOpenURL = jest.fn();
const mockJoinChannelLiveSession = jest.fn();
const mockJoinClassSessionOccurrence = jest.fn();

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      teal: '#14b8a6',
      tealBg: '#f0fdfa',
      card: '#ffffff',
      inputBg: '#f1f5f9',
      border: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#64748b',
      textFaint: '#94a3b8',
    },
  }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/api/queries', () => ({
  joinChannelLiveSession: (...args: unknown[]) => mockJoinChannelLiveSession(...args),
  joinClassSessionOccurrence: (...args: unknown[]) =>
    mockJoinClassSessionOccurrence(...args),
}));
jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({ data: { id: 'account-1', org_id: 'org-1' } }),
}));
jest.mock('lucide-react-native', () => ({
  Video: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'video-icon'} />;
  },
  Clock3: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'clock-icon'} />;
  },
  Share2: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'share-icon'} />;
  },
  X: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'close-icon'} />;
  },
  Presentation: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'presentation-icon'} />;
  },
  ShieldUser: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'shielduser-icon'} />;
  },
  User: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'user-icon'} />;
  },
  BriefcaseBusiness: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'briefcasebusiness-icon'} />;
  },
  Sparkles: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'sparkles-icon'} />;
  },
}));
jest.spyOn(Linking, 'openURL').mockImplementation(mockOpenURL);
jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

const baseSession: ClassSession = {
  id: 'test-1',
  label: 'Mar · Week 2',
  time: '2:30 PM',
  dayName: 'Mon',
  dayNum: '10',
  isToday: false,
  isLive: false,
  isPast: false,
  status: 'scheduled',
  meetingLink: null,
  channelId: 'channel-1',
  variant: 'default',
  disabled: false,
  startAt: '2025-03-10T14:30:00.000Z',
  endAt: '2025-03-10T15:30:00.000Z',
};

describe('SessionCard', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOpenURL.mockClear();
    mockJoinChannelLiveSession.mockReset();
    mockJoinClassSessionOccurrence.mockReset();
  });

  it('renders without crashing', () => {
    render(<SessionCard session={baseSession} />);
  });

  it('shows day name and number', () => {
    render(<SessionCard session={baseSession} />);
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('shows session label and time', () => {
    render(<SessionCard session={baseSession} />);
    expect(screen.getByText('Mar · Week 2')).toBeTruthy();
    expect(screen.getByText('2:30 PM')).toBeTruthy();
  });

  it('keeps the default session tile title size', () => {
    render(<SessionCard session={baseSession} />);

    expect(
      StyleSheet.flatten(screen.getByText('Mar · Week 2').props.style),
    ).toMatchObject({
      fontSize: 14,
      fontWeight: '600',
    });
  });

  it('can match the message list session title style', () => {
    render(<SessionCard session={baseSession} titleVariant="message-list" />);

    expect(
      StyleSheet.flatten(screen.getByText('Mar · Week 2').props.style),
    ).toMatchObject({
      fontSize: 17,
      fontWeight: '700',
    });
  });

  it('renders grouped educator and student names with icons', () => {
    render(
      <SessionCard
        session={{
          ...baseSession,
          participants: [
            { name: 'Priya Patel', kind: 'educator' },
            { name: 'Ava Lee', kind: 'child', themeKey: 'blue' },
          ],
        }}
      />,
    );

    expect(screen.getByText('Priya Patel')).toBeTruthy();
    expect(screen.getByText('Ava Lee')).toBeTruthy();
    expect(screen.getByTestId('presentation-icon')).toBeTruthy();
    expect(screen.getByTestId('user-icon')).toBeTruthy();
  });

  it('shows LIVE badge when isLive', () => {
    render(<SessionCard session={{ ...baseSession, isLive: true }} />);
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Join Now')).toBeTruthy();
  });

  it('shows Join button for upcoming sessions', () => {
    render(
      <SessionCard
        session={{ ...baseSession, meetingLink: 'https://meet.example.com/abc' }}
      />,
    );
    expect(screen.getByText('Join')).toBeTruthy();
  });

  it('does not show join button when join action is disabled by parent', () => {
    render(<SessionCard session={baseSession} showJoinButton={false} />);
    expect(screen.queryByText('Join')).toBeNull();
    expect(screen.queryByText('Join Now')).toBeNull();
  });

  it('shows the external join dialog from the join button', () => {
    render(
      <SessionCard session={{ ...baseSession, meetingLink: 'https://zoom.us/j/abc' }} />,
    );

    fireEvent.press(screen.getByLabelText('Join session'));

    expect(screen.getByText('Session ready to join')).toBeTruthy();
    expect(screen.getByText('https://zoom.us/j/abc')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Join Zoom')).toBeTruthy();
    expect(screen.getByLabelText('Share join link')).toBeTruthy();
    expect(screen.getByLabelText('Open Zoom')).toBeTruthy();
    expect(screen.getByLabelText('Close join dialog')).toBeTruthy();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('opens internal meeting links directly from the join button', () => {
    render(
      <SessionCard session={{ ...baseSession, meetingLink: '/live-sessions/abc' }} />,
    );

    fireEvent.press(screen.getByLabelText('Join session'));

    expect(mockOpenURL).toHaveBeenCalledWith('http://localhost:3000/live-sessions/abc');
  });

  it('shows the external join dialog for an external provider join path', async () => {
    mockJoinChannelLiveSession.mockResolvedValue({
      sessionId: 'live-1',
      joinPath: 'https://zoom.us/j/from-channel',
      status: 'live',
      created: true,
      provider: 'zoom',
    });

    render(<SessionCard session={baseSession} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join session'));
    });

    await waitFor(() =>
      expect(mockJoinChannelLiveSession).toHaveBeenCalledWith({
        orgId: 'org-1',
        channelId: 'channel-1',
      }),
    );
    expect(await screen.findByText('Session ready to join')).toBeTruthy();
    expect(await screen.findByText('https://zoom.us/j/from-channel')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens internal join paths directly from the join button', async () => {
    mockJoinChannelLiveSession.mockResolvedValue({
      sessionId: 'live-1',
      joinPath: '/acme/live-sessions/abc',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    render(<SessionCard session={baseSession} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join session'));
    });

    await waitFor(() => expect(mockJoinChannelLiveSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockOpenURL).toHaveBeenCalledWith(
        'http://localhost:3000/acme/live-sessions/abc',
      ),
    );
  });

  it('falls back to the classroom sessions tab when the join request fails', async () => {
    mockJoinChannelLiveSession.mockRejectedValue(new Error('not_authorized'));

    render(<SessionCard session={baseSession} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join session'));
    });

    expect(screen.getByText('Mar · Week 2')).toBeTruthy();
    await waitFor(() => expect(mockJoinChannelLiveSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(app)/spaces/[channelId]',
        params: { channelId: 'channel-1', tab: 'sessions' },
      }),
    );
  });

  it('joins the exact occurrence when the rollout flag is on', async () => {
    mockJoinClassSessionOccurrence.mockResolvedValue({
      sessionId: 'live-1',
      joinPath: '/acme/live-sessions/live-1',
      status: 'live',
      created: true,
      provider: 'daily',
      occurrence: {
        orgId: 'org-1',
        channelId: 'channel-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2025-03-10T14:30:00.000Z',
      },
    });

    render(
      <SessionCard
        session={{
          ...baseSession,
          scheduleId: 'schedule-1',
          occurrenceKey: '2025-03-10T14:30:00.000Z',
        }}
        joinOccurrenceEnabled
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join session'));
    });

    await waitFor(() =>
      expect(mockJoinClassSessionOccurrence).toHaveBeenCalledWith({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2025-03-10T14:30:00.000Z',
      }),
    );
    // A dated card must never fall back to the channel-scoped huddle.
    expect(mockJoinChannelLiveSession).not.toHaveBeenCalled();
  });

  it('uses the channel join when the card carries no occurrence identity', async () => {
    mockJoinChannelLiveSession.mockResolvedValue({
      sessionId: 'live-1',
      joinPath: '/acme/live-sessions/live-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    render(<SessionCard session={baseSession} joinOccurrenceEnabled />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join session'));
    });

    await waitFor(() => expect(mockJoinChannelLiveSession).toHaveBeenCalled());
    expect(mockJoinClassSessionOccurrence).not.toHaveBeenCalled();
  });

  it('shows Recording button for past sessions', () => {
    render(<SessionCard session={{ ...baseSession, isPast: true }} />);
    expect(screen.getByText('Recording')).toBeTruthy();
  });

  it('renders a cancel button when a cancel action is provided', () => {
    render(
      <SessionCard
        session={baseSession}
        cancelAction={{ onPress: jest.fn(), accessibilityLabel: 'Cancel class session' }}
      />,
    );

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByLabelText('Cancel class session')).toBeTruthy();
  });

  it('fires the provided cancel callback', () => {
    const onCancel = jest.fn();
    render(<SessionCard session={baseSession} cancelAction={{ onPress: onCancel }} />);
    fireEvent.press(screen.getByLabelText('Cancel session'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows Canceled badge for exception variant', () => {
    render(<SessionCard session={{ ...baseSession, variant: 'exception' }} />);
    expect(screen.getByText('Canceled')).toBeTruthy();
  });

  it('shows Rescheduled badge for override variant', () => {
    render(<SessionCard session={{ ...baseSession, variant: 'override' }} />);
    expect(screen.getByText('Rescheduled')).toBeTruthy();
  });

  it('opens classroom messages from the card when configured', () => {
    render(<SessionCard session={baseSession} pressTarget="messages" />);

    fireEvent.press(screen.getByLabelText('Open session details'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/spaces/[channelId]',
      params: { channelId: 'channel-1', tab: 'messages' },
    });
  });

  it('does not navigate from the card when card press is disabled', () => {
    render(<SessionCard session={baseSession} enableCardPress={false} />);

    fireEvent.press(screen.getByLabelText('Open session details'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows student names next to the time', () => {
    render(
      <SessionCard
        session={{
          ...baseSession,
          students: [
            { name: 'Alice', themeKey: 'blue' },
            { name: 'Bob', themeKey: 'teal' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows participant names next to the time', () => {
    render(
      <SessionCard
        session={{
          ...baseSession,
          participants: [
            { name: 'Alice', kind: 'child', themeKey: 'blue' },
            { name: 'Mr. Chen', kind: 'educator', themeKey: 'teal' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Mr. Chen')).toBeTruthy();
  });

  it('does not render student separator when no students', () => {
    render(<SessionCard session={{ ...baseSession, students: [] }} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});
