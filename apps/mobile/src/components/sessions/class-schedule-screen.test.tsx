import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { ClassScheduleScreen } from './class-schedule-screen';

const mockSuccessToast = jest.fn();
const mockErrorToast = jest.fn();
const mockCancelRecurringSessionOccurrence = jest.fn();

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
      pageBg: '#f8fafc',
      red: '#ef4444',
      modalOverlay: 'rgba(0,0,0,0.4)',
    },
  }),
}));

jest.mock('@/providers/toast-provider', () => ({
  useToast: () => ({
    success: mockSuccessToast,
    error: mockErrorToast,
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  cancelRecurringSessionOccurrence: (...args: unknown[]) =>
    mockCancelRecurringSessionOccurrence(...args),
  queryKeys: {
    orgSessions: (orgId: string) => ['org-sessions', orgId],
  },
}));

jest.mock('@/components/sessions/session-card', () => ({
  SessionCard: ({
    session,
    cancelAction,
  }: {
    session: { label: string };
    cancelAction?: { onPress: () => void } | null;
  }) => {
    const ReactNative = require('react-native');
    return (
      <>
        <ReactNative.Text>{session.label}</ReactNative.Text>
        {cancelAction ? (
          <ReactNative.Pressable
            accessibilityLabel="Cancel class session"
            onPress={cancelAction.onPress}
          >
            <ReactNative.Text>Cancel</ReactNative.Text>
          </ReactNative.Pressable>
        ) : null}
      </>
    );
  },
  formatTimeBadge: (value: string) => value,
  formatOriginalTime: (value: string) => value,
  formatOriginalDate: (value: string) => value,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
  return { ...view, queryClient };
}

function makeRecurringSchedule(): ClassScheduleVM {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(14, 30, 0, 0);
  const end = new Date(start);
  end.setHours(15, 30, 0, 0);
  const weekdayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

  return {
    ids: { id: 'sched-1', orgId: 'org-1' },
    title: 'Math',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    recurrence: {
      ids: { id: 'rec-1', orgId: 'org-1' },
      rule: {
        frequency: 'weekly',
        interval: 1,
        byWeekday: [weekdayMap[start.getDay()]!],
        count: 1,
      },
      exceptions: [],
      overrides: [],
    },
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'user-1',
    },
  };
}

describe('ClassScheduleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows cancel actions for owners on recurring upcoming sessions', () => {
    const { queryClient } = renderWithClient(
      <ClassScheduleScreen
        schedules={[makeRecurringSchedule()]}
        orgId="org-1"
        profileKind="owner"
      />,
    );

    expect(screen.getByLabelText('Cancel class session')).toBeTruthy();
    queryClient.clear();
  });

  it('submits the optional cancel reason and shows a success toast', async () => {
    const schedule = makeRecurringSchedule();
    mockCancelRecurringSessionOccurrence.mockResolvedValue({
      occurrenceKey: schedule.startAt,
      reason: 'Teacher unavailable',
    });

    const { queryClient } = renderWithClient(
      <ClassScheduleScreen schedules={[schedule]} orgId="org-1" profileKind="owner" />,
    );

    fireEvent.press(screen.getByLabelText('Cancel class session'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Add a note for the cancellation'),
      'Teacher unavailable',
    );
    fireEvent.press(screen.getByText('Confirm cancel'));

    await waitFor(() => expect(mockSuccessToast).toHaveBeenCalled());
    queryClient.clear();
  });

  it('shows an error toast when the cancellation fails', async () => {
    mockCancelRecurringSessionOccurrence.mockRejectedValue(
      new Error('permission denied'),
    );
    const { queryClient } = renderWithClient(
      <ClassScheduleScreen
        schedules={[makeRecurringSchedule()]}
        orgId="org-1"
        profileKind="owner"
      />,
    );

    fireEvent.press(screen.getByLabelText('Cancel class session'));
    fireEvent.press(screen.getByText('Confirm cancel'));

    await waitFor(() =>
      expect(mockErrorToast).toHaveBeenCalledWith(
        'Unable to cancel session',
        'permission denied',
      ),
    );
    queryClient.clear();
  });
});
