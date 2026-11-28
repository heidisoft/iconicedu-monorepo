import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { CompletedSessionRow } from '@/lib/sessions/completed-sessions';

const mockInvalidateQueries = jest.fn(() => Promise.resolve());
const mockBack = jest.fn();
const mockFetchNextPage = jest.fn();
const mockRefetch = jest.fn(() => Promise.resolve());
const mockHookCalls: Array<{ tab: string; monthKey: string }> = [];
let mockReportsEnabled = true;

let mockState: {
  rows: CompletedSessionRow[];
  counts: { completed: number; pending: number } | null;
  isOrgAdminView: boolean;
  isPending: boolean;
  isError: boolean;
};

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: () => mockReportsEnabled,
}));

// The row and the report sheet have their own component tests; here they only
// expose the props the screen hands them.
jest.mock('@/components/sessions/completed-session-row', () => ({
  CompletedSessionRow: ({
    row,
    reportsEnabled,
    reportedLocally,
    onReport,
  }: {
    row: CompletedSessionRow;
    reportsEnabled: boolean;
    reportedLocally: boolean;
    onReport: (row: CompletedSessionRow) => void;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Text>{row.title}</Text>
        <Text>{`status:${row.statusLabel}`}</Text>
        <Text>{`reports-enabled:${String(reportsEnabled)}`}</Text>
        {reportedLocally ? <Text>{`reported:${row.id}`}</Text> : null}
        <Pressable
          accessibilityLabel={`Report ${row.id}`}
          onPress={() => onReport(row)}
        />
      </View>
    );
  },
}));

jest.mock('@/components/sessions/report-completion-sheet', () => ({
  ReportCompletionSheet: ({
    completion,
    onReported,
  }: {
    completion: { id: string } | null;
    onReported: (id: string) => void;
  }) => {
    const { Pressable, Text } = require('react-native');
    return completion ? (
      <Pressable
        accessibilityLabel="Submit mock report"
        onPress={() => onReported(completion.id)}
      >
        <Text>{`report-sheet:${completion.id}`}</Text>
      </Pressable>
    ) : null;
  },
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = () => <Text>icon</Text>;
  return {
    CalendarCheck: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Clock3: Icon,
    Star: Icon,
  };
});

jest.mock('@/components/sessions/session-completed-tile', () => ({
  SessionCompletedTile: ({
    completion,
    onCompletionSubmit,
  }: {
    completion: { id: string };
    onCompletionSubmit: (status: 'confirmed') => void;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        accessibilityLabel={`Confirm ${completion.id}`}
        onPress={() => onCompletionSubmit('confirmed')}
      >
        <Text>{`confirm-tile:${completion.id}`}</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/hooks/use-completed-sessions-history', () => ({
  useCompletedSessionsHistory: (tab: string, month: { monthKey: string }) => {
    mockHookCalls.push({ tab, monthKey: month.monthKey });
    return {
      ...mockState,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetch,
    };
  },
}));

import CompletedSessionsScreen from './completed';

function row(overrides: Partial<CompletedSessionRow> = {}): CompletedSessionRow {
  return {
    id: 'row-1',
    title: 'Algebra',
    startsAt: '2026-11-03T15:00:00.000Z',
    sessionEndAt: '2026-11-03T16:00:00.000Z',
    subtitle: 'Sam',
    statusLabel: 'Confirmed',
    awaitingConfirmation: false,
    rating: 4,
    completion: null,
    confirmedBy: 'self',
    reportCount: 0,
    reportable: false,
    ratable: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHookCalls.length = 0;
  mockReportsEnabled = true;
  mockState = {
    rows: [row()],
    counts: { completed: 7, pending: 2 },
    isOrgAdminView: false,
    isPending: false,
    isError: false,
  };
});

it('lists completed sessions with the month counts on the tabs', () => {
  const screen = render(<CompletedSessionsScreen />);

  expect(screen.getByText('Sessions completed')).toBeTruthy();
  expect(screen.getByText('Algebra')).toBeTruthy();
  expect(screen.getByText('status:Confirmed')).toBeTruthy();
  expect(screen.getByText('Completed (7)')).toBeTruthy();
  expect(screen.getByText('Awaiting confirmation (2)')).toBeTruthy();
  expect(mockHookCalls.at(-1)?.tab).toBe('completed');
});

it('switches to the awaiting tab and renders pending rows as confirm tiles', () => {
  const screen = render(<CompletedSessionsScreen />);
  mockState.rows = [
    row({
      id: 'pending-1',
      statusLabel: 'Awaiting confirmation',
      awaitingConfirmation: true,
      completion: { id: 'pending-1' } as CompletedSessionRow['completion'],
    }),
  ];

  fireEvent.press(screen.getByRole('tab', { name: 'Awaiting confirmation (2)' }));

  expect(mockHookCalls.at(-1)?.tab).toBe('pending');
  expect(screen.getByText('confirm-tile:pending-1')).toBeTruthy();
});

it('refreshes counts right after a confirm and everything else on the next tab change', () => {
  mockState.rows = [
    row({
      id: 'pending-1',
      awaitingConfirmation: true,
      completion: { id: 'pending-1' } as CompletedSessionRow['completion'],
    }),
  ];
  const screen = render(<CompletedSessionsScreen />);

  fireEvent.press(screen.getByLabelText('Confirm pending-1'));
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ['session-completions', 'summary'],
  });
  expect(mockInvalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ['session-completions'],
  });

  fireEvent.press(screen.getByRole('tab', { name: 'Awaiting confirmation (2)' }));
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ['session-completions'],
  });
});

