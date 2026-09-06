import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ActivityFeedItemVM, ActivityFeedVM } from '@iconicedu/shared-types';

const mockMarkRead = jest.fn();
const mockRefetchFeed = jest.fn(() => Promise.resolve());
const mockRouterPush = jest.fn();
let mockFeed: ActivityFeedVM;
let mockSearchParams: Record<string, unknown>;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useLocalSearchParams: () => mockSearchParams,
}));

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

jest.mock('@/hooks/use-push-nudge', () => ({
  usePushNudge: () => ({
    isVisible: false,
    nudgeVariant: 'request-permission',
    triggerNudge: jest.fn(),
    handleEnable: jest.fn(),
    handleOpenSettings: jest.fn(),
    handleDismiss: jest.fn(),
  }),
}));

jest.mock('@/components/notifications/push-nudge-sheet', () => ({
  PushNudgeSheet: () => null,
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
    CheckCheck: Icon,
    CheckCircle: Icon,
    CreditCard: Icon,
    GraduationCap: Icon,
    MessageSquare: Icon,
    Star: Icon,
  };
});

import InboxScreen from './inbox';

function makeActivity(input: {
  id: string;
  tabKey: ActivityFeedItemVM['tabKey'];
  primary: string;
  isRead?: boolean;
  verb?: ActivityFeedItemVM['verb'];
  actionLabel?: string;
  metadata?: Record<string, unknown>;
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
    verb: input.verb ?? 'message.posted',
    refs: {},
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: { primary: input.primary, secondary: 'sent a message' },
      summary: 'A short preview',
      actionButton: input.actionLabel
        ? { label: input.actionLabel, variant: 'outline' }
        : undefined,
    },
    state: { isRead: input.isRead ?? false, importance: 'normal' },
    metadata: input.metadata,
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
    mockSearchParams = {};
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

  it('opens the class space from a class notification action', () => {
    mockFeed = {
      ...makeFeed(),
      sections: [
        {
          label: 'Today',
          items: [
            makeActivity({
              id: 'class-action',
              tabKey: 'classes',
              primary: 'Algebra I',
              verb: 'class.session.rescheduled',
              actionLabel: 'Open class',
              metadata: { channelId: 'space-channel-123' },
            }),
          ],
        },
      ],
    };

    render(<InboxScreen />);

    fireEvent.press(screen.getByText('Open class'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/spaces/space-channel-123');
    expect(mockMarkRead).toHaveBeenCalledWith(['class-action']);
  });

  it('opens the DM screen from a direct-message reply action', () => {
    mockFeed = {
      ...makeFeed(),
      sections: [
        {
          label: 'Today',
          items: [
            makeActivity({
              id: 'dm-action',
              tabKey: 'all',
              primary: 'Alice',
              verb: 'message.posted',
              actionLabel: 'Reply',
              metadata: {
                channelId: 'dm-channel-123',
                channelRouteKind: 'dm',
              },
            }),
          ],
        },
      ],
    };

    render(<InboxScreen />);

    fireEvent.press(screen.getByText('Reply'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/dm/dm-channel-123');
    expect(mockMarkRead).toHaveBeenCalledWith(['dm-action']);
  });

  it('uses the projected href to identify older direct-message actions', () => {
    mockFeed = {
      ...makeFeed(),
      sections: [
        {
          label: 'Today',
          items: [
            {
              ...makeActivity({
                id: 'dm-action',
                tabKey: 'all',
                primary: 'Alice',
                verb: 'message.posted',
                actionLabel: 'Reply',
                metadata: { channelId: 'dm-channel-123' },
              }),
              content: {
                ...makeActivity({
                  id: 'dm-action',
                  tabKey: 'all',
                  primary: 'Alice',
                  actionLabel: 'Reply',
                }).content,
                actionButton: {
                  label: 'Reply',
                  variant: 'outline',
                  href: '../dm/dm-channel-123',
                },
              },
            } as ActivityFeedItemVM,
          ],
        },
      ],
    };

    render(<InboxScreen />);

    fireEvent.press(screen.getByText('Reply'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/dm/dm-channel-123');
  });

  it('shows feedback requests inline instead of navigating away', () => {
    mockFeed = {
      ...makeFeed(),
      sections: [
        {
          label: 'Today',
          items: [
            makeActivity({
              id: 'feedback-action',
              tabKey: 'classes',
              primary: 'Share feedback for Algebra I',
              verb: 'session.feedback_request.sent',
              actionLabel: 'Give feedback',
              metadata: {
                feedbackUiEnabled: true,
                sessionCompletionId: 'completion-1',
                sourceEventId: 'event-1',
                classSessionId: 'session-1',
                classroomId: 'space-1',
                channelId: 'space-channel-123',
              },
            }),
          ],
        },
      ],
    };

    render(<InboxScreen />);

    expect(screen.getByText('Rate your session')).toBeTruthy();
    expect(screen.queryByText('Give feedback')).toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('opens a pushed feedback notification on the target activity item', () => {
    mockSearchParams = { activityId: 'feedback-action' };
    mockFeed = {
      ...makeFeed(),
      sections: [
        {
          label: 'Today',
          items: [
            makeActivity({
              id: 'feedback-action',
              tabKey: 'classes',
              primary: 'Share feedback for Algebra I',
              verb: 'session.feedback_request.sent',
              actionLabel: 'Give feedback',
              metadata: {
                feedbackUiEnabled: true,
                sessionCompletionId: 'completion-1',
                sourceEventId: 'event-1',
                classSessionId: 'session-1',
                classroomId: 'space-1',
                channelId: 'space-channel-123',
              },
            }),
          ],
        },
      ],
    };

    render(<InboxScreen />);

    expect(screen.getByText('Share feedback for Algebra I')).toBeTruthy();
    expect(screen.getByText('Rate your session')).toBeTruthy();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
