import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ActivityFeedItemVM, ActivityFeedVM } from '@iconicedu/shared-types';

const mockMarkRead = jest.fn();
const mockRefetchFeed = jest.fn(() => Promise.resolve());
let mockFeed: ActivityFeedVM;

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      id: 'profile-1',
      timezone: 'America/New_York',
    },
  }),
}));

jest.mock('@/hooks/use-activity-feed', () => ({
  useActivityFeed: () => ({
    data: mockFeed,
    isPending: false,
    refetch: mockRefetchFeed,
  }),
  useMarkActivityFeedRead: () => ({
    mutate: mockMarkRead,
  }),
}));

jest.mock('@/components/skeletons', () => ({
  ActivityFeedSkeleton: () => null,
}));

jest.mock('@/lib/header-surface', () => ({
  createHeaderSurface: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = ({ size }: { size?: number }) => <Text>{`icon-${size ?? 0}`}</Text>;
  return {
    Bell: Icon,
    CheckCircle: Icon,
    CreditCard: Icon,
    GraduationCap: Icon,
    MessageSquare: Icon,
  };
});

import InboxScreen from './inbox';

function makeActivity(input: {
  id: string;
  tabKey: ActivityFeedItemVM['tabKey'];
  primary: string;
  isRead?: boolean;
}): ActivityFeedItemVM {
  return {
    kind: 'leaf',
    ids: { id: input.id, orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-04-02T12:00:00.000Z',
      createdAt: '2026-04-02T12:00:00.000Z',
    },
    tabKey: input.tabKey,
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'message.posted',
    refs: {},
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: { primary: input.primary, secondary: 'sent a message' },
      summary: 'A short preview',
    },
    state: { isRead: input.isRead ?? false, importance: 'normal' },
  } as ActivityFeedItemVM;
}

function makeFeed(): ActivityFeedVM {
  const items = [
    makeActivity({ id: 'class-unread', tabKey: 'classes', primary: 'Class update' }),
    makeActivity({ id: 'payment-unread', tabKey: 'payment', primary: 'Payment update' }),
    makeActivity({
      id: 'system-read',
      tabKey: 'system',
      primary: 'System update',
      isRead: true,
    }),
  ];

  return {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: 'All', badgeCount: 2 },
      { key: 'classes', label: 'Classes', badgeCount: 1 },
      { key: 'payment', label: 'Payment', badgeCount: 1 },
      { key: 'system', label: 'System', badgeCount: 0 },
    ],
    sections: [{ label: 'Today', items }],
    unreadCount: 2,
    nextCursor: null,
  };
}

describe('InboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeed = makeFeed();
  });

  it('does not mark notifications read just by rendering the tab', () => {
    render(<InboxScreen />);

    expect(screen.getByText('Class update')).toBeTruthy();
    expect(screen.getByText('Payment update')).toBeTruthy();
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('marks a notification read when its row is pressed', () => {
    render(<InboxScreen />);

    fireEvent.press(screen.getByText('Class update'));

    expect(mockMarkRead).toHaveBeenCalledWith(['class-unread']);
  });

  it('marks only unread notifications in the active tab when using Mark all read', () => {
    render(<InboxScreen />);

    fireEvent.press(screen.getAllByText('Classes')[0]);
    fireEvent.press(screen.getByLabelText('Mark all notifications as read'));

    expect(mockMarkRead).toHaveBeenCalledWith(['class-unread']);
  });
});
