import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActivityFeed } from './use-activity-feed';
import type { ActivityFeedVM } from '@iconicedu/shared-types';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetchActivityFeed = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  fetchActivityFeed: (...args: unknown[]) => mockFetchActivityFeed(...args),
  queryKeys: {
    inbox: (orgId: string, profileId: string) => ['inbox', orgId, profileId],
  },
}));

const mockAccountData: Record<string, unknown> = { id: 'acc-1', org_id: 'org-1' };
const mockProfileData: Record<string, unknown> = { id: 'profile-1' };

jest.mock('./use-account', () => ({
  useAccount: () => ({ data: mockAccountData }),
}));

jest.mock('./use-profile', () => ({
  useProfile: () => ({ data: mockProfileData }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

const fakeFeed: ActivityFeedVM = {
  activeTab: 'all',
  tabs: [
    { key: 'all', label: 'All', badgeCount: 1 },
    { key: 'classes', label: 'Classes', badgeCount: 1 },
    { key: 'payment', label: 'Payment', badgeCount: 0 },
    { key: 'system', label: 'System', badgeCount: 0 },
  ],
  sections: [
    {
      label: 'Today',
      items: [
        {
          kind: 'leaf',
          ids: { id: 'item-1', orgId: 'org-1' },
          timestamps: {
            occurredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          tabKey: 'classes',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'summary.posted',
          refs: {
            actor:
              null as unknown as ActivityFeedVM['sections'][0]['items'][0]['refs']['actor'],
          },
          content: { headline: { primary: 'Priya posted a session summary' } },
          state: { isRead: false },
        },
      ],
    },
  ],
  unreadCount: 1,
  nextCursor: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('useActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state while fetching', () => {
    mockFetchActivityFeed.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns feed data on successful fetch', async () => {
    mockFetchActivityFeed.mockResolvedValue(fakeFeed);

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(fakeFeed);
  });

  it('calls fetchActivityFeed with orgId and profileId', async () => {
    mockFetchActivityFeed.mockResolvedValue(fakeFeed);

    renderHook(() => useActivityFeed(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockFetchActivityFeed).toHaveBeenCalled());

    expect(mockFetchActivityFeed).toHaveBeenCalledWith('org-1', 'profile-1');
  });

  it('does not fetch when orgId is missing', () => {
    const originalOrgId = mockAccountData.org_id;
    mockAccountData.org_id = undefined;

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchActivityFeed).not.toHaveBeenCalled();

    mockAccountData.org_id = originalOrgId;
  });

  it('does not fetch when profileId is missing', () => {
    const originalProfileId = mockProfileData.id;
    mockProfileData.id = undefined;

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchActivityFeed).not.toHaveBeenCalled();

    mockProfileData.id = originalProfileId;
  });
});
