import { act, renderHook } from '@testing-library/react-native';
import { useMarkRead } from './use-mark-read';

const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
const mockGetQueryData = jest.fn().mockReturnValue(undefined);
const mockMarkChannelReadState = jest.fn();
const mockMarkThreadReadState = jest.fn();
const mockApplyOptimisticChannelReadState = jest.fn();
const mockApplyOptimisticThreadReadState = jest.fn();
const mockReportMobileObservedError = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
    setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
    getQueryData: (...args: unknown[]) => mockGetQueryData(...args),
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  queryKeys: {
    messages: (channelId: string, profileId = '') => ['messages', channelId, profileId],
    channelReadState: (channelId: string, accountId: string) => [
      'channelReadState',
      channelId,
      accountId,
    ],
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
  markChannelReadState: (...args: unknown[]) => mockMarkChannelReadState(...args),
  markThreadReadState: (...args: unknown[]) => mockMarkThreadReadState(...args),
}));

jest.mock('@/lib/messages/apply-optimistic-channel-read-state', () => ({
  applyOptimisticChannelReadState: (...args: unknown[]) =>
    mockApplyOptimisticChannelReadState(...args),
  applyOptimisticThreadReadState: (...args: unknown[]) =>
    mockApplyOptimisticThreadReadState(...args),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: (...args: unknown[]) =>
    mockReportMobileObservedError(...args),
}));

const DEFAULT_PARAMS = {
  orgId: 'org-1',
  profileId: 'profile-1',
  accountId: 'account-1',
  channelId: 'channel-1',
};

describe('useMarkRead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkChannelReadState.mockResolvedValue(0);
    mockMarkThreadReadState.mockResolvedValue(undefined);
  });

  describe('markChannelRead', () => {
    it('applies optimistic state immediately with correct args', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockApplyOptimisticChannelReadState).toHaveBeenCalledWith({
        queryClient: expect.anything(),
        orgId: 'org-1',
        profileId: 'profile-1',
        accountId: 'account-1',
        channelId: 'channel-1',
        lastReadMessageId: 'msg-1',
        profileKind: undefined,
      });
    });

    it('calls markChannelReadState API with correct args', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockMarkChannelReadState).toHaveBeenCalledWith({
        orgId: 'org-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        channelId: 'channel-1',
        lastReadMessageId: 'msg-1',
      });
    });

    it('sets channelReadState query data on success', async () => {
      mockMarkChannelReadState.mockResolvedValue(3);
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['channelReadState', 'channel-1', 'account-1'],
        expect.objectContaining({
          channelId: 'channel-1',
          lastReadMessageId: 'msg-1',
          unreadCount: 3,
        }),
      );
    });

    it('invalidates channelReadState query on API error', async () => {
      mockMarkChannelReadState.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['channelReadState', 'channel-1', 'account-1'],
      });
    });

    it('does not call the API a second time with the same lastReadMessageId', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markChannelRead('msg-1');
        await result.current.markChannelRead('msg-1');
      });

      expect(mockMarkChannelReadState).toHaveBeenCalledTimes(1);
    });

    it('does nothing when channelId is empty', async () => {
      const { result } = renderHook(() =>
        useMarkRead({ ...DEFAULT_PARAMS, channelId: '' }),
      );

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockApplyOptimisticChannelReadState).not.toHaveBeenCalled();
      expect(mockMarkChannelReadState).not.toHaveBeenCalled();
    });

    it('does nothing when accountId is empty', async () => {
      const { result } = renderHook(() =>
        useMarkRead({ ...DEFAULT_PARAMS, accountId: '' }),
      );

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockApplyOptimisticChannelReadState).not.toHaveBeenCalled();
      expect(mockMarkChannelReadState).not.toHaveBeenCalled();
    });

    it('passes profileKind through to optimistic update', async () => {
      const { result } = renderHook(() =>
        useMarkRead({ ...DEFAULT_PARAMS, profileKind: 'educator' }),
      );

      await act(async () => {
        await result.current.markChannelRead('msg-1');
      });

      expect(mockApplyOptimisticChannelReadState).toHaveBeenCalledWith(
        expect.objectContaining({ profileKind: 'educator' }),
      );
    });
  });

  describe('markThreadRead', () => {
    const THREAD_INPUT = {
      orgId: 'org-1',
      channelId: 'channel-1',
      parentMessageId: 'parent-1',
      threadId: 'thread-1',
      lastReadMessageId: 'reply-1',
    };

    it('applies optimistic thread state immediately', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markThreadRead(THREAD_INPUT);
      });

      expect(mockApplyOptimisticThreadReadState).toHaveBeenCalledWith({
        queryClient: expect.anything(),
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        accountId: 'account-1',
        parentMessageId: 'parent-1',
        lastReadMessageId: 'reply-1',
      });
    });

    it('calls markThreadReadState API with correct args', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markThreadRead(THREAD_INPUT);
      });

      expect(mockMarkThreadReadState).toHaveBeenCalledWith({
        orgId: 'org-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        lastReadMessageId: 'reply-1',
      });
    });

    it('invalidates messages query on API error', async () => {
      mockMarkThreadReadState.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markThreadRead(THREAD_INPUT);
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['messages', 'channel-1', 'profile-1'],
        exact: true,
      });
    });

    it('reports the error to analytics on API failure', async () => {
      const err = new Error('server error');
      mockMarkThreadReadState.mockRejectedValue(err);
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markThreadRead(THREAD_INPUT);
      });

      expect(mockReportMobileObservedError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: err,
          source: 'mobile.messages.use_mark_read.thread_read_state_sync',
        }),
      );
    });

    it('works with undefined lastReadMessageId', async () => {
      const { result } = renderHook(() => useMarkRead(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.markThreadRead({
          orgId: 'org-1',
          channelId: 'channel-1',
          parentMessageId: 'parent-1',
          threadId: 'thread-1',
        });
      });

      expect(mockMarkThreadReadState).toHaveBeenCalledWith(
        expect.objectContaining({ lastReadMessageId: undefined }),
      );
    });
  });
});
