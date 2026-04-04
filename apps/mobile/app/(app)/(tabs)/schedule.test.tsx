import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import ScheduleScreen from './schedule';

const mockFetchOrgSessions = jest.fn();

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#f8fafc',
      border: '#e2e8f0',
      text: '#0f172a',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');
  return { SafeAreaView: ReactNative.View };
});

jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({
    data: { org_id: 'org-1', primary_role: 'owner' },
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: { kind: null },
    refetch: jest.fn(),
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchOrgSessions: (...args: unknown[]) => mockFetchOrgSessions(...args),
  queryKeys: {
    orgSessions: (orgId: string) => ['org-sessions', orgId],
  },
}));

jest.mock('@/components/sessions/class-schedule-screen', () => ({
  ClassScheduleScreen: ({ schedules }: { schedules: Array<{ title: string }> }) => {
    const ReactNative = require('react-native');
    return (
      <>
        <ReactNative.Text>schedule-count:{schedules.length}</ReactNative.Text>
        <ReactNative.Text>{schedules[0]?.title ?? 'no-title'}</ReactNative.Text>
      </>
    );
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('schedule route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders fetched schedule content instead of the placeholder empty state', async () => {
    mockFetchOrgSessions.mockResolvedValue([
      {
        ids: { id: 'sched-1', orgId: 'org-1' },
        title: 'Algebra',
        startAt: '2099-03-09T14:30:00.000Z',
        endAt: '2099-03-09T15:30:00.000Z',
        status: 'scheduled',
        visibility: 'private',
        participants: [],
        source: { kind: 'class_session', learningSpaceId: 'space-1' },
        audit: { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'user-1' },
      },
    ]);

    const { queryClient } = renderWithClient(<ScheduleScreen />);

    expect(screen.getByText('Schedule')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('schedule-count:1')).toBeTruthy());
    expect(screen.getByText('Algebra')).toBeTruthy();
    queryClient.clear();
  });
});
