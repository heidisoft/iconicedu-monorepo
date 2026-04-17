import { renderHook, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockSubscription = { remove: jest.fn() };
const mockConstants = { appOwnership: 'standalone' };
const mockMarkActivityFeedRead = jest.fn();

jest.mock('expo-constants', () => mockConstants);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  addNotificationResponseReceivedListener: (
    listener: (response: {
      notification: { request: { content: { data: Record<string, unknown> } } };
    }) => void,
  ) => {
    mockAddNotificationResponseReceivedListener(listener);
    return mockSubscription;
  },
  setBadgeCountAsync: (...args: unknown[]) => mockSetBadgeCountAsync(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({
    account: { org_id: 'org-1' },
    profile: { id: 'profile-1' },
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  markActivityFeedRead: (...args: unknown[]) => mockMarkActivityFeedRead(...args),
}));

const { useNotificationHandler } = require('./use-notification-handler');
import { DEFAULT_NOTIFICATION_ROUTE } from '@/lib/notifications/notification-config';

describe('useNotificationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.appOwnership = 'standalone';
    mockMarkActivityFeedRead.mockResolvedValue(undefined);
  });

  it('routes dm.posted taps to the DM screen and clears the badge', async () => {
    renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    listener({
      notification: {
        request: {
          content: {
            data: { prefKey: 'dm.posted', channelId: 'ch-1' },
          },
        },
      },
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(app)/dm/ch-1');
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  it('falls back to the default route for unknown prefKeys and still clears the badge', async () => {
    renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    listener({
      notification: {
        request: {
          content: {
            data: { prefKey: 'unknown.key' },
          },
        },
      },
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(DEFAULT_NOTIFICATION_ROUTE);
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  it('marks the activity feed item read when the push payload includes an inbox item id', async () => {
    renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    listener({
      notification: {
        request: {
          content: {
            data: {
              prefKey: 'message.posted',
              activityFeedItemId: 'feed-1',
              orgId: 'org-1',
            },
          },
        },
      },
    });

    await waitFor(() => {
      expect(mockMarkActivityFeedRead).toHaveBeenCalledWith('org-1', 'profile-1', [
        'feed-1',
      ]);
    });
  });

  it('passes threadId through to routing for threaded message notifications', async () => {
    renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    listener({
      notification: {
        request: {
          content: {
            data: {
              prefKey: 'message.posted',
              scopeKind: 'learning_space',
              channelId: 'space-1',
              threadId: 'thread-99',
            },
          },
        },
      },
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(app)/spaces/space-1?threadId=thread-99');
    });
  });

  it('does not register notification listeners when running in Expo Go', async () => {
    mockConstants.appOwnership = 'expo';

    renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).not.toHaveBeenCalled();
    });
  });
});