it('steps back through months and cannot go past the current one', () => {
  const screen = render(<CompletedSessionsScreen />);
  const currentMonth = mockHookCalls.at(-1)?.monthKey;

  fireEvent.press(screen.getByLabelText('Next month'));
  expect(mockHookCalls.at(-1)?.monthKey).toBe(currentMonth);

  fireEvent.press(screen.getByLabelText('Previous month'));
  expect(mockHookCalls.at(-1)?.monthKey).not.toBe(currentMonth);
});

it('limits admins to the three-month window the admin endpoint returns', () => {
  mockState.isOrgAdminView = true;
  const screen = render(<CompletedSessionsScreen />);
  const previous = screen.getByLabelText('Previous month');

  fireEvent.press(previous);
  fireEvent.press(previous);
  const monthsVisited = new Set(mockHookCalls.map((call) => call.monthKey));
  fireEvent.press(previous);

  expect(new Set(mockHookCalls.map((call) => call.monthKey)).size).toBe(
    monthsVisited.size,
  );
  expect(monthsVisited.size).toBe(3);
});

it('shows an empty state for a month with no sessions', () => {
  mockState.rows = [];
  const screen = render(<CompletedSessionsScreen />);

  expect(screen.getByText('No completed sessions')).toBeTruthy();
  expect(screen.getByText(/^Sessions completed in .+ will appear here\.$/)).toBeTruthy();
});

it('uses the caught-up empty state on the awaiting tab', () => {
  mockState.rows = [];
  const screen = render(<CompletedSessionsScreen />);

  fireEvent.press(screen.getByRole('tab', { name: 'Awaiting confirmation (2)' }));

  expect(screen.getByText('All caught up')).toBeTruthy();
});

it('offers a retry when the list fails to load', () => {
  mockState.rows = [];
  mockState.isError = true;
  const screen = render(<CompletedSessionsScreen />);

  fireEvent.press(screen.getByText('Try again'));

  expect(mockRefetch).toHaveBeenCalled();
});

it('opens the report sheet from a row and marks the row reported once submitted', () => {
  mockState.rows = [
    row({
      id: 'staff-1',
      statusLabel: 'Marked by staff',
      confirmedBy: 'staff',
      reportable: true,
      completion: { id: 'staff-1' } as CompletedSessionRow['completion'],
    }),
  ];
  const screen = render(<CompletedSessionsScreen />);

  fireEvent.press(screen.getByLabelText('Report staff-1'));
  expect(screen.getByText('report-sheet:staff-1')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Submit mock report'));
  expect(screen.queryByText('report-sheet:staff-1')).toBeNull();
  expect(screen.getByText('reported:staff-1')).toBeTruthy();

  // The full refresh waits for the next tab change, like a confirm.
  fireEvent.press(screen.getByRole('tab', { name: 'Awaiting confirmation (2)' }));
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ['session-completions'],
  });
});

it('passes the reports flag through to the rows', () => {
  mockReportsEnabled = false;
  const screen = render(<CompletedSessionsScreen />);

  expect(screen.getByText('reports-enabled:false')).toBeTruthy();
});
