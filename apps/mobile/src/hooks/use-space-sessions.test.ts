import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSpaceSessions } from './use-space-sessions';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetchSpaceSchedules = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  fetchSpaceSchedulesByChannelId: (...args: unknown[]) =>
    mockFetchSpaceSchedules(...args),
  queryKeys: {
    spaceSchedules: (channelId: string, orgId: string) => [
      'space-sessions',
      channelId,
      orgId,
    ],
  },
}));

// ─── Test helpers ───────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const fakeSchedules: ClassScheduleVM[] = [
  {
    ids: { id: 'sched-1', orgId: 'org-1' },
    title: 'Math Class',
    startAt: '2026-03-01T10:00:00Z',
    endAt: '2026-03-01T11:00:00Z',
    status: 'scheduled',
    visibility: 'private',
    source: { kind: 'class_session', learningSpaceId: 'sp-1', channelId: 'ch-1' },
    participants: [],
    audit: { createdAt: '2026-01-01T00:00:00Z', createdBy: 'user-1' },
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpaceSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state while fetching', () => {
    // Never-resolving promise to keep the hook in loading state
    mockFetchSpaceSchedules.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useSpaceSessions('ch-1', 'org-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.schedules).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns schedules on successful fetch', async () => {
    mockFetchSpaceSchedules.mockResolvedValue(fakeSchedules);

    const { result } = renderHook(() => useSpaceSessions('ch-1', 'org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.schedules).toEqual(fakeSchedules);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array on success with no data', async () => {
    mockFetchSpaceSchedules.mockResolvedValue([]);

    const { result } = renderHook(() => useSpaceSessions('ch-1', 'org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.schedules).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns error message on fetch failure', async () => {
    mockFetchSpaceSchedules.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSpaceSessions('ch-1', 'org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.schedules).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('returns generic error message for non-Error rejections', async () => {
    mockFetchSpaceSchedules.mockRejectedValue('something went wrong');

    const { result } = renderHook(() => useSpaceSessions('ch-1', 'org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load sessions');
  });

  it('does not fetch when channelId is empty', () => {
    const { result } = renderHook(() => useSpaceSessions('', 'org-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchSpaceSchedules).not.toHaveBeenCalled();
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHook(() => useSpaceSessions('ch-1', ''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchSpaceSchedules).not.toHaveBeenCalled();
  });

  it('calls fetch with correct channelId and orgId', async () => {
    mockFetchSpaceSchedules.mockResolvedValue([]);

    renderHook(() => useSpaceSessions('ch-abc', 'org-xyz'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockFetchSpaceSchedules).toHaveBeenCalled());

    expect(mockFetchSpaceSchedules).toHaveBeenCalledWith('ch-abc', 'org-xyz');
  });
});
