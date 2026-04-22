import { act, renderHook } from '@testing-library/react-native';
import {
  resolveChannelIdFromPayload,
  shouldSyncChannelListsForReadStatePayload,
  useUnreadSync,
} from './use-unread-sync';

const mockInvalidateQueries = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockSubscribe = jest.fn();
const mockOn = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

type RealtimeCallback = (payload?: {
  new?: { thread_id?: string | null; channel_id?: string | null } | null;
  old?: { thread_id?: string | null; channel_id?: string | null } | null;
}) => void;

const realtimeCallbacks = new Map<string, RealtimeCallback>();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  queryKeys: {
    messages: (channelId: string, profileId = '') => ['messages', channelId, profileId],
    directMessages: (orgId: string, profileId: string) => [
      'directMessages',
      orgId,
      profileId,
    ],
    supervisedDirectMessages: (orgId: string, accountId: string) => [
      'supervisedDirectMessages',
      orgId,
      accountId,
    ],
  },
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => mockSelect(...args),
    }),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: (...args: unknown[]) => mockSetBadgeCountAsync(...args),
}));

describe('use-unread-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    realtimeCallbacks.clear();

    mockIs.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ eq: mockEq, is: mockIs });
    mockSelect.mockReturnValue({ eq: mockEq });

    mockOn.mockImplementation(
      (_type: string, filter: { event: string }, callback: RealtimeCallback) => {
        realtimeCallbacks.set(filter.event, callback);
        return { on: mockOn, subscribe: mockSubscribe };
      },
    );
    mockSubscribe.mockReturnValue({ id: 'realtime-channel' });
    mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns true for channel-level rows', () => {
    expect(
      shouldSyncChannelListsForReadStatePayload({
        new: { thread_id: null },
      }),
    ).toBe(true);
  });

  it('returns false for thread-level rows', () => {
    expect(
      shouldSyncChannelListsForReadStatePayload({
        new: { thread_id: 'thread-1' },
      }),
    ).toBe(false);
  });

  it('falls back to old row values for updates', () => {
    expect(
      shouldSyncChannelListsForReadStatePayload({
        old: { thread_id: 'thread-1' },
      }),
    ).toBe(false);
  });

  it('resolves channel_id from new or old realtime payload rows', () => {
    expect(resolveChannelIdFromPayload({ new: { channel_id: 'channel-1' } })).toBe(
      'channel-1',
    );
    expect(resolveChannelIdFromPayload({ old: { channel_id: 'channel-2' } })).toBe(
      'channel-2',
    );
  });

  it('invalidates messages query for thread-level updates with channel_id', async () => {
    renderHook(() =>
      useUnreadSync({
        orgId: 'org-1',
        profileId: 'profile-1',
        accountId: 'account-1',
      }),
    );

    await act(async () => {
      realtimeCallbacks.get('INSERT')?.({
        new: { thread_id: 'thread-1', channel_id: 'channel-1' },
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['messages', 'channel-1', 'profile-1'],
      exact: true,
    });
  });

  it('invalidates channel lists for thread-level updates so combined badges refresh', async () => {
    renderHook(() =>
      useUnreadSync({
        orgId: 'org-1',
        profileId: 'profile-1',
        accountId: 'account-1',
      }),
    );

    await act(async () => {
      realtimeCallbacks.get('UPDATE')?.({
        new: { thread_id: 'thread-1', channel_id: 'channel-1' },
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['directMessages', 'org-1', 'profile-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['learningSpaceChannels', 'org-1', 'profile-1', null],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['supervisedDirectMessages', 'org-1', 'account-1'],
    });
  });

  it('does not invalidate messages query when channel_id is missing in thread update', async () => {
    renderHook(() =>
      useUnreadSync({
        orgId: 'org-1',
        profileId: 'profile-1',
        accountId: 'account-1',
      }),
    );

    await act(async () => {
      realtimeCallbacks.get('INSERT')?.({
        new: { thread_id: 'thread-1' },
      });
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['messages', expect.any(String), 'profile-1'],
      exact: true,
    });
  });

  it('debounces badge sync when multiple channel-level events arrive quickly', async () => {
    jest.useFakeTimers();

    renderHook(() =>
      useUnreadSync({
        orgId: 'org-1',
        profileId: 'profile-1',
        accountId: 'account-1',
      }),
    );

    expect(mockSelect).toHaveBeenCalledTimes(1);
    mockSelect.mockClear();

    await act(async () => {
      realtimeCallbacks.get('INSERT')?.({
        new: { thread_id: null, channel_id: 'channel-1' },
      });
      realtimeCallbacks.get('UPDATE')?.({
        new: { thread_id: null, channel_id: 'channel-1' },
      });
      realtimeCallbacks.get('UPDATE')?.({
        new: { thread_id: null, channel_id: 'channel-1' },
      });
    });

    expect(mockSelect).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(399);
    });

    expect(mockSelect).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
